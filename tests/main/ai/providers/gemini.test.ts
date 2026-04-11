import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeminiProvider } from '../../../../src/main/ai/providers/gemini'
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

describe('GeminiProvider OAuth flow', () => {
  let provider: GeminiProvider

  beforeEach(() => {
    provider = new GeminiProvider()
    vi.restoreAllMocks()
  })

  it('routes OAuth requests to Gemini API with Bearer token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}'])
    }) as unknown as typeof fetch

    const chunks: AIStreamChunk[] = []
    await provider.streamChat(
      [{ role: 'user', content: 'Hi' }],
      'gemini-2.5-pro',
      'oauth:test-token',
      (chunk) => chunks.push(chunk)
    )

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('generativelanguage.googleapis.com')
    expect(String(url)).toContain('gemini-2.5-pro')

    const headers = (init?.headers as Record<string, string>) ?? {}
    expect(headers.Authorization).toBe('Bearer test-token')

    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(1)
    expect(textChunks[0].text).toBe('hello')
    expect(chunks[chunks.length - 1].type).toBe('done')
  })

  it('sends quota project header for structured OAuth credentials', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}'])
    }) as unknown as typeof fetch

    const payload = Buffer.from(
      JSON.stringify({ accessToken: 'test-token', quotaProject: '1234567890' }),
      'utf8'
    ).toString('base64url')

    await provider.streamChat(
      [{ role: 'user', content: 'Hi' }],
      'gemini-2.5-pro',
      `oauth-json:${payload}`,
      () => {}
    )

    const [, init] = vi.mocked(fetch).mock.calls[0]
    const headers = (init?.headers as Record<string, string>) ?? {}
    expect(headers.Authorization).toBe('Bearer test-token')
    expect(headers['x-goog-user-project']).toBe('1234567890')
  })

  it('throws re-auth guidance on OAuth 401 responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: async () => '{"error":{"status":"UNAUTHENTICATED"}}'
    }) as unknown as typeof fetch

    await expect(
      provider.streamChat(
        [{ role: 'user', content: 'Hi' }],
        'gemini-2.5-flash',
        'oauth:test-token',
        () => {}
      )
    ).rejects.toThrow('rejected the OAuth access token')
  })

  it('retries on 429 with rate limit info', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '2' }),
        text: async () => '{"error":{"message":"rate limited"}}'
      })
      .mockResolvedValueOnce({
        ok: true,
        body: makeSSEStream(['data: {"candidates":[{"content":{"parts":[{"text":"retry-ok"}]}}]}'])
      }) as unknown as typeof fetch

    const chunks: AIStreamChunk[] = []
    await provider.streamChat(
      [{ role: 'user', content: 'Hi' }],
      'gemini-2.5-flash',
      'oauth:test-token',
      (chunk) => chunks.push(chunk)
    )

    expect(fetch).toHaveBeenCalledTimes(2)
    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks.some((c) => c.text === 'retry-ok')).toBe(true)
  })

  it('throws on 403 with auth error guidance', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
      text: async () => '{"error":{"message":"forbidden"}}'
    }) as unknown as typeof fetch

    await expect(
      provider.streamChat(
        [{ role: 'user', content: 'Hi' }],
        'gemini-2.5-flash',
        'oauth:test-token',
        () => {}
      )
    ).rejects.toThrow('forbidden')
  })

  it('surfaces scope-specific OAuth guidance on 403 responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          error: {
            message: 'Request had insufficient authentication scopes.',
            details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }]
          }
        })
    }) as unknown as typeof fetch

    await expect(
      provider.streamChat(
        [{ role: 'user', content: 'Hi' }],
        'gemini-2.5-flash',
        'oauth:test-token',
        () => {}
      )
    ).rejects.toThrow('missing required API scopes')
  })
})

vi.mock('@google/generative-ai', () => {
  const sendMessageStream = vi.fn()
  const startChat = vi.fn(() => ({ sendMessageStream }))
  const getGenerativeModel = vi.fn(() => ({ startChat }))
  const GoogleGenerativeAI = vi.fn(function GoogleGenerativeAI(this: {
    getGenerativeModel: typeof getGenerativeModel
  }) {
    this.getGenerativeModel = getGenerativeModel
  })

  return {
    GoogleGenerativeAI,
    __mockedGeminiSdk: {
      sendMessageStream,
      startChat,
      getGenerativeModel
    }
  }
})

describe('GeminiProvider API key flow', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const sdk = await import('@google/generative-ai')
    sdk.__mockedGeminiSdk.sendMessageStream.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => 'hello' }
        yield { text: () => ' world' }
      })()
    })
  })

  it('uses GoogleGenerativeAI SDK when an API key is provided', async () => {
    const sdk = await import('@google/generative-ai')
    const provider = new GeminiProvider()
    const chunks: AIStreamChunk[] = []

    await provider.streamChat(
      [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' }
      ],
      'gemini-2.5-flash',
      'AIza-test-key',
      (chunk) => chunks.push(chunk)
    )

    expect(sdk.GoogleGenerativeAI).toHaveBeenCalledWith('AIza-test-key')
    expect(sdk.__mockedGeminiSdk.getGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash'
    })
    expect(sdk.__mockedGeminiSdk.startChat).toHaveBeenCalled()
    expect(sdk.__mockedGeminiSdk.sendMessageStream).toHaveBeenCalledWith(
      'Hello',
      expect.any(Object)
    )

    expect(chunks.filter((chunk) => chunk.type === 'text').map((chunk) => chunk.text)).toEqual([
      'hello',
      ' world'
    ])
    expect(chunks[chunks.length - 1].type).toBe('done')
  })
})
