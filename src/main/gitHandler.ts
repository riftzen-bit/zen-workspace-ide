import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { resolve as resolvePath } from 'path'
import { existsSync } from 'fs'

export function setupGitHandlers(): void {
  ipcMain.handle('git:branch', async (_, cwd: string) => {
    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return null
    return new Promise<string | null>((resolve) => {
      exec('git rev-parse --abbrev-ref HEAD', { cwd: resolved, timeout: 3000 }, (err, stdout) => {
        if (err) {
          resolve(null)
          return
        }
        resolve(stdout.trim() || null)
      })
    })
  })
}
