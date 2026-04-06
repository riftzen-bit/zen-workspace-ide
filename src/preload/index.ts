import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  searchFiles: (query: string, dir: string) => ipcRenderer.invoke('fs:searchFiles', query, dir),
  saveFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs:saveFile', filePath, content),
  searchYoutube: (query: string) => ipcRenderer.invoke('youtube:search', query),
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear')
  },
  terminal: {
    create: (id: string, cols: number, rows: number, commandStr?: string) =>
      ipcRenderer.invoke('terminal:create', id, cols, rows, commandStr),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', id, cols, rows),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_: any, id: string, data: string) => callback(id, data)
      ipcRenderer.on('terminal:onData', handler)
      return () => ipcRenderer.removeListener('terminal:onData', handler)
    },
    onExit: (callback: (id: string) => void) => {
      const handler = (_: any, id: string) => callback(id)
      ipcRenderer.on('terminal:onExit', handler)
      return () => ipcRenderer.removeListener('terminal:onExit', handler)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
