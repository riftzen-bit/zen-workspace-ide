import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { resolve as resolvePath } from 'path'
import { existsSync, readFileSync } from 'fs-extra'

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
      exec('git status --porcelain', { cwd: resolved, timeout: 5000 }, (err, _stdout) => {
        if (err) {
          resolve({ staged: false, unstaged: false })
          return
        }
        const lines = _stdout.trim().split('\n').filter(Boolean)
        const staged = lines.some((line) => /^[MARC]/.test(line))
        const unstaged = lines.some((line) => /^.[MD?]/.test(line))
        resolve({ staged, unstaged })
      })
    })
  })

  ipcMain.handle('git:statusFiles', async (_, cwd: string) => {
    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return { staged: [], unstaged: [] }
    return new Promise<{
      staged: { file: string; status: string }[]
      unstaged: { file: string; status: string }[]
    }>((resolve) => {
      exec('git status --porcelain', { cwd: resolved, timeout: 5000 }, (err, _stdout) => {
        if (err) {
          resolve({ staged: [], unstaged: [] })
          return
        }
        const lines = _stdout.trim().split('\n').filter(Boolean)
        const staged: { file: string; status: string }[] = []
        const unstaged: { file: string; status: string }[] = []

        for (const line of lines) {
          const x = line[0]
          const y = line[1]
          const file = line.substring(3).trim()

          if (x !== ' ' && x !== '?') {
            staged.push({ file, status: x })
          }
          if (y !== ' ' && y !== '?') {
            unstaged.push({ file, status: y })
          }
          if (x === '?' && y === '?') {
            unstaged.push({ file, status: 'U' })
          }
        }
        resolve({ staged, unstaged })
      })
    })
  })

  ipcMain.handle(
    'git:fileDiffContent',
    async (_, cwd: string, file: string, stagedOnly: boolean) => {
      const resolved = resolvePath(cwd)
      if (!existsSync(resolved)) return { original: '', modified: '' }

      const getFileContentAtHead = (): Promise<string> => {
        return new Promise<string>((res) => {
          exec(
            `git show HEAD:"${file}"`,
            { cwd: resolved, timeout: 5000, maxBuffer: 1024 * 1024 * 5 },
            (err, stdout) => {
              if (err) {
                res('') // New file or error
              } else {
                res(stdout)
              }
            }
          )
        })
      }

      const getFileContentAtIndex = (): Promise<string> => {
        return new Promise<string>((res) => {
          exec(
            `git show :0:"${file}"`,
            { cwd: resolved, timeout: 5000, maxBuffer: 1024 * 1024 * 5 },
            (err, stdout) => {
              if (err) {
                res('') // Error or not in index
              } else {
                res(stdout)
              }
            }
          )
        })
      }

      const getFileContentAtWorkspace = (): Promise<string> => {
        return new Promise<string>((res) => {
          const fullPath = resolvePath(resolved, file)
          if (existsSync(fullPath)) {
            res(readFileSync(fullPath, 'utf-8'))
          } else {
            res('')
          }
        })
      }

      try {
        if (stagedOnly) {
          // Compare HEAD vs Index
          const original = await getFileContentAtHead()
          const modified = await getFileContentAtIndex()
          return { original, modified }
        } else {
          // Compare Index vs Workspace
          const original = await getFileContentAtIndex()
          const modified = await getFileContentAtWorkspace()
          return { original, modified }
        }
      } catch {
        return { original: '', modified: '' }
      }
    }
  )

  ipcMain.handle('git:add', async (_, cwd: string, file: string) => {
    const resolved = resolvePath(cwd)
    return new Promise<boolean>((resolve) => {
      exec(`git add "${file}"`, { cwd: resolved, timeout: 5000 }, (err) => {
        resolve(!err)
      })
    })
  })

  ipcMain.handle('git:unstage', async (_, cwd: string, file: string) => {
    const resolved = resolvePath(cwd)
    return new Promise<boolean>((resolve) => {
      exec(`git reset HEAD "${file}"`, { cwd: resolved, timeout: 5000 }, (err) => {
        resolve(!err)
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
