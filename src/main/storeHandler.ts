import StoreModule from 'electron-store'
import { ipcMain } from 'electron'

const Store = ((StoreModule as { default?: typeof StoreModule }).default ||
  StoreModule) as typeof StoreModule
const store = new Store()

const ALLOWED_STORE_KEYS = new Set([
  'vibe-ide-settings',
  'vibe-ide-chat-history',
  'vibe-ide-terminal-workspaces',
  'file-storage',
  'zen-projects',
  'media-storage',
  'zen-custom-prompts'
])

export function setupStoreHandlers() {
  ipcMain.handle('store:get', (_, key: string) => {
    if (!ALLOWED_STORE_KEYS.has(key)) return undefined
    return store.get(key)
  })

  ipcMain.handle('store:set', (_, key: string, value: unknown) => {
    if (!ALLOWED_STORE_KEYS.has(key)) return
    if (typeof value !== 'object' || value === null || typeof value === 'function') return
    store.set(key, value)
  })

  ipcMain.handle('store:delete', (_, key: string) => {
    if (!ALLOWED_STORE_KEYS.has(key)) return
    store.delete(key)
  })

  ipcMain.handle('store:clear', () => {
    for (const key of ALLOWED_STORE_KEYS) {
      store.delete(key)
    }
  })
}
