import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain, BrowserWindow } from 'electron'
import chokidar from 'chokidar'
import { setupFileWatcher } from '../../src/main/fileWatcher'

vi.mock('electron', () => {
  const mockWebContents = {
    send: vi.fn()
  }
  const mockWindow = {
    webContents: mockWebContents,
    isDestroyed: vi.fn(() => false)
  }
  return {
    ipcMain: {
      handle: vi.fn()
    },
    BrowserWindow: {
      getAllWindows: vi.fn(() => [mockWindow])
    }
  }
})

vi.mock('chokidar', () => {
  const mockWatcher = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined)
  }
  return {
    default: {
      watch: vi.fn(() => mockWatcher)
    }
  }
})

describe('fileWatcher', () => {
  let handlers: Record<string, any> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    ;(ipcMain.handle as any).mockImplementation((channel: string, callback: any) => {
      handlers[channel] = callback
    })
  })

  it('should register IPC handlers', () => {
    setupFileWatcher()
    expect(ipcMain.handle).toHaveBeenCalledWith('fs:watchWorkspace', expect.any(Function))
  })

  it('should start chokidar watcher when fs:watchWorkspace is called', async () => {
    setupFileWatcher()
    const dirPath = '/test/path'

    await handlers['fs:watchWorkspace'](null, dirPath)

    expect(chokidar.watch).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]test[\\/]path$/),
      expect.objectContaining({
        persistent: true,
        ignoreInitial: true
      })
    )
  })

  it('should not restart watcher if same directory is provided', async () => {
    setupFileWatcher()
    const dirPath = '/test/path/2'

    await handlers['fs:watchWorkspace'](null, dirPath)
    await handlers['fs:watchWorkspace'](null, dirPath)

    expect(chokidar.watch).toHaveBeenCalledTimes(1)
  })

  it('should handle file system events and send to window', async () => {
    setupFileWatcher()
    const dirPath = '/test/path/4'
    await handlers['fs:watchWorkspace'](null, dirPath)

    const mockWatcher = (chokidar.watch as any).mock.results[0].value
    const onCalls = mockWatcher.on.mock.calls
    const eventMap: Record<string, any> = {}
    onCalls.forEach((call: any) => {
      eventMap[call[0]] = call[1]
    })

    const mockWin = BrowserWindow.getAllWindows()[0]

    // Test 'change'
    eventMap['change']('file.txt')
    expect(mockWin.webContents.send).toHaveBeenCalledWith('fs:fileChanged', 'file.txt')

    // Test 'add'
    eventMap['add']('new.txt')
    expect(mockWin.webContents.send).toHaveBeenCalledWith('fs:fileCreated', 'new.txt')

    // Test 'unlink'
    eventMap['unlink']('old.txt')
    expect(mockWin.webContents.send).toHaveBeenCalledWith('fs:fileDeleted', 'old.txt')

    // Test 'addDir'
    eventMap['addDir']('new-dir')
    expect(mockWin.webContents.send).toHaveBeenCalledWith('fs:dirCreated', 'new-dir')

    // Test 'unlinkDir'
    eventMap['unlinkDir']('old-dir')
    expect(mockWin.webContents.send).toHaveBeenCalledWith('fs:dirDeleted', 'old-dir')
  })

  it('should not send messages if window is destroyed', async () => {
    setupFileWatcher()
    const dirPath = '/test/path/5'
    await handlers['fs:watchWorkspace'](null, dirPath)

    const mockWatcher = (chokidar.watch as any).mock.results[0].value
    const changeHandler = mockWatcher.on.mock.calls.find((c: any) => c[0] === 'change')[1]

    const mockWin = BrowserWindow.getAllWindows()[0]
    ;(mockWin.isDestroyed as any).mockReturnValue(true)

    changeHandler('file.txt')
    expect(mockWin.webContents.send).not.toHaveBeenCalled()
  })

  it('should stop watcher if fs:watchWorkspace is called with null path', async () => {
    setupFileWatcher()
    await handlers['fs:watchWorkspace'](null, '/some/path/6')
    const mockWatcher = (chokidar.watch as any).mock.results[0].value

    await handlers['fs:watchWorkspace'](null, null)
    expect(mockWatcher.close).toHaveBeenCalled()
  })
})
