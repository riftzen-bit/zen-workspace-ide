import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export type AIProviderType = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama' | 'antigravity'

interface SettingsState {
  // Existing
  geminiApiKey: string
  autoPlayVibe: boolean
  fontSize: number
  wordWrap: boolean

  // Multi-provider
  activeProvider: AIProviderType
  openaiApiKey: string
  anthropicApiKey: string
  groqApiKey: string
  ollamaUrl: string
  googleClientId: string
  googleClientSecret: string
  googleOAuthActive: boolean
  googleOAuthEmail: string
  antigravityOAuthActive: boolean
  antigravityOAuthEmail: string
  geminiOAuthActive: boolean
  geminiOAuthEmail: string
  modelPerProvider: {
    gemini: string
    openai: string
    anthropic: string
    groq: string
    ollama: string
    antigravity: string
  }

  // Music (Lyria) — separate from chat API key
  lyriaApiKey: string
  setLyriaApiKey: (key: string) => void

  // Setters
  setGeminiApiKey: (key: string) => void
  setAutoPlayVibe: (autoPlay: boolean) => void
  setFontSize: (size: number) => void
  setWordWrap: (wrap: boolean) => void
  setActiveProvider: (provider: AIProviderType) => void
  setOpenaiApiKey: (key: string) => void
  setAnthropicApiKey: (key: string) => void
  setGroqApiKey: (key: string) => void
  setOllamaUrl: (url: string) => void
  setGoogleClientId: (id: string) => void
  setGoogleClientSecret: (secret: string) => void
  setGoogleOAuthActive: (active: boolean, email?: string) => void
  setAntigravityOAuthActive: (active: boolean, email?: string) => void
  setGeminiOAuthActive: (active: boolean, email?: string) => void
  setModelForProvider: (provider: AIProviderType, model: string) => void

  // Loads API keys from encrypted storage (called once on rehydration)
  loadSecureKeys: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Existing defaults
      geminiApiKey: '',
      lyriaApiKey: '',
      autoPlayVibe: true,
      fontSize: 14,
      wordWrap: true,

      // Multi-provider defaults
      activeProvider: 'gemini',
      openaiApiKey: '',
      anthropicApiKey: '',
      groqApiKey: '',
      ollamaUrl: 'http://localhost:11434',
      googleClientId: '',
      googleClientSecret: '',
      googleOAuthActive: false,
      googleOAuthEmail: '',
      antigravityOAuthActive: false,
      antigravityOAuthEmail: '',
      geminiOAuthActive: false,
      geminiOAuthEmail: '',
      modelPerProvider: {
        gemini: 'gemini-2.5-flash',
        openai: 'gpt-5',
        anthropic: 'claude-sonnet-4-6',
        groq: 'llama-3.3-70b-versatile',
        ollama: 'gemma3:12b',
        antigravity: 'gemini-2.5-flash'
      },

      setLyriaApiKey: (key) => {
        set({ lyriaApiKey: key })
        window.api.secureStore.set('lyriaApiKey', key).catch(() => {})
      },
      setGeminiApiKey: (key) => {
        set({ geminiApiKey: key })
        window.api.secureStore.set('geminiApiKey', key).catch(() => {})
      },
      setAutoPlayVibe: (autoPlay) => set({ autoPlayVibe: autoPlay }),
      setFontSize: (size) => set({ fontSize: size }),
      setWordWrap: (wrap) => set({ wordWrap: wrap }),
      setActiveProvider: (provider) => set({ activeProvider: provider }),
      setOpenaiApiKey: (key) => {
        set({ openaiApiKey: key })
        window.api.secureStore.set('openaiApiKey', key).catch(() => {})
      },
      setAnthropicApiKey: (key) => {
        set({ anthropicApiKey: key })
        window.api.secureStore.set('anthropicApiKey', key).catch(() => {})
      },
      setGroqApiKey: (key) => {
        set({ groqApiKey: key })
        window.api.secureStore.set('groqApiKey', key).catch(() => {})
      },
      setOllamaUrl: (url) => set({ ollamaUrl: url }),
      setGoogleClientId: (id) => {
        set({ googleClientId: id })
        window.api.secureStore.set('googleClientId', id).catch(() => {})
      },
      setGoogleClientSecret: (secret) => {
        set({ googleClientSecret: secret })
        window.api.secureStore.set('googleClientSecret', secret).catch(() => {})
      },
      setGoogleOAuthActive: (active, email) =>
        set({ googleOAuthActive: active, googleOAuthEmail: email ?? '' }),
      setAntigravityOAuthActive: (active, email) =>
        set({ antigravityOAuthActive: active, antigravityOAuthEmail: email ?? '' }),
      setGeminiOAuthActive: (active, email) =>
        set({ geminiOAuthActive: active, geminiOAuthEmail: email ?? '' }),
      setModelForProvider: (provider, model) =>
        set((state) => ({
          modelPerProvider: { ...state.modelPerProvider, [provider]: model }
        })),

      loadSecureKeys: async () => {
        if (!window.api?.secureStore) return
        const [gemini, openai, anthropic, groq, googleClientId, googleClientSecret, lyria] =
          await Promise.all([
            window.api.secureStore.get('geminiApiKey'),
            window.api.secureStore.get('openaiApiKey'),
            window.api.secureStore.get('anthropicApiKey'),
            window.api.secureStore.get('groqApiKey'),
            window.api.secureStore.get('googleClientId'),
            window.api.secureStore.get('googleClientSecret'),
            window.api.secureStore.get('lyriaApiKey')
          ])
        set({
          geminiApiKey: gemini ?? '',
          openaiApiKey: openai ?? '',
          anthropicApiKey: anthropic ?? '',
          groqApiKey: groq ?? '',
          googleClientId: googleClientId ?? '',
          googleClientSecret: googleClientSecret ?? '',
          lyriaApiKey: lyria ?? ''
        })
      }
    }),
    {
      name: 'vibe-ide-settings',
      storage: createJSONStorage(() => electronZustandStorage),
      // Persist only non-sensitive, non-action fields
      partialize: (state) => ({
        autoPlayVibe: state.autoPlayVibe,
        fontSize: state.fontSize,
        wordWrap: state.wordWrap,
        activeProvider: state.activeProvider,
        ollamaUrl: state.ollamaUrl,
        googleOAuthActive: state.googleOAuthActive,
        googleOAuthEmail: state.googleOAuthEmail,
        antigravityOAuthActive: state.antigravityOAuthActive,
        antigravityOAuthEmail: state.antigravityOAuthEmail,
        geminiOAuthActive: state.geminiOAuthActive,
        geminiOAuthEmail: state.geminiOAuthEmail,
        modelPerProvider: state.modelPerProvider
      }),
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<SettingsState>) }),
      onRehydrateStorage: () => async (state) => {
        if (state) {
          await state.loadSecureKeys()
        }
      }
    }
  )
)
