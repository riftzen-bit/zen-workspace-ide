import { AIMessage, AIProvider, AIStreamChunk, AIProviderType } from '../types'

export class OllamaProvider implements AIProvider {
  readonly type: AIProviderType = 'ollama'

  async streamChat(
    messages: AIMessage[],
    model: string,
    baseUrl: string,
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const url = baseUrl.replace(/\/$/, '')

    const response = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true
      }),
      signal
    })

    if (!response.ok) {
      const err = await response.text()
      onChunk({ type: 'error', error: `Ollama error ${response.status}: ${err}` })
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
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          const text = parsed?.message?.content
          if (text) onChunk({ type: 'text', text })
        } catch {
          // skip malformed
        }
      }
    }

    onChunk({ type: 'done' })
  }
}
