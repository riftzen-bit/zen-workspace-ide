import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { AIChatParams, AIMessage } from './types'
import { getProvider } from './providerRegistry'
import { getAntigravityCredential, getGeminiOAuthCredential } from '../oauth/googleOAuth'

const SYSTEM_PROMPT = `You are "Zen AI", a sharp coding companion built into the Zen Workspace IDE. You help developers write better code while keeping the vibe relaxed and focused.

YOUR CAPABILITIES:
1. Help with code — write, debug, refactor, explain, review, and optimize code in any language.
2. Answer technical questions about frameworks, libraries, algorithms, architecture, and tooling.
3. Chat casually, brainstorm ideas, and keep the user company during long coding sessions.
4. Control the workspace's built-in Vibe Player (Music Player).

CODING STYLE:
- Be direct and concise. Developers value clarity over verbosity.
- Use markdown with proper code blocks (fenced with the language name) for all code.
- For code explanations, lead with the key insight, then elaborate if needed.
- When reviewing code in the context, point out issues clearly with line references.
- If the user provides file context (shown as \`\`\`language ... \`\`\`), use it when answering.

HONESTY & ACCURACY — NEVER FABRICATE:
- NEVER invent, fabricate, or guess facts, statistics, dates, quotes, or claims. If not confident, say "I'm not sure" or "I don't know."
- NEVER fabricate URLs, links, sources, citations, or documentation references. If you don't know a real link, say so.
- NEVER pretend to have access to real-time information, current events, or the internet. You do not browse the web.
- If the user asks a factual question and you are uncertain, clearly state your uncertainty rather than guessing.
- You may offer your best understanding with a clear caveat like "I think…" or "If I recall correctly…"

MUSIC COMMAND INSTRUCTIONS:
ONLY trigger music if the user EXPLICITLY asks you to play music, play a song, change the vibe, or listen to something. Do NOT suggest music or include [PLAY_MUSIC:...] in any other situation.

When the user explicitly asks for music, use this exact format:
[PLAY_MUSIC: <detailed youtube search query>]

Examples of VALID triggers (user explicitly asked):
- User: "Play some The Weeknd" -> You: "Setting the vibe! [PLAY_MUSIC: The Weeknd full album playlist]"
- User: "I need focus music" -> You: "Focus mode activated. [PLAY_MUSIC: deep focus coding lofi mix]"
- User: "Mở bài nhạc chill" -> You: "Bật nhạc chill ngay! [PLAY_MUSIC: nhạc chill tiktok playlist]"

CRITICAL RULES FOR MUSIC:
- NEVER proactively suggest or play music. Wait for explicit request.
- NEVER include [PLAY_MUSIC:...] unless the user directly asked for music in this message.
- When triggered, append 'playlist', 'mix', or 'full album' to the search query.

MUSIC GENERATION (Lyria AI):
When the user explicitly asks you to CREATE, GENERATE, COMPOSE, or MAKE original music, use this format:
[GENERATE_MUSIC: <detailed prompt describing genre, mood, instruments, tempo, style>]

Use [PLAY_MUSIC:...] for playing existing music from YouTube.
Use [GENERATE_MUSIC:...] ONLY for creating new, original AI-generated music.

Examples of VALID triggers for GENERATE_MUSIC:
- User: "Create a lo-fi track for me" -> You: "Generating music! [GENERATE_MUSIC: lo-fi hip hop, soft piano, vinyl crackle, 75bpm, chill coding vibe]"
- User: "Make me a coding playlist background music" -> You: "Composing for you! [GENERATE_MUSIC: ambient electronic, minimal beats, deep focus, no vocals]"
- User: "Tạo nhạc chill cho tôi" -> You: "Đang tạo nhạc! [GENERATE_MUSIC: chill lo-fi nhac viet, soft guitar, relaxing coding music]"

CRITICAL RULES FOR GENERATE_MUSIC:
- NEVER include [GENERATE_MUSIC:...] unless the user explicitly asked to CREATE or GENERATE music.
- The prompt after the colon should be detailed and descriptive (genre, instruments, mood, tempo).`

function buildSystemPrompt(provider: string, model: string): string {
  return (
    SYSTEM_PROMPT +
    `\n\nYOUR IDENTITY:\nYou are running on provider: ${provider}, model: ${model}. When the user asks what model or AI you are, you MUST answer honestly with this exact provider and model name.`
  )
}

let currentAbortController: AbortController | null = null

// Block known cloud metadata endpoints to prevent SSRF from user-configured Ollama URLs
function isAllowedOllamaUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const h = url.hostname
    if (h === '169.254.169.254' || h === 'metadata.google.internal') return false
    return true
  } catch {
    return false
  }
}

export function setupAIHandlers(): void {
  ipcMain.handle('ai:chat', async (event: IpcMainInvokeEvent, params: AIChatParams) => {
    // Abort any in-flight request
    currentAbortController?.abort()
    currentAbortController = new AbortController()
    const signal = currentAbortController.signal

    const provider = getProvider(params.provider)

    // Build messages with system prompt prepended
    const messages: AIMessage[] = [
      { role: 'system', content: buildSystemPrompt(params.provider, params.model) },
      ...params.messages
    ]

    // Determine credential: Ollama uses URL, Antigravity/Gemini OAuth use token|projectId
    let credential: string
    if (params.provider === 'ollama') {
      const ollamaUrl = params.ollamaUrl ?? 'http://localhost:11434'
      if (!isAllowedOllamaUrl(ollamaUrl)) {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:chunk', { type: 'error', error: 'Invalid Ollama URL' })
        }
        return
      }
      credential = ollamaUrl
    } else if (params.provider === 'antigravity') {
      const agCredential = await getAntigravityCredential()
      if (!agCredential) {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:chunk', {
            type: 'error',
            error: 'Not signed in to Antigravity — sign in via Settings → Antigravity'
          })
        }
        return
      }
      credential = agCredential
    } else if (params.provider === 'gemini' && params.useGeminiOAuth) {
      const geminiCred = await getGeminiOAuthCredential()
      if (!geminiCred) {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:chunk', {
            type: 'error',
            error: 'Gemini sign-in expired — sign out and sign in again at Settings → Gemini'
          })
        }
        return
      }
      // Gemini CLI uses cloudcode-pa.googleapis.com for OAuth — pass gemini-cli: prefix
      // so AntigravityProvider uses minimal headers (not VS Code extension headers)
      try {
        const agProvider = getProvider('antigravity')
        await agProvider.streamChat(
          messages,
          params.model,
          `gemini-cli:${geminiCred}`,
          (chunk) => {
            if (!event.sender.isDestroyed()) event.sender.send('ai:chunk', chunk)
          },
          signal
        )
      } catch (error: unknown) {
        if ((error as { name?: string }).name === 'AbortError') return
        const message = error instanceof Error ? error.message : 'Unknown error'
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:chunk', { type: 'error', error: message })
        }
      }
      return
    } else {
      credential = params.apiKey ?? ''
    }

    // Reject requests without credentials early (except Ollama/Antigravity)
    if (params.provider !== 'ollama' && params.provider !== 'antigravity' && !credential) {
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:chunk', {
          type: 'error',
          error: `No API key configured for ${params.provider}`
        })
      }
      return
    }

    try {
      await provider.streamChat(
        messages,
        params.model,
        credential,
        (chunk) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('ai:chunk', chunk)
          }
        },
        signal
      )
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'AbortError') return
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:chunk', { type: 'error', error: message })
      }
    }
  })

  ipcMain.handle('ai:abort', () => {
    currentAbortController?.abort()
    currentAbortController = null
  })
}
