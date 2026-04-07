import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIProvider } from '../../../../src/main/ai/providers/openai'
import { AIStreamChunk } from '../../../../src/main/ai/types'

function makeSSEStream(lines: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new TextEncoder().encode(line + '\n'))
      }
      controller.close()
    }
  })
}

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider
  beforeEach(() => {
    provider = new OpenAIProvider()
  })

  it('has correct type', () => {
    expect(provider.type).toBe('openai')
  })

  it('streams text chunks correctly', async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      'data: [DONE]'
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(sseLines)
    })

    const chunks: AIStreamChunk[] = []
    await provider.streamChat([{ role: 'user', content: 'Hi' }], 'gpt-4o', 'sk-test', (chunk) =>
      chunks.push(chunk)
    )

    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(2)
    expect(textChunks[0].text).toBe('Hello')
    expect(textChunks[1].text).toBe(' world')
    expect(chunks[chunks.length - 1].type).toBe('done')
  })

  it('emits error chunk on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    })

    const chunks: AIStreamChunk[] = []
    await provider.streamChat([{ role: 'user', content: 'Hi' }], 'gpt-4o', 'bad-key', (chunk) =>
      chunks.push(chunk)
    )

    expect(chunks[0].type).toBe('error')
    expect(chunks[0].error).toContain('401')
  })

  it('sends correct request format', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: [DONE]'])
    })

    await provider.streamChat(
      [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' }
      ],
      'gpt-4o',
      'sk-test',
      () => {}
    )

    const call = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(call[1]?.body as string)
    expect(body.model).toBe('gpt-4o')
    expect(body.stream).toBe(true)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')

    const headers = call[1]?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer sk-test')
  })

  it('respects abort signal', async () => {
    const controller = new AbortController()

    global.fetch = vi.fn().mockImplementation(() => {
      controller.abort()
      return Promise.reject(new DOMException('Aborted', 'AbortError'))
    })

    const chunks: AIStreamChunk[] = []
    // Should not throw, just return without chunks
    await provider
      .streamChat(
        [{ role: 'user', content: 'Hello' }],
        'gpt-4o',
        'sk-test',
        (chunk) => chunks.push(chunk),
        controller.signal
      )
      .catch(() => {})

    // No text chunks should have been emitted
    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(0)
  })
})
