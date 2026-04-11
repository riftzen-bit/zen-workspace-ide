import type { AIProviderType } from '../store/useSettingsStore'
import { useSettingsStore } from '../store/useSettingsStore'

export interface ResolvedAIRequestConfig {
  provider: AIProviderType
  model: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
}

export function resolveAIRequestConfig(): ResolvedAIRequestConfig {
  const settings = useSettingsStore.getState()
  const provider = settings.activeProvider
  const model = settings.modelPerProvider[provider]

  if (provider === 'gemini') {
    return {
      provider,
      model,
      apiKey: settings.geminiOAuthActive ? undefined : settings.geminiApiKey,
      useGeminiOAuth: settings.geminiOAuthActive
    }
  }

  if (provider === 'openai') {
    return {
      provider,
      model,
      apiKey: settings.openaiApiKey
    }
  }

  if (provider === 'anthropic') {
    return {
      provider,
      model,
      apiKey: settings.anthropicApiKey
    }
  }

  if (provider === 'groq') {
    return {
      provider,
      model,
      apiKey: settings.groqApiKey
    }
  }

  return {
    provider,
    model,
    ollamaUrl: settings.ollamaUrl
  }
}

export function hasUsableAICredentials(config: ResolvedAIRequestConfig): boolean {
  if (config.provider === 'ollama') {
    return Boolean(config.ollamaUrl)
  }

  if (config.provider === 'gemini' && config.useGeminiOAuth) {
    return true
  }

  return Boolean(config.apiKey)
}
