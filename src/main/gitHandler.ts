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

  ipcMain.handle('git:status', async (_, cwd: string) => {
    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return null
    return new Promise<{ staged: boolean; unstaged: boolean }>((resolve) => {
      exec('git status --porcelain', { cwd: resolved, timeout: 5000 }, (err, stdout) => {
        if (err) {
          resolve({ staged: false, unstaged: false })
          return
        }
        const lines = stdout.trim().split('\n').filter(Boolean)
        const staged = lines.some((line) => /^[MARC]/.test(line))
        const unstaged = lines.some((line) => /^.[MD?]/.test(line))
        resolve({ staged, unstaged })
      })
    })
  })

  ipcMain.handle('git:diff', async (_, cwd: string, stagedOnly: boolean) => {
    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return null
    return new Promise<string | null>((resolve) => {
      const cmd = stagedOnly ? 'git diff --cached' : 'git diff HEAD'
      exec(cmd, { cwd: resolved, timeout: 10000, maxBuffer: 1024 * 1024 * 5 }, (err, stdout) => {
        if (err) {
          // If HEAD doesn't exist (initial commit), git diff HEAD fails. Fallback to just git diff.
          exec(
            'git diff',
            { cwd: resolved, timeout: 10000, maxBuffer: 1024 * 1024 * 5 },
            (err2, stdout2) => {
              if (err2) {
                resolve(null)
                return
              }
              resolve(stdout2.trim() || null)
            }
          )
          return
        }
        resolve(stdout.trim() || null)
      })
    })
  })

  ipcMain.handle('git:commit', async (_, cwd: string, message: string, addAll: boolean) => {
    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return { success: false, error: 'Directory not found' }
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const escapedMessage = message.replace(/"/g, '\\"')
      const cmd = addAll
        ? `git commit -a -m "${escapedMessage}"`
        : `git commit -m "${escapedMessage}"`
      exec(cmd, { cwd: resolved, timeout: 15000 }, (err, _stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr || err.message })
          return
        }
        resolve({ success: true })
      })
    })
  })
}
