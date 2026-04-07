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

function stopWatcher(): Promise<void> {
  if (watcher) {
    return watcher.close().then(() => {
      watcher = null
      currentWorkspaceDir = null
    })
  }
  return Promise.resolve()
}

function startWatcher(dirPath: string): void {
  if (currentWorkspaceDir === dirPath) return

  stopWatcher().then(() => {
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
      .on('change', (filePath: string) => {
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('fs:fileChanged', filePath)
        }
      })
      .on('add', (filePath: string) => {
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('fs:fileCreated', filePath)
        }
      })
      .on('unlink', (filePath: string) => {
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('fs:fileDeleted', filePath)
        }
      })
      .on('addDir', (dirPath: string) => {
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('fs:dirCreated', dirPath)
        }
      })
      .on('unlinkDir', (dirPath: string) => {
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('fs:dirDeleted', dirPath)
        }
      })
  })
}

export function setupFileWatcher(): void {
  ipcMain.handle('fs:watchWorkspace', (_event, dirPath: string) => {
    if (dirPath) {
      startWatcher(dirPath)
    } else {
      stopWatcher()
    }
  })

  ipcMain.handle('fs:stopWatcher', () => {
    stopWatcher()
  })
}
