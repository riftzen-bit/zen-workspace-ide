import { AIProviderType } from '../types'
import { OpenAIProvider } from './openai'

export class GroqProvider extends OpenAIProvider {
  readonly type: AIProviderType = 'groq'

  protected get baseUrl(): string {
    return 'https://api.groq.com/openai/v1'
  }
}
