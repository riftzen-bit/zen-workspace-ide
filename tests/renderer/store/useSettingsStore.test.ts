import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'

vi.mock('../../../src/renderer/src/store/electronZustandStorage', () => ({
  electronZustandStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock window.api including secureStore for tests
Object.defineProperty(window, 'api', {
  value: {
    secureStore: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    }
  },
  writable: true
})

import { useSettingsStore } from '../../../src/renderer/src/store/useSettingsStore'

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      geminiApiKey: '',
      autoPlayVibe: true,
      fontSize: 14,
      wordWrap: true,
      activeProvider: 'gemini',
      openaiApiKey: '',
      anthropicApiKey: '',
      groqApiKey: '',
      ollamaUrl: 'http://localhost:11434',
      geminiOAuthActive: false,
      geminiOAuthEmail: '',
      modelPerProvider: {
        gemini: 'gemini-3-flash',
        openai: 'gpt-5',
        anthropic: 'claude-sonnet-4-6',
        groq: 'llama-3.3-70b-versatile',
        ollama: 'gemma3:12b'
      }
    } as ReturnType<typeof useSettingsStore.getState>)
  })

  it('has correct default values', () => {
    const state = useSettingsStore.getState()
    expect(state.activeProvider).toBe('gemini')
    expect(state.fontSize).toBe(14)
    expect(state.autoPlayVibe).toBe(true)
    expect(state.wordWrap).toBe(true)
    expect(state.ollamaUrl).toBe('http://localhost:11434')
    expect(state.geminiOAuthActive).toBe(false)
  })

  it('setActiveProvider updates provider', () => {
    act(() => {
      useSettingsStore.getState().setActiveProvider('openai')
    })
    expect(useSettingsStore.getState().activeProvider).toBe('openai')
  })

  it('setGeminiApiKey updates key', () => {
    act(() => {
      useSettingsStore.getState().setGeminiApiKey('AIzaSy-test')
    })
    expect(useSettingsStore.getState().geminiApiKey).toBe('AIzaSy-test')
  })

  it('setOpenaiApiKey updates key', () => {
    act(() => {
      useSettingsStore.getState().setOpenaiApiKey('sk-test-key')
    })
    expect(useSettingsStore.getState().openaiApiKey).toBe('sk-test-key')
  })

  it('setAnthropicApiKey updates key', () => {
    act(() => {
      useSettingsStore.getState().setAnthropicApiKey('sk-ant-test')
    })
    expect(useSettingsStore.getState().anthropicApiKey).toBe('sk-ant-test')
  })

  it('setGroqApiKey updates key', () => {
    act(() => {
      useSettingsStore.getState().setGroqApiKey('gsk-test')
    })
    expect(useSettingsStore.getState().groqApiKey).toBe('gsk-test')
  })

  it('setOllamaUrl updates url', () => {
    act(() => {
      useSettingsStore.getState().setOllamaUrl('http://192.168.1.100:11434')
    })
    expect(useSettingsStore.getState().ollamaUrl).toBe('http://192.168.1.100:11434')
  })

  it('setGeminiOAuthActive updates auth state', () => {
    act(() => {
      useSettingsStore.getState().setGeminiOAuthActive(true, 'user@gmail.com')
    })
    const state = useSettingsStore.getState()
    expect(state.geminiOAuthActive).toBe(true)
    expect(state.geminiOAuthEmail).toBe('user@gmail.com')
  })

  it('setModelForProvider updates only the specified provider model', () => {
    act(() => {
      useSettingsStore.getState().setModelForProvider('openai', 'o3')
    })
    const { modelPerProvider } = useSettingsStore.getState()
    expect(modelPerProvider.openai).toBe('o3')
    expect(modelPerProvider.gemini).toBe('gemini-3-flash') // unchanged
    expect(modelPerProvider.anthropic).toBe('claude-sonnet-4-6') // unchanged
  })

  it('setFontSize updates font size', () => {
    act(() => {
      useSettingsStore.getState().setFontSize(16)
    })
    expect(useSettingsStore.getState().fontSize).toBe(16)
  })

  it('setWordWrap toggles word wrap', () => {
    act(() => {
      useSettingsStore.getState().setWordWrap(false)
    })
    expect(useSettingsStore.getState().wordWrap).toBe(false)
  })
})
