import type { ContextFile, FileNode } from '../types'
import {
  basename,
  dirname,
  joinPath,
  normalizePath,
  toRelativePath,
  uniquePaths,
  withoutExtension
} from './pathUtils'

const CONTEXT_FILE_MAX_CHARS = 8_000
const CONTEXT_TOTAL_MAX_CHARS = 40_000
const IMPORTABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.md']
const ROOT_CONTEXT_FILES = [
  'package.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.web.json',
  'vite.config.ts',
  'vite.config.js',
  'vitest.config.ts',
  'vitest.config.js',
  'eslint.config.js'
]

export function flattenFileTree(nodes: FileNode[]): string[] {
  const paths: string[] = []
  const walk = (items: FileNode[]) => {
    for (const item of items) {
      paths.push(normalizePath(item.path))
      if (item.children?.length) {
        walk(item.children)
      }
    }
  }
  walk(nodes)
  return paths
}

function sanitizeContextContent(content: string): string {
  return content
    .replace(/\[PLAY_MUSIC:[^\]]*\]/g, '[PLAY_MUSIC:REDACTED]')
    .replace(/\[GENERATE_MUSIC:[^\]]*\]/g, '[GENERATE_MUSIC:REDACTED]')
}

function extractRelativeImports(content: string): string[] {
  const imports = new Set<string>()
  const pattern =
    /\b(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g

  for (const match of content.matchAll(pattern)) {
    const specifier = (match[1] ?? match[2] ?? match[3] ?? '').trim()
    if (specifier.startsWith('.')) {
      imports.add(specifier)
    }
  }

  return Array.from(imports)
}

function resolveImportCandidates(fromFile: string, specifier: string, allPaths: string[]): string[] {
  const fromDir = dirname(fromFile)
  const normalizedBase = normalizePath(joinPath(fromDir, specifier))
  const candidates = new Set<string>([normalizedBase])

  for (const ext of IMPORTABLE_EXTENSIONS) {
    candidates.add(`${normalizedBase}${ext}`)
    candidates.add(joinPath(normalizedBase, `index${ext}`))
  }

  return Array.from(candidates).filter((candidate) => allPaths.includes(candidate))
}

function findSiblingTests(activeFile: string, allPaths: string[]): string[] {
  const fileDir = dirname(activeFile)
  const fileBase = withoutExtension(activeFile)
  const fileName = basename(fileBase)
  const parentRelative = fileDir.split('/').slice(-2).join('/')
  const results = allPaths.filter((path) => {
    const normalized = normalizePath(path)
    if (normalized === activeFile) return false
    const base = basename(normalized)
    const sameStem =
      base.startsWith(`${fileName}.test.`) ||
      base.startsWith(`${fileName}.spec.`) ||
      normalized.includes(`/tests/`) ||
      normalized.includes(`/__tests__/`)
    if (!sameStem) return false
    return normalized.includes(parentRelative) || dirname(normalized) === fileDir
  })
  return results.slice(0, 2)
}

function findRootConfigs(workspaceDir: string | null | undefined, allPaths: string[]): string[] {
  if (!workspaceDir) return []
  const byRelativePath = new Map<string, string>()
  for (const path of allPaths) {
    byRelativePath.set(toRelativePath(workspaceDir, path), path)
  }
  return ROOT_CONTEXT_FILES.map((name) => byRelativePath.get(name)).filter((value): value is string => !!value)
}

async function readContextFileContent(
  path: string,
  fileContents: Record<string, string>
): Promise<string | null> {
  const normalized = normalizePath(path)
  const existing = fileContents[normalized] ?? fileContents[path]
  if (typeof existing === 'string') {
    return existing
  }

  const content = await window.api.readFile(path)
  return typeof content === 'string' ? content : null
}

function clipContextContent(content: string): string {
  if (content.length <= CONTEXT_FILE_MAX_CHARS) {
    return content
  }

  const midpoint = Math.floor(CONTEXT_FILE_MAX_CHARS / 2)
  const head = content.slice(0, midpoint)
  const tail = content.slice(-midpoint)
  return `${head}\n/* context clipped */\n${tail}`
}

export async function buildSmartContext(params: {
  activeFile: string | null
  workspaceDir: string | null
  fileTree: FileNode[]
  fileContents: Record<string, string>
  extraPaths?: string[]
  excludedPaths?: string[]
}): Promise<ContextFile[]> {
  const { activeFile, workspaceDir, fileTree, fileContents } = params
  if (!activeFile) return []

  const allPaths = flattenFileTree(fileTree).filter((path) => !path.endsWith('/'))
  const excluded = new Set(uniquePaths(params.excludedPaths ?? []))
  const extras = uniquePaths(params.extraPaths ?? [])
  const activeContent = await readContextFileContent(activeFile, fileContents)
  if (!activeContent) return []

  const importCandidates = extractRelativeImports(activeContent)
    .flatMap((specifier) => resolveImportCandidates(activeFile, specifier, allPaths))
    .slice(0, 4)

  const candidatePaths = uniquePaths([
    activeFile,
    ...importCandidates,
    ...findSiblingTests(activeFile, allPaths),
    ...findRootConfigs(workspaceDir, allPaths),
    ...extras
  ]).filter((path) => !excluded.has(normalizePath(path)))

  const contextFiles: ContextFile[] = []
  let totalChars = 0

  for (const path of candidatePaths) {
    const rawContent =
      path === activeFile ? activeContent : await readContextFileContent(path, fileContents)
    if (!rawContent) continue

    const sanitized = clipContextContent(sanitizeContextContent(rawContent))
    if (totalChars + sanitized.length > CONTEXT_TOTAL_MAX_CHARS && contextFiles.length > 0) {
      break
    }

    let reason = 'Related file'
    if (path === activeFile) {
      reason = 'Active file'
    } else if (importCandidates.includes(path)) {
      reason = 'Imported dependency'
    } else if (extras.includes(normalizePath(path))) {
      reason = 'Manually added'
    } else if (ROOT_CONTEXT_FILES.includes(toRelativePath(workspaceDir, path))) {
      reason = 'Project config'
    } else {
      reason = 'Test companion'
    }

    contextFiles.push({
      path,
      label: basename(path),
      reason,
      content: sanitized
    })
    totalChars += sanitized.length
  }

  return contextFiles
}

export function formatContextForPrompt(contextFiles: ContextFile[]): string {
  return contextFiles
    .map(
      (file) =>
        `[Context: ${file.path} | ${file.reason}]\n\`\`\`\n${sanitizeContextContent(file.content)}\n\`\`\``
    )
    .join('\n\n')
}
