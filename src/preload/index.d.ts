import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openDirectory: () => Promise<string | null>
      readDirectory: (dirPath: string) => Promise<any[]>
      readFile: (filePath: string) => Promise<string>
      saveFile: (filePath: string, content: string) => Promise<boolean>
      searchYoutube: (query: string) => Promise<any>
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
}
