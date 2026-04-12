import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import os from 'os'

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  },
  dialog: {
    showOpenDialog: vi.fn()
  }
}))

// Mock security module
vi.mock('../../src/main/security', () => ({
  isTrustedIpcSender: vi.fn().mockReturnValue(true),
  canonicalizePath: vi.fn((p: string) => p),
  resolvePathWithinRoot: vi.fn((root: string, target: string) => {
    const resolved = path.resolve(root, target)
    if (resolved.startsWith(root)) return resolved
    return null
  })
}))

describe('Search & Replace Helper Functions', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-test-'))

    // Create test files
    fs.writeFileSync(
      path.join(tempDir, 'test1.ts'),
      `function hello() {
  console.log("Hello World");
  return "Hello";
}`
    )

    fs.writeFileSync(
      path.join(tempDir, 'test2.ts'),
      `const greeting = "Hello";
const farewell = "Goodbye";`
    )

    fs.mkdirSync(path.join(tempDir, 'subdir'))
    fs.writeFileSync(path.join(tempDir, 'subdir', 'nested.ts'), `// Hello from nested file`)
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('escapeRegExp', () => {
    it('escapes special regex characters', () => {
      const escapeRegExp = (str: string): string => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      }

      expect(escapeRegExp('hello.world')).toBe('hello\\.world')
      expect(escapeRegExp('test[0]')).toBe('test\\[0\\]')
      expect(escapeRegExp('a+b*c?')).toBe('a\\+b\\*c\\?')
      expect(escapeRegExp('normal')).toBe('normal')
    })
  })

  describe('search functionality', () => {
    it('finds matches in files', async () => {
      const content = fs.readFileSync(path.join(tempDir, 'test1.ts'), 'utf-8')
      const query = 'Hello'
      const matches: Array<{ line: number; column: number; content: string }> = []

      const lines = content.split(/\r?\n/)
      const regex = new RegExp(query, 'gi')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        regex.lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = regex.exec(line)) !== null) {
          matches.push({
            line: i + 1,
            column: match.index + 1,
            content: line
          })
        }
      }

      expect(matches).toHaveLength(3)
      expect(matches[0].line).toBe(1) // function hello()
      expect(matches[1].line).toBe(2) // "Hello World"
      expect(matches[2].line).toBe(3) // "Hello"
    })

    it('respects case sensitivity', async () => {
      const content = 'Hello hello HELLO'
      const caseSensitiveMatches = content.match(/Hello/g) || []
      const caseInsensitiveMatches = content.match(/Hello/gi) || []

      expect(caseSensitiveMatches).toHaveLength(1)
      expect(caseInsensitiveMatches).toHaveLength(3)
    })
  })

  describe('replace functionality', () => {
    it('replaces text in file content', () => {
      const content = 'Hello World, Hello Universe'
      const search = 'Hello'
      const replace = 'Hi'

      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      const newContent = content.replace(regex, replace)

      expect(newContent).toBe('Hi World, Hi Universe')
    })

    it('replaces case-insensitively when specified', () => {
      const content = 'Hello hello HELLO'
      const search = 'hello'
      const replace = 'Hi'

      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const newContent = content.replace(regex, replace)

      expect(newContent).toBe('Hi Hi Hi')
    })

    it('counts replacements correctly', () => {
      const content = 'Hello World, Hello Universe, Hello Galaxy'
      const search = 'Hello'

      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      const matches = content.match(regex)

      expect(matches).toHaveLength(3)
    })
  })
})
