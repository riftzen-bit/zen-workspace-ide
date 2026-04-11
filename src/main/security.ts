import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import fs from 'fs'
import { basename, dirname, isAbsolute, normalize, relative, resolve } from 'path'

type IPCEventLike =
  | Pick<IpcMainEvent, 'sender' | 'senderFrame'>
  | Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>
  | null
  | undefined

const DEFAULT_DEV_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])

function getAllowedOrigins(): Set<string> {
  const origins = new Set(DEFAULT_DEV_ORIGINS)
  const rendererUrl = process.env.ELECTRON_RENDERER_URL

  if (rendererUrl) {
    try {
      origins.add(new URL(rendererUrl).origin)
    } catch {
      // Ignore malformed URLs in env.
    }
  }

  return origins
}

export function isTrustedIpcSender(event: IPCEventLike): boolean {
  // Unit tests call handlers directly without a real Electron event object.
  if (!event || typeof event !== 'object') return true
  if (!('sender' in event) && !('senderFrame' in event)) return true

  const senderUrl = event.senderFrame?.url ?? event.sender?.getURL?.() ?? ''
  if (!senderUrl) return false

  try {
    const parsed = new URL(senderUrl)
    if (parsed.protocol === 'file:') return true
    return getAllowedOrigins().has(parsed.origin)
  } catch {
    return false
  }
}

export function canonicalizePath(inputPath: string): string {
  const resolvedPath = resolve(normalize(inputPath))
  try {
    return fs.realpathSync.native(resolvedPath)
  } catch {
    return resolvedPath
  }
}

export function isPathInsideRoot(candidatePath: string, rootPath: string): boolean {
  const normalizedRoot = resolve(normalize(rootPath))
  const normalizedCandidate = resolve(normalize(candidatePath))
  const rel = relative(normalizedRoot, normalizedCandidate)

  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function buildCanonicalCandidateForMissingPath(resolvedPath: string): string | null {
  const suffixParts: string[] = [basename(resolvedPath)]
  let cursor = dirname(resolvedPath)

  while (!fs.existsSync(cursor)) {
    const parent = dirname(cursor)
    if (parent === cursor) return null
    suffixParts.unshift(basename(cursor))
    cursor = parent
  }

  let canonicalAncestor: string
  try {
    canonicalAncestor = fs.realpathSync.native(cursor)
  } catch {
    return null
  }

  return resolve(canonicalAncestor, ...suffixParts)
}

export function resolvePathWithinRoot(
  rootPath: string,
  candidatePath: string,
  allowMissing = false
): string | null {
  const canonicalRoot = canonicalizePath(rootPath)
  const resolvedCandidate = resolve(normalize(candidatePath))

  let canonicalCandidate: string | null = null
  try {
    canonicalCandidate = fs.realpathSync.native(resolvedCandidate)
  } catch {
    if (!allowMissing) return null
    canonicalCandidate = buildCanonicalCandidateForMissingPath(resolvedCandidate)
  }

  if (!canonicalCandidate) return null
  if (!isPathInsideRoot(canonicalCandidate, canonicalRoot)) return null
  return resolvedCandidate
}
