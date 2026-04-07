import { describe, it, expect, vi } from 'vitest'

// Mock the provider modules with proper class constructors
vi.mock('../../../src/main/ai/providers/gemini', () => ({
  GeminiProvider: class {
    type = 'gemini'
  }
}))
vi.mock('../../../src/main/ai/providers/openai', () => ({
  OpenAIProvider: class {
    type = 'openai'
  }
}))
vi.mock('../../../src/main/ai/providers/anthropic', () => ({
  AnthropicProvider: class {
    type = 'anthropic'
  }
}))
vi.mock('../../../src/main/ai/providers/groq', () => ({
  GroqProvider: class {
    type = 'groq'
  }
}))
vi.mock('../../../src/main/ai/providers/ollama', () => ({
  OllamaProvider: class {
    type = 'ollama'
  }
}))

import { getProvider } from '../../../src/main/ai/providerRegistry'

describe('providerRegistry', () => {
  it('returns a GeminiProvider for gemini', () => {
    const provider = getProvider('gemini')
    expect(provider.type).toBe('gemini')
  })

  it('returns an OpenAIProvider for openai', () => {
    const provider = getProvider('openai')
    expect(provider.type).toBe('openai')
  })

  it('returns an AnthropicProvider for anthropic', () => {
    const provider = getProvider('anthropic')
    expect(provider.type).toBe('anthropic')
  })

  it('returns a GroqProvider for groq', () => {
    const provider = getProvider('groq')
    expect(provider.type).toBe('groq')
  })

  it('returns an OllamaProvider for ollama', () => {
    const provider = getProvider('ollama')
    expect(provider.type).toBe('ollama')
  })

  it('caches provider instances', () => {
    const p1 = getProvider('openai')
    const p2 = getProvider('openai')
    expect(p1).toBe(p2)
  })

  it('throws for unknown provider', () => {
    expect(() => getProvider('unknown' as never)).toThrow('Unknown provider: unknown')
  })
})
