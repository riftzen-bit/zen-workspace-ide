import { ipcMain, BrowserWindow } from 'electron'
import chokidar, { FSWatcher } from 'chokidar'
import { getCurrentWorkspacePath } from './fsHandler'
import { isTrustedIpcSender, resolvePathWithinRoot } from './security'

let watcher: FSWatcher | null = null
let currentWorkspaceDir: string | null = null
let startingWatcher = false
let pendingWatchPath: string | null = null

// Directories to ignore when watching
const IGNORED_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/out/**',
  '**/.cache/**',
  '**/coverage/**'
]

function getWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

function emitFsEvent(channel: string, path: string) {
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, path)
  }
}

export async function stopWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close()
    watcher = null
    currentWorkspaceDir = null
  }
}

async function startWatcher(dirPath: string): Promise<void> {
  const workspace = getCurrentWorkspacePath() ?? dirPath

  const safeDirPath = resolvePathWithinRoot(workspace, dirPath, true)
  if (!safeDirPath) return

  if (currentWorkspaceDir === safeDirPath) return

  // Another start is in flight — queue the newest requested path and let the
  // already-running call pick it up after it finishes, instead of dropping
  // the request silently.
  if (startingWatcher) {
    pendingWatchPath = safeDirPath
    return
  }

  startingWatcher = true
  try {
    await stopWatcher()

    currentWorkspaceDir = safeDirPath

    watcher = chokidar.watch(safeDirPath, {
      ignored: IGNORED_PATTERNS,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })

    watcher
      .on('change', (path) => emitFsEvent('fs:fileChanged', path))
      .on('add', (path) => emitFsEvent('fs:fileCreated', path))
      .on('unlink', (path) => emitFsEvent('fs:fileDeleted', path))
      .on('addDir', (path) => emitFsEvent('fs:dirCreated', path))
      .on('unlinkDir', (path) => emitFsEvent('fs:dirDeleted', path))
      .on('error', (error) => console.error(`Watcher error: ${error}`))
  } finally {
    startingWatcher = false
  }

  if (pendingWatchPath && pendingWatchPath !== currentWorkspaceDir) {
    const next = pendingWatchPath
    pendingWatchPath = null
    await startWatcher(next)
  } else {
    pendingWatchPath = null
  }
}

export function setupFileWatcher(): void {
  // `fs:watchWorkspace(null)` is the canonical "stop watching" call — no separate
  // stop channel is exposed in the preload API.
  ipcMain.handle('fs:watchWorkspace', async (event, dirPath: string | null) => {
    if (!isTrustedIpcSender(event)) return

    if (dirPath) {
      await startWatcher(dirPath)
    } else {
      await stopWatcher()
    }
  })
}
