import { app, shell, BrowserWindow, ipcMain, session } from 'electron'

// Suppress Chromium XDG portal noise on Linux
if (process.platform === 'linux') {
  const origWrite = process.stderr.write.bind(process.stderr)
  process.stderr.write = (chunk: unknown, ...args: unknown[]) => {
    const s = String(chunk)
    if (s.includes('xdg/request.cc') || s.includes('Request cancelled by user')) return true
    return (origWrite as (...a: unknown[]) => boolean)(chunk, ...args)
  }
}
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { setupFSHandlers } from './fsHandler'
import { setupYoutubeHandlers } from './youtubeHandler'
import { setupStoreHandlers } from './storeHandler'
import { setupSafeStoreHandlers } from './safeStore'
import { setupPtyHandlers } from './ptyHandler'
import { setupAIHandlers } from './ai/aiHandler'
import { setupOAuthHandlers } from './oauth/googleOAuth'
import { setupFileWatcher } from './fileWatcher'
import { setupGitHandlers } from './gitHandler'
import { setupLyriaHandlers } from './music/lyriaHandler'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.control && input.shift && input.key === 'I' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools()
    }
  })

  if (is.dev) {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
  }

  mainWindow.webContents.on('console-message', (event) => {
    const msg = event.message
    if (
      msg.includes('[vite] connecting...') ||
      msg.includes('[vite] connected.') ||
      msg.includes('Download the React DevTools') ||
      msg.includes('Autofill.enable') ||
      msg.includes('Autofill.setAddresses')
    ) {
      return
    }
    console.log(
      `[RENDERER CONSOLE] level ${event.level}: ${msg} (at ${event.sourceId}:${event.lineNumber})`
    )
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {
      /* ignore malformed URLs */
    }
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.zen.workspace')

  // Production CSP via response headers (dev keeps the loose meta tag for HMR)
  if (!is.dev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      // AI API calls now go through main process — renderer CSP is tighter
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self';",
            "script-src 'self' 'unsafe-eval' blob:;",
            "style-src 'self' 'unsafe-inline';",
            "img-src 'self' data: https:;",
            "font-src 'self' data:;",
            "connect-src 'self' https://*.youtube.com;",
            'frame-src https://www.youtube.com https://youtube.com;',
            "media-src 'self' blob:;",
            "worker-src 'self' blob:;"
          ].join(' ')
        }
      })
    })
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Initialize FS Handlers
  setupFSHandlers()
  setupYoutubeHandlers()
  setupStoreHandlers()
  setupSafeStoreHandlers()
  setupPtyHandlers()
  setupAIHandlers()
  setupOAuthHandlers()
  setupFileWatcher()
  setupGitHandlers()
  setupLyriaHandlers()
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Allow autoplay in the browser window
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
