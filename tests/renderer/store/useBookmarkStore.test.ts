import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'

vi.mock('../../../src/renderer/src/store/electronZustandStorage', () => ({
  electronZustandStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
  }
}))

import { useBookmarkStore } from '../../../src/renderer/src/store/useBookmarkStore'

describe('useBookmarkStore', () => {
  beforeEach(() => {
    useBookmarkStore.setState({ bookmarks: [] })
  })

  describe('addBookmark', () => {
    it('adds a bookmark with generated id and timestamp', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark({
          path: '/test/file.ts',
          name: 'file.ts',
          line: 10
        })
      })

      const { bookmarks } = useBookmarkStore.getState()
      expect(bookmarks).toHaveLength(1)
      expect(bookmarks[0].path).toBe('/test/file.ts')
      expect(bookmarks[0].name).toBe('file.ts')
      expect(bookmarks[0].line).toBe(10)
      expect(bookmarks[0].id).toBeDefined()
      expect(bookmarks[0].createdAt).toBeDefined()
    })
  })

  describe('removeBookmark', () => {
    it('removes bookmark by id', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark({
          path: '/test/file1.ts',
          name: 'file1.ts'
        })
        useBookmarkStore.getState().addBookmark({
          path: '/test/file2.ts',
          name: 'file2.ts'
        })
      })

      const { bookmarks } = useBookmarkStore.getState()
      const idToRemove = bookmarks[0].id

      act(() => {
        useBookmarkStore.getState().removeBookmark(idToRemove)
      })

      const updated = useBookmarkStore.getState().bookmarks
      expect(updated).toHaveLength(1)
      expect(updated[0].path).toBe('/test/file2.ts')
    })
  })

  describe('toggleBookmark', () => {
    it('adds bookmark when not exists', () => {
      act(() => {
        useBookmarkStore.getState().toggleBookmark('/test/file.ts', 5)
      })

      const { bookmarks } = useBookmarkStore.getState()
      expect(bookmarks).toHaveLength(1)
      expect(bookmarks[0].path).toBe('/test/file.ts')
      expect(bookmarks[0].line).toBe(5)
    })

    it('removes bookmark when exists', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark({
          path: '/test/file.ts',
          name: 'file.ts',
          line: 5
        })
      })

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(1)

      act(() => {
        useBookmarkStore.getState().toggleBookmark('/test/file.ts', 5)
      })

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(0)
    })
  })

  describe('updateBookmarkLabel', () => {
    it('updates the label of a bookmark', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark({
          path: '/test/file.ts',
          name: 'file.ts'
        })
      })

      const { bookmarks } = useBookmarkStore.getState()
      const id = bookmarks[0].id

      act(() => {
        useBookmarkStore.getState().updateBookmarkLabel(id, 'Important function')
      })

      const updated = useBookmarkStore.getState().bookmarks[0]
      expect(updated.label).toBe('Important function')
    })
  })

  describe('clearBookmarks', () => {
    it('removes all bookmarks', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark({ path: '/test/file1.ts', name: 'file1.ts' })
        useBookmarkStore.getState().addBookmark({ path: '/test/file2.ts', name: 'file2.ts' })
        useBookmarkStore.getState().addBookmark({ path: '/test/file3.ts', name: 'file3.ts' })
      })

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(3)

      act(() => {
        useBookmarkStore.getState().clearBookmarks()
      })

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(0)
    })
  })

  describe('getBookmarksForFile', () => {
    it('returns only bookmarks for specified file', () => {
      act(() => {
        useBookmarkStore
          .getState()
          .addBookmark({ path: '/test/file1.ts', name: 'file1.ts', line: 1 })
        useBookmarkStore
          .getState()
          .addBookmark({ path: '/test/file1.ts', name: 'file1.ts', line: 10 })
        useBookmarkStore
          .getState()
          .addBookmark({ path: '/test/file2.ts', name: 'file2.ts', line: 5 })
      })

      const file1Bookmarks = useBookmarkStore.getState().getBookmarksForFile('/test/file1.ts')
      expect(file1Bookmarks).toHaveLength(2)

      const file2Bookmarks = useBookmarkStore.getState().getBookmarksForFile('/test/file2.ts')
      expect(file2Bookmarks).toHaveLength(1)
    })
  })

  describe('hasBookmark', () => {
    it('returns true when bookmark exists', () => {
      act(() => {
        useBookmarkStore
          .getState()
          .addBookmark({ path: '/test/file.ts', name: 'file.ts', line: 10 })
      })

      expect(useBookmarkStore.getState().hasBookmark('/test/file.ts', 10)).toBe(true)
      expect(useBookmarkStore.getState().hasBookmark('/test/file.ts')).toBe(true)
    })

    it('returns false when bookmark does not exist', () => {
      expect(useBookmarkStore.getState().hasBookmark('/test/file.ts', 10)).toBe(false)
      expect(useBookmarkStore.getState().hasBookmark('/test/other.ts')).toBe(false)
    })
  })
})
