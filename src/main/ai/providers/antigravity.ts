import { AIMessage, AIProvider, AIStreamChunk, AIProviderType } from '../types'

const CLOUDCODE_ENDPOINT = 'https://cloudcode-pa.googleapis.com'

function buildVSCodeHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'antigravity/1.15.8 darwin/arm64',
    'X-Goog-Api-Client': 'google-cloud-sdk vscode/1.96.0',
    'Client-Metadata': JSON.stringify({
      ideType: 'VSCODE',
      platform: 'MACOS',
      pluginType: 'GEMINI',
      osVersion: '15.1',
      arch: 'arm64'
    })
  }
}

function buildGeminiCliHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export class AntigravityProvider implements AIProvider {
  readonly type: AIProviderType = 'antigravity'

  async streamChat(
    messages: AIMessage[],
    model: string,
    credential: string, // format: "TOKEN|PROJECT_ID" or "gemini-cli:TOKEN|PROJECT_ID"
    onChunk: (chunk: AIStreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const isGeminiCli = credential.startsWith('gemini-cli:')
    const credPart = isGeminiCli ? credential.slice(11) : credential
    const sep = credPart.indexOf('|')
    if (sep === -1) {
      throw new Error('Invalid credential format — expected TOKEN|PROJECT_ID')
    }
    const token = credPart.slice(0, sep)
    const projectId = credPart.slice(sep + 1)
    const headers = isGeminiCli ? buildGeminiCliHeaders(token) : buildVSCodeHeaders(token)

    const systemMessage = messages.find((m) => m.role === 'system')
    const chatMessages = messages.filter((m) => m.role !== 'system')

    const contents = chatMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const innerRequest: Record<string, unknown> = { contents }
    if (systemMessage) {
      innerRequest.systemInstruction = { parts: [{ text: systemMessage.content }] }
    }

    const body = {
      project: projectId,
      model,
      request: innerRequest
    }

    const response = await fetch(`${CLOUDCODE_ENDPOINT}/v1internal:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    })

    if (!response.ok) {
      const err = await response.text().catch(() => '')
      const label = isGeminiCli ? 'Gemini' : 'Antigravity'
      if (response.status === 401 || response.status === 403) {
        const settingsPath = isGeminiCli ? 'Settings → Gemini' : 'Settings → Antigravity'
        throw new Error(
          `${label} auth expired — sign out and re-sign in via ${settingsPath}${err ? `: ${err.slice(0, 200)}` : ''}`
        )
      }

      if (response.status === 429) {
        try {
          const parsed = JSON.parse(err)
          if (parsed?.error?.message) {
            throw new Error(
              `${label} Free Quota Exhausted: ${parsed.error.message} (Tip: Use a personal Gemini API Key in Settings to avoid this limit)`
            )
          }
        } catch {
          // ignore parse error, fallback
        }
        throw new Error(`${label} Free Quota Exhausted. Please wait or use a personal API Key.`)
      }

      throw new Error(`${label} error ${response.status}: ${err.slice(0, 200)}`)
    }

    if (!response.body) throw new Error('No response body from Antigravity')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (signal?.aborted) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const dataStr = line.slice(5).trim()
        if (!dataStr) continue
        try {
          const data = JSON.parse(dataStr) as {
            response?: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
          }
          const inner = data.response ?? data
          const text = inner.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) onChunk({ type: 'text', text })
        } catch {
          // ignore malformed lines
        }
      }
    }

    onChunk({ type: 'done' })
  }
}
