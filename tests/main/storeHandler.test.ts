import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron-store
const storeData: Record<string, unknown> = {}
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      get(key: string) {
        return storeData[key]
      }
      set(key: string, value: unknown) {
        storeData[key] = value
      }
      delete(key: string) {
        delete storeData[key]
      }
      clear() {
        Object.keys(storeData).forEach((k) => delete storeData[k])
      }
    }
  }
})

// Mock electron ipcMain
const handlers: Record<string, (...args: unknown[]) => unknown> = {}
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler
    }
  }
}))

import { setupStoreHandlers } from '../../src/main/storeHandler'

describe('storeHandler', () => {
  beforeEach(() => {
    // Clear store data between tests
    Object.keys(storeData).forEach((k) => delete storeData[k])
    setupStoreHandlers()
  })

  it('rejects unknown keys for get', async () => {
    const result = await handlers['store:get']({}, 'unknown-key')
    expect(result).toBeUndefined()
  })

  it('allows whitelisted keys for get', async () => {
    // Set a value first
    await handlers['store:set']({}, 'vibe-ide-settings', { key: 'value' })
    const result = await handlers['store:get']({}, 'vibe-ide-settings')
    expect(result).toEqual({ key: 'value' })
  })

  it('allows zen-projects key', async () => {
    await handlers['store:set']({}, 'zen-projects', { projects: [] })
    const result = await handlers['store:get']({}, 'zen-projects')
    expect(result).toEqual({ projects: [] })
  })

  it('allows media-storage key', async () => {
    await handlers['store:set']({}, 'media-storage', { volume: 0.8 })
    const result = await handlers['store:get']({}, 'media-storage')
    expect(result).toEqual({ volume: 0.8 })
  })

  it('rejects oauth-tokens key (managed exclusively by main process)', async () => {
    await handlers['store:set']({}, 'oauth-tokens', { accessToken: 'abc' })
    const result = await handlers['store:get']({}, 'oauth-tokens')
    expect(result).toBeUndefined()
  })

  it('rejects non-object values', async () => {
    await handlers['store:set']({}, 'vibe-ide-settings', 'string-value')
    const result = await handlers['store:get']({}, 'vibe-ide-settings')
    // Should not have stored the string
    expect(result).not.toBe('string-value')
  })

  it('rejects unknown keys for set', async () => {
    await handlers['store:set']({}, 'secret-key', { evil: true })
    const result = await handlers['store:get']({}, 'secret-key')
    expect(result).toBeUndefined()
  })

  it('delete removes a key', async () => {
    await handlers['store:set']({}, 'vibe-ide-settings', { data: 1 })
    await handlers['store:delete']({}, 'vibe-ide-settings')
    const result = await handlers['store:get']({}, 'vibe-ide-settings')
    expect(result).toBeUndefined()
  })
})
