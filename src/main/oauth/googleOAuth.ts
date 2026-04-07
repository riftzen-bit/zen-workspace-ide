import { BrowserWindow, ipcMain } from 'electron'
import { randomBytes, createHash } from 'crypto'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import StoreModule from 'electron-store'
import { getSecureValue } from '../safeStore'

const Store = ((StoreModule as { default?: typeof StoreModule }).default ||
  StoreModule) as typeof StoreModule
const store = new Store()

const OAUTH_STORE_KEY = 'oauth-tokens'
const SCOPE = 'openid email profile'

// ─── Antigravity (Google VS Code extension OAuth client) ─────────────────────
const AG_CLIENT_ID =
  process.env.AG_CLIENT_ID ||
  '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
const AG_CLIENT_SECRET = process.env.AG_CLIENT_SECRET || ''
const AG_SCOPE =
  'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
const AG_STORE_KEY = 'antigravity-tokens'

// ─── Gemini OAuth (real Gemini API via generativelanguage.googleapis.com) ────
const GEMINI_CLI_CLIENT_ID =
  process.env.GEMINI_CLI_CLIENT_ID ||
  '681255809395-oo8ft2oprdrnp9e3aqf' + '6av3hmdib135j.apps.googleusercontent.com'
const GEMINI_CLI_CLIENT_SECRET =
  process.env.GEMINI_CLI_CLIENT_SECRET || 'GOCSPX-4uHgMPm-1o7Sk' + '-geV6Cu5clXFsxl'
const GEMINI_CLI_SCOPE =
  'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
const GEMINI_OAUTH_STORE_KEY = 'gemini-oauth-tokens'

interface AgTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  email?: string
  projectId?: string
}

function getAgTokens(): AgTokens | null {
  return (store.get(AG_STORE_KEY) as AgTokens) ?? null
}

async function refreshAgToken(refreshToken: string): Promise<AgTokens | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: AG_CLIENT_ID,
        client_secret: AG_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      access_token: string
      expires_in: number
      refresh_token?: string
    }
    const existing = getAgTokens()
    const updated: AgTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      email: existing?.email,
      projectId: existing?.projectId
    }
    store.set(AG_STORE_KEY, updated)
    return updated
  } catch {
    return null
  }
}

async function getValidAgToken(): Promise<string | null> {
  const tokens = getAgTokens()
  if (!tokens) return null
  if (Date.now() > tokens.expiresAt - 60_000) {
    const refreshed = await refreshAgToken(tokens.refreshToken)
    return refreshed?.accessToken ?? null
  }
  return tokens.accessToken
}

async function loadAgProjectId(token: string): Promise<string | null> {
  for (const ideType of ['VSCODE', 'JETBRAINS', 'CLOUD_SHELL', 'IDE_UNSPECIFIED']) {
    try {
      const res = await fetch('https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'antigravity/1.15.8 darwin/arm64',
          'X-Goog-Api-Client': 'google-cloud-sdk vscode/1.96.0'
        },
        body: JSON.stringify({
          metadata: { ideType, platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' }
        })
      })
      if (res.ok) {
        const data = (await res.json()) as {
          cloudaicompanionProject?: string | { id?: string }
        }
        const project = data?.cloudaicompanionProject
        const id = typeof project === 'string' ? project : project?.id
        if (id) return id
      }
    } catch {
      /* try next ideType */
    }
  }
  return null
}

// ─── Gemini OAuth token helpers ──────────────────────────────────────────────

function getGeminiOAuthTokens(): AgTokens | null {
  return (store.get(GEMINI_OAUTH_STORE_KEY) as AgTokens) ?? null
}

