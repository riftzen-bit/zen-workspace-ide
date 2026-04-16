import { ipcMain, shell } from 'electron'
import { randomBytes, createHash } from 'crypto'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import StoreModule from 'electron-store'
import { deleteSecureValue, getSecureValue, setSecureValue } from '../safeStore'
import { isTrustedIpcSender } from '../security'

const Store = ((StoreModule as { default?: typeof StoreModule }).default ||
  StoreModule) as typeof StoreModule
const store = new Store()

const GEMINI_OAUTH_SECURE_KEY = 'geminiOAuthTokens'
const LEGACY_GEMINI_OAUTH_STORE_KEY = 'gemini-oauth-tokens'
const GEMINI_OAUTH_TOKEN_VERSION = 2
const GEMINI_CLOUD_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'
const GEMINI_RETRIEVER_SCOPE = 'https://www.googleapis.com/auth/generative-language.retriever'

const GEMINI_SCOPES = [
  GEMINI_CLOUD_SCOPE,
  GEMINI_RETRIEVER_SCOPE,
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ')

interface OAuthTokens {
  version?: number
  accessToken: string
  refreshToken: string
  expiresAt: number
  email?: string
  clientId?: string
  quotaProject?: string
}

function readSecureJson<T>(key: string): T | null {
  const raw = getSecureValue(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeSecureJson(key: string, value: unknown): void {
  setSecureValue(key, JSON.stringify(value))
}

function clearSecureJson(key: string): void {
  deleteSecureValue(key)
}

function readTokenSetWithMigration<T>(legacyKey: string, secureKey: string): T | null {
  const secureValue = readSecureJson<T>(secureKey)
  if (secureValue) return secureValue

  const legacyValue = (store.get(legacyKey) as T | undefined) ?? null
  if (!legacyValue) return null

  writeSecureJson(secureKey, legacyValue)
  store.delete(legacyKey)
  return legacyValue
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function deriveQuotaProjectFromClientId(clientId?: string): string | undefined {
  const trimmed = clientId?.trim()
  if (!trimmed) return undefined
  const match = trimmed.match(/^(\d+)-/)
  return match?.[1]
}

function normalizeGeminiOAuthTokens(tokens: OAuthTokens): OAuthTokens {
  const normalizedClientId = tokens.clientId || getUserClientId() || undefined
  const normalizedQuotaProject =
    tokens.quotaProject ?? deriveQuotaProjectFromClientId(normalizedClientId)

  if (normalizedClientId === tokens.clientId && normalizedQuotaProject === tokens.quotaProject) {
    return tokens
  }

  return {
    ...tokens,
    clientId: normalizedClientId,
    quotaProject: normalizedQuotaProject
  }
}

function getGeminiOAuthTokens(): OAuthTokens | null {
  const stored = readTokenSetWithMigration<OAuthTokens>(
    LEGACY_GEMINI_OAUTH_STORE_KEY,
    GEMINI_OAUTH_SECURE_KEY
  )
  if (!stored) return null

  if ((stored.version ?? 0) < GEMINI_OAUTH_TOKEN_VERSION) {
    clearSecureJson(GEMINI_OAUTH_SECURE_KEY)
    return null
  }

  const normalized = normalizeGeminiOAuthTokens(stored)
  if (normalized.clientId !== stored.clientId || normalized.quotaProject !== stored.quotaProject) {
    writeSecureJson(GEMINI_OAUTH_SECURE_KEY, normalized)
  }

  return normalized
}

function getUserClientId(): string {
  return getSecureValue('googleClientId') ?? ''
}

function getUserClientSecret(): string {
  return getSecureValue('googleClientSecret') ?? ''
}

async function refreshGeminiOAuthToken(tokens: OAuthTokens): Promise<OAuthTokens | null> {
  const clientId = tokens.clientId ?? getUserClientId()
  const clientSecret = getUserClientSecret()

  if (!clientId) return null

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken
    })
    if (clientSecret) {
      body.append('client_secret', clientSecret)
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })

    if (!res.ok) {
      clearSecureJson(GEMINI_OAUTH_SECURE_KEY)
      return null
    }

    const data = (await res.json()) as {
      access_token: string
      expires_in: number
      refresh_token?: string
    }
    const updated: OAuthTokens = {
      version: GEMINI_OAUTH_TOKEN_VERSION,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      email: tokens.email,
      clientId,
      quotaProject: tokens.quotaProject ?? deriveQuotaProjectFromClientId(clientId)
    }
    writeSecureJson(GEMINI_OAUTH_SECURE_KEY, updated)
    return updated
  } catch {
    clearSecureJson(GEMINI_OAUTH_SECURE_KEY)
    return null
  }
}

