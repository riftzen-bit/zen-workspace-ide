import { beforeEach, describe, expect, it, vi } from 'vitest'

const secureValues: Record<string, string> = {}
const storeValues: Record<string, unknown> = {}

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  }
}))

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      get(key: string): unknown {
        return storeValues[key]
      }
      set(key: string, value: unknown): void {
        storeValues[key] = value
      }
      delete(key: string): void {
        delete storeValues[key]
      }
      has(key: string): boolean {
        return Object.prototype.hasOwnProperty.call(storeValues, key)
      }
    }
  }
})

vi.mock('../../../src/main/safeStore', () => ({
  setSecureValue: (key: string, value: string) => {
    secureValues[key] = value
  },
  getSecureValue: (key: string) => secureValues[key] ?? null,
  deleteSecureValue: (key: string) => {
    delete secureValues[key]
  }
}))

import { getGeminiOAuthAccess, getGeminiOAuthCredential } from '../../../src/main/oauth/googleOAuth'

describe('googleOAuth getGeminiOAuthCredential', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.keys(secureValues).forEach((key) => delete secureValues[key])
    Object.keys(storeValues).forEach((key) => delete storeValues[key])
  })

  it('returns token directly when tokens are valid', async () => {
    secureValues.geminiOAuthTokens = JSON.stringify({
      version: 2,
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 10 * 60 * 1000,
      email: 'dev@example.com'
    })

    const credential = await getGeminiOAuthCredential()

    expect(credential).toBe('test-token')
  })

  it('returns null when no tokens are stored', async () => {
    const credential = await getGeminiOAuthCredential()
    expect(credential).toBeNull()
  })

  it('refreshes token when expired and clears on failure', async () => {
    secureValues.geminiOAuthTokens = JSON.stringify({
      version: 2,
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() - 1000,
      email: 'dev@example.com',
      clientId: 'test-client-id'
    })
    secureValues.googleClientId = 'test-client-id'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid'
    })
    vi.stubGlobal('fetch', fetchMock)

    const credential = await getGeminiOAuthCredential()
    expect(credential).toBeNull()
    expect(secureValues.geminiOAuthTokens).toBeUndefined()
  })

  it('refreshes token successfully when expired', async () => {
    secureValues.geminiOAuthTokens = JSON.stringify({
      version: 2,
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() - 1000,
      email: 'dev@example.com',
      clientId: 'test-client-id'
    })
    secureValues.googleClientId = 'test-client-id'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-token',
        expires_in: 3600,
        refresh_token: 'new-refresh-token'
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const credential = await getGeminiOAuthCredential()
    expect(credential).toBe('new-token')
    expect(fetchMock).toHaveBeenCalled()
  })

  it('reuses stored token consistently across multiple calls', async () => {
    secureValues.geminiOAuthTokens = JSON.stringify({
      version: 2,
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 10 * 60 * 1000,
      email: 'dev@example.com'
    })

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const first = await getGeminiOAuthCredential()
    const second = await getGeminiOAuthCredential()

    expect(first).toBe('test-token')
    expect(second).toBe('test-token')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clears legacy OAuth tokens that were created before the new scope version', async () => {
    secureValues.geminiOAuthTokens = JSON.stringify({
      accessToken: 'legacy-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 10 * 60 * 1000,
      email: 'dev@example.com'
    })

    const credential = await getGeminiOAuthCredential()

    expect(credential).toBeNull()
    expect(secureValues.geminiOAuthTokens).toBeUndefined()
  })

  it('derives quota project from client ID for OAuth access payload', async () => {
    secureValues.geminiOAuthTokens = JSON.stringify({
      version: 2,
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 10 * 60 * 1000,
      clientId: '1234567890-test.apps.googleusercontent.com'
    })

    const access = await getGeminiOAuthAccess()

    expect(access).toEqual({
      accessToken: 'test-token',
      quotaProject: '1234567890'
    })
  })
})
