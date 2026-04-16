import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { resolve as resolvePath } from 'path'
import { existsSync } from 'fs-extra'
import { readFile } from 'fs/promises'
import { isTrustedIpcSender, resolvePathWithinRoot } from './security'
import { getCurrentWorkspacePath } from './fsHandler'

const DEFAULT_MAX_BUFFER = 1024 * 1024 * 5

// Safe git ref: letters, digits, _, ., /, - (not leading). No ".." sequences.
// Blocks flag injection ("-foo"), absolute/unsafe refs, and dangerous meta.
function isSafeGitRef(ref: string): boolean {
  if (!ref || typeof ref !== 'string') return false
  if (ref.length > 200) return false
  if (ref.startsWith('-') || ref.startsWith('/')) return false
  if (ref.includes('..')) return false
  return /^[A-Za-z0-9._/-]+$/.test(ref)
}

function resolveWithinWorkspace(cwd: string): string | null {
  const workspace = getCurrentWorkspacePath()
  if (!workspace) return null
  return resolvePathWithinRoot(workspace, cwd)
}

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

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return null

    const { error, stdout } = await runGit(resolved, ['rev-parse', '--abbrev-ref', 'HEAD'], 3000)
    if (error) return null
    return stdout.trim() || null
  })

  ipcMain.handle('git:status', async (event, cwd: string) => {
    if (!isTrustedIpcSender(event)) return null

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return null

    const { error, stdout } = await runGit(resolved, ['status', '--porcelain'], 5000)
    if (error) return { staged: false, unstaged: false }

    const lines = stdout.trim().split('\n').filter(Boolean)
    const staged = lines.some((line) => /^[MARC]/.test(line))
    const unstaged = lines.some((line) => /^.[MD?]/.test(line))
    return { staged, unstaged }
  })

  ipcMain.handle('git:statusFiles', async (event, cwd: string) => {
    if (!isTrustedIpcSender(event)) return { staged: [], unstaged: [] }

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return { staged: [], unstaged: [] }

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

      const resolved = resolveWithinWorkspace(cwd)
      if (!resolved) return { original: '', modified: '' }

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

      const getFileContentAtWorkspace = async (): Promise<string> => {
        const safePath = resolvePathWithinRoot(resolved, resolvePath(resolved, file))
        if (!safePath) return ''
        if (!existsSync(safePath)) return ''
        try {
          return await readFile(safePath, 'utf-8')
        } catch {
          return ''
        }
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

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return false
    const { error } = await runGit(resolved, ['add', '--', file], 5000)
    return !error
  })

  ipcMain.handle('git:unstage', async (event, cwd: string, file: string) => {
    if (!isTrustedIpcSender(event)) return false

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return false
    const { error } = await runGit(resolved, ['reset', 'HEAD', '--', file], 5000)
    return !error
  })

  ipcMain.handle('git:diff', async (event, cwd: string, stagedOnly: boolean) => {
    if (!isTrustedIpcSender(event)) return null

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return null

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

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return { success: false, error: 'Outside workspace' }

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

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return []

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

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return { success: false, error: 'Outside workspace' }

    const args = message?.trim() ? ['stash', 'push', '-m', message.trim()] : ['stash', 'push']
    const { error, stderr } = await runGit(resolved, args, 10000)
    if (error) {
      return { success: false, error: stderr || error.message }
    }

    return { success: true }
  })

  ipcMain.handle('git:stashPop', async (event, cwd: string, index?: string) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return { success: false, error: 'Outside workspace' }

    const args = index ? ['stash', 'pop', index] : ['stash', 'pop']
    const { error, stderr } = await runGit(resolved, args, 10000)
    if (error) {
      return { success: false, error: stderr || error.message }
    }

    return { success: true }
  })

  ipcMain.handle('git:stashApply', async (event, cwd: string, index?: string) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return { success: false, error: 'Outside workspace' }

    const args = index ? ['stash', 'apply', index] : ['stash', 'apply']
    const { error, stderr } = await runGit(resolved, args, 10000)
    if (error) {
      return { success: false, error: stderr || error.message }
    }

    return { success: true }
  })

  ipcMain.handle('git:stashDrop', async (event, cwd: string, index: string) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return { success: false, error: 'Outside workspace' }

    const { error, stderr } = await runGit(resolved, ['stash', 'drop', index], 5000)
    if (error) {
      return { success: false, error: stderr || error.message }
    }

    return { success: true }
  })

  ipcMain.handle('git:log', async (event, cwd: string, limit?: number) => {
    if (!isTrustedIpcSender(event)) return []

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return []

    const count = Math.min(Math.max(Number(limit) || 50, 1), 500)
    const separator = '|||GITSEP|||'
    const { error, stdout } = await runGit(
      resolved,
      [
        'log',
        `--pretty=format:%H${separator}%h${separator}%an${separator}%ae${separator}%ct${separator}%s`,
        `-n`,
        String(count)
      ],
      10000
    )
    if (error || !stdout.trim()) return []

    return stdout
      .split('\n')
      .map((line) => {
        const parts = line.split(separator)
        if (parts.length < 6) return null
        const [hash, shortHash, author, email, timestamp, subject] = parts
        return {
          hash,
          shortHash,
          author,
          email,
          timestamp: Number(timestamp) * 1000,
          subject
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
  })

  ipcMain.handle('git:branchList', async (event, cwd: string) => {
    if (!isTrustedIpcSender(event)) return []

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return []

    const separator = '|||GITSEP|||'
    const { error, stdout } = await runGit(
      resolved,
      [
        'branch',
        '-a',
        `--format=%(refname:short)${separator}%(HEAD)${separator}%(committerdate:iso8601)`
      ],
      5000
    )
    if (error || !stdout.trim()) return []

    return stdout
      .split('\n')
      .map((line) => {
        const parts = line.split(separator)
        if (parts.length < 3) return null
        const [name, head, date] = parts
        if (!name || name.startsWith('(')) return null
        const isRemote = name.startsWith('remotes/') || name.startsWith('origin/')
        return {
          name: name.trim(),
          isCurrent: head.trim() === '*',
          isRemote,
          lastCommit: date.trim()
        }
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
  })

  ipcMain.handle('git:checkout', async (event, cwd: string, branch: string) => {
    if (!isTrustedIpcSender(event)) return { success: false, error: 'Untrusted sender' }

    const resolved = resolveWithinWorkspace(cwd)
    if (!resolved) return { success: false, error: 'Outside workspace' }

    if (!isSafeGitRef(branch)) {
      return { success: false, error: 'Invalid branch name' }
    }

    const { error, stderr } = await runGit(resolved, ['checkout', branch], 15000)
    if (error) {
      return { success: false, error: stderr || error.message }
    }

    return { success: true }
  })
}
