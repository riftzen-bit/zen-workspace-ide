import { FileNode } from '../renderer/src/types'

interface PtyOperationResult {
  success: boolean
  reason?: string
  results?: Array<{ id: string; success: boolean; reason?: string }>
}

interface PtyBroadcastResult {
  dispatched: string[]
  unavailable: Array<{ id: string; reason: string }>
}

interface AIChunk {
  type: 'text' | 'done' | 'error'
  text?: string
  error?: string
}

interface AIReviewFinding {
  id: string
  severity: 'critical' | 'warning' | 'info' | 'suggestion'
  title: string
  summary: string
  lineStart: number
  lineEnd: number
  suggestion?: string
  replacement?: string
  canApply: boolean
}

interface AIReviewResult {
  findings: AIReviewFinding[]
  summary: string
}

interface AIChatParams {
  provider: string
  model: string
  workspaceDir?: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
  messages: Array<{ role: string; content: string }>
}

interface AICompleteParams {
  provider: string
  model: string
  prompt: string
  workspaceDir?: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
  systemPrompt?: string
}

interface AIGenerateTestParams {
  filePath: string
  workspaceDir?: string
  provider: string
  model: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
}

interface AIReviewParams {
  provider: string
  model: string
  workspaceDir?: string
  apiKey?: string
  ollamaUrl?: string
  useGeminiOAuth?: boolean
  filePath: string
  original: string
  modified: string
}

declare global {
  interface Window {
    api: {
      openDirectory: () => Promise<string | null>
      setWorkspace: (dirPath: string) => Promise<void>
      readDirectory: (dirPath: string) => Promise<FileNode[]>
      readFile: (filePath: string) => Promise<string | null>
      searchFiles: (query: string, dir: string) => Promise<{ path: string; name: string }[]>
      scanTodos: (dir: string) => Promise<
        Array<{
          id: string
          path: string
          relativePath: string
          name: string
          line: number
          column: number
          tag: 'TODO' | 'FIXME' | 'HACK'
          text: string
        }>
      >
      saveFile: (filePath: string, content: string) => Promise<boolean>
      createFile: (filePath: string) => Promise<{ ok: boolean; error?: string }>
      createDir: (dirPath: string) => Promise<{ ok: boolean; error?: string }>
      rename: (oldPath: string, newPath: string) => Promise<{ ok: boolean; error?: string }>
      deleteItem: (targetPath: string) => Promise<{ ok: boolean; error?: string }>
      searchWithContext: (
        query: string,
        dir: string,
        caseSensitive: boolean
      ) => Promise<
        Array<{
          path: string
          relativePath: string
          name: string
          line: number
          column: number
          lineContent: string
          matchLength: number
        }>
      >
      replaceInFiles: (
        replacements: Array<{
          path: string
          search: string
          replace: string
          caseSensitive: boolean
        }>
      ) => Promise<{
        ok: boolean
        error?: string
        count: number
        failures: Array<{ path: string; error: string }>
      }>
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
        stashList: (cwd: string) => Promise<Array<{ index: string; message: string; date: string }>>
        stashSave: (cwd: string, message: string) => Promise<{ success: boolean; error?: string }>
        stashPop: (cwd: string, index?: string) => Promise<{ success: boolean; error?: string }>
        stashApply: (cwd: string, index?: string) => Promise<{ success: boolean; error?: string }>
        stashDrop: (cwd: string, index: string) => Promise<{ success: boolean; error?: string }>
        log: (
          cwd: string,
          limit?: number
        ) => Promise<
          Array<{
            hash: string
            shortHash: string
            author: string
            email: string
            timestamp: number
            subject: string
          }>
        >
        branchList: (cwd: string) => Promise<
          Array<{
            name: string
            isCurrent: boolean
            isRemote: boolean
            lastCommit: string
          }>
        >
        checkout: (cwd: string, branch: string) => Promise<{ success: boolean; error?: string }>
      }
      store: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<void>
        delete: (key: string) => Promise<void>
        clear: () => Promise<void>
        exportSettings: () => Promise<{ success: boolean; path?: string; error?: string }>
        importSettings: () => Promise<{
          success: boolean
          importedCount?: number
          error?: string
        }>
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
        resize: (id: string, cols: number, rows: number) => void
        write: (id: string, data: string) => void
        broadcast: (terminalIds: string[], data: string) => Promise<PtyBroadcastResult>
        kill: (id: string) => Promise<void>
        pause: (id: string) => Promise<PtyOperationResult>
        resume: (id: string) => Promise<PtyOperationResult>
        pauseWorkspace: (terminalIds: string[]) => Promise<PtyOperationResult>
        resumeWorkspace: (terminalIds: string[]) => Promise<PtyOperationResult>
        exportSession: (
          content: string,
          defaultName?: string
        ) => Promise<{ success: boolean; path?: string; error?: string }>
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
            agentStatus?: 'idle' | 'working' | 'waiting' | 'error' | 'done' | 'paused'
            agentName?: string
            timestamp: number
          }) => void
        ) => () => void
      }
      ai: {
        chat: (params: AIChatParams) => Promise<void>
        complete: (params: AICompleteParams) => Promise<{ text: string; error?: string }>
        review: (params: AIReviewParams) => Promise<AIReviewResult>
        generateTest: (
          params: AIGenerateTestParams
        ) => Promise<{ success: boolean; targetPath?: string; error?: string }>
        abort: () => Promise<void>
        onChunk: (callback: (chunk: AIChunk) => void) => () => void
      }
      oauth: {
        geminiStart: () => Promise<{
          success: boolean
          email?: string
          error?: string
          errorCode?: string
        }>
        geminiLogout: () => Promise<void>
        geminiStatus: () => Promise<{
          active: boolean
          email?: string
        }>
        openSetupGuide: () => Promise<{
          success: boolean
          error?: string
        }>
        saveCredentials: (params: {
          apiKey?: string
          clientId?: string
          clientSecret?: string
        }) => Promise<{
          success: boolean
          error?: string
        }>
        onKeysUpdated: (callback: () => void) => () => void
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
      weather: {
        geocode: (query: string) => Promise<
          | {
              ok: true
              data: {
                city: string
                country: string
                latitude: number
                longitude: number
                timezone: string
              } | null
            }
          | { ok: false; error: string }
        >
        ipLocate: () => Promise<
          | {
              ok: true
              data: {
                city: string
                country: string
                latitude: number
                longitude: number
                timezone: string
              }
            }
          | { ok: false; error: string }
        >
        current: (
          latitude: number,
          longitude: number
        ) => Promise<
          { ok: true; data: { temp: number; code: number } } | { ok: false; error: string }
        >
      }
    }
  }
}
