import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GroqProvider } from '../../../../src/main/ai/providers/groq'

describe('GroqProvider', () => {
  let provider: GroqProvider
  beforeEach(() => {
    provider = new GroqProvider()
  })

  it('has correct type', () => {
    expect(provider.type).toBe('groq')
  })

  it('uses Groq API base URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'))
          controller.close()
        }
      })
    })

    await provider.streamChat(
      [{ role: 'user', content: 'Hi' }],
      'llama-3.3-70b-versatile',
      'gsk-test',
      () => {}
    )

    const call = vi.mocked(fetch).mock.calls[0]
    expect(call[0]).toContain('api.groq.com')
    expect(call[0]).not.toContain('api.openai.com')
  })

  it('sends OpenAI-compatible request format', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'))
          controller.close()
        }
      })
    })

    await provider.streamChat(
      [{ role: 'user', content: 'Hello' }],
      'llama-3.1-8b-instant',
      'gsk-key',
      () => {}
    )

    const call = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(call[1]?.body as string)
    expect(body.model).toBe('llama-3.1-8b-instant')
    expect(body.stream).toBe(true)
    expect(body.messages[0].role).toBe('user')
  })
})
