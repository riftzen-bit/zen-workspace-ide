import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaProvider } from '../../../../src/main/ai/providers/ollama'
import { AIStreamChunk } from '../../../../src/main/ai/types'

function makeJSONStream(lines: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new TextEncoder().encode(line + '\n'))
      }
      controller.close()
    }
  })
}

describe('OllamaProvider', () => {
  let provider: OllamaProvider
  beforeEach(() => {
    provider = new OllamaProvider()
  })

  it('has correct type', () => {
    expect(provider.type).toBe('ollama')
  })

  it('streams text chunks from Ollama JSON format', async () => {
    const lines = [
      JSON.stringify({ message: { content: 'Hello' }, done: false }),
      JSON.stringify({ message: { content: ' world' }, done: false }),
      JSON.stringify({ message: { content: '' }, done: true })
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeJSONStream(lines)
    })

    const chunks: AIStreamChunk[] = []
    await provider.streamChat(
      [{ role: 'user', content: 'Hi' }],
      'llama3',
      'http://localhost:11434',
      (chunk) => chunks.push(chunk)
    )

    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks[0].text).toBe('Hello')
    expect(textChunks[1].text).toBe(' world')
    const doneChunks = chunks.filter((c) => c.type === 'done')
    expect(doneChunks.length).toBeGreaterThan(0)
  })

  it('uses the provided base URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeJSONStream([JSON.stringify({ message: { content: '' }, done: true })])
    })

    await provider.streamChat(
      [{ role: 'user', content: 'Hi' }],
      'llama3',
      'http://192.168.1.100:11434',
      () => {}
    )

    const call = vi.mocked(fetch).mock.calls[0]
    expect(call[0]).toBe('http://192.168.1.100:11434/api/chat')
  })

  it('strips trailing slash from URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeJSONStream([JSON.stringify({ message: { content: '' }, done: true })])
    })

    await provider.streamChat(
      [{ role: 'user', content: 'Hi' }],
      'llama3',
      'http://localhost:11434/',
      () => {}
    )

    const call = vi.mocked(fetch).mock.calls[0]
    expect(call[0]).toBe('http://localhost:11434/api/chat')
  })

  it('emits error on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Model not found'
    })

    const chunks: AIStreamChunk[] = []
    await provider.streamChat(
      [{ role: 'user', content: 'Hi' }],
      'nonexistent-model',
      'http://localhost:11434',
      (chunk) => chunks.push(chunk)
    )

    expect(chunks[0].type).toBe('error')
    expect(chunks[0].error).toContain('404')
  })
})
