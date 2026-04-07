import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  setWorkspace: (dirPath: string) => ipcRenderer.invoke('fs:setWorkspace', dirPath),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  searchFiles: (query: string, dir: string) => ipcRenderer.invoke('fs:searchFiles', query, dir),
  saveFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:saveFile', filePath, content),
  createFile: (filePath: string) =>
    ipcRenderer.invoke('fs:createFile', filePath) as Promise<{ ok: boolean; error?: string }>,
  createDir: (dirPath: string) =>
    ipcRenderer.invoke('fs:createDir', dirPath) as Promise<{ ok: boolean; error?: string }>,
  rename: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('fs:rename', oldPath, newPath) as Promise<{ ok: boolean; error?: string }>,
  deleteItem: (targetPath: string) =>
    ipcRenderer.invoke('fs:delete', targetPath) as Promise<{ ok: boolean; error?: string }>,
  searchYoutube: (query: string) => ipcRenderer.invoke('youtube:search', query),
  watchWorkspace: (dirPath: string | null) => ipcRenderer.invoke('fs:watchWorkspace', dirPath),
  onFileChanged: (callback: (filePath: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('fs:fileChanged', handler)
    return () => ipcRenderer.removeListener('fs:fileChanged', handler)
  },
  onFileCreated: (callback: (filePath: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('fs:fileCreated', handler)
    return () => ipcRenderer.removeListener('fs:fileCreated', handler)
  },
  onFileDeleted: (callback: (filePath: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('fs:fileDeleted', handler)
    return () => ipcRenderer.removeListener('fs:fileDeleted', handler)
  },
  onDirCreated: (callback: (dirPath: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, dirPath: string) => callback(dirPath)
    ipcRenderer.on('fs:dirCreated', handler)
    return () => ipcRenderer.removeListener('fs:dirCreated', handler)
  },
  onDirDeleted: (callback: (dirPath: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, dirPath: string) => callback(dirPath)
    ipcRenderer.on('fs:dirDeleted', handler)
    return () => ipcRenderer.removeListener('fs:dirDeleted', handler)
  },
  git: {
    branch: (cwd: string) => ipcRenderer.invoke('git:branch', cwd) as Promise<string | null>,
    status: (cwd: string) =>
      ipcRenderer.invoke('git:status', cwd) as Promise<{ staged: boolean; unstaged: boolean }>,
    statusFiles: (cwd: string) =>
      ipcRenderer.invoke('git:statusFiles', cwd) as Promise<{
        staged: { file: string; status: string }[]
        unstaged: { file: string; status: string }[]
      }>,
    fileDiffContent: (cwd: string, file: string, stagedOnly: boolean) =>
      ipcRenderer.invoke('git:fileDiffContent', cwd, file, stagedOnly) as Promise<{
        original: string
        modified: string
      }>,
    add: (cwd: string, file: string) =>
      ipcRenderer.invoke('git:add', cwd, file) as Promise<boolean>,
    unstage: (cwd: string, file: string) =>
      ipcRenderer.invoke('git:unstage', cwd, file) as Promise<boolean>,
    diff: (cwd: string, stagedOnly: boolean) =>
      ipcRenderer.invoke('git:diff', cwd, stagedOnly) as Promise<string | null>,
    commit: (cwd: string, message: string, addAll: boolean) =>
      ipcRenderer.invoke('git:commit', cwd, message, addAll) as Promise<{
        success: boolean
        error?: string
      }>
  },
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear')
  },
  terminal: {
    create: (id: string, cols: number, rows: number, commandStr?: string, cwd?: string) =>
      ipcRenderer.invoke('terminal:create', id, cols, rows, commandStr, cwd),
    exists: (id: string) => ipcRenderer.invoke('terminal:exists', id),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', id, cols, rows),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    pause: (id: string) => ipcRenderer.invoke('terminal:pause', id),
    resume: (id: string) => ipcRenderer.invoke('terminal:resume', id),
    pauseWorkspace: (terminalIds: string[]) =>
      ipcRenderer.invoke('terminal:pauseWorkspace', terminalIds),
    resumeWorkspace: (terminalIds: string[]) =>
      ipcRenderer.invoke('terminal:resumeWorkspace', terminalIds),
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string, data: string) => callback(id, data)
      ipcRenderer.on('terminal:onData', handler)
      return () => ipcRenderer.removeListener('terminal:onData', handler)
    },
    onExit: (callback: (id: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string) => callback(id)
      ipcRenderer.on('terminal:onExit', handler)
      return () => ipcRenderer.removeListener('terminal:onExit', handler)
    },
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
    ) => {
      const handler = (_: Electron.IpcRendererEvent, evt: unknown) =>
        callback(evt as Parameters<typeof callback>[0])
      ipcRenderer.on('terminal:activity', handler)
      return () => ipcRenderer.removeListener('terminal:activity', handler)
    }
  },
  ai: {
    chat: (params: {
      provider: string
      model: string
      apiKey?: string
      ollamaUrl?: string
      useGeminiOAuth?: boolean
      messages: { role: string; content: string }[]
    }) => ipcRenderer.invoke('ai:chat', params),
    abort: () => ipcRenderer.invoke('ai:abort'),
    onChunk: (callback: (chunk: { type: string; text?: string; error?: string }) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        chunk: { type: string; text?: string; error?: string }
      ) => callback(chunk)
      ipcRenderer.on('ai:chunk', handler)
      return () => ipcRenderer.removeListener('ai:chunk', handler)
    }
  },
  oauth: {
    googleStart: () =>
      ipcRenderer.invoke('oauth:google:start') as Promise<{
        success: boolean
        email?: string
        error?: string
      }>,
    googleLogout: () => ipcRenderer.invoke('oauth:google:logout'),
    googleStatus: () =>
      ipcRenderer.invoke('oauth:google:status') as Promise<{
        active: boolean
        email?: string
        isConfigured?: boolean
      }>,
    googleGetToken: () => ipcRenderer.invoke('oauth:google:getToken') as Promise<string | null>,
    antigravityStart: () =>
      ipcRenderer.invoke('oauth:antigravity:start') as Promise<{
        success: boolean
        email?: string
        hasProject?: boolean
        error?: string
      }>,
    antigravityLogout: () => ipcRenderer.invoke('oauth:antigravity:logout'),
    antigravityStatus: () =>
      ipcRenderer.invoke('oauth:antigravity:status') as Promise<{
        active: boolean
        email?: string
        hasProject?: boolean
      }>,
    geminiStart: () =>
      ipcRenderer.invoke('oauth:gemini:start') as Promise<{
        success: boolean
        email?: string
        error?: string
      }>,
    geminiLogout: () => ipcRenderer.invoke('oauth:gemini:logout'),
    geminiStatus: () =>
      ipcRenderer.invoke('oauth:gemini:status') as Promise<{
        active: boolean
        email?: string
      }>,
    geminiCheckCli: () =>
      ipcRenderer.invoke('oauth:gemini:checkCli') as Promise<{ available: boolean }>,
    geminiImportCli: () =>
      ipcRenderer.invoke('oauth:gemini:importCli') as Promise<{
        success: boolean
        email?: string
        error?: string
      }>
  },
  music: {
    generate: (params: {
      model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview'
      prompt: string
      lyrics?: string
      instrumental: boolean
      apiKey?: string
      useGeminiOAuth?: boolean
    }) => ipcRenderer.invoke('lyria:generate', params),
    abort: () => ipcRenderer.invoke('lyria:abort'),
    save: (audioBase64: string, mimeType: string, suggestedName: string) =>
      ipcRenderer.invoke('lyria:save', audioBase64, mimeType, suggestedName) as Promise<{
        ok: boolean
        path?: string
        error?: string
      }>,
    onProgress: (
      callback: (chunk: {
        type: 'started' | 'complete' | 'error'
        lyrics?: string
        audioBase64?: string
        mimeType?: string
        error?: string
      }) => void
    ) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        chunk: {
          type: 'started' | 'complete' | 'error'
          lyrics?: string
          audioBase64?: string
          mimeType?: string
          error?: string
        }
      ) => callback(chunk)
      ipcRenderer.on('lyria:progress', handler)
      return () => ipcRenderer.removeListener('lyria:progress', handler)
    }
  },
  secureStore: {
    get: (key: string) => ipcRenderer.invoke('secure-store:get', key) as Promise<string | null>,
    set: (key: string, value: string) =>
      ipcRenderer.invoke('secure-store:set', key, value) as Promise<void>,
    delete: (key: string) => ipcRenderer.invoke('secure-store:delete', key) as Promise<void>
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  throw new Error('Context isolation must be enabled')
}
