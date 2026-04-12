import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { resolve as resolvePath } from 'path'
import { existsSync, readFileSync } from 'fs-extra'
import { isTrustedIpcSender } from './security'

const DEFAULT_MAX_BUFFER = 1024 * 1024 * 5

function runGit(
  cwd: string,
  args: string[],
  timeout: number,
  maxBuffer = DEFAULT_MAX_BUFFER
): Promise<{ error: Error | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd, timeout, maxBuffer, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          error: error as Error | null,
          stdout,
          stderr
        })
      }
    )
  })
}

export function setupGitHandlers(): void {
  ipcMain.handle('git:branch', async (event, cwd: string) => {
    if (!isTrustedIpcSender(event)) return null

    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return null

    const { error, stdout } = await runGit(resolved, ['rev-parse', '--abbrev-ref', 'HEAD'], 3000)
    if (error) return null
    return stdout.trim() || null
  })

  ipcMain.handle('git:status', async (event, cwd: string) => {
    if (!isTrustedIpcSender(event)) return null

    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return null

    const { error, stdout } = await runGit(resolved, ['status', '--porcelain'], 5000)
    if (error) return { staged: false, unstaged: false }

    const lines = stdout.trim().split('\n').filter(Boolean)
    const staged = lines.some((line) => /^[MARC]/.test(line))
    const unstaged = lines.some((line) => /^.[MD?]/.test(line))
    return { staged, unstaged }
  })

  ipcMain.handle('git:statusFiles', async (event, cwd: string) => {
    if (!isTrustedIpcSender(event)) return { staged: [], unstaged: [] }

    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return { staged: [], unstaged: [] }

    const { error, stdout } = await runGit(resolved, ['status', '--porcelain'], 5000)
    if (error) return { staged: [], unstaged: [] }

    const lines = stdout.trim().split('\n').filter(Boolean)
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

    return { staged, unstaged }
  })

  ipcMain.handle(
    'git:fileDiffContent',
    async (event, cwd: string, file: string, stagedOnly: boolean) => {
      if (!isTrustedIpcSender(event)) return { original: '', modified: '' }

      const resolved = resolvePath(cwd)
      if (!existsSync(resolved)) return { original: '', modified: '' }

      const getFileContentAtHead = (): Promise<string> => {
        return new Promise<string>((res) => {
          runGit(resolved, ['show', `HEAD:${file}`], 5000).then(({ error, stdout }) => {
            if (error) {
              res('') // New file or error
            } else {
              res(stdout)
            }
          })
        })
      }

      const getFileContentAtIndex = (): Promise<string> => {
        return new Promise<string>((res) => {
          runGit(resolved, ['show', `:0:${file}`], 5000).then(({ error, stdout }) => {
            if (error) {
              res('') // Error or not in index
            } else {
              res(stdout)
            }
          })
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

  ipcMain.handle('git:add', async (event, cwd: string, file: string) => {
    if (!isTrustedIpcSender(event)) return false

    const resolved = resolvePath(cwd)
    const { error } = await runGit(resolved, ['add', '--', file], 5000)
    return !error
  })

  ipcMain.handle('git:unstage', async (event, cwd: string, file: string) => {
    if (!isTrustedIpcSender(event)) return false

    const resolved = resolvePath(cwd)
    const { error } = await runGit(resolved, ['reset', 'HEAD', '--', file], 5000)
    return !error
  })

  ipcMain.handle('git:diff', async (event, cwd: string, stagedOnly: boolean) => {
    if (!isTrustedIpcSender(event)) return null

    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return null

    const args = stagedOnly ? ['diff', '--cached'] : ['diff', 'HEAD']
    const primary = await runGit(resolved, args, 10000)
    if (!primary.error) {
      return primary.stdout.trim() || null
    }

    // If HEAD doesn't exist (initial commit), git diff HEAD fails. Fallback to just git diff.
    const fallback = await runGit(resolved, ['diff'], 10000)
    if (fallback.error) return null
    return fallback.stdout.trim() || null
  })

  ipcMain.handle('git:commit', async (event, cwd: string, message: string, addAll: boolean) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return { success: false, error: 'Directory not found' }

    const safeMessage = (message ?? '').split('\0').join('').trim()
    if (!safeMessage) {
      return { success: false, error: 'Commit message is required' }
    }

    const commitArgs = addAll ? ['commit', '-a', '-m', safeMessage] : ['commit', '-m', safeMessage]
    const { error, stderr } = await runGit(resolved, commitArgs, 15000)
    if (error) {
      return { success: false, error: stderr || error.message }
    }

    return { success: true }
  })

  ipcMain.handle('git:stashList', async (event, cwd: string) => {
    if (!isTrustedIpcSender(event)) return []

    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return []

    const { error, stdout } = await runGit(
      resolved,
      ['stash', 'list', '--format=%gd|||%gs|||%ci'],
      5000
    )
    if (error || !stdout.trim()) return []

    return stdout
      .trim()
      .split('\n')
      .map((line) => {
        const [index, message, date] = line.split('|||')
        return { index: index || '', message: message || '', date: date || '' }
      })
  })

  ipcMain.handle('git:stashSave', async (event, cwd: string, message: string) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return { success: false, error: 'Directory not found' }

    const args = message?.trim() ? ['stash', 'push', '-m', message.trim()] : ['stash', 'push']
    const { error, stderr } = await runGit(resolved, args, 10000)
    if (error) {
      return { success: false, error: stderr || error.message }
    }

    return { success: true }
  })

  ipcMain.handle('git:stashPop', async (event, cwd: string, index?: string) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return { success: false, error: 'Directory not found' }

    const args = index ? ['stash', 'pop', index] : ['stash', 'pop']
    const { error, stderr } = await runGit(resolved, args, 10000)
    if (error) {
      return { success: false, error: stderr || error.message }
    }

    return { success: true }
  })

  ipcMain.handle('git:stashApply', async (event, cwd: string, index?: string) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return { success: false, error: 'Directory not found' }

    const args = index ? ['stash', 'apply', index] : ['stash', 'apply']
    const { error, stderr } = await runGit(resolved, args, 10000)
    if (error) {
      return { success: false, error: stderr || error.message }
    }

    return { success: true }
  })

  ipcMain.handle('git:stashDrop', async (event, cwd: string, index: string) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    const resolved = resolvePath(cwd)
    if (!existsSync(resolved)) return { success: false, error: 'Directory not found' }

    const { error, stderr } = await runGit(resolved, ['stash', 'drop', index], 5000)
    if (error) {
      return { success: false, error: stderr || error.message }
    }

    return { success: true }
  })
}
