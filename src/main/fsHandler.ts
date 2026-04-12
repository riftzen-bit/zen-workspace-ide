import { ipcMain, dialog } from 'electron'
import { join, resolve, normalize } from 'path'
import * as fs from 'fs'
import { canonicalizePath, isTrustedIpcSender, resolvePathWithinRoot } from './security'

let currentWorkspace: string | null = null

export function getCurrentWorkspacePath(): string | null {
  return currentWorkspace
}

function isWithinWorkspace(filePath: string, allowMissing = false): boolean {
  if (!currentWorkspace) return false
  return resolvePathWithinRoot(currentWorkspace, filePath, allowMissing) !== null
}

export type FileNode = {
  path: string
  name: string
  isDirectory: boolean
  children?: FileNode[]
}

export type WorkspaceTodo = {
  id: string
  path: string
  relativePath: string
  name: string
  line: number
  column: number
  tag: 'TODO' | 'FIXME' | 'HACK'
  text: string
}

export function setupFSHandlers(): void {
  ipcMain.handle('dialog:openDirectory', async (event) => {
    if (!isTrustedIpcSender(event)) return null

    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) {
      return null
    }
    currentWorkspace = canonicalizePath(filePaths[0])
    return currentWorkspace
  })

  ipcMain.handle('fs:setWorkspace', (event, dirPath: string) => {
    if (!isTrustedIpcSender(event)) return
    if (!dirPath || typeof dirPath !== 'string') return

    const resolvedPath = resolve(normalize(dirPath))
    try {
      const stat = fs.statSync(resolvedPath)
      if (!stat.isDirectory()) return
      currentWorkspace = canonicalizePath(resolvedPath)
    } catch {
      // Ignore invalid workspace paths.
    }
  })

  ipcMain.handle('fs:readDirectory', async (event, dirPath: string) => {
    if (!isTrustedIpcSender(event)) return []
    if (!isWithinWorkspace(dirPath)) return []

    const safeDirPath = currentWorkspace ? resolvePathWithinRoot(currentWorkspace, dirPath) : null
    if (!safeDirPath) return []

    return await scanDirAsync(safeDirPath)
  })

  ipcMain.handle('fs:searchFiles', async (event, query: string, dirPath: string) => {
    if (!isTrustedIpcSender(event)) return []
    if (!isWithinWorkspace(dirPath)) return []

    const safeDirPath = currentWorkspace ? resolvePathWithinRoot(currentWorkspace, dirPath) : null
    if (!safeDirPath) return []

    return await searchFilesAsync(query, safeDirPath)
  })

  ipcMain.handle('fs:scanTodos', async (event, dirPath: string) => {
    if (!isTrustedIpcSender(event)) return []
    if (!isWithinWorkspace(dirPath)) return []

    const safeDirPath = currentWorkspace ? resolvePathWithinRoot(currentWorkspace, dirPath) : null
    if (!safeDirPath) return []

    return await scanTodosAsync(safeDirPath, currentWorkspace ?? safeDirPath)
  })

  ipcMain.handle('fs:readFile', async (event, filePath: string) => {
    if (!isTrustedIpcSender(event)) return null
    if (!isWithinWorkspace(filePath)) return null

    const safeFilePath = currentWorkspace ? resolvePathWithinRoot(currentWorkspace, filePath) : null
    if (!safeFilePath) return null

    try {
      const stat = await fs.promises.stat(safeFilePath)
      if (stat.isDirectory()) return null
      return await fs.promises.readFile(safeFilePath, 'utf-8')
    } catch (e: unknown) {
      if (e instanceof Error) console.error('Failed to read file:', e.message)
      return null
    }
  })

  ipcMain.handle('fs:saveFile', async (event, filePath: string, content: string) => {
    if (!isTrustedIpcSender(event)) return false
    if (!isWithinWorkspace(filePath, true)) return false

    const safeFilePath = currentWorkspace
      ? resolvePathWithinRoot(currentWorkspace, filePath, true)
      : null
    if (!safeFilePath) return false

    try {
      await fs.promises.writeFile(safeFilePath, content, 'utf-8')
      return true
    } catch (e: unknown) {
      if (e instanceof Error) console.error('Failed to save file:', e.message)
      return false
    }
  })

  ipcMain.handle('fs:createFile', async (event, filePath: string) => {
    if (!isTrustedIpcSender(event)) return { ok: false, error: 'Untrusted sender' }
    if (!isWithinWorkspace(filePath, true)) return { ok: false, error: 'Outside workspace' }

    const safeFilePath = currentWorkspace
      ? resolvePathWithinRoot(currentWorkspace, filePath, true)
      : null
    if (!safeFilePath) return { ok: false, error: 'Outside workspace' }

    try {
      await fs.promises.writeFile(safeFilePath, '', { flag: 'wx' })
      return { ok: true }
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('fs:createDir', async (event, dirPath: string) => {
    if (!isTrustedIpcSender(event)) return { ok: false, error: 'Untrusted sender' }
    if (!isWithinWorkspace(dirPath, true)) return { ok: false, error: 'Outside workspace' }

    const safeDirPath = currentWorkspace
      ? resolvePathWithinRoot(currentWorkspace, dirPath, true)
      : null
    if (!safeDirPath) return { ok: false, error: 'Outside workspace' }

    try {
      await fs.promises.mkdir(safeDirPath, { recursive: true })
      return { ok: true }
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('fs:rename', async (event, oldPath: string, newPath: string) => {
    if (!isTrustedIpcSender(event)) return { ok: false, error: 'Untrusted sender' }
    if (!isWithinWorkspace(oldPath) || !isWithinWorkspace(newPath, true)) {
      return { ok: false, error: 'Outside workspace' }
    }

    const safeOldPath = currentWorkspace ? resolvePathWithinRoot(currentWorkspace, oldPath) : null
    const safeNewPath = currentWorkspace
      ? resolvePathWithinRoot(currentWorkspace, newPath, true)
      : null
    if (!safeOldPath || !safeNewPath) {
      return { ok: false, error: 'Outside workspace' }
    }

    try {
      await fs.promises.rename(safeOldPath, safeNewPath)
      return { ok: true }
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('fs:delete', async (event, targetPath: string) => {
    if (!isTrustedIpcSender(event)) return { ok: false, error: 'Untrusted sender' }
    if (!isWithinWorkspace(targetPath)) return { ok: false, error: 'Outside workspace' }

    const safeTargetPath = currentWorkspace
      ? resolvePathWithinRoot(currentWorkspace, targetPath)
      : null
    if (!safeTargetPath) return { ok: false, error: 'Outside workspace' }

    try {
      await fs.promises.rm(safeTargetPath, { recursive: true, force: true })
      return { ok: true }
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(
    'fs:searchWithContext',
    async (event, query: string, dirPath: string, caseSensitive: boolean) => {
      if (!isTrustedIpcSender(event)) return []
      if (!isWithinWorkspace(dirPath)) return []

      const safeDirPath = currentWorkspace ? resolvePathWithinRoot(currentWorkspace, dirPath) : null
      if (!safeDirPath) return []

      return await searchWithContextAsync(query, safeDirPath, caseSensitive)
    }
  )

  ipcMain.handle(
    'fs:replaceInFiles',
    async (
      event,
      replacements: Array<{ path: string; search: string; replace: string; caseSensitive: boolean }>
    ) => {
      if (!isTrustedIpcSender(event)) return { ok: false, error: 'Untrusted sender', count: 0 }

      let totalReplaced = 0

      for (const { path: filePath, search, replace, caseSensitive } of replacements) {
        if (!isWithinWorkspace(filePath)) continue

        const safeFilePath = currentWorkspace
          ? resolvePathWithinRoot(currentWorkspace, filePath)
          : null
        if (!safeFilePath) continue

        try {
          const content = await fs.promises.readFile(safeFilePath, 'utf-8')
          const flags = caseSensitive ? 'g' : 'gi'
          const regex = new RegExp(escapeRegExp(search), flags)
          const matches = content.match(regex)
          if (!matches) continue

          const newContent = content.replace(regex, replace)
          if (newContent !== content) {
            await fs.promises.writeFile(safeFilePath, newContent, 'utf-8')
            totalReplaced += matches.length
          }
        } catch {
          // Skip files that can't be read/written
        }
      }

      return { ok: true, count: totalReplaced }
    }
  )
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
      if (!isWithinWorkspace(fullPath)) {
        return null
      }

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
      if (!isWithinWorkspace(fullPath)) {
        return
      }

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

async function scanTodosAsync(dir: string, workspaceRoot: string): Promise<WorkspaceTodo[]> {
  const results: WorkspaceTodo[] = []
  const TODO_PATTERN = /\b(TODO|FIXME|HACK)\b[:\s-]*(.*)$/i

  async function scan(currentDir: string) {
    let list: string[] = []
    try {
      list = await fs.promises.readdir(currentDir)
    } catch {
      return
    }

    const promises = list.map(async (file) => {
      if (
        file === 'node_modules' ||
        file === '.git' ||
        file === 'dist' ||
        file === 'out' ||
        file === '.next' ||
        file === 'coverage' ||
        file.endsWith('.png') ||
        file.endsWith('.jpg') ||
        file.endsWith('.jpeg') ||
        file.endsWith('.gif') ||
        file.endsWith('.svg') ||
        file.endsWith('.mp3') ||
        file.endsWith('.mp4') ||
        file.endsWith('.lock')
      ) {
        return
      }

      const fullPath = join(currentDir, file)
      if (!isWithinWorkspace(fullPath)) return

      let stat
      try {
        stat = await fs.promises.stat(fullPath)
      } catch {
        return
      }

      if (stat.isDirectory()) {
        await scan(fullPath)
        return
      }

      if (stat.size > 1_000_000) return

      let content = ''
      try {
        content = await fs.promises.readFile(fullPath, 'utf8')
      } catch {
        return
      }

      const lines = content.split(/\r?\n/)
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index]
        const match = line.match(TODO_PATTERN)
        if (!match) continue
        const tag = match[1].toUpperCase() as 'TODO' | 'FIXME' | 'HACK'
        const markerIndex = line.toUpperCase().indexOf(tag)
        results.push({
          id: `${fullPath}:${index + 1}:${markerIndex + 1}`,
          path: fullPath,
          relativePath: fullPath.startsWith(workspaceRoot)
            ? fullPath.slice(workspaceRoot.length).replace(/^[\\/]+/, '')
            : fullPath,
          name: file,
          line: index + 1,
          column: markerIndex + 1,
          tag,
          text: match[2]?.trim() || line.trim()
        })
      }
    })

    await Promise.all(promises)
  }

  await scan(dir)
  return results.sort((a, b) => {
    if (a.path === b.path) {
      return a.line - b.line
    }
    return a.path.localeCompare(b.path)
  })
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export type SearchMatch = {
  path: string
  relativePath: string
  name: string
  line: number
  column: number
  lineContent: string
  matchLength: number
}

async function searchWithContextAsync(
  query: string,
  dir: string,
  caseSensitive: boolean
): Promise<SearchMatch[]> {
  const results: SearchMatch[] = []
  if (!query || query.trim().length === 0) return results

  const flags = caseSensitive ? 'g' : 'gi'
  const regex = new RegExp(escapeRegExp(query), flags)

  async function scan(currentDir: string) {
    let list: string[] = []
    try {
      list = await fs.promises.readdir(currentDir)
    } catch {
      return
    }

    const promises = list.map(async (file) => {
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
        file.endsWith('.lock') ||
        file.endsWith('.min.js') ||
        file.endsWith('.min.css')
      ) {
        return
      }

      const fullPath = join(currentDir, file)
      if (!isWithinWorkspace(fullPath)) return

      let stat
      try {
        stat = await fs.promises.stat(fullPath)
      } catch {
        return
      }

      if (stat.isDirectory()) {
        await scan(fullPath)
      } else if (stat.size < 500000) {
        try {
          const content = await fs.promises.readFile(fullPath, 'utf8')
          const lines = content.split(/\r?\n/)

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            regex.lastIndex = 0
            let match: RegExpExecArray | null

            while ((match = regex.exec(line)) !== null) {
              results.push({
                path: fullPath,
                relativePath: fullPath.startsWith(dir)
                  ? fullPath.slice(dir.length).replace(/^[\\/]+/, '')
                  : fullPath,
                name: file,
                line: i + 1,
                column: match.index + 1,
                lineContent: line,
                matchLength: query.length
              })
            }
          }
        } catch {
          return
        }
      }
    })

    await Promise.all(promises)
  }

  await scan(dir)
  return results.sort((a, b) => {
    if (a.path === b.path) return a.line - b.line
    return a.path.localeCompare(b.path)
  })
}
