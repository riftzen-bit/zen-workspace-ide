import { AIMessage, AIProvider, AIStreamChunk, AIProviderType } from '../types'
import { GoogleGenerativeAI } from '@google/generative-ai'

function parseRetryDelaySeconds(errText: string, retryAfterHeader: string | null): number | null {
  if (retryAfterHeader) {
    const parsedHeader = Number.parseInt(retryAfterHeader, 10)
    if (Number.isFinite(parsedHeader) && parsedHeader > 0) {
      return parsedHeader
    }
  }

  const candidates: string[] = []
  if (errText) {
    candidates.push(errText)
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } }
      if (parsed.error?.message) candidates.push(parsed.error.message)
    } catch {
      // ignore parse errors
    }
  }

  const patterns = [/reset after (\d+)s/i, /retry after (\d+)s/i, /wait (\d+)s/i, /in (\d+)s/i]

  for (const source of candidates) {
    for (const pattern of patterns) {
      const match = source.match(pattern)
      if (!match) continue
      const secs = Number.parseInt(match[1], 10)
      if (Number.isFinite(secs) && secs > 0) return secs
    }
  }

  return null
}

function summarizeGeminiOAuthError(status: number, errText: string): string {
  const trimmed = errText.trim()
  let parsedMessage = ''
  let reason = ''

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: {
          message?: string
          status?: string
          details?: Array<{ reason?: string; metadata?: Record<string, string> }>
        }
      }
      parsedMessage = parsed.error?.message ?? ''
      reason = parsed.error?.details?.find((detail) => detail.reason)?.reason ?? ''
      if (!reason && parsed.error?.status) reason = parsed.error.status
    } catch {
      // ignore parse errors and fall back to raw text
    }
  }

  const lower = `${reason} ${parsedMessage} ${trimmed}`.toLowerCase()

  if (status === 401) {
    return 'Gemini rejected the OAuth access token. Please sign out and sign in again via Settings.'
  }

  if (lower.includes('access_token_scope_insufficient')) {
    return 'Gemini OAuth is missing required API scopes. Sign out, then sign in again so Zen Workspace can request the updated Gemini permissions.'
  }

  if (lower.includes('user_project_denied') || lower.includes('x-goog-user-project')) {
    return 'Google accepted the sign-in, but the linked Google Cloud project cannot be used for Gemini quota. Ensure the OAuth client belongs to your own project and that the Generative Language API is enabled there.'
  }

  if (
    lower.includes('serviceusage.services.use') ||
    lower.includes('caller does not have required permission to use project')
  ) {
    return 'Your Google account does not have permission to use the OAuth client project for Gemini quota. Use a project you own, or grant your account access to that project.'
  }

  if (
    lower.includes('generativelanguage.googleapis.com') &&
    lower.includes('not been used in project')
  ) {
    return 'The Generative Language API is not enabled for the Google Cloud project linked to this OAuth client. Enable the API in Google Cloud Console, then sign in again.'
  }

  if (lower.includes('api has not been used') || lower.includes('api is disabled')) {
    return 'The required Google API is disabled for your Cloud project. Enable the Generative Language API, then try again.'
  }

  if (status === 403) {
    return (
      parsedMessage ||
      'Google denied the Gemini OAuth request. Check your Cloud project setup in the Setup Guide.'
    )
  }

  return parsedMessage || trimmed || `Gemini OAuth error ${status}`
}

interface GeminiOAuthCredentialPayload {
  accessToken: string
  quotaProject?: string
}

function decodeGeminiOAuthCredential(credential: string): GeminiOAuthCredentialPayload {
  if (credential.startsWith('oauth-json:')) {
    const encoded = credential.slice('oauth-json:'.length)
    const json = Buffer.from(encoded, 'base64url').toString('utf8')
    return JSON.parse(json) as GeminiOAuthCredentialPayload
  }

  if (credential.startsWith('oauth:')) {
    return { accessToken: credential.slice(6) }
  }

  throw new Error('Invalid Gemini OAuth credential payload')
}

export class GeminiProvider implements AIProvider {
  readonly type: AIProviderType = 'gemini'

  async streamChat(
    messages: AIMessage[],
    model: string,
    credential: string,
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (credential.startsWith('oauth-json:') || credential.startsWith('oauth:')) {
      const { accessToken, quotaProject } = decodeGeminiOAuthCredential(credential)
      await this._streamWithOAuthToken(messages, model, accessToken, onChunk, signal, quotaProject)
    } else {
      await this._streamWithApiKey(messages, model, credential, onChunk, signal)
    }
  }

  private async _streamWithApiKey(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const genAI = new GoogleGenerativeAI(apiKey)
    const genModel = genAI.getGenerativeModel({ model })

    const systemMessage = messages.find((m) => m.role === 'system')
    const chatMessages = messages.filter((m) => m.role !== 'system')

    const history = chatMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const lastMessage = chatMessages[chatMessages.length - 1]

    const chat = genModel.startChat({
      history,
      systemInstruction: systemMessage
        ? { role: 'user', parts: [{ text: systemMessage.content }] }
        : undefined
    })

    const result = await chat.sendMessageStream(lastMessage?.content ?? '', { signal } as object)

    for await (const chunk of result.stream) {
      if (signal?.aborted) break
      const text = chunk.text()
      if (text) onChunk({ type: 'text', text })
    }

    onChunk({ type: 'done' })
  }

  private async _streamWithOAuthToken(
    messages: AIMessage[],
    model: string,
    token: string,
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal,
    quotaProject?: string
  ): Promise<void> {
    const systemMessage = messages.find((m) => m.role === 'system')
    const chatMessages = messages.filter((m) => m.role !== 'system')

    const contents = chatMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const body: Record<string, unknown> = { contents }
    if (systemMessage) {
      body.systemInstruction = { parts: [{ text: systemMessage.content }] }
    }
    body.generationConfig = { candidateCount: 1 }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`
    const maxRetries = 3

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(quotaProject ? { 'x-goog-user-project': quotaProject } : {})
        },
        body: JSON.stringify(body),
        signal
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')

        if (response.status === 401 || response.status === 403) {
          throw new Error(summarizeGeminiOAuthError(response.status, errText))
        }

        if (response.status === 429) {
          const waitSeconds = parseRetryDelaySeconds(errText, response.headers.get('retry-after'))
          if (waitSeconds != null && attempt < maxRetries && !signal?.aborted) {
            const waitMs = Math.min(waitSeconds, 120) * 1000 + 1000
            onChunk({
              type: 'text',
              text: `\n\n\u23F3 Rate limited \u2014 waiting ${waitSeconds}s then retrying automatically (${attempt + 1}/${maxRetries})...\n\n`
            })
            await new Promise((resolve) => setTimeout(resolve, waitMs))
            if (signal?.aborted) return
            continue
          }

          const resetTime = waitSeconds != null ? `${waitSeconds}s` : 'a while'
          throw new Error(
            `Gemini rate limit active. Please wait ${resetTime} before sending another request.`
          )
        }

        throw new Error(`Gemini OAuth error ${response.status}: ${errText.slice(0, 300)}`)
      }

      if (!response.body) throw new Error('No response body from Gemini')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (signal?.aborted) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const dataStr = line.slice(5).trim()
          if (!dataStr) continue
          try {
            const data = JSON.parse(dataStr) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
            }
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) onChunk({ type: 'text', text })
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      onChunk({ type: 'done' })
      return
    }

    throw new Error('Gemini: max retries exhausted')
  }
}
