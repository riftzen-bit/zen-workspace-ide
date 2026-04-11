import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import * as os from 'os'
import * as fs from 'fs'
import { processChunk, clearBuffer } from './activityParser'
import { isTrustedIpcSender } from './security'

const ptys: Record<string, pty.IPty> = {}
const ptyStatus: Record<string, 'running' | 'paused'> = {}
const ptyCreatedAt: Record<string, number> = {}
const ptyReadyAt: Record<string, number | undefined> = {}

const SENSITIVE_ENV =
  /^(.*SECRET|.*TOKEN|.*KEY|.*PASSWORD|.*CREDENTIAL|.*AUTH|.*PRIVATE|.*SIGNING)$/i

function getSanitizedEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !SENSITIVE_ENV.test(k)) {
      env[k] = v
    }
  }
  return env
}

function resizePty(id: string, cols: number, rows: number): void {
  if (ptys[id]) {
    try {
      ptys[id].resize(cols, rows)
    } catch (e) {
      console.error('Resize error:', e)
    }
  }
}

function writePty(id: string, data: string): boolean {
  if (!ptys[id]) {
    return false
  }

  try {
    ptys[id].write(data)
    return true
  } catch (e) {
    console.error('Write error:', e)
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPtyReady(id: string): boolean {
  if (!ptys[id]) {
    return false
  }

  const readyAt = ptyReadyAt[id]
  if (readyAt) {
    return true
  }

  const createdAt = ptyCreatedAt[id]
  return createdAt !== undefined && Date.now() - createdAt >= 250
}

async function waitForPtyReady(id: string, timeoutMs = 1200): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (isPtyReady(id)) {
      return true
    }
    await sleep(25)
  }

  return isPtyReady(id)
}

function emitManualActivity(
  terminalId: string,
  event: {
    type: string
    message: string
    agentStatus?: 'idle' | 'working' | 'waiting' | 'error' | 'done' | 'paused'
  }
) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send('terminal:activity', {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      terminalId,
      ...event,
      timestamp: Date.now()
    })
  }
}

