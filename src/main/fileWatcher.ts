import { ipcMain, BrowserWindow } from 'electron'
import chokidar, { FSWatcher } from 'chokidar'

let watcher: FSWatcher | null = null
let currentWorkspaceDir: string | null = null

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
  if (currentWorkspaceDir === dirPath) return

  // Ensure previous watcher is fully closed before starting a new one
  await stopWatcher()

  currentWorkspaceDir = dirPath

  watcher = chokidar.watch(dirPath, {
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
}

export function setupFileWatcher(): void {
  ipcMain.handle('fs:watchWorkspace', async (_event, dirPath: string) => {
    if (dirPath) {
      await startWatcher(dirPath)
    } else {
      await stopWatcher()
    }
  })

  ipcMain.handle('fs:stopWatcher', async () => {
    await stopWatcher()
  })
}