async function getValidGeminiOAuthTokens(): Promise<OAuthTokens | null> {
  const tokens = getGeminiOAuthTokens()
  if (!tokens) return null
  if (Date.now() > tokens.expiresAt - 60_000) {
    return await refreshGeminiOAuthToken(tokens)
  }
  return tokens
}

export interface GeminiOAuthAccess {
  accessToken: string
  quotaProject?: string
}

export async function getGeminiOAuthAccess(): Promise<GeminiOAuthAccess | null> {
  const tokens = await getValidGeminiOAuthTokens()
  if (!tokens) return null
  return {
    accessToken: tokens.accessToken,
    quotaProject: tokens.quotaProject
  }
}

export async function getValidGeminiOAuthToken(): Promise<string | null> {
  const access = await getGeminiOAuthAccess()
  return access?.accessToken ?? null
}

export async function getGeminiOAuthCredential(): Promise<string | null> {
  return getValidGeminiOAuthToken()
}

function startLoopbackServer(): Promise<{
  port: number
  waitForCode: () => Promise<{ code: string; state: string | null }>
  close: () => void
}> {
  return new Promise((resolve, reject) => {
    let resolveCode: (result: { code: string; state: string | null }) => void
    let rejectCode: (err: Error) => void

    const codePromise = new Promise<{ code: string; state: string | null }>((res, rej) => {
      resolveCode = res
      rejectCode = rej
    })

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1`)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">` +
          (code
            ? `<h2>Sign in successful</h2><p>You can close this window.</p>`
            : `<h2>Sign in failed</h2><p>${error ?? 'Unknown error'}</p>`) +
          `</body></html>`
      )

      if (code) {
        resolveCode({ code, state })
      } else {
        rejectCode(new Error(error ?? 'OAuth error'))
      }

      server.close()
    })

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        port,
        waitForCode: () => codePromise,
        close: () => server.close()
      })
    })

    server.on('error', reject)
  })
}

let oauthInProgress = false