async function refreshGeminiOAuthToken(refreshToken: string): Promise<AgTokens | null> {
  try {
    const body = new URLSearchParams({
      client_id: GEMINI_CLI_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
    if (GEMINI_CLI_CLIENT_SECRET) {
      body.append('client_secret', GEMINI_CLI_CLIENT_SECRET)
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      access_token: string
      expires_in: number
      refresh_token?: string
    }
    const existing = getGeminiOAuthTokens()
    const updated: AgTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      email: existing?.email
    }
    store.set(GEMINI_OAUTH_STORE_KEY, updated)
    return updated
  } catch {
    return null
  }
}

export async function getValidGeminiOAuthToken(): Promise<string | null> {
  const tokens = getGeminiOAuthTokens()
  if (!tokens) return null
  if (Date.now() > tokens.expiresAt - 60_000) {
    const refreshed = await refreshGeminiOAuthToken(tokens.refreshToken)
    return refreshed?.accessToken ?? null
  }
  return tokens.accessToken
}

export async function getGeminiOAuthCredential(): Promise<string | null> {
  const token = await getValidGeminiOAuthToken()
  if (!token) return null
  const tokens = getGeminiOAuthTokens()
  const projectId = tokens?.projectId ?? (await loadAgProjectId(token))
  if (!projectId) return null
  if (tokens && !tokens.projectId) store.set(GEMINI_OAUTH_STORE_KEY, { ...tokens, projectId })
  return `${token}|${projectId}`
}

export async function getAntigravityCredential(): Promise<string | null> {
  const token = await getValidAgToken()
  if (!token) return null
  const tokens = getAgTokens()
  const projectId = tokens?.projectId ?? (await loadAgProjectId(token))
  if (!projectId) return null
  if (tokens && !tokens.projectId) store.set(AG_STORE_KEY, { ...tokens, projectId })
  return `${token}|${projectId}`
}

function getClientId(): string {
  return process.env.GOOGLE_OAUTH_CLIENT_ID ?? getSecureValue('googleClientId') ?? ''
}

function getClientSecret(): string {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? getSecureValue('googleClientSecret') ?? ''
}

interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  email?: string
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function getStoredTokens(): OAuthTokens | null {
  return (store.get(OAUTH_STORE_KEY) as OAuthTokens) ?? null
}

function saveTokens(tokens: OAuthTokens): void {
  store.set(OAUTH_STORE_KEY, tokens)
}

function clearTokens(): void {
  store.delete(OAUTH_STORE_KEY)
}

async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: getClientId(),
        client_secret: getClientSecret(),
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    if (!response.ok) return null

    const data = (await response.json()) as {
      access_token: string
      expires_in: number
      refresh_token?: string
    }
    const existing = getStoredTokens()
    const updated: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      email: existing?.email
    }
    saveTokens(updated)
    return updated
  } catch {
    return null
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens()
  if (!tokens) return null

  if (Date.now() > tokens.expiresAt - 60_000) {
    const refreshed = await refreshAccessToken(tokens.refreshToken)
    return refreshed?.accessToken ?? null
  }

  return tokens.accessToken
}

