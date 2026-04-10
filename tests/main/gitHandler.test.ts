import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { existsSync, readFileSync } from 'fs-extra'
import { setupGitHandlers } from '../../src/main/gitHandler'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

vi.mock('child_process', () => ({
  exec: vi.fn()
}))

vi.mock('fs-extra', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}))

vi.mock('path', () => ({
  resolve: (...args: string[]) => args.join('/')
}))

describe('gitHandler', () => {
  const handlers: Record<string, (...args: any[]) => any> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    ;(ipcMain.handle as any).mockImplementation((name: string, fn: (...args: any[]) => any) => {
      handlers[name] = fn
    })
    setupGitHandlers()
  })

  it('git:branch returns branch name on success', async () => {
    ;(existsSync as any).mockReturnValue(true)
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => {
      cb(null, 'main\n')
    })

    const result = await handlers['git:branch'](null, '/repo')
    expect(result).toBe('main')
    expect(exec).toHaveBeenCalledWith(
      'git rev-parse --abbrev-ref HEAD',
      expect.objectContaining({ cwd: '/repo' }),
      expect.any(Function)
    )
  })

  it('git:branch returns null if directory does not exist', async () => {
    ;(existsSync as any).mockReturnValue(false)
    const result = await handlers['git:branch'](null, '/invalid')
    expect(result).toBeNull()
  })

  it('git:status returns correct staged/unstaged boolean flags', async () => {
    ;(existsSync as any).mockReturnValue(true)
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => {
      cb(null, 'M  staged-file.ts\n M unstaged-file.ts\n?? new-file.ts')
    })

    const result = await handlers['git:status'](null, '/repo')
    expect(result).toEqual({ staged: true, unstaged: true })
  })

  it('git:statusFiles parses porcelain output correctly', async () => {
    ;(existsSync as any).mockReturnValue(true)
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => {
      cb(null, 'M  staged.ts\n M unstaged.ts\n?? untracked.ts\nAM added-staged-and-unstaged.ts')
    })

    const result = await handlers['git:statusFiles'](null, '/repo')
    expect(result.staged).toContainEqual({ file: 'staged.ts', status: 'M' })
    expect(result.staged).toContainEqual({ file: 'added-staged-and-unstaged.ts', status: 'A' })
    expect(result.unstaged).toContainEqual({ file: 'unstaged.ts', status: 'M' })
    expect(result.unstaged).toContainEqual({ file: 'untracked.ts', status: 'U' })
    expect(result.unstaged).toContainEqual({ file: 'added-staged-and-unstaged.ts', status: 'M' })
  })

  it('git:fileDiffContent compares HEAD and Index when stagedOnly is true', async () => {
    ;(existsSync as any).mockReturnValue(true)
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => {
      if (cmd.includes('HEAD:')) cb(null, 'old content')
      else if (cmd.includes(':0:')) cb(null, 'staged content')
    })

    const result = await handlers['git:fileDiffContent'](null, '/repo', 'test.ts', true)
    expect(result).toEqual({ original: 'old content', modified: 'staged content' })
  })

  it('git:fileDiffContent compares Index and Workspace when stagedOnly is false', async () => {
    ;(existsSync as any).mockReturnValue(true)
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => {
      if (cmd.includes(':0:')) cb(null, 'staged content')
    })
    ;(readFileSync as any).mockReturnValue('workspace content')

    const result = await handlers['git:fileDiffContent'](null, '/repo', 'test.ts', false)
    expect(result).toEqual({ original: 'staged content', modified: 'workspace content' })
  })

  it('git:add executes git add command', async () => {
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => cb(null))
    const result = await handlers['git:add'](null, '/repo', 'file.ts')
    expect(result).toBe(true)
    expect(exec).toHaveBeenCalledWith('git add "file.ts"', expect.any(Object), expect.any(Function))
  })

  it('git:unstage executes git reset command', async () => {
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => cb(null))
    const result = await handlers['git:unstage'](null, '/repo', 'file.ts')
    expect(result).toBe(true)
    expect(exec).toHaveBeenCalledWith(
      'git reset HEAD "file.ts"',
      expect.any(Object),
      expect.any(Function)
    )
  })

  it('git:diff handles staged diff', async () => {
    ;(existsSync as any).mockReturnValue(true)
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => cb(null, 'diff content'))
    const result = await handlers['git:diff'](null, '/repo', true)
    expect(result).toBe('diff content')
    expect(exec).toHaveBeenCalledWith('git diff --cached', expect.any(Object), expect.any(Function))
  })

  it('git:diff falls back if HEAD does not exist', async () => {
    ;(existsSync as any).mockReturnValue(true)
    let callCount = 0
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => {
      callCount++
      if (cmd === 'git diff HEAD') cb(new Error('no head'))
      else cb(null, 'fallback diff')
    })
    const result = await handlers['git:diff'](null, '/repo', false)
    expect(result).toBe('fallback diff')
    expect(callCount).toBe(2)
  })

  it('git:commit executes commit command with message escaping', async () => {
    ;(existsSync as any).mockReturnValue(true)
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => cb(null))
    const result = await handlers['git:commit'](null, '/repo', 'feat: "test"', false)
    expect(result.success).toBe(true)
    expect(exec).toHaveBeenCalledWith(
      'git commit -m "feat: \\"test\\""',
      expect.any(Object),
      expect.any(Function)
    )
  })

  it('git:commit uses -a flag when addAll is true', async () => {
    ;(existsSync as any).mockReturnValue(true)
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) => cb(null))
    await handlers['git:commit'](null, '/repo', 'msg', true)
    expect(exec).toHaveBeenCalledWith(
      'git commit -a -m "msg"',
      expect.any(Object),
      expect.any(Function)
    )
  })

  it('git:commit returns error message on failure', async () => {
    ;(existsSync as any).mockReturnValue(true)
    ;(exec as any).mockImplementation((cmd: string, opts: any, cb: any) =>
      cb(new Error('fail'), '', 'stderr error')
    )
    const result = await handlers['git:commit'](null, '/repo', 'msg', false)
    expect(result.success).toBe(false)
    expect(result.error).toBe('stderr error')
  })
})
