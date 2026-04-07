import { FileNode } from '../renderer/src/types'

interface PtyOperationResult {
  success: boolean
  reason?: string
  results?: Array<{ id: string; success: boolean; reason?: string }>
}

interface AIChunk {
  type: 'text' | 'done' | 'error'
  text?: string
  error?: string
}

interface AIChatParams {
  provider: string
  model: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
  messages: Array<{ role: string; content: string }>
}

declare global {
  interface Window {
    api: {
      openDirectory: () => Promise<string | null>
      setWorkspace: (dirPath: string) => Promise<void>
      readDirectory: (dirPath: string) => Promise<FileNode[]>
      readFile: (filePath: string) => Promise<string | null>
      searchFiles: (query: string, dir: string) => Promise<{ path: string; name: string }[]>
      saveFile: (filePath: string, content: string) => Promise<boolean>
      createFile: (filePath: string) => Promise<{ ok: boolean; error?: string }>
      createDir: (dirPath: string) => Promise<{ ok: boolean; error?: string }>
      rename: (oldPath: string, newPath: string) => Promise<{ ok: boolean; error?: string }>
      deleteItem: (targetPath: string) => Promise<{ ok: boolean; error?: string }>
      searchYoutube: (
        query: string
      ) => Promise<{ videoId: string; title: string; url: string } | null>
      watchWorkspace: (dirPath: string | null) => Promise<void>
      onFileChanged: (callback: (filePath: string) => void) => () => void
      onFileCreated: (callback: (filePath: string) => void) => () => void
      onFileDeleted: (callback: (filePath: string) => void) => () => void
      onDirCreated: (callback: (dirPath: string) => void) => () => void
      onDirDeleted: (callback: (dirPath: string) => void) => () => void
      git: {
        branch: (cwd: string) => Promise<string | null>
        status: (cwd: string) => Promise<{ staged: boolean; unstaged: boolean }>
        statusFiles: (cwd: string) => Promise<{
          staged: { file: string; status: string }[]
          unstaged: { file: string; status: string }[]
        }>
        fileDiffContent: (
          cwd: string,
          file: string,
          stagedOnly: boolean
        ) => Promise<{ original: string; modified: string }>
        add: (cwd: string, file: string) => Promise<boolean>
        unstage: (cwd: string, file: string) => Promise<boolean>
        diff: (cwd: string, stagedOnly: boolean) => Promise<string | null>
        commit: (
          cwd: string,
          message: string,
          addAll: boolean
        ) => Promise<{ success: boolean; error?: string }>
      }
      store: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<void>
        delete: (key: string) => Promise<void>
        clear: () => Promise<void>
      }
      terminal: {
        create: (
          id: string,
          cols: number,
          rows: number,
          commandStr?: string,
          cwd?: string
        ) => Promise<boolean>
        exists: (id: string) => Promise<boolean>
        resize: (id: string, cols: number, rows: number) => Promise<void>
        write: (id: string, data: string) => Promise<void>
        kill: (id: string) => Promise<void>
        pause: (id: string) => Promise<PtyOperationResult>
        resume: (id: string) => Promise<PtyOperationResult>
        pauseWorkspace: (terminalIds: string[]) => Promise<PtyOperationResult>
        resumeWorkspace: (terminalIds: string[]) => Promise<PtyOperationResult>
        onData: (callback: (id: string, data: string) => void) => () => void
        onExit: (callback: (id: string) => void) => () => void
        onActivity: (
          callback: (event: {
            id: string
            terminalId: string
            type: string
            message: string
            filePath?: string
            costValue?: string
            timestamp: number
          }) => void
        ) => () => void
      }
      ai: {
        chat: (params: AIChatParams) => Promise<void>
        abort: () => Promise<void>
        onChunk: (callback: (chunk: AIChunk) => void) => () => void
      }
      oauth: {
        googleStart: () => Promise<{ success: boolean; email?: string; error?: string }>
        googleLogout: () => Promise<void>
        googleStatus: () => Promise<{
          active: boolean
          email?: string
          isConfigured?: boolean
        }>
        googleGetToken: () => Promise<string | null>
        antigravityStart: () => Promise<{
          success: boolean
          email?: string
          hasProject?: boolean
          error?: string
        }>
        antigravityLogout: () => Promise<void>
        antigravityStatus: () => Promise<{
          active: boolean
          email?: string
          hasProject?: boolean
        }>
        geminiStart: () => Promise<{
          success: boolean
          email?: string
          error?: string
        }>
        geminiLogout: () => Promise<void>
        geminiStatus: () => Promise<{
          active: boolean
          email?: string
        }>
        geminiCheckCli: () => Promise<{ available: boolean }>
        geminiImportCli: () => Promise<{
          success: boolean
          email?: string
          error?: string
        }>
      }
      music: {
        generate: (params: {
          model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview'
          prompt: string
          lyrics?: string
          instrumental: boolean
          apiKey?: string
          useGeminiOAuth?: boolean
        }) => Promise<void>
        abort: () => Promise<void>
        save: (
          audioBase64: string,
          mimeType: string,
          suggestedName: string
        ) => Promise<{ ok: boolean; path?: string; error?: string }>
        onProgress: (
          callback: (chunk: {
            type: 'started' | 'complete' | 'error'
            lyrics?: string
            audioBase64?: string
            mimeType?: string
            error?: string
          }) => void
        ) => () => void
      }
      secureStore: {
        get: (key: string) => Promise<string | null>
        set: (key: string, value: string) => Promise<void>
        delete: (key: string) => Promise<void>
      }
    }
  }
}
