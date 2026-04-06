import { FileNode } from '../renderer/src/types'

interface PtyOperationResult {
  success: boolean
  reason?: string
  results?: Array<{ id: string; success: boolean; reason?: string }>
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
      searchYoutube: (
        query: string
      ) => Promise<{ videoId: string; title: string; url: string } | null>
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
      }
    }
  }
}
