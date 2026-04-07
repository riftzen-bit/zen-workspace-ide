import { AIMessage, AIProvider, AIStreamChunk, AIProviderType } from '../types'
import { GoogleGenerativeAI } from '@google/generative-ai'

export class GeminiProvider implements AIProvider {
  readonly type: AIProviderType = 'gemini'

  async streamChat(
    messages: AIMessage[],
    model: string,
    credential: string,
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (credential.startsWith('oauth:')) {
      const oauthPart = credential.slice(6)
      const pipeIdx = oauthPart.indexOf('|')
      const token = pipeIdx >= 0 ? oauthPart.slice(0, pipeIdx) : oauthPart
      const projectId = pipeIdx >= 0 ? oauthPart.slice(pipeIdx + 1) : undefined
      await this._streamWithOAuthToken(messages, model, token, onChunk, signal, projectId)
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

    // Convert messages to Gemini format
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
    projectId?: string
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

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    if (projectId) {
      headers['x-goog-user-project'] = projectId
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal
      }
    )

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      if (response.status === 403) {
        throw new Error(
          `Gemini auth error (403): ${errText || 'Sign out and re-sign in with Google in Settings to grant AI access'}`
        )
      }
      throw new Error(`Gemini OAuth error ${response.status}: ${errText}`)
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
        if (!line.startsWith('data: ')) continue
        const dataStr = line.slice(6).trim()
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
  }
}
