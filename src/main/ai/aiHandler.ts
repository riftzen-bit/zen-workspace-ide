import { ipcMain, IpcMainInvokeEvent } from 'electron'
import fs from 'fs'
import path from 'path'
import {
  AIChatParams,
  AIMessage,
  AIGenerateTestParams,
  AICompleteParams,
  AIReviewParams,
  AIProviderType
} from './types'
import { getProvider } from './providerRegistry'
import { getGeminiOAuthAccess } from '../oauth/googleOAuth'
import { isTrustedIpcSender, resolvePathWithinRoot } from '../security'

import { executeTool } from './tools'

function encodeGeminiOAuthCredential(accessToken: string, quotaProject?: string): string {
  const payload = Buffer.from(JSON.stringify({ accessToken, quotaProject }), 'utf8').toString(
    'base64url'
  )
  return `oauth-json:${payload}`
}

const SYSTEM_PROMPT = `You are "Zen AI", a sharp coding companion built into the Zen Workspace IDE. You help developers write better code while keeping the vibe relaxed and focused.

YOUR CAPABILITIES:
1. Help with code — write, debug, refactor, explain, review, and optimize code in any language.
2. Answer technical questions about frameworks, libraries, algorithms, architecture, and tooling.
3. Chat casually, brainstorm ideas, and keep the user company during long coding sessions.
4. Control the workspace's built-in Vibe Player (Music Player).

TOOL CALLING (Like Gemini CLI):
You are an advanced AI coding assistant. You have tools available to interact with the user's workspace.
To use a tool, you must output a JSON block exactly like this, wrapped in <tool_call> tags:
<tool_call>
{"name": "read_file", "args": {"path": "src/main.ts"}}
</tool_call>

Available Tools:
1. read_file
   - args: {"path": "string (relative to workspace)"}
   - use: Reads the contents of a file.
2. list_dir
   - args: {"path": "string (relative to workspace, default: '.')"}
   - use: Lists files and folders in a directory.
3. write_file
   - args: {"path": "string", "content": "string"}
   - use: Creates or overwrites a file with the given content.
4. run_command
   - args: {"command": "string"}
   - use: Runs a bash command in the workspace directory.

Rules for Tools:
- Only output ONE <tool_call> at a time.
- After outputting a <tool_call>, STOP generating further text. The system will execute the tool and provide the output in a <tool_response> block in the next message.
- Use tools to understand the codebase before answering questions about it! If the user says "read the whole codebase", use run_command with 'find' or 'ls -R' or list_dir, then read_file on relevant files.
- Do NOT make assumptions about file names, use list_dir or run_command (like ls, grep) to find them.

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

let chatAbortController: AbortController | null = null
let completeAbortController: AbortController | null = null
let generateTestAbortController: AbortController | null = null
const MAX_TOOL_CALL_ITERATIONS = 8

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

type CredentialParams = {
  provider: AIProviderType
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
}

async function resolveCredential(params: CredentialParams): Promise<string> {
  if (params.provider === 'ollama') {
    const ollamaUrl = params.ollamaUrl ?? 'http://localhost:11434'
    if (!isAllowedOllamaUrl(ollamaUrl)) {
      throw new Error('Invalid Ollama URL')
    }
    return ollamaUrl
  }

  if (params.provider === 'gemini' && params.useGeminiOAuth) {
    const oauthAccess = await getGeminiOAuthAccess()
    if (!oauthAccess) {
      throw new Error(
        'Not signed in to Gemini. Open Setup Guide in Settings to configure your credentials, then sign in with Google.'
      )
    }
    return encodeGeminiOAuthCredential(oauthAccess.accessToken, oauthAccess.quotaProject)
  }

  const credential = params.apiKey ?? ''
  if (!credential) {
    throw new Error(
      `No API key configured for ${params.provider}. Open Settings to add your credentials.`
    )
  }
  return credential
}

async function collectProviderText(
  params: CredentialParams & {
    model: string
    messages: AIMessage[]
    signal?: AbortSignal
  }
): Promise<string> {
  const provider = getProvider(params.provider)
  const credential = await resolveCredential(params)
  let accumulatedText = ''
  let chunkError: string | null = null

  await provider.streamChat(
    params.messages,
    params.model,
    credential,
    (chunk) => {
      if (chunk.type === 'text' && chunk.text) {
        accumulatedText += chunk.text
      } else if (chunk.type === 'error') {
        chunkError = chunk.error ?? 'Unknown AI error'
      }
    },
    params.signal
  )

  if (chunkError) {
    throw new Error(chunkError)
  }

  return accumulatedText.trim()
}

function extractJsonPayload(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (blockMatch) {
    return blockMatch[1].trim()
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1)
  }

  return null
}

function parseReviewResult(text: string): {
  summary: string
  findings: Array<{
    id: string
    severity: 'critical' | 'warning' | 'info' | 'suggestion'
    title: string
    summary: string
    lineStart: number
    lineEnd: number
    suggestion?: string
    replacement?: string
    canApply: boolean
  }>
} {
  const jsonPayload = extractJsonPayload(text)
  if (!jsonPayload) {
    return { summary: text.trim() || 'Review complete.', findings: [] }
  }

  try {
    const parsed = JSON.parse(jsonPayload) as {
      summary?: string
      findings?: Array<{
        severity?: string
        title?: string
        summary?: string
        lineStart?: number
        lineEnd?: number
        suggestion?: string
        replacement?: string
        canApply?: boolean
      }>
    }

    const findings = (parsed.findings ?? [])
      .map((finding, index) => {
        const severity: 'critical' | 'warning' | 'info' | 'suggestion' =
          finding.severity === 'critical' ||
          finding.severity === 'warning' ||
          finding.severity === 'info' ||
          finding.severity === 'suggestion'
            ? finding.severity
            : 'warning'

        const lineStart = Number.isFinite(finding.lineStart)
          ? Math.max(1, Number(finding.lineStart))
          : 1
        const lineEnd = Number.isFinite(finding.lineEnd)
          ? Math.max(lineStart, Number(finding.lineEnd))
          : lineStart

        return {
          id: `review-${Date.now()}-${index}`,
          severity,
          title: finding.title?.trim() || 'Review finding',
          summary: finding.summary?.trim() || '',
          lineStart,
          lineEnd,
          suggestion: finding.suggestion?.trim() || undefined,
          replacement: finding.replacement?.trim() || undefined,
          canApply:
            Boolean(finding.canApply) &&
            typeof finding.replacement === 'string' &&
            finding.replacement.trim().length > 0
        }
      })
      .filter((finding) => finding.summary.length > 0)
      .slice(0, 12)

    return {
      summary: parsed.summary?.trim() || 'Review complete.',
      findings
    }
  } catch {
    return {
      summary: text.trim() || 'Review complete.',
      findings: []
    }
  }
}

export function setupAIHandlers(): void {
  ipcMain.handle('ai:chat', async (event: IpcMainInvokeEvent, params: AIChatParams) => {
    if (!isTrustedIpcSender(event)) return

    // Abort any in-flight chat request
    chatAbortController?.abort()
    chatAbortController = new AbortController()
    const signal = chatAbortController.signal

    // Build messages with system prompt prepended
    const messages: AIMessage[] = [
      { role: 'system', content: buildSystemPrompt(params.provider, params.model) },
      ...params.messages
    ]

    let credential = ''
    try {
      credential = await resolveCredential(params)
    } catch (error) {
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:chunk', {
          type: 'error',
          error: error instanceof Error ? error.message : 'Failed to resolve credentials'
        })
      }
      return
    }

    let isDone = false
    const currentMessages = [...messages]

    let toolCallIterations = 0

    while (!isDone && !signal.aborted) {
      let accumulatedText = ''
      let chunkError: unknown = null

      try {
        await getProvider(params.provider).streamChat(
          currentMessages,
          params.model,
          credential,
          (chunk) => {
            if (chunk.type === 'text' && chunk.text) {
              accumulatedText += chunk.text
              if (!event.sender.isDestroyed()) {
                event.sender.send('ai:chunk', { type: 'text', text: chunk.text })
              }
            } else if (chunk.type === 'error') {
              if (!event.sender.isDestroyed()) {
                event.sender.send('ai:chunk', chunk)
              }
              isDone = true
            }
            // We intercept 'done' so we can handle tool calls before telling renderer we are done
          },
          signal
        )
      } catch (error: unknown) {
        if ((error as { name?: string }).name === 'AbortError') return
        chunkError = error
      }

      if (chunkError) {
        const message = chunkError instanceof Error ? chunkError.message : 'Unknown error'

        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:chunk', { type: 'error', error: message })
        }
        break
      }

      if (signal.aborted) break

      const toolCallMatch = accumulatedText.match(/<tool_call>([\s\S]*?)<\/tool_call>/)
      if (toolCallMatch) {
        toolCallIterations += 1
        if (toolCallIterations > MAX_TOOL_CALL_ITERATIONS) {
          if (!event.sender.isDestroyed()) {
            event.sender.send('ai:chunk', {
              type: 'error',
              error: 'Tool call limit reached. Please refine the request and try again.'
            })
          }
          break
        }

        try {
          let jsonString = toolCallMatch[1].trim()
          if (jsonString.startsWith('```json')) {
            jsonString = jsonString.slice(7)
          } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.slice(3)
          }
          if (jsonString.endsWith('```')) {
            jsonString = jsonString.slice(0, -3)
          }

          const toolCall = JSON.parse(jsonString.trim())

          if (!event.sender.isDestroyed()) {
            event.sender.send('ai:chunk', {
              type: 'text',
              text: `\n\n> 🛠️ Executing tool: ${toolCall.name}...\n`
            })
          }

          const toolArgs =
            toolCall && typeof toolCall.args === 'object' && toolCall.args !== null
              ? (toolCall.args as Record<string, unknown>)
              : {}
          const result = await executeTool(toolCall.name, toolArgs, params.workspaceDir)

          currentMessages.push({ role: 'assistant', content: accumulatedText })
          // Add truncation for large outputs to prevent token limit errors
          const maxResponseLength = 30000
          const truncatedResult =
            result.length > maxResponseLength
              ? result.substring(0, maxResponseLength) + '\n... (truncated)'
              : result
          currentMessages.push({
            role: 'user',
            content: `<tool_response>\n${truncatedResult}\n</tool_response>`
          })

          // Loop continues...
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e)
          currentMessages.push({ role: 'assistant', content: accumulatedText })
          currentMessages.push({
            role: 'user',
            content: `<tool_response>\nError parsing tool call: ${message}\n</tool_response>`
          })
        }
      } else {
        // No tool call, finished
        if (!event.sender.isDestroyed() && !isDone) {
          event.sender.send('ai:chunk', { type: 'done' })
        }
        isDone = true
      }
    }
  })

  ipcMain.handle('ai:abort', (event: IpcMainInvokeEvent) => {
    if (!isTrustedIpcSender(event)) return
    chatAbortController?.abort()
    chatAbortController = null
    completeAbortController?.abort()
    completeAbortController = null
    generateTestAbortController?.abort()
    generateTestAbortController = null
  })

  ipcMain.handle('ai:complete', async (event: IpcMainInvokeEvent, params: AICompleteParams) => {
    if (!isTrustedIpcSender(event)) {
      return { text: '', error: 'Untrusted sender' }
    }

    completeAbortController?.abort()
    completeAbortController = new AbortController()

    try {
      const text = await collectProviderText({
        ...params,
        signal: completeAbortController.signal,
        messages: [
          {
            role: 'system',
            content:
              params.systemPrompt?.trim() ||
              'You are a precise coding assistant. Return only the requested text. Do not wrap your answer in markdown fences.'
          },
          {
            role: 'user',
            content: params.prompt
          }
        ]
      })
      return { text }
    } catch (error) {
      return {
        text: '',
        error: error instanceof Error ? error.message : 'Failed to complete request'
      }
    }
  })

  ipcMain.handle('ai:review', async (event: IpcMainInvokeEvent, params: AIReviewParams) => {
    if (!isTrustedIpcSender(event)) {
      return { summary: 'Untrusted sender', findings: [] }
    }

    try {
      const reviewText = await collectProviderText({
        ...params,
        messages: [
          {
            role: 'system',
            content:
              'You are a strict senior code reviewer. Return valid JSON only. Focus on correctness, security, maintainability, performance, and developer experience.'
          },
          {
            role: 'user',
            content:
              `Review the following file diff and return JSON with this exact shape:\n` +
              `{"summary":"string","findings":[{"severity":"critical|warning|info|suggestion","title":"string","summary":"string","lineStart":1,"lineEnd":1,"suggestion":"string optional","replacement":"string optional","canApply":true}]}\n` +
              `Rules:\n` +
              `- Use line numbers from the MODIFIED file only.\n` +
              `- Keep findings actionable and concise.\n` +
              `- Set canApply=true only when replacement contains a complete replacement for the referenced line range.\n` +
              `- Return at most 8 findings.\n` +
              `- If the code looks good, return an empty findings array.\n\n` +
              `File: ${params.filePath}\n\n` +
              `ORIGINAL:\n\`\`\`\n${params.original}\n\`\`\`\n\n` +
              `MODIFIED:\n\`\`\`\n${params.modified}\n\`\`\``
          }
        ]
      })

      return parseReviewResult(reviewText)
    } catch (error) {
      return {
        summary: error instanceof Error ? error.message : 'Review failed',
        findings: []
      }
    }
  })

  ipcMain.handle(
    'ai:generateTest',
    async (event: IpcMainInvokeEvent, params: AIGenerateTestParams) => {
      if (!isTrustedIpcSender(event)) {
        return { success: false, error: 'Untrusted sender' }
      }

      try {
        if (!params.workspaceDir) {
          return { success: false, error: 'Workspace directory is required' }
        }

        const safeSourcePath = resolvePathWithinRoot(params.workspaceDir, params.filePath)
        if (!safeSourcePath) {
          return { success: false, error: 'Source file path is outside workspace' }
        }

        const sourceCode = await fs.promises.readFile(safeSourcePath, 'utf-8')
        const parsed = path.parse(safeSourcePath)

        let targetPath = safeSourcePath
        const srcDirMatch = path.sep + 'src' + path.sep
        const testsDirMatch = path.sep + 'tests' + path.sep
        if (targetPath.includes(srcDirMatch)) {
          targetPath = targetPath.replace(srcDirMatch, testsDirMatch)
        } else {
          targetPath = path.join(parsed.dir, '__tests__', parsed.base)
        }

        const targetParsed = path.parse(targetPath)
        let ext = targetParsed.ext
        if (ext === '.ts') ext = '.test.ts'
        else if (ext === '.tsx') ext = '.test.tsx'
        else if (ext === '.js') ext = '.test.js'
        else if (ext === '.jsx') ext = '.test.jsx'
        else ext = '.test' + ext

        const unsafeTargetPath = path.join(targetParsed.dir, targetParsed.name + ext)
        const finalTargetPath = resolvePathWithinRoot(params.workspaceDir, unsafeTargetPath, true)
        if (!finalTargetPath) {
          return { success: false, error: 'Target test path resolves outside workspace' }
        }

        const messages: AIMessage[] = [
          {
            role: 'system',
            content:
              'You are an expert software tester. Your task is to generate a complete, passing Vitest test file for the provided code. Output ONLY the raw code for the test file. Do not use markdown code blocks (like ```typescript), just output the raw code. Do not include any explanations.'
          },
          {
            role: 'user',
            content: `Source file path: ${params.filePath}\n\nCode:\n${sourceCode}`
          }
        ]

        generateTestAbortController?.abort()
        generateTestAbortController = new AbortController()

        let generatedCode = await collectProviderText({
          ...params,
          messages,
          signal: generateTestAbortController.signal
        })

        if (generatedCode.startsWith('```')) {
          const lines = generatedCode.split('\n')
          if (lines[0].startsWith('```')) lines.shift()
          if (lines[lines.length - 1].startsWith('```')) lines.pop()
          generatedCode = lines.join('\n').trim()
        }

        await fs.promises.mkdir(path.dirname(finalTargetPath), { recursive: true })
        await fs.promises.writeFile(finalTargetPath, generatedCode + '\n', 'utf-8')

        return { success: true, targetPath: finalTargetPath }
      } catch (error: unknown) {
        console.error('ai:generateTest error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )
}
