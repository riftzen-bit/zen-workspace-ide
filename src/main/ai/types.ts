export type AIProviderType = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama'

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
  workspaceDir?: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
  messages: AIMessage[]
}

export interface AICompleteParams {
  provider: AIProviderType
  model: string
  prompt: string
  workspaceDir?: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
  systemPrompt?: string
}

export interface AIGenerateTestParams {
  filePath: string
  workspaceDir?: string
  provider: AIProviderType
  model: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
}

export interface AIReviewParams {
  provider: AIProviderType
  model: string
  workspaceDir?: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
  filePath: string
  original: string
  modified: string
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
