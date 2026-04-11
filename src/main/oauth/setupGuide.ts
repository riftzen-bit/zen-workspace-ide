import { createServer, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import { deleteSecureValue, getSecureValue, setSecureValue } from '../safeStore'
import { BrowserWindow } from 'electron'

let activeServer: ReturnType<typeof createServer> | null = null

function getSetupGuideHTML(port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zen Workspace IDE — Gemini Setup Guide</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e4e4e7;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 720px; margin: 0 auto; }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #fafafa;
    }
    .subtitle {
      color: #71717a;
      font-size: 14px;
      margin-bottom: 40px;
    }
    .section {
      background: #18181b;
      border: 1px solid #27272a;
      padding: 28px;
      margin-bottom: 24px;
    }
    .section h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
      color: #fafafa;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section h2 .badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 2px 8px;
      background: #22c55e20;
      color: #4ade80;
      border: 1px solid #22c55e30;
    }
    .section h2 .badge.advanced {
      background: #3b82f620;
      color: #60a5fa;
      border: 1px solid #3b82f630;
    }
    .section-desc {
      color: #a1a1aa;
      font-size: 13px;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .steps {
      list-style: none;
      counter-reset: step;
    }
    .steps li {
      counter-increment: step;
      padding: 12px 0 12px 40px;
      position: relative;
      border-bottom: 1px solid #27272a;
      font-size: 13px;
      line-height: 1.7;
      color: #d4d4d8;
    }
    .steps li:last-child { border-bottom: none; }
    .steps li::before {
      content: counter(step);
      position: absolute;
      left: 0;
      top: 12px;
      width: 24px;
      height: 24px;
      background: #27272a;
      color: #a1a1aa;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    a {
      color: #60a5fa;
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
    .input-group {
      margin-top: 16px;
    }
    .input-group label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #a1a1aa;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .input-row {
      display: flex;
      gap: 8px;
    }
    input[type="text"], input[type="password"] {
      flex: 1;
      background: #0a0a0a;
      border: 1px solid #3f3f46;
      color: #fafafa;
      padding: 10px 14px;
      font-size: 13px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus { border-color: #60a5fa; }
    input::placeholder { color: #52525b; }
    button {
      background: #27272a;
      color: #fafafa;
      border: 1px solid #3f3f46;
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    button:hover { background: #3f3f46; }
    button.primary {
      background: #2563eb;
      border-color: #3b82f6;
    }
    button.primary:hover { background: #1d4ed8; }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .status {
      margin-top: 12px;
      padding: 10px 14px;
      font-size: 12px;
      display: none;
    }
    .status.success {
      display: block;
      background: #22c55e15;
      border: 1px solid #22c55e30;
      color: #4ade80;
    }
    .status.error {
      display: block;
      background: #ef444415;
      border: 1px solid #ef444430;
      color: #f87171;
    }
    .divider {
      text-align: center;
      color: #52525b;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin: 8px 0;
      position: relative;
    }
    .divider::before, .divider::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 40%;
      height: 1px;
      background: #27272a;
    }
    .divider::before { left: 0; }
    .divider::after { right: 0; }
    code {
      background: #27272a;
      padding: 1px 6px;
      font-size: 12px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      color: #e4e4e7;
    }
    .note {
      background: #27272a;
      border-left: 3px solid #f59e0b;
      padding: 12px 16px;
      font-size: 12px;
      color: #d4d4d8;
      line-height: 1.6;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Gemini Setup Guide</h1>
    <p class="subtitle">Configure your own Google credentials for Zen Workspace IDE. Your keys stay on your device.</p>

    <!-- API Key Section -->
    <div class="section">
      <h2>API Key <span class="badge">Recommended</span></h2>
      <p class="section-desc">
        The fastest way to get started. Get a free API key from Google AI Studio and paste it below.
      </p>
      <ol class="steps">
        <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> and sign in with your Google account.</li>
        <li>Click <strong>"Create API Key"</strong> and select or create a Google Cloud project.</li>
        <li>Copy the generated key (starts with <code>AIza...</code>) and paste it below.</li>
      </ol>
      <div class="input-group">
        <label>Gemini API Key</label>
        <div class="input-row">
          <input type="password" id="apiKey" placeholder="AIzaSy..." autocomplete="off" />
          <button class="primary" onclick="saveApiKey()">Save Key</button>
        </div>
      </div>
      <div id="apiKeyStatus" class="status"></div>
      <div class="note">
        <strong>Free tier:</strong> Gemini API offers a generous free tier. For heavy usage or Lyria music generation, you may need to enable billing in your Google Cloud project.
      </div>
    </div>

    <div class="divider">or</div>

    <!-- OAuth Section -->
    <div class="section">
      <h2>OAuth Credentials <span class="badge advanced">Advanced</span></h2>
      <p class="section-desc">
        For users who prefer OAuth-based authentication instead of an API key. This lets you sign in with your Google account directly.
        <br><strong>Note:</strong> This requires several steps in Google Cloud Console. If you want something simpler, use the API Key option above.
      </p>

      <div style="background: #ef444420; border: 1px solid #ef444440; border-left: 3px solid #ef4444; padding: 14px 16px; margin-bottom: 20px; font-size: 12px; line-height: 1.7; color: #fca5a5;">
        <strong style="color: #f87171; font-size: 13px;">Common Error: "Access blocked / has not completed verification"</strong><br>
        This happens when you forget to add your email as a <strong>Test User</strong>. You MUST complete step 4 below or Google will block your sign-in.
      </div>

      <ol class="steps">
        <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener">Google Cloud Console</a>. Create a <strong>new project</strong> (or select an existing one).</li>

        <li>Enable the <strong>Generative Language API</strong>: go to <a href="https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com" target="_blank" rel="noopener">APIs & Services &rarr; Library &rarr; Generative Language API</a> and click <strong>Enable</strong>.</li>

        <li>Configure the <strong>OAuth Consent Screen</strong> at <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener">APIs & Services &rarr; OAuth consent screen</a>:
          <br>&nbsp;&nbsp;- User Type: <strong>External</strong>, click Create
          <br>&nbsp;&nbsp;- App name: anything (e.g. "Zen Workspace IDE")
          <br>&nbsp;&nbsp;- User support email: your email
          <br>&nbsp;&nbsp;- Developer contact: your email
          <br>&nbsp;&nbsp;- Click <strong>Save and Continue</strong>
          <br>&nbsp;&nbsp;- On the <strong>Scopes</strong> page: you can skip this (click Save and Continue)
          <br>&nbsp;&nbsp;- On the <strong>Test users</strong> page: see step 4 below
        </li>

        <li style="background: #22c55e10; border-left: 3px solid #22c55e; padding-left: 36px; margin-left: -40px; padding-right: 12px;">
          <strong style="color: #4ade80;">CRITICAL &mdash; Add yourself as Test User:</strong>
          <br>Go to <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener">OAuth consent screen</a> &rarr; click <strong>Audience</strong> (in the left sidebar or tabs) &rarr; scroll to <strong>Test users</strong> &rarr; click <strong>+ Add Users</strong> &rarr; enter <strong>your Gmail address</strong> (the one you will sign in with) &rarr; click <strong>Save</strong>.
          <br><br>
          <span style="color: #fca5a5;">Without this step, Google will block sign-in with: "Access blocked: has not completed the Google verification process"</span>
        </li>

        <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Credentials</a> &rarr; <strong>Create Credentials</strong> &rarr; <strong>OAuth Client ID</strong>.
          <br>&nbsp;&nbsp;- Application type: <strong>Desktop app</strong>
          <br>&nbsp;&nbsp;- Name: anything
          <br>&nbsp;&nbsp;- Click Create
        </li>

        <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> shown in the popup, and paste them below.</li>
      </ol>

      <div class="input-group">
        <label>OAuth Client ID</label>
        <input type="text" id="clientId" placeholder="xxxxx.apps.googleusercontent.com" autocomplete="off" />
      </div>
      <div class="input-group">
        <label>OAuth Client Secret</label>
        <input type="password" id="clientSecret" placeholder="GOCSPX-..." autocomplete="off" />
      </div>
      <div class="input-group" style="margin-top: 20px;">
        <button class="primary" onclick="saveOAuth()">Save OAuth Credentials</button>
      </div>
      <div id="oauthStatus" class="status"></div>
      <div class="note">
        <strong>Project tip:</strong> use the <strong>same Google Cloud project</strong> for both the OAuth Client and the <strong>Generative Language API</strong>. Zen Workspace IDE derives the quota project automatically from your OAuth Client ID.
        <br><br>
        After saving, go back to Zen Workspace IDE Settings and click <strong>"Sign in with Google"</strong>.
        <br><br>
        <strong>When signing in:</strong> Google will show <em>"This app isn't verified"</em>. Click <strong>"Advanced"</strong> &rarr; <strong>"Go to [your app name] (unsafe)"</strong> to continue. This is normal for testing-mode apps.
      </div>
    </div>
  </div>

  <script>
    const API_URL = 'http://127.0.0.1:${port}';

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey })
        });
        const data = await res.json();
        if (data.success) {
          statusEl.className = 'status success';
          statusEl.textContent = 'API key saved! You can close this page and return to Zen Workspace IDE.';
        } else {
          statusEl.className = 'status error';
          statusEl.textContent = data.error || 'Failed to save.';
        }
      } catch (err) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Could not connect to Zen Workspace IDE. Make sure the app is running.';
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, clientSecret })
        });
        const data = await res.json();
        if (data.success) {
          statusEl.className = 'status success';
          statusEl.textContent = 'OAuth credentials saved! Go back to Zen Workspace IDE and click "Sign in with Google" in Settings.';
        } else {
          statusEl.className = 'status error';
          statusEl.textContent = data.error || 'Failed to save.';
        }
      } catch (err) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Could not connect to Zen Workspace IDE. Make sure the app is running.';
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

  return new Promise((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // CORS headers for localhost
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const url = new URL(req.url ?? '/', `http://127.0.0.1`)

      if (req.method === 'POST' && url.pathname === '/save') {
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
      res.end(getSetupGuideHTML(port))
    })

    server.listen(0, '127.0.0.1', () => {
      activeServer = server
      const { port } = server.address() as AddressInfo
      resolve(`http://127.0.0.1:${port}`)
    })

    server.on('error', reject)

    // Auto-close after 30 minutes
    setTimeout(
      () => {
        try {
          server.close()
        } catch {
          /* ignore */
        }
        if (activeServer === server) activeServer = null
      },
      30 * 60 * 1000
    )
  })
}
