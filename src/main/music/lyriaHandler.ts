import { ipcMain, dialog, IpcMainInvokeEvent } from 'electron'
import { writeFile } from 'fs/promises'
import { GoogleGenAI } from '@google/genai'
import { getGeminiOAuthAccess } from '../oauth/googleOAuth'

export interface LyriaGenerateParams {
  model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview'
  prompt: string
  lyrics?: string
  instrumental: boolean
  apiKey?: string
  useGeminiOAuth?: boolean
}

export interface LyriaProgressChunk {
  type: 'started' | 'complete' | 'error'
  lyrics?: string
  audioBase64?: string
  mimeType?: string
  error?: string
}

let currentAbortController: AbortController | null = null

function summarizeGeminiOAuthError(status: number, errText: string): string {
  const trimmed = errText.trim()
  let parsedMessage = ''
  let reason = ''

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: {
          message?: string
          status?: string
          details?: Array<{ reason?: string }>
        }
      }
      parsedMessage = parsed.error?.message ?? ''
      reason = parsed.error?.details?.find((detail) => detail.reason)?.reason ?? ''
      if (!reason && parsed.error?.status) reason = parsed.error.status
    } catch {
      // ignore parse errors
    }
  }

  const lower = `${reason} ${parsedMessage} ${trimmed}`.toLowerCase()
  if (status === 401) {
    return 'Gemini rejected the OAuth token. Sign out and sign back in via Settings.'
  }
  if (lower.includes('access_token_scope_insufficient')) {
    return 'Gemini OAuth is missing required API scopes. Sign out, then sign in again so Zen Workspace can request the updated permissions.'
  }
  if (lower.includes('user_project_denied') || lower.includes('x-goog-user-project')) {
    return 'Google accepted the sign-in, but the linked Cloud project cannot be used for Gemini quota. Use the same project for your OAuth client and the Generative Language API.'
  }
  if (lower.includes('api has not been used') || lower.includes('api is disabled')) {
    return 'The Generative Language API is not enabled for the Cloud project linked to this OAuth client.'
  }
  return parsedMessage || trimmed || `Gemini OAuth error ${status}`
}

async function generateWithOAuth(
  params: LyriaGenerateParams,
  token: string,
  quotaProject: string | undefined,
  signal: AbortSignal
): Promise<{ lyrics?: string; audioBase64?: string; mimeType?: string }> {
  let promptText = params.prompt
  if (params.instrumental) {
    promptText += ' [instrumental, no vocals]'
  }
  if (params.lyrics) {
    promptText += `\n\nCustom lyrics:\n${params.lyrics}`
  }

  const contents = [
    {
      role: 'user',
      parts: [{ text: promptText }]
    }
  ]

  const body: Record<string, unknown> = {
    contents,
    config: {
      responseModalities: ['AUDIO', 'TEXT']
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  if (quotaProject) {
    headers['x-goog-user-project'] = quotaProject
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    }
  )

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    if (response.status === 401 || response.status === 403) {
      throw new Error(summarizeGeminiOAuthError(response.status, errText))
    }
    throw new Error(`Gemini OAuth error ${response.status}: ${errText}`)
  }

  const data = await response.json()

  let lyrics: string | undefined
  let audioBase64: string | undefined
  let mimeType = 'audio/mp3'

  const candidates = data.candidates ?? []
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? []
    for (const part of parts) {
      if (part.text) {
        lyrics = part.text
      } else if (part.inlineData?.data) {
        audioBase64 = part.inlineData.data
        mimeType = part.inlineData.mimeType ?? 'audio/mp3'
      }
    }
  }

  if (!audioBase64) {
    throw new Error('No audio generated. Try a different prompt.')
  }

  return { lyrics, audioBase64, mimeType }
}

async function generateWithApiKey(
  params: LyriaGenerateParams,
  signal: AbortSignal
): Promise<{ lyrics?: string; audioBase64?: string; mimeType?: string }> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey! })

  let promptText = params.prompt
  if (params.instrumental) {
    promptText += ' [instrumental, no vocals]'
  }
  if (params.lyrics) {
    promptText += `\n\nCustom lyrics:\n${params.lyrics}`
  }

  const response = await ai.models.generateContent({
    model: params.model,
    contents: promptText,
    config: {
      responseModalities: ['AUDIO', 'TEXT']
    }
  })

  if (signal.aborted) throw new Error('AbortError')

  let lyrics: string | undefined
  let audioBase64: string | undefined
  let mimeType = 'audio/mp3'

  const candidates = response.candidates ?? []
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? []
    for (const part of parts) {
      if (part.text) {
        lyrics = part.text
      } else if (part.inlineData?.data) {
        audioBase64 = part.inlineData.data
        mimeType = part.inlineData.mimeType ?? 'audio/mp3'
      }
    }
  }

  if (!audioBase64) {
    throw new Error('No audio generated. Try a different prompt.')
  }

  return { lyrics, audioBase64, mimeType }
}

export function setupLyriaHandlers(): void {
  ipcMain.handle(
    'lyria:generate',
    async (event: IpcMainInvokeEvent, params: LyriaGenerateParams) => {
      currentAbortController?.abort()
      currentAbortController = new AbortController()
      const signal = currentAbortController.signal

      const send = (chunk: LyriaProgressChunk) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('lyria:progress', chunk)
        }
      }

      send({ type: 'started' })

      try {
        let result: { lyrics?: string; audioBase64?: string; mimeType?: string }

        const oauthAccess = await getGeminiOAuthAccess()

        if (oauthAccess) {
          result = await generateWithOAuth(
            params,
            oauthAccess.accessToken,
            oauthAccess.quotaProject,
            signal
          )
        } else if (params.useGeminiOAuth) {
          send({
            type: 'error',
            error:
              'Not signed in to Gemini. Open Setup Guide in Settings to configure your credentials.'
          })
          return
        } else {
          if (!params.apiKey) {
            send({
              type: 'error',
              error:
                'Lyria requires a Gemini API key. Open Setup Guide in Settings or get one free at aistudio.google.com/apikey.'
            })
            return
          }
          result = await generateWithApiKey(params, signal)
        }

        if (signal.aborted) return

        send({
          type: 'complete',
          lyrics: result.lyrics,
          audioBase64: result.audioBase64,
          mimeType: result.mimeType
        })
      } catch (error: unknown) {
        if (signal.aborted) return
        if ((error as { name?: string }).name === 'AbortError') return
        let message = error instanceof Error ? error.message : 'Unknown error generating music'
        if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
          message =
            'Quota exceeded. Lyria requires a paid API plan — enable billing at aistudio.google.com then retry.'
        }
        send({ type: 'error', error: message })
      }
    }
  )

  ipcMain.handle('lyria:abort', () => {
    currentAbortController?.abort()
    currentAbortController = null
  })

  ipcMain.handle(
    'lyria:save',
    async (_: IpcMainInvokeEvent, audioBase64: string, mimeType: string, suggestedName: string) => {
      const ext = mimeType.includes('wav') ? 'wav' : 'mp3'
      const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: `${suggestedName}.${ext}`,
        filters: [
          { name: 'Audio', extensions: [ext] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (canceled || !filePath) return { ok: false }

      try {
        const buffer = Buffer.from(audioBase64, 'base64')
        await writeFile(filePath, buffer)
        return { ok: true, path: filePath }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Save failed'
        return { ok: false, error: message }
      }
    }
  )
}
