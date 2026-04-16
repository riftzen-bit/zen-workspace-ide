import { AIMessage, AIProvider, AIStreamChunk, AIProviderType } from '../types'

const BASE_URL = 'https://api.openai.com/v1'

export class OpenAIProvider implements AIProvider {
  readonly type: AIProviderType = 'openai'

  protected get baseUrl(): string {
    return BASE_URL
  }

  async streamChat(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true
      }),
      signal
    })

    if (!response.ok) {
      const err = await response.text()
      onChunk({ type: 'error', error: `OpenAI error ${response.status}: ${err}` })
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onChunk({ type: 'error', error: 'No response body' })
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done || signal?.aborted) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const text = parsed?.choices?.[0]?.delta?.content
          if (text) onChunk({ type: 'text', text })
        } catch {
          // skip malformed
        }
      }
    }

    if (!signal?.aborted) {
      onChunk({ type: 'done' })
    }
  }
}
