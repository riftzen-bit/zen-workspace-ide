export type AIProviderType = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama' | 'antigravity'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIStreamChunk {
  type: 'text' | 'done' | 'error'
  text?: string
  error?: string
}

export interface AIChatParams {
  provider: AIProviderType
  model: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
  messages: AIMessage[]
}

export interface AIProvider {
  readonly type: AIProviderType
  streamChat(
    messages: AIMessage[],
    model: string,
    credential: string,
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void>
}
