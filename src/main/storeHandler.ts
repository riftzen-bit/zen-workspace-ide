import StoreModule from 'electron-store'
import { ipcMain, dialog } from 'electron'
import { isTrustedIpcSender } from './security'
import * as fs from 'fs/promises'

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
  'zen-custom-prompts',
  'zen-snippets',
  'zen-focus-analytics',
  'zen-keybindings',
  'zen-workspace-templates'
])

export function setupStoreHandlers() {
  ipcMain.handle('store:get', (event, key: string) => {
    if (!isTrustedIpcSender(event)) return undefined
    if (!ALLOWED_STORE_KEYS.has(key)) return undefined
    return store.get(key)
  })

  ipcMain.handle('store:set', (event, key: string, value: unknown) => {
    if (!isTrustedIpcSender(event)) return
    if (!ALLOWED_STORE_KEYS.has(key)) return
    if (typeof value !== 'object' || value === null || typeof value === 'function') return
    store.set(key, value)
  })

  ipcMain.handle('store:delete', (event, key: string) => {
    if (!isTrustedIpcSender(event)) return
    if (!ALLOWED_STORE_KEYS.has(key)) return
    store.delete(key)
  })

  ipcMain.handle('store:clear', (event) => {
    if (!isTrustedIpcSender(event)) return
    for (const key of ALLOWED_STORE_KEYS) {
      store.delete(key)
    }
  })

  // Export all settings to a JSON file
  ipcMain.handle('settings:export', async (event) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    try {
      const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: `zen-workspace-settings-${Date.now()}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (canceled || !filePath) {
        return { success: false, error: 'Cancelled' }
      }

      // Collect all non-sensitive settings
      const exportData: Record<string, unknown> = {}
      for (const key of ALLOWED_STORE_KEYS) {
        const value = store.get(key)
        if (value !== undefined) {
          exportData[key] = value
        }
      }

      // Add export metadata
      const exportPayload = {
        _meta: {
          exportedAt: new Date().toISOString(),
          version: '1.0',
          app: 'zen-workspace'
        },
        data: exportData
      }

      await fs.writeFile(filePath, JSON.stringify(exportPayload, null, 2), 'utf-8')
      return { success: true, path: filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // Import settings from a JSON file
  ipcMain.handle('settings:import', async (event) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    try {
      const { filePaths, canceled } = await dialog.showOpenDialog({
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (canceled || filePaths.length === 0) {
        return { success: false, error: 'Cancelled' }
      }

      const content = await fs.readFile(filePaths[0], 'utf-8')
      const payload = JSON.parse(content)

      // Validate structure
      if (!payload.data || typeof payload.data !== 'object') {
        return { success: false, error: 'Invalid settings file format' }
      }

      // Validate it's from our app
      if (payload._meta?.app !== 'zen-workspace') {
        return { success: false, error: 'Settings file is not from Zen Workspace' }
      }

      // Import each key if it's in the allowed list
      let importedCount = 0
      for (const [key, value] of Object.entries(payload.data)) {
        if (ALLOWED_STORE_KEYS.has(key) && typeof value === 'object' && value !== null) {
          store.set(key, value)
          importedCount++
        }
      }

      return { success: true, importedCount }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
