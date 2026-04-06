import { ipcMain } from 'electron'
import * as pty from 'node-pty'
import * as os from 'os'

const ptys: Record<string, pty.IPty> = {}

export function setupPtyHandlers() {
  ipcMain.handle(
    'terminal:create',
    (event, id: string, cols: number, rows: number, commandStr?: string) => {
      if (ptys[id]) {
        ptys[id].kill()
        delete ptys[id]
      }

      const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'

      // If a custom command is provided, we can either pass it as arguments to the shell
      // or run it directly. Running it via the shell is usually safer to get env vars.
      const cmd = shell
      let args: string[] = []

      if (commandStr && commandStr !== 'Terminal') {
        if (os.platform() === 'win32') {
          args = ['-NoExit', '-Command', commandStr]
        } else {
          args = ['-c', `${commandStr}; exec bash`] // Execute command and drop into bash
        }
      }

      const ptyProcess = pty.spawn(cmd, args, {
        name: 'xterm-color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: process.cwd(), // We should ideally use the workspace dir here, but process.cwd() is ok for now. Can be updated later.
        env: process.env as any
      })

      ptys[id] = ptyProcess

      ptyProcess.onData((data) => {
        event.sender.send('terminal:onData', id, data)
      })

      ptyProcess.onExit(() => {
        event.sender.send('terminal:onExit', id)
        delete ptys[id]
      })

      return true
    }
  )

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
    }
  })
}
