import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import * as os from 'os'
import * as fs from 'fs'
import { processChunk, clearBuffer } from './activityParser'

const ptys: Record<string, pty.IPty> = {}
const ptyStatus: Record<string, 'running' | 'paused'> = {}

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

export function setupPtyHandlers() {
  ipcMain.handle(
    'terminal:create',
    (event, id: string, cols: number, rows: number, commandStr?: string, cwd?: string) => {
      if (ptys[id]) {
        ptys[id].kill()
        delete ptys[id]
        delete ptyStatus[id]
      }

      const isWin = os.platform() === 'win32'

      // Determine best shell. Prefer pwsh (PowerShell 7+) over Windows PowerShell 5.1 for speed
      let shell = process.env.SHELL || (fs.existsSync('/bin/bash') ? 'bash' : 'sh')
      if (isWin) {
        shell = 'powershell.exe'
        try {
          if (fs.existsSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe')) {
            shell = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
          } else if (fs.existsSync('C:\\Program Files\\PowerShell\\6\\pwsh.exe')) {
            shell = 'C:\\Program Files\\PowerShell\\6\\pwsh.exe'
          }
        } catch {
          // fallback
        }
      }

      let args: string[] = []

      if (isWin) {
        // Skip profile loading completely on Windows for instant startup
        // Also skip the annoying copyright banner
        if (commandStr && commandStr !== 'Terminal') {
          args = ['-NoProfile', '-NoLogo', '-NoExit', '-Command', commandStr]
        } else {
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

      ptyProcess.onData((data) => {
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
        clearBuffer(id)
        delete ptys[id]
        delete ptyStatus[id]
      })

      return true
    }
  )

  ipcMain.handle('terminal:exists', (_event, id: string) => {
    return !!ptys[id]
  })

  ipcMain.handle('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    if (ptys[id]) {
      try {
        ptys[id].resize(cols, rows)
      } catch (e) {
        console.error('Resize error:', e)
      }
    }
  })

  ipcMain.handle('terminal:write', (_event, id: string, data: string) => {
    if (ptys[id]) {
      ptys[id].write(data)
    }
  })

  ipcMain.handle('terminal:kill', (_event, id: string) => {
    if (ptys[id]) {
      ptys[id].kill()
      delete ptys[id]
      delete ptyStatus[id]
    }
  })

  ipcMain.handle('terminal:pause', (_event, id: string) => {
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
      return { success: true }
    } catch (e) {
      console.error('Pause error:', e)
      return { success: false, reason: String(e) }
    }
  })

  ipcMain.handle('terminal:resume', (_event, id: string) => {
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
      return { success: true }
    } catch (e) {
      console.error('Resume error:', e)
      return { success: false, reason: String(e) }
    }
  })

  ipcMain.handle('terminal:pauseWorkspace', (_event, terminalIds: string[]) => {
    const platform = os.platform()
    if (platform === 'win32') {
      return { success: false, reason: 'unsupported-platform', results: [] }
    }
    const results = terminalIds.map((id) => {
      if (!ptys[id]) return { id, success: false, reason: 'not-found' }
      try {
        process.kill(ptys[id].pid, 'SIGSTOP')
        ptyStatus[id] = 'paused'
        return { id, success: true }
      } catch (e) {
        return { id, success: false, reason: String(e) }
      }
    })
    return { success: true, results }
  })

  ipcMain.handle('terminal:resumeWorkspace', (_event, terminalIds: string[]) => {
    const platform = os.platform()
    if (platform === 'win32') {
      return { success: false, reason: 'unsupported-platform', results: [] }
    }
    const results = terminalIds.map((id) => {
      if (!ptys[id]) return { id, success: false, reason: 'not-found' }
      try {
        process.kill(ptys[id].pid, 'SIGCONT')
        ptyStatus[id] = 'running'
        return { id, success: true }
      } catch (e) {
        return { id, success: false, reason: String(e) }
      }
    })
    return { success: true, results }
  })
}
