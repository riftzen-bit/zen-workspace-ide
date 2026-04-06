import StoreModule from 'electron-store'
import { ipcMain } from 'electron'

const Store = (StoreModule as any).default || StoreModule
const store = new Store()

export function setupStoreHandlers() {
  ipcMain.handle('store:get', (_, key: string) => {
    return store.get(key)
  })

  ipcMain.handle('store:set', (_, key: string, value: any) => {
    store.set(key, value)
  })

  ipcMain.handle('store:delete', (_, key: string) => {
    store.delete(key)
  })

  ipcMain.handle('store:clear', () => {
    store.clear()
  })
}
