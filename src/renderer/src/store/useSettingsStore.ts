import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export type AIProviderType = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama'

interface SettingsState {
  // Existing
  geminiApiKey: string
  autoPlayVibe: boolean
  fontSize: number
  wordWrap: boolean
  smartContextEnabled: boolean
  inlineCompletionEnabled: boolean
  adaptiveAmbientEnabled: boolean
  agentBudgetLimit: number | null
  autoPauseAgentBudget: boolean

  // Multi-provider
  activeProvider: AIProviderType
  openaiApiKey: string
  anthropicApiKey: string
  groqApiKey: string
  ollamaUrl: string
  googleClientId: string
  googleClientSecret: string
  geminiOAuthActive: boolean
  geminiOAuthEmail: string
  modelPerProvider: {
    gemini: string
    openai: string
    anthropic: string
    groq: string
    ollama: string
  }

  // Music (Lyria) -- separate from chat API key
  lyriaApiKey: string
  setLyriaApiKey: (key: string) => void

  // Custom Location for Weather/Time
  customLocation: string
  setCustomLocation: (location: string) => void

  // Setters
  setGeminiApiKey: (key: string) => void
  setAutoPlayVibe: (autoPlay: boolean) => void
  setFontSize: (size: number) => void
  setWordWrap: (wrap: boolean) => void
  setSmartContextEnabled: (enabled: boolean) => void
  setInlineCompletionEnabled: (enabled: boolean) => void
  setAdaptiveAmbientEnabled: (enabled: boolean) => void
  setAgentBudgetLimit: (limit: number | null) => void
  setAutoPauseAgentBudget: (enabled: boolean) => void
  setActiveProvider: (provider: AIProviderType) => void
  setOpenaiApiKey: (key: string) => void
  setAnthropicApiKey: (key: string) => void
  setGroqApiKey: (key: string) => void
  setOllamaUrl: (url: string) => void
  setGoogleClientId: (id: string) => void
  setGoogleClientSecret: (secret: string) => void
  setGeminiOAuthActive: (active: boolean, email?: string) => void
  setModelForProvider: (provider: AIProviderType, model: string) => void

  loadSecureKeys: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Existing defaults
      geminiApiKey: '',
      lyriaApiKey: '',
      customLocation: '',
      autoPlayVibe: true,
      fontSize: 14,
      wordWrap: true,
      smartContextEnabled: true,
      inlineCompletionEnabled: true,
      adaptiveAmbientEnabled: false,
      agentBudgetLimit: null,
      autoPauseAgentBudget: false,

      // Multi-provider defaults
      activeProvider: 'gemini',
      openaiApiKey: '',
      anthropicApiKey: '',
      groqApiKey: '',
      ollamaUrl: 'http://localhost:11434',
      googleClientId: '',
      googleClientSecret: '',
      geminiOAuthActive: false,
      geminiOAuthEmail: '',
      modelPerProvider: {
        gemini: 'gemini-2.5-flash',
        openai: 'gpt-5',
        anthropic: 'claude-sonnet-4-6',
        groq: 'llama-3.3-70b-versatile',
        ollama: 'gemma3:12b'
      },

      setLyriaApiKey: (key) => {
        set({ lyriaApiKey: key })
        window.api.secureStore.set('lyriaApiKey', key).catch(() => {})
      },
      setGeminiApiKey: (key) => {
        set({ geminiApiKey: key })
        window.api.secureStore.set('geminiApiKey', key).catch(() => {})
      },
      setCustomLocation: (location) => set({ customLocation: location }),
      setAutoPlayVibe: (autoPlay) => set({ autoPlayVibe: autoPlay }),
      setFontSize: (size) => set({ fontSize: size }),
      setWordWrap: (wrap) => set({ wordWrap: wrap }),
      setSmartContextEnabled: (enabled) => set({ smartContextEnabled: enabled }),
      setInlineCompletionEnabled: (enabled) => set({ inlineCompletionEnabled: enabled }),
      setAdaptiveAmbientEnabled: (enabled) => set({ adaptiveAmbientEnabled: enabled }),
      setAgentBudgetLimit: (limit) => set({ agentBudgetLimit: limit }),
      setAutoPauseAgentBudget: (enabled) => set({ autoPauseAgentBudget: enabled }),
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
      partialize: (state) => ({
        customLocation: state.customLocation,
        autoPlayVibe: state.autoPlayVibe,
        fontSize: state.fontSize,
        wordWrap: state.wordWrap,
        smartContextEnabled: state.smartContextEnabled,
        inlineCompletionEnabled: state.inlineCompletionEnabled,
        adaptiveAmbientEnabled: state.adaptiveAmbientEnabled,
        agentBudgetLimit: state.agentBudgetLimit,
        autoPauseAgentBudget: state.autoPauseAgentBudget,
        activeProvider: state.activeProvider,
        ollamaUrl: state.ollamaUrl,
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