export function setupPtyHandlers() {
  ipcMain.handle(
    'terminal:create',
    (event, id: string, cols: number, rows: number, commandStr?: string, cwd?: string) => {
      if (!isTrustedIpcSender(event)) return false

      if (ptys[id]) {
        ptys[id].kill()
        delete ptys[id]
        delete ptyStatus[id]
      }

      const isWin = os.platform() === 'win32'

      // Determine best shell. Prefer pwsh (PowerShell 7+) over Windows PowerShell 5.1 for speed
      let shell = process.env.SHELL || (fs.existsSync('/bin/bash') ? 'bash' : 'sh')
      let pwshPath = 'powershell.exe'
      if (isWin) {
        try {
          if (fs.existsSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe')) {
            pwshPath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
          } else if (fs.existsSync('C:\\Program Files\\PowerShell\\6\\pwsh.exe')) {
            pwshPath = 'C:\\Program Files\\PowerShell\\6\\pwsh.exe'
          }
        } catch {
          // fallback
        }
      }

      let args: string[] = []

      if (isWin) {
        const command = (commandStr ?? '').trim()
        if (command && command !== 'Terminal') {
          // cmd.exe starts faster for launching single CLIs than starting a full PowerShell host.
          shell = process.env.COMSPEC || 'cmd.exe'
          args = ['/d', '/s', '/k', command]
        } else {
          // Skip profile loading for fastest plain terminal startup.
          shell = pwshPath
          args = ['-NoProfile', '-NoLogo']
        }
      } else {
        if (commandStr && commandStr !== 'Terminal') {
          const execShell = shell.includes('zsh') ? 'zsh' : shell.includes('fish') ? 'fish' : shell
          args = ['-c', `${commandStr}; exec ${execShell}`]
        }
      }

      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: cwd || process.env.HOME || process.env.USERPROFILE || process.cwd(),
        env: getSanitizedEnv(),
        useConpty: isWin // Uses faster modern ConPTY backend on Windows 10+
      })

      ptys[id] = ptyProcess
      ptyStatus[id] = 'running'
      ptyCreatedAt[id] = Date.now()
      ptyReadyAt[id] = undefined

      ptyProcess.onData((data) => {
        if (!ptyReadyAt[id]) {
          ptyReadyAt[id] = Date.now()
        }
        if (!event.sender.isDestroyed()) {
          event.sender.send('terminal:onData', id, data)
        }

        // Secondary listener: parse for activity events
        const activities = processChunk(id, data)
        if (activities.length > 0) {
          const win = BrowserWindow.getAllWindows()[0]
          if (win && !win.isDestroyed()) {
            for (const act of activities) {
              win.webContents.send('terminal:activity', act)
            }
          }
        }
      })

      ptyProcess.onExit(() => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('terminal:onExit', id)
        }
        emitManualActivity(id, { type: 'status', message: 'Terminal exited', agentStatus: 'done' })
        clearBuffer(id)
        delete ptys[id]
        delete ptyStatus[id]
        delete ptyCreatedAt[id]
        delete ptyReadyAt[id]
      })

      return true
    }
  )

  ipcMain.handle('terminal:exists', (_event, id: string) => {
    if (!isTrustedIpcSender(_event)) return false
    return !!ptys[id]
  })

  ipcMain.handle('terminal:broadcast', async (_event, terminalIds: string[], data: string) => {
    if (!isTrustedIpcSender(_event)) {
      return {
        dispatched: [],
        unavailable: terminalIds.map((id) => ({ id, reason: 'untrusted-sender' }))
      }
    }

    const uniqueIds = [...new Set(terminalIds.filter((id) => typeof id === 'string' && id.trim()))]
    const unavailable: Array<{ id: string; reason: string }> = []
    const dispatched: string[] = []

    await Promise.all(
      uniqueIds.map(async (id) => {
        const ready = await waitForPtyReady(id)
        if (!ready) {
          unavailable.push({ id, reason: ptys[id] ? 'not-ready' : 'not-found' })
          return
        }

        if (!writePty(id, data)) {
          unavailable.push({ id, reason: 'write-failed' })
          return
        }

        dispatched.push(id)
      })
    )

    return { dispatched, unavailable }
  })

  ipcMain.on('terminal:resize', (event, id: string, cols: number, rows: number) => {
    if (!isTrustedIpcSender(event)) return
    resizePty(id, cols, rows)
  })

  ipcMain.handle('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    if (!isTrustedIpcSender(_event)) return
    resizePty(id, cols, rows)
  })

  ipcMain.on('terminal:write', (event, id: string, data: string) => {
    if (!isTrustedIpcSender(event)) return
    writePty(id, data)
  })

  ipcMain.handle('terminal:write', (_event, id: string, data: string) => {
    if (!isTrustedIpcSender(_event)) return
    writePty(id, data)
  })

  ipcMain.handle('terminal:kill', (_event, id: string) => {
    if (!isTrustedIpcSender(_event)) return
    if (ptys[id]) {
      ptys[id].kill()
      delete ptys[id]
      delete ptyStatus[id]
      delete ptyCreatedAt[id]
      delete ptyReadyAt[id]
    }
  })

  ipcMain.handle('terminal:pause', (_event, id: string) => {
    if (!isTrustedIpcSender(_event)) {
      return { success: false, reason: 'untrusted-sender' }
    }

    const platform = os.platform()
    if (platform === 'win32') {
      return { success: false, reason: 'unsupported-platform' }
    }
    if (!ptys[id]) {
      return { success: false, reason: 'not-found' }
    }
    try {
      process.kill(ptys[id].pid, 'SIGSTOP')
      ptyStatus[id] = 'paused'
      emitManualActivity(id, { type: 'status', message: 'Workspace paused', agentStatus: 'paused' })
      return { success: true }
    } catch (e) {
      console.error('Pause error:', e)
      return { success: false, reason: String(e) }
    }
  })

  ipcMain.handle('terminal:resume', (_event, id: string) => {
    if (!isTrustedIpcSender(_event)) {
      return { success: false, reason: 'untrusted-sender' }
    }

    const platform = os.platform()
    if (platform === 'win32') {
      return { success: false, reason: 'unsupported-platform' }
    }
    if (!ptys[id]) {
      return { success: false, reason: 'not-found' }
    }
    try {
      process.kill(ptys[id].pid, 'SIGCONT')
      ptyStatus[id] = 'running'
      emitManualActivity(id, { type: 'status', message: 'Workspace resumed', agentStatus: 'idle' })
      return { success: true }
    } catch (e) {
      console.error('Resume error:', e)
      return { success: false, reason: String(e) }
    }
  })

  ipcMain.handle('terminal:pauseWorkspace', (_event, terminalIds: string[]) => {
    if (!isTrustedIpcSender(_event)) {
      return { success: false, reason: 'untrusted-sender', results: [] }
    }

    const platform = os.platform()
    if (platform === 'win32') {
      return { success: false, reason: 'unsupported-platform', results: [] }
    }
    const results = terminalIds.map((id) => {
      if (!ptys[id]) return { id, success: false, reason: 'not-found' }
      try {
        process.kill(ptys[id].pid, 'SIGSTOP')
        ptyStatus[id] = 'paused'
        emitManualActivity(id, {
          type: 'status',
          message: 'Workspace paused',
          agentStatus: 'paused'
        })
        return { id, success: true }
      } catch (e) {
        return { id, success: false, reason: String(e) }
      }
    })
    return { success: true, results }
  })

  ipcMain.handle('terminal:resumeWorkspace', (_event, terminalIds: string[]) => {
    if (!isTrustedIpcSender(_event)) {
      return { success: false, reason: 'untrusted-sender', results: [] }
    }

    const platform = os.platform()
    if (platform === 'win32') {
      return { success: false, reason: 'unsupported-platform', results: [] }
    }
    const results = terminalIds.map((id) => {
      if (!ptys[id]) return { id, success: false, reason: 'not-found' }
      try {
        process.kill(ptys[id].pid, 'SIGCONT')
        ptyStatus[id] = 'running'
        emitManualActivity(id, {
          type: 'status',
          message: 'Workspace resumed',
          agentStatus: 'idle'
        })
        return { id, success: true }
      } catch (e) {
        return { id, success: false, reason: String(e) }
      }
    })
    return { success: true, results }
  })
}
