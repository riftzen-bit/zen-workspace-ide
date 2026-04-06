/// <reference types="vite/client" />

interface FileNode {
  path: string
  name: string
  isDirectory: boolean
  children?: FileNode[]
}

interface Window {
  api: {
    openDirectory: () => Promise<string | null>
    readDirectory: (dirPath: string) => Promise<FileNode[]>
    readFile: (filePath: string) => Promise<string | null>
    searchFiles: (query: string, dir: string) => Promise<{ path: string; name: string }[]>
    saveFile: (filePath: string, content: string) => Promise<boolean>
    searchYoutube: (
      query: string
    ) => Promise<{ videoId: string; title: string; url: string } | null>
    store: {
      get: (key: string) => Promise<any>
      set: (key: string, value: any) => Promise<void>
      delete: (key: string) => Promise<void>
      clear: () => Promise<void>
    }
    terminal: {
      create: (id: string, cols: number, rows: number, commandStr?: string) => Promise<boolean>
      resize: (id: string, cols: number, rows: number) => Promise<void>
      write: (id: string, data: string) => Promise<void>
      kill: (id: string) => Promise<void>
      onData: (callback: (id: string, data: string) => void) => () => void
      onExit: (callback: (id: string) => void) => () => void
    }
  }
}
