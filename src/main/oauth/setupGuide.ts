import { createServer, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import { randomBytes } from 'crypto'
import { deleteSecureValue, getSecureValue, setSecureValue } from '../safeStore'
import { BrowserWindow } from 'electron'

let activeServer: ReturnType<typeof createServer> | null = null
let activeToken: string | null = null
let activeAutoCloseTimer: NodeJS.Timeout | null = null

function getSetupGuideHTML(port: number, token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini Setup — Zen Workspace</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #1a1918;
      --bg-subtle: #211f1e;
      --bg-input: #141312;
      --border: #2e2b29;
      --border-light: #3d3936;
      --text: #e8e4df;
      --text-secondary: #a39e97;
      --text-dim: #6b665f;
      --accent: #b8956c;
      --accent-hover: #d4ac7a;
      --error: #c75f5f;
      --success: #7a9e7a;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html { font-size: 16px; }

    body {
      font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 640px;
      margin: 0 auto;
      padding: 72px 24px 96px;
    }

    header {
      margin-bottom: 64px;
    }

    h1 {
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 12px;
      color: var(--text);
    }

    .lead {
      font-size: 15px;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .section {
      margin-bottom: 56px;
    }

    .section-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }

    h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text);
    }

    .tag {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-dim);
      padding: 3px 8px;
      border: 1px solid var(--border);
    }

    .section-intro {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 24px;
    }

    .warning {
      font-size: 13px;
      color: var(--error);
      padding: 16px;
      border: 1px solid var(--border);
      border-left: 2px solid var(--error);
      margin-bottom: 24px;
      background: var(--bg-subtle);
    }

    .warning strong {
      display: block;
      margin-bottom: 6px;
    }

    ol {
      list-style: none;
      counter-reset: steps;
    }

    li {
      counter-increment: steps;
      position: relative;
      padding-left: 32px;
      margin-bottom: 16px;
      font-size: 14px;
      color: var(--text-secondary);
    }

    li::before {
      content: counter(steps);
      position: absolute;
      left: 0;
      top: 0;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-dim);
      width: 20px;
    }

    li.highlight {
      background: var(--bg-subtle);
      border-left: 2px solid var(--success);
      padding: 14px 16px 14px 32px;
      margin-left: 0;
    }

    li.highlight::before {
      left: 10px;
      top: 14px;
    }

    li strong {
      color: var(--text);
      font-weight: 600;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover {
      color: var(--accent-hover);
    }

    code {
      font-family: 'SF Mono', Menlo, monospace;
      font-size: 12px;
      background: var(--bg-subtle);
      padding: 2px 6px;
      color: var(--text);
    }

    .sub-list {
      margin-top: 10px;
      padding-left: 0;
    }

    .sub-list li {
      padding-left: 16px;
      margin-bottom: 6px;
      font-size: 13px;
    }

    .sub-list li::before {
      content: '—';
      width: auto;
      color: var(--border-light);
    }

    .form-area {
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      padding: 24px;
      margin: 28px 0;
    }

    .field {
      margin-bottom: 20px;
    }

    .field:last-of-type {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 8px;
    }

    .input-row {
      display: flex;
      gap: 10px;
    }

    input {
      flex: 1;
      background: var(--bg-input);
      border: 1px solid var(--border);
      color: var(--text);
      font-family: 'SF Mono', Menlo, monospace;
      font-size: 13px;
      padding: 12px 14px;
      outline: none;
      transition: border-color 0.15s;
    }

    input:focus {
      border-color: var(--border-light);
    }

    input::placeholder {
      color: var(--text-dim);
    }

    button {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      font-weight: 500;
      background: var(--bg-input);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 12px 20px;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    button:hover {
      background: var(--bg-subtle);
      border-color: var(--border-light);
    }

    .status {
      display: none;
      font-size: 13px;
      padding: 12px 14px;
      margin-top: 16px;
      border: 1px solid var(--border);
    }

    .status.success {
      display: block;
      color: var(--success);
      border-color: var(--success);
      background: rgba(122, 158, 122, 0.08);
    }

    .status.error {
      display: block;
      color: var(--error);
      border-color: var(--error);
      background: rgba(199, 95, 95, 0.08);
    }

    .note {
      font-size: 13px;
      color: var(--text-dim);
      padding-left: 16px;
      border-left: 1px solid var(--border);
      margin-top: 24px;
    }

    .note strong {
      color: var(--text-secondary);
      font-weight: 600;
    }

    .divider {
      text-align: center;
      margin: 48px 0;
      position: relative;
    }

    .divider::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 1px;
      background: var(--border);
    }

    .divider span {
      position: relative;
      background: var(--bg);
      padding: 0 16px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-dim);
    }

    footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11px;
      color: var(--text-dim);
      display: flex;
      justify-content: space-between;
    }

    @media (max-width: 540px) {
      .container { padding: 48px 20px 64px; }
      h1 { font-size: 24px; }
      .input-row { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Gemini Setup</h1>
      <p class="lead">Configure your Google credentials. Keys are stored locally on your device.</p>
    </header>

    <section class="section">
      <div class="section-header">
        <h2>API Key</h2>
        <span class="tag">Recommended</span>
      </div>

      <p class="section-intro">
        The quickest path. Obtain a free API key from Google AI Studio.
      </p>

      <ol>
        <li>Visit <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> and sign in.</li>
        <li>Click <strong>Create API Key</strong> and select a project.</li>
        <li>Copy the key (begins with <code>AIza...</code>) and enter it below.</li>
      </ol>

      <div class="form-area">
        <div class="field">
          <label>API Key</label>
          <div class="input-row">
            <input type="password" id="apiKey" placeholder="AIzaSy..." autocomplete="off" spellcheck="false" />
            <button onclick="saveApiKey()">Save</button>
          </div>
        </div>
        <div id="apiKeyStatus" class="status"></div>
      </div>

      <div class="note">
        <strong>Free tier available.</strong> Heavy usage or Lyria music generation may require billing.
      </div>
    </section>

    <div class="divider"><span>or</span></div>

    <section class="section">
      <div class="section-header">
        <h2>OAuth Credentials</h2>
        <span class="tag">Advanced</span>
      </div>

      <p class="section-intro">
        For direct Google account sign-in. This method requires configuration in Google Cloud Console.
      </p>

      <div class="warning">
        <strong>Common issue: Access blocked</strong>
        This occurs when your email is not added as a Test User. Complete step 4 to resolve.
      </div>

      <ol>
        <li>Open <a href="https://console.cloud.google.com" target="_blank" rel="noopener">Google Cloud Console</a> and create or select a project.</li>

        <li>Enable the <a href="https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com" target="_blank" rel="noopener">Generative Language API</a>.</li>

        <li>Configure the <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener">OAuth consent screen</a>:
          <ol class="sub-list">
            <li>User type: <strong>External</strong></li>
            <li>App name: any (e.g., Zen Workspace)</li>
            <li>Support and developer email: your address</li>
            <li>Save and continue through Scopes</li>
          </ol>
        </li>

        <li class="highlight">
          <strong>Add yourself as Test User:</strong><br>
          OAuth consent screen → Audience → Test users → Add Users → enter your Gmail → Save.
        </li>

        <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Credentials</a> → Create Credentials → OAuth Client ID.
          <ol class="sub-list">
            <li>Application type: <strong>Desktop app</strong></li>
            <li>Create</li>
          </ol>
        </li>

        <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> from the dialog.</li>
      </ol>

      <div class="form-area">
        <div class="field">
          <label>Client ID</label>
          <input type="text" id="clientId" placeholder="xxxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false" />
        </div>
        <div class="field">
          <label>Client Secret</label>
          <input type="password" id="clientSecret" placeholder="GOCSPX-..." autocomplete="off" spellcheck="false" />
        </div>
        <div class="field">
          <button onclick="saveOAuth()">Save Credentials</button>
        </div>
        <div id="oauthStatus" class="status"></div>
      </div>

      <div class="note">
        After saving, return to Settings and select <strong>Sign in with Google</strong>.<br><br>
        Google will display a verification warning. Click <strong>Advanced</strong>, then <strong>Go to [app name] (unsafe)</strong>. This is expected for test applications.
      </div>
    </section>

    <footer>
      <span>Zen Workspace</span>
      <span>Port ${port}</span>
    </footer>
  </div>

  <script>
    const API_URL = 'http://127.0.0.1:${port}';
    const CSRF_TOKEN = '${token}';

    async function saveApiKey() {
      const apiKey = document.getElementById('apiKey').value.trim();
      const statusEl = document.getElementById('apiKeyStatus');
      if (!apiKey) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Please enter an API key.';
        return;
      }
      try {
        const res = await fetch(API_URL + '/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN },
          body: JSON.stringify({ apiKey })
        });
        const data = await res.json();
        if (data.success) {
          statusEl.className = 'status success';
          statusEl.textContent = 'Saved. You may close this page.';
        } else {
          statusEl.className = 'status error';
          statusEl.textContent = data.error || 'Failed to save.';
        }
      } catch (err) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Connection failed. Ensure the application is running.';
      }
    }

    async function saveOAuth() {
      const clientId = document.getElementById('clientId').value.trim();
      const clientSecret = document.getElementById('clientSecret').value.trim();
      const statusEl = document.getElementById('oauthStatus');
      if (!clientId) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Please enter a Client ID.';
        return;
      }
      try {
        const res = await fetch(API_URL + '/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN },
          body: JSON.stringify({ clientId, clientSecret })
        });
        const data = await res.json();
        if (data.success) {
          statusEl.className = 'status success';
          statusEl.textContent = 'Saved. Return to Settings to sign in.';
        } else {
          statusEl.className = 'status error';
          statusEl.textContent = data.error || 'Failed to save.';
        }
      } catch (err) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Connection failed. Ensure the application is running.';
      }
    }
  </script>
