import { ipcMain, safeStorage } from 'electron'
import StoreModule from 'electron-store'
import { isTrustedIpcSender } from './security'

const Store = ((StoreModule as { default?: typeof StoreModule }).default ||
  StoreModule) as typeof StoreModule
const store = new Store()

// Keys that must be encrypted at rest
const SENSITIVE_KEYS = new Set([
  'geminiApiKey',
  'openaiApiKey',
  'anthropicApiKey',
  'groqApiKey',
  'googleClientId',
  'googleClientSecret',
  'lyriaApiKey',
  'googleOAuthTokens',
  'geminiOAuthTokens'
])
const PREFIX = 'encrypted:'

function encryptValue(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) return value
  return safeStorage.encryptString(value).toString('base64')
}

function decryptValue(encoded: string): string {
  if (!safeStorage.isEncryptionAvailable()) return encoded
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
}

// One-time migration: move plaintext keys from vibe-ide-settings into encrypted storage
function migrateOldKeys(): void {
  const settings = store.get('vibe-ide-settings') as Record<string, unknown> | undefined
  if (!settings || typeof settings !== 'object') return

  let changed = false
  for (const key of SENSITIVE_KEYS) {
    const encKey = PREFIX + key
    const oldVal = settings[key]
    if (typeof oldVal === 'string' && oldVal && !store.has(encKey)) {
      store.set(encKey, encryptValue(oldVal))
      settings[key] = ''
      changed = true
    }
  }

  if (changed) {
    store.set('vibe-ide-settings', settings)
  }
}

/** Write a sensitive key directly from main process (no IPC round-trip). */
export function setSecureValue(key: string, value: string): void {
  if (!SENSITIVE_KEYS.has(key)) return
  store.set(PREFIX + key, encryptValue(value))
}

/** Delete a sensitive key directly from main process. */
export function deleteSecureValue(key: string): void {
  if (!SENSITIVE_KEYS.has(key)) return
  store.delete(PREFIX + key)
}

/** Read a sensitive key directly from main process (no IPC round-trip). */
export function getSecureValue(key: string): string | null {
  if (!SENSITIVE_KEYS.has(key)) return null
  const encoded = store.get(PREFIX + key) as string | undefined
  if (!encoded) return null
  try {
    return decryptValue(encoded)
  } catch {
    return null
  }
}

export function setupSafeStoreHandlers(): void {
  migrateOldKeys()

  ipcMain.handle('secure-store:get', (_, key: string): string | null => {
    if (!isTrustedIpcSender(_)) return null
    if (!SENSITIVE_KEYS.has(key)) return null
    const encoded = store.get(PREFIX + key) as string | undefined
    if (!encoded) return null
    try {
      return decryptValue(encoded)
    } catch {
      return null
    }
  })

  ipcMain.handle('secure-store:set', (_, key: string, value: string): void => {
    if (!isTrustedIpcSender(_)) return
    if (!SENSITIVE_KEYS.has(key) || typeof value !== 'string') return
    store.set(PREFIX + key, encryptValue(value))
  })

  ipcMain.handle('secure-store:delete', (_, key: string): void => {
    if (!isTrustedIpcSender(_)) return
    if (!SENSITIVE_KEYS.has(key)) return
    store.delete(PREFIX + key)
  })
}
