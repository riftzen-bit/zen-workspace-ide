import { ipcMain, dialog } from 'electron'
import { join, resolve, normalize, sep } from 'path'
import * as fs from 'fs'

let currentWorkspace: string | null = null

function isWithinWorkspace(filePath: string): boolean {
  if (!currentWorkspace) return false
  const resolved = resolve(normalize(filePath))
  return resolved === currentWorkspace || resolved.startsWith(currentWorkspace + sep)
}

export type FileNode = {
  path: string
  name: string
  isDirectory: boolean
  children?: FileNode[]
}

export function setupFSHandlers(): void {
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) {
      return null
    }
    currentWorkspace = resolve(filePaths[0])
    return currentWorkspace
  })

  ipcMain.handle('fs:setWorkspace', (_, dirPath: string) => {
    currentWorkspace = resolve(normalize(dirPath))
  })

  ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
    if (!isWithinWorkspace(dirPath)) return []
    return await scanDirAsync(dirPath)
  })

  ipcMain.handle('fs:searchFiles', async (_, query: string, dirPath: string) => {
    if (!isWithinWorkspace(dirPath)) return []
    return await searchFilesAsync(query, dirPath)
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    if (!isWithinWorkspace(filePath)) return null
    try {
      return await fs.promises.readFile(filePath, 'utf-8')
    } catch (e: unknown) {
      if (e instanceof Error) console.error('Failed to read file:', e.message)
      return null
    }
  })

  ipcMain.handle('fs:saveFile', async (_, filePath: string, content: string) => {
    if (!isWithinWorkspace(filePath)) return false
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8')
      return true
    } catch (e: unknown) {
      if (e instanceof Error) console.error('Failed to save file:', e.message)
      return false
    }
  })
}

async function scanDirAsync(dir: string): Promise<FileNode[]> {
  const results: FileNode[] = []
  try {
    const list = await fs.promises.readdir(dir)

    // Process files in parallel
    const promises = list.map(async (file) => {
      // Ignore common heavy folders
      if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'out') {
        return null
      }

      const fullPath = join(dir, file)
      const stat = await fs.promises.stat(fullPath)

      if (stat && stat.isDirectory()) {
        return {
          path: fullPath,
          name: file,
          isDirectory: true,
          children: await scanDirAsync(fullPath) // recursive scan
        }
      } else {
        return {
          path: fullPath,
          name: file,
          isDirectory: false
        }
      }
    })

    const scanned = await Promise.all(promises)

    for (const node of scanned) {
      if (node !== null) {
        results.push(node)
      }
    }

    // Sort directories first
    return results.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name)
      }
      return a.isDirectory ? -1 : 1
    })
  } catch (err) {
    console.error('Scan dir error:', err)
    return results
  }
}

async function searchFilesAsync(
  query: string,
  dir: string
): Promise<{ path: string; name: string }[]> {
  const results: { path: string; name: string }[] = []
  if (!query || query.trim().length === 0) return results

  const lowerQuery = query.toLowerCase()

  async function scan(currentDir: string) {
    let list: string[] = []
    try {
      list = await fs.promises.readdir(currentDir)
    } catch {
      return
    }

    const promises = list.map(async (file) => {
      // Ignore common heavy folders/files
      if (
        file === 'node_modules' ||
        file === '.git' ||
        file === 'dist' ||
        file === 'out' ||
        file === '.next' ||
        file.endsWith('.svg') ||
        file.endsWith('.png') ||
        file.endsWith('.jpg') ||
        file.endsWith('.jpeg') ||
        file.endsWith('.mp3') ||
        file.endsWith('.mp4') ||
        file.endsWith('.lock')
      ) {
        return
      }

      const fullPath = join(currentDir, file)
      let stat
      try {
        stat = await fs.promises.stat(fullPath)
      } catch {
        return
      }

      if (stat.isDirectory()) {
        await scan(fullPath)
      } else if (stat.size < 1000000) {
        // limit to ~1MB
        try {
          const content = await fs.promises.readFile(fullPath, 'utf8')
          if (content.toLowerCase().includes(lowerQuery)) {
            results.push({ path: fullPath, name: file })
          }
        } catch {
          return
        }
      }
    })

    await Promise.all(promises)
  }

  await scan(dir)
  return results
}
