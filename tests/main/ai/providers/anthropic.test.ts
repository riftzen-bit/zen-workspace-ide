import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicProvider } from '../../../../src/main/ai/providers/anthropic'
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

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider
  beforeEach(() => {
    provider = new AnthropicProvider()
  })

  it('has correct type', () => {
    expect(provider.type).toBe('anthropic')
  })

  it('streams text chunks from content_block_delta events', async () => {
    const sseLines = [
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}',
      'data: {"type":"message_stop"}'
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(sseLines)
    })

    const chunks: AIStreamChunk[] = []
    await provider.streamChat(
      [{ role: 'user', content: 'Hello' }],
      'claude-sonnet-4-20250514',
      'sk-ant-test',
      (chunk) => chunks.push(chunk)
    )

    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(2)
    expect(textChunks[0].text).toBe('Hi')
    expect(textChunks[1].text).toBe(' there')
  })

  it('separates system messages correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: {"type":"message_stop"}'])
    })

    await provider.streamChat(
      [
        { role: 'system', content: 'You are Zen AI' },
        { role: 'user', content: 'Hello' }
      ],
      'claude-sonnet-4-20250514',
      'sk-ant-test',
      () => {}
    )

    const call = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(call[1]?.body as string)
    expect(body.system).toBe('You are Zen AI')
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].role).toBe('user')
  })

  it('emits error chunk on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden'
    })

    const chunks: AIStreamChunk[] = []
    await provider.streamChat(
      [{ role: 'user', content: 'Hi' }],
      'claude-sonnet-4-20250514',
      'bad-key',
      (chunk) => chunks.push(chunk)
    )

    expect(chunks[0].type).toBe('error')
    expect(chunks[0].error).toContain('403')
  })

  it('sends correct Anthropic headers', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: {"type":"message_stop"}'])
    })

    await provider.streamChat(
      [{ role: 'user', content: 'Hi' }],
      'claude-haiku-4-5-20251001',
      'sk-ant-123',
      () => {}
    )

    const call = vi.mocked(fetch).mock.calls[0]
    const headers = call[1]?.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-123')
    expect(headers['anthropic-version']).toBe('2023-06-01')
  })
})
