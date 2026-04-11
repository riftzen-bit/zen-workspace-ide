import { AIProvider, AIProviderType } from './types'
import { GeminiProvider } from './providers/gemini'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { GroqProvider } from './providers/groq'
import { OllamaProvider } from './providers/ollama'

const registry = new Map<AIProviderType, AIProvider>()

export function getProvider(type: AIProviderType): AIProvider {
  if (!registry.has(type)) {
    switch (type) {
      case 'gemini':
        registry.set(type, new GeminiProvider())
        break
      case 'openai':
        registry.set(type, new OpenAIProvider())
        break
      case 'anthropic':
        registry.set(type, new AnthropicProvider())
        break
      case 'groq':
        registry.set(type, new GroqProvider())
        break
      case 'ollama':
        registry.set(type, new OllamaProvider())
        break
      default:
        throw new Error(`Unknown provider: ${type}`)
    }
  }
  return registry.get(type)!
}
