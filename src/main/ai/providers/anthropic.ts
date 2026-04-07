import { AIMessage, AIProvider, AIStreamChunk, AIProviderType } from '../types'

export class AnthropicProvider implements AIProvider {
  readonly type: AIProviderType = 'anthropic'

  async streamChat(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    // Separate system messages from chat messages
    const systemMessages = messages.filter((m) => m.role === 'system')
    const chatMessages = messages.filter((m) => m.role !== 'system')
    const system = systemMessages.map((m) => m.content).join('\n')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system: system || undefined,
        messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        stream: true
      }),
      signal
    })

    if (!response.ok) {
      const err = await response.text()
      onChunk({ type: 'error', error: `Anthropic error ${response.status}: ${err}` })
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
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            onChunk({ type: 'text', text: parsed.delta.text })
          }
        } catch {
          // skip malformed
        }
      }
    }

    onChunk({ type: 'done' })
  }
}