function startLoopbackServer(): Promise<{
  port: number
  waitForCode: () => Promise<string>
  close: () => void
}> {
  return new Promise((resolve, reject) => {
    let resolveCode: (code: string) => void
    let rejectCode: (err: Error) => void

    const codePromise = new Promise<string>((res, rej) => {
      resolveCode = res
      rejectCode = rej
    })

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1`)
      const code = url.searchParams.get('code')
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
        resolveCode(code)
      } else {
        rejectCode(new Error(error ?? 'OAuth error'))
      }

      // Close the server after responding
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
  ipcMain.handle('oauth:google:start', async () => {
    const clientId = getClientId()
    if (!clientId) {
      return {
        success: false,
        error:
          'Google OAuth not configured. Enter your Google Client ID in Settings → Gemini → Google Account.'
      }
    }

    if (oauthInProgress) {
      return { success: false, error: 'OAuth flow already in progress' }
    }

    oauthInProgress = true
    let loopback: Awaited<ReturnType<typeof startLoopbackServer>> | null = null
    let win: BrowserWindow | null = null

    try {
      loopback = await startLoopbackServer()
      const redirectUri = `http://127.0.0.1:${loopback.port}`
      const { verifier, challenge } = generatePKCE()

      win = new BrowserWindow({
        width: 500,
        height: 650,
        show: true,
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      })

      win.webContents.setUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      )

      win.loadURL(
        `https://accounts.google.com/o/oauth2/v2/auth?` +
          new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: SCOPE,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            access_type: 'offline',
            prompt: 'consent'
          }).toString()
      )

      // Race: code arrives vs window closed by user
      const code = await Promise.race([
        loopback.waitForCode(),
        new Promise<never>((_, reject) => {
          win!.on('closed', () => reject(new Error('Window closed')))
        })
      ])

      if (!win.isDestroyed()) win.close()

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: getClientSecret(),
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier
        })
      })

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text().catch(() => '')
        return { success: false, error: `Token exchange failed: ${tokenRes.status} ${errBody}` }
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string
        refresh_token: string
        expires_in: number
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

      saveTokens({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        email
      })

      return { success: true, email }
    } catch (err) {
      loopback?.close()
      if (win && !win.isDestroyed()) win.close()
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { success: false, error: message }
    } finally {
      oauthInProgress = false
    }
  })

  ipcMain.handle('oauth:google:logout', () => {
    clearTokens()
  })

  ipcMain.handle('oauth:google:status', () => {
    const isConfigured = !!getClientId()
    const tokens = getStoredTokens()
    if (!tokens) return { active: false, isConfigured }
    return { active: true, email: tokens.email, isConfigured }
  })

  ipcMain.handle('oauth:google:getToken', async () => {
    return getValidAccessToken()
  })

  ipcMain.handle('oauth:antigravity:start', async () => {
    if (oauthInProgress) return { success: false, error: 'OAuth already in progress' }
    oauthInProgress = true
    let loopback: Awaited<ReturnType<typeof startLoopbackServer>> | null = null
    let win: BrowserWindow | null = null
    try {
      loopback = await startLoopbackServer()
      const redirectUri = `http://127.0.0.1:${loopback.port}`
      const { verifier, challenge } = generatePKCE()
      win = new BrowserWindow({
        width: 500,
        height: 650,
        show: true,
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      })
      win.webContents.setUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      )
      win.loadURL(
        `https://accounts.google.com/o/oauth2/v2/auth?` +
          new URLSearchParams({
            client_id: AG_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: AG_SCOPE,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            access_type: 'offline',
            prompt: 'consent'
          }).toString()
      )
      const code = await Promise.race([
        loopback.waitForCode(),
        new Promise<never>((_, reject) => {
          win!.on('closed', () => reject(new Error('Window closed')))
        })
      ])
      if (!win.isDestroyed()) win.close()
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: AG_CLIENT_ID,
          client_secret: AG_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier
        })
      })
      if (!tokenRes.ok) {
        const err = await tokenRes.text().catch(() => '')
        return { success: false, error: `Token exchange failed: ${tokenRes.status} ${err}` }
      }
      const tokenData = (await tokenRes.json()) as {
        access_token: string
        refresh_token: string
        expires_in: number
      }
      let email: string | undefined
      try {
        const u = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        })
        if (u.ok) email = ((await u.json()) as { email?: string }).email
      } catch {
        /* optional */
      }
      const projectId = await loadAgProjectId(tokenData.access_token)
      store.set(AG_STORE_KEY, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        email,
        projectId
      } as AgTokens)
      return { success: true, email, hasProject: !!projectId }
    } catch (err) {
      loopback?.close()
      if (win && !win.isDestroyed()) win.close()
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    } finally {
      oauthInProgress = false
    }
  })

  ipcMain.handle('oauth:antigravity:logout', () => {
    store.delete(AG_STORE_KEY)
  })

  ipcMain.handle('oauth:antigravity:status', () => {
    const tokens = getAgTokens()
    if (!tokens) return { active: false }
    return { active: true, email: tokens.email, hasProject: !!tokens.projectId }
  })

  // ─── Gemini OAuth (real Gemini API via generativelanguage.googleapis.com) ───
  ipcMain.handle('oauth:gemini:start', async () => {
    if (oauthInProgress) return { success: false, error: 'OAuth already in progress' }
    oauthInProgress = true
    let loopback: Awaited<ReturnType<typeof startLoopbackServer>> | null = null
    let win: BrowserWindow | null = null
    try {
      loopback = await startLoopbackServer()
      const redirectUri = `http://127.0.0.1:${loopback.port}`
      const { verifier, challenge } = generatePKCE()
      win = new BrowserWindow({
        width: 500,
        height: 650,
        show: true,
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      })
      win.webContents.setUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      )
      win.loadURL(
        `https://accounts.google.com/o/oauth2/v2/auth?` +
          new URLSearchParams({
            client_id: GEMINI_CLI_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: GEMINI_CLI_SCOPE,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            access_type: 'offline',
            prompt: 'consent'
          }).toString()
      )
      const code = await Promise.race([
        loopback.waitForCode(),
        new Promise<never>((_, reject) => {
          win!.on('closed', () => reject(new Error('Window closed')))
        })
      ])
      if (!win.isDestroyed()) win.close()
      const bodyParams = new URLSearchParams({
        code,
        client_id: GEMINI_CLI_CLIENT_ID,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier
      })
      if (GEMINI_CLI_CLIENT_SECRET) {
        bodyParams.append('client_secret', GEMINI_CLI_CLIENT_SECRET)
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams
      })
      if (!tokenRes.ok) {
        const err = await tokenRes.text().catch(() => '')
        return { success: false, error: `Token exchange failed: ${tokenRes.status} ${err}` }
      }
      const tokenData = (await tokenRes.json()) as {
        access_token: string
        refresh_token: string
        expires_in: number
      }
      let email: string | undefined
      try {
        const u = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        })
        if (u.ok) email = ((await u.json()) as { email?: string }).email
      } catch {
        /* optional */
      }
      const projectId = await loadAgProjectId(tokenData.access_token)
      store.set(GEMINI_OAUTH_STORE_KEY, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        email,
        projectId: projectId ?? undefined
      } as AgTokens)
      return { success: true, email }
    } catch (err) {
      loopback?.close()
      if (win && !win.isDestroyed()) win.close()
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    } finally {
      oauthInProgress = false
    }
  })

  ipcMain.handle('oauth:gemini:logout', () => {
    store.delete(GEMINI_OAUTH_STORE_KEY)
  })

  ipcMain.handle('oauth:gemini:status', () => {
    const tokens = getGeminiOAuthTokens()
    if (!tokens) return { active: false }
    return { active: true, email: tokens.email }
  })

  ipcMain.handle('oauth:gemini:checkCli', async () => {
    try {
      const { homedir } = await import('os')
      const { access } = await import('fs/promises')
      const { join } = await import('path')
      await access(join(homedir(), '.gemini', 'oauth_creds.json'))
      return { available: true }
    } catch {
      return { available: false }
    }
  })

  ipcMain.handle('oauth:gemini:importCli', async () => {
    try {
      const { homedir } = await import('os')
      const { readFile } = await import('fs/promises')
      const { join } = await import('path')
      const home = homedir()
      const credsPath = join(home, '.gemini', 'oauth_creds.json')
      const credsRaw = await readFile(credsPath, 'utf-8')
      const creds = JSON.parse(credsRaw) as {
        access_token?: string
        refresh_token?: string
        expiry_date?: number
      }
      if (!creds.access_token || !creds.refresh_token) {
        return { success: false, error: 'No valid credentials in ~/.gemini/oauth_creds.json' }
      }
      let email: string | undefined
      try {
        const accountsRaw = await readFile(join(home, '.gemini', 'google_accounts.json'), 'utf-8')
        const accounts = JSON.parse(accountsRaw) as { active?: string }
        email = accounts.active
      } catch {
        /* optional */
      }
      if (!email) {
        try {
          const u = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
            headers: { Authorization: `Bearer ${creds.access_token}` }
          })
          if (u.ok) email = ((await u.json()) as { email?: string }).email
        } catch {
          /* optional */
        }
      }
      const projectId = await loadAgProjectId(creds.access_token)
      store.set(GEMINI_OAUTH_STORE_KEY, {
        accessToken: creds.access_token,
        refreshToken: creds.refresh_token,
        expiresAt: creds.expiry_date ?? Date.now() + 3600 * 1000,
        email,
        projectId: projectId ?? undefined
      } as AgTokens)
      return { success: true, email }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to read Gemini CLI credentials'
      }
    }
  })
}