</body>
</html>`
}

export async function startSetupGuideServer(): Promise<string> {
  if (activeServer) {
    try {
      activeServer.close()
    } catch {
      /* ignore */
    }
    activeServer = null
  }
  if (activeAutoCloseTimer) {
    clearTimeout(activeAutoCloseTimer)
    activeAutoCloseTimer = null
  }

  return new Promise((resolve, reject) => {
    activeToken = randomBytes(32).toString('hex')
    const token = activeToken

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const { port: serverPort } = server.address() as AddressInfo
      const allowedOrigin = `http://127.0.0.1:${serverPort}`

      // Reject Host headers other than 127.0.0.1/localhost on the right port
      // to block DNS-rebinding attacks against this temporary local server.
      const hostHeader = (req.headers.host ?? '').toLowerCase()
      const allowedHosts = new Set([
        `127.0.0.1:${serverPort}`,
        `localhost:${serverPort}`,
        `[::1]:${serverPort}`
      ])
      if (!allowedHosts.has(hostHeader)) {
        res.writeHead(421, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Invalid Host')
        return
      }

      res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const url = new URL(req.url ?? '/', `http://127.0.0.1`)

      if (req.method === 'POST' && url.pathname === '/save') {
        if (req.headers['x-csrf-token'] !== token) {
          res.writeHead(403, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Invalid token' }))
          return
        }
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as {
              apiKey?: string
              clientId?: string
              clientSecret?: string
            }

            const previousClientId = getSecureValue('googleClientId') ?? ''
            const previousClientSecret = getSecureValue('googleClientSecret') ?? ''

            if (data.apiKey) {
              setSecureValue('geminiApiKey', data.apiKey)
            }
            if (data.clientId) {
              setSecureValue('googleClientId', data.clientId)
            }
            if (data.clientSecret !== undefined) {
              if (data.clientSecret) {
                setSecureValue('googleClientSecret', data.clientSecret)
              } else {
                deleteSecureValue('googleClientSecret')
              }
            }

            const clientIdChanged =
              data.clientId !== undefined && data.clientId !== previousClientId
            const clientSecretChanged =
              data.clientSecret !== undefined && data.clientSecret !== previousClientSecret
            if (clientIdChanged || clientSecretChanged) {
              deleteSecureValue('geminiOAuthTokens')
            }

            // Notify renderer to reload secure keys
            for (const win of BrowserWindow.getAllWindows()) {
              if (!win.isDestroyed()) {
                win.webContents.send('secure-keys-updated')
              }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true }))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }))
          }
        })
        return
      }

      // Serve the guide page
      const { port } = server.address() as AddressInfo
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(getSetupGuideHTML(port, token))
    })

    server.listen(0, '127.0.0.1', () => {
      activeServer = server
      const { port } = server.address() as AddressInfo
      resolve(`http://127.0.0.1:${port}`)
    })

    server.on('error', reject)

    // Auto-close after 30 minutes. Track the timer so a later startSetupGuideServer()
    // call can clear it, and .unref() so it doesn't keep the process alive on quit.
    activeAutoCloseTimer = setTimeout(
      () => {
        try {
          server.close()
        } catch {
          /* ignore */
        }
        if (activeServer === server) activeServer = null
        activeAutoCloseTimer = null
      },
      30 * 60 * 1000
    )
    activeAutoCloseTimer.unref?.()
  })
}
