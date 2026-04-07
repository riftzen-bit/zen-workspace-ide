import { ipcMain, dialog, IpcMainInvokeEvent } from 'electron'
import { writeFile } from 'fs/promises'
import { GoogleGenAI } from '@google/genai'

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
        // Lyria requires API key — OAuth (cloudcode-pa.googleapis.com) doesn't support Lyria
        if (!params.apiKey) {
          send({
            type: 'error',
            error:
              'Lyria requires a Gemini API key. Get one free at aistudio.google.com/apikey, then paste it into the Music Generator panel.'
          })
          return
        }

        const result = await generateWithApiKey(params, signal)

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
