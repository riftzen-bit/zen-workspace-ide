import { AIMessage, AIProvider, AIStreamChunk, AIProviderType } from '../types'

const CLOUDCODE_ENDPOINT = 'https://cloudcode-pa.googleapis.com'

function buildVSCodeHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'antigravity/1.15.8 darwin/arm64',
    'X-Goog-Api-Client': 'google-cloud-sdk vscode/1.96.0',
    'Client-Metadata': JSON.stringify({
      ideType: 'VSCODE',
      platform: 'PLATFORM_UNSPECIFIED',
      pluginType: 'GEMINI',
      osVersion: '15.1',
      arch: 'arm64'
    })
  }
}

function buildGeminiCliHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'gemini-cli',
    'Client-Metadata': JSON.stringify({
      ideType: 'IDE_UNSPECIFIED',
      platform: 'PLATFORM_UNSPECIFIED',
      pluginType: 'GEMINI'
    })
  }
}

function resolveGeminiModel(model: string, isGeminiCli: boolean): string {
  if (!isGeminiCli) return model

  // Map generic names to standard preview models since they have Ultra rate limits on CloudCode API
  switch (model) {
    case 'gemini-2.5-pro':
    case 'pro':
      return 'gemini-3-pro-preview'
    case 'gemini-2.5-flash':
    case 'flash':
      return 'gemini-3-flash-preview'
    case 'gemini-2.5-flash-lite':
    case 'flash-lite':
      return 'gemini-3.1-flash-lite-preview'
    default:
      return model
  }
}

export class AntigravityProvider implements AIProvider {
  readonly type: AIProviderType = 'antigravity'

  async streamChat(
    messages: AIMessage[],
    model: string,
    credential: string, // format: "TOKEN|PROJECT_ID" or "gemini-cli:TOKEN|PROJECT_ID"
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    return this._streamChatWithRetry(messages, model, credential, onChunk, signal, 0)
  }

  private async _streamChatWithRetry(
    messages: AIMessage[],
    model: string,
    credential: string,
    onChunk: (chunk: AIStreamChunk) => void,
    signal: AbortSignal | undefined,
    retries: number
  ): Promise<void> {
    const isGeminiCli = credential.startsWith('gemini-cli:')
    const credPart = isGeminiCli ? credential.slice(11) : credential
    const sep = credPart.indexOf('|')
    if (sep === -1) {
      throw new Error('Invalid credential format — expected TOKEN|PROJECT_ID')
    }
    const token = credPart.slice(0, sep)
    const projectId = credPart.slice(sep + 1)

    // Choose correct headers to bypass strict non-IDE rate limits while avoiding 403 on Gemini OAuth
    const headers = isGeminiCli ? buildGeminiCliHeaders(token) : buildVSCodeHeaders(token)

    // Resolve model mappings correctly to trigger Ultra tiers for Gemini CLI
    const resolvedModel = resolveGeminiModel(model, isGeminiCli)

    const systemMessage = messages.find((m) => m.role === 'system')
    const chatMessages = messages.filter((m) => m.role !== 'system')

    const contents = chatMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const innerRequest: Record<string, unknown> = { contents }
    if (systemMessage) {
      innerRequest.systemInstruction = { parts: [{ text: systemMessage.content }] }
    }

    const body: Record<string, unknown> = {
      project: projectId,
      model: resolvedModel,
      request: innerRequest
    }

    if (isGeminiCli) {
      // Opt-in to Google One AI Premium tier credits (bypasses standard free tier limits)
      body.enabled_credit_types = ['GOOGLE_ONE_AI']
    }

    const response = await fetch(`${CLOUDCODE_ENDPOINT}/v1internal:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    })

    if (!response.ok) {
      const err = await response.text().catch(() => '')
      const label = isGeminiCli ? 'Gemini' : 'Antigravity'
      if (response.status === 401 || response.status === 403) {
        const settingsPath = isGeminiCli ? 'Settings → Gemini' : 'Settings → Antigravity'
        if (err.includes('PERMISSION_DENIED') && err.includes(resolvedModel)) {
          throw new Error(
            `${label} auth error: Your account doesn't have permission to use the ${resolvedModel} model. Try switching to a different model.`
          )
        }
        throw new Error(
          `${label} auth expired — sign out and re-sign in via ${settingsPath}${err ? `: ${err.slice(0, 200)}` : ''}`
        )
      }

      if (response.status === 429) {
        let resetTime = 'a while'
        let resetTimeSec = 60 // default to 60s if we can't parse
        try {
          const parsed = JSON.parse(err)
          const msg = parsed?.error?.message || ''
          const match = msg.match(/reset after (\d+s)/)
          if (match) {
            resetTime = match[1]
            resetTimeSec = parseInt(match[1].replace('s', ''), 10)
          }
        } catch {
          // ignore
        }

        // Auto-retry for 429 limits to preserve tool-calling loops
        // Only auto-retry if the wait is very short, otherwise fail fast.
        if (retries < 4 && resetTimeSec <= 10) {
          await new Promise((resolve) => setTimeout(resolve, resetTimeSec * 1000 + 1000))
          if (signal?.aborted) return
          return this._streamChatWithRetry(
            messages,
            model,
            credential,
            onChunk,
            signal,
            retries + 1
          )
        }

        throw new Error(
          `${label} Rate Limit Active. To prevent spam, Google limits how fast you can send requests. Please wait ${resetTime} before trying again.`
        )
      }

      throw new Error(`${label} error ${response.status}: ${err.slice(0, 200)}`)
    }

    if (!response.body) throw new Error('No response body from Antigravity')

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
            response?: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
          }
          const inner = data.response ?? data
          const text = inner.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) onChunk({ type: 'text', text })
        } catch {
          // ignore malformed lines
        }
      }
    }

    onChunk({ type: 'done' })
  }
}
