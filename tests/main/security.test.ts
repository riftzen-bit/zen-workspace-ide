import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  isTrustedIpcSender,
  canonicalizePath,
  isPathInsideRoot,
  resolvePathWithinRoot
} from '../../src/main/security'

describe('isTrustedIpcSender', () => {
  it('treats null/undefined events as trusted (internal main-process calls)', () => {
    expect(isTrustedIpcSender(null)).toBe(true)
    expect(isTrustedIpcSender(undefined)).toBe(true)
  })

  it('treats events without sender/senderFrame as trusted', () => {
    expect(isTrustedIpcSender({} as never)).toBe(true)
  })

  it('rejects empty sender url', () => {
    const event = {
      sender: { getURL: () => '' },
      senderFrame: undefined
    } as never
    expect(isTrustedIpcSender(event)).toBe(false)
  })

  it('accepts file: scheme', () => {
    const event = {
      sender: { getURL: () => 'file:///app/index.html' },
      senderFrame: undefined
    } as never
    expect(isTrustedIpcSender(event)).toBe(true)
  })

  it('accepts default localhost dev origin', () => {
    const event = {
      sender: { getURL: () => 'http://localhost:5173/index.html' },
      senderFrame: undefined
    } as never
    expect(isTrustedIpcSender(event)).toBe(true)
  })

  it('rejects unknown http origin', () => {
    const event = {
      sender: { getURL: () => 'http://evil.example/index.html' },
      senderFrame: undefined
    } as never
    expect(isTrustedIpcSender(event)).toBe(false)
  })

  it('prefers senderFrame.url when present', () => {
    const event = {
      sender: { getURL: () => 'http://evil.example/' },
      senderFrame: { url: 'file:///app/index.html' }
    } as never
    expect(isTrustedIpcSender(event)).toBe(true)
  })

  it('returns false for malformed urls', () => {
    const event = {
      sender: { getURL: () => 'not-a-url' },
      senderFrame: undefined
    } as never
    expect(isTrustedIpcSender(event)).toBe(false)
  })
})

describe('canonicalizePath', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zen-sec-'))
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns realpath for an existing dir', () => {
    const got = canonicalizePath(tmpDir)
    expect(fs.realpathSync.native(tmpDir)).toBe(got)
  })

  it('returns resolved path for a non-existent path', () => {
    const phantom = path.join(tmpDir, 'does-not-exist')
    const got = canonicalizePath(phantom)
    expect(got).toBe(path.resolve(phantom))
  })
})

describe('isPathInsideRoot', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zen-sec-'))
    fs.mkdirSync(path.join(tmpDir, 'child'))
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns true for identical paths', () => {
    expect(isPathInsideRoot(tmpDir, tmpDir)).toBe(true)
  })

  it('returns true for child paths', () => {
    expect(isPathInsideRoot(path.join(tmpDir, 'child'), tmpDir)).toBe(true)
  })

  it('returns false for parent paths', () => {
    expect(isPathInsideRoot(path.dirname(tmpDir), tmpDir)).toBe(false)
  })

  it('returns false for sibling paths', () => {
    const sibling = path.join(path.dirname(tmpDir), 'sibling-dir')
    expect(isPathInsideRoot(sibling, tmpDir)).toBe(false)
  })
})

describe('resolvePathWithinRoot', () => {
  let tmpDir: string
  let childFile: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zen-sec-'))
    childFile = path.join(tmpDir, 'note.txt')
    fs.writeFileSync(childFile, 'hi')
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('resolves an existing child file inside root', () => {
    const got = resolvePathWithinRoot(tmpDir, childFile)
    expect(got).not.toBeNull()
    expect(path.resolve(got as string)).toBe(path.resolve(childFile))
  })

  it('rejects a path that escapes root via ..', () => {
    const escape = path.join(tmpDir, '..', 'escaped.txt')
    expect(resolvePathWithinRoot(tmpDir, escape)).toBeNull()
  })

  it('rejects a missing path when allowMissing is false', () => {
    const missing = path.join(tmpDir, 'nope.txt')
    expect(resolvePathWithinRoot(tmpDir, missing)).toBeNull()
  })

  it('allows a missing path under root when allowMissing is true', () => {
    const missing = path.join(tmpDir, 'new', 'sub', 'file.txt')
    const got = resolvePathWithinRoot(tmpDir, missing, true)
    expect(got).not.toBeNull()
  })

  it('rejects a missing path that resolves outside root even with allowMissing', () => {
    const escape = path.join(tmpDir, '..', 'outside.txt')
    expect(resolvePathWithinRoot(tmpDir, escape, true)).toBeNull()
  })
})