export function setupOAuthHandlers(): void {
  // Gemini OAuth with user-supplied credentials
  ipcMain.handle('oauth:gemini:start', async (event) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Untrusted sender', errorCode: 'untrusted_sender' }
    }

    const clientId = getUserClientId()
    if (!clientId) {
      return {
        success: false,
        error:
          'No OAuth Client ID configured. Open the Setup Guide in Settings to configure your Google credentials.',
        errorCode: 'not_configured'
      }
    }

    if (oauthInProgress) {
      return {
        success: false,
        error: 'A sign-in flow is already running. Please wait and try again.',
        errorCode: 'oauth_in_progress'
      }
    }

    oauthInProgress = true
    let loopback: Awaited<ReturnType<typeof startLoopbackServer>> | null = null

    try {
      loopback = await startLoopbackServer()
      const redirectUri = `http://127.0.0.1:${loopback.port}`
      const { verifier, challenge } = generatePKCE()
      const expectedState = randomBytes(24).toString('hex')

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: GEMINI_SCOPES,
          state: expectedState,
          code_challenge: challenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent'
        }).toString()

      await shell.openExternal(authUrl)

      let timeoutHandle: NodeJS.Timeout | null = null
      const authResult = await Promise.race([
        loopback.waitForCode(),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error('OAuth timeout')), 10 * 60 * 1000)
          timeoutHandle.unref?.()
        })
      ]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle)
      })

      if (authResult.state !== expectedState) {
        return {
          success: false,
          error: 'Sign-in verification failed. Please retry.',
          errorCode: 'state_mismatch'
        }
      }

      const clientSecret = getUserClientSecret()
      const body = new URLSearchParams({
        code: authResult.code,
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier
      })
      if (clientSecret) {
        body.append('client_secret', clientSecret)
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      })

      if (!tokenRes.ok) {
        await tokenRes.text().catch(() => '')
        return {
          success: false,
          error: `Token exchange failed (${tokenRes.status}). Check your Client ID and Secret in the Setup Guide.`,
          errorCode: 'token_exchange'
        }
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string
        refresh_token?: string
        expires_in: number
      }

      if (!tokenData.refresh_token) {
        return {
          success: false,
          error: 'No refresh token returned. Please try signing in again.',
          errorCode: 'missing_refresh_token'
        }
      }

      let email: string | undefined
      try {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        })
        if (userRes.ok) {
          const user = (await userRes.json()) as { email?: string }
          email = user.email
        }
      } catch {
        // email is optional
      }

      writeSecureJson(GEMINI_OAUTH_SECURE_KEY, {
        version: GEMINI_OAUTH_TOKEN_VERSION,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        email,
        clientId,
        quotaProject: deriveQuotaProjectFromClientId(clientId)
      } as OAuthTokens)

      return { success: true, email }
    } catch (err) {
      loopback?.close()
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.includes('OAuth timeout')) {
        return {
          success: false,
          error: 'Google sign-in timed out. Please try again.',
          errorCode: 'timeout'
        }
      }
      if (message.includes('access_denied')) {
        return {
          success: false,
          error:
            'Google blocked the sign-in. You must add your Gmail address as a Test User in Google Cloud Console: go to APIs & Services → OAuth consent screen → Audience → Test users → Add your email. Then try signing in again.',
          errorCode: 'access_denied'
        }
      }
      return { success: false, error: message, errorCode: 'unknown' }
    } finally {
      oauthInProgress = false
    }
  })

  ipcMain.handle('oauth:gemini:logout', (event) => {
    if (!isTrustedIpcSender(event)) return
    clearSecureJson(GEMINI_OAUTH_SECURE_KEY)
    store.delete(LEGACY_GEMINI_OAUTH_STORE_KEY)
    // Also clean up legacy keys
    store.delete('oauth-tokens')
    store.delete('antigravity-tokens')
  })

  ipcMain.handle('oauth:gemini:status', async (event) => {
    if (!isTrustedIpcSender(event)) return { active: false }
    const tokens = await getValidGeminiOAuthTokens()
    if (!tokens) return { active: false }
    return { active: true, email: tokens.email }
  })

  // Setup guide server
  ipcMain.handle('oauth:openSetupGuide', async (event) => {
    if (!isTrustedIpcSender(event)) return { success: false }

    try {
      const { startSetupGuideServer } = await import('./setupGuide')
      const url = await startSetupGuideServer()
      await shell.openExternal(url)
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to open setup guide'
      }
    }
  })

  // Save credentials from setup guide
  ipcMain.handle(
    'oauth:saveCredentials',
    (event, params: { apiKey?: string; clientId?: string; clientSecret?: string }) => {
      if (!isTrustedIpcSender(event)) return { success: false }

      const previousClientId = getUserClientId()
      const previousClientSecret = getUserClientSecret()

      if (params.apiKey) {
        setSecureValue('geminiApiKey', params.apiKey)
      }
      if (params.clientId) {
        setSecureValue('googleClientId', params.clientId)
      }
      if (params.clientSecret !== undefined) {
        if (params.clientSecret) {
          setSecureValue('googleClientSecret', params.clientSecret)
        } else {
          deleteSecureValue('googleClientSecret')
        }
      }

      const clientIdChanged = params.clientId !== undefined && params.clientId !== previousClientId
      const clientSecretChanged =
        params.clientSecret !== undefined && params.clientSecret !== previousClientSecret
      if (clientIdChanged || clientSecretChanged) {
        clearSecureJson(GEMINI_OAUTH_SECURE_KEY)
      }

      return { success: true }
    }
  )
}
