import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export interface Bookmark {
  id: string
  path: string
  name: string
  line?: number
  column?: number
  label?: string
  createdAt: number
}

interface BookmarkState {
  bookmarks: Bookmark[]

  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => void
  removeBookmark: (id: string) => void
  toggleBookmark: (path: string, line?: number) => void
  updateBookmarkLabel: (id: string, label: string) => void
  clearBookmarks: () => void
  getBookmarksForFile: (path: string) => Bookmark[]
  hasBookmark: (path: string, line?: number) => boolean
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarks: [],

      addBookmark: (bookmark) => {
        const newBookmark: Bookmark = {
          ...bookmark,
          id: generateId(),
          createdAt: Date.now()
        }
        set((state) => ({
          bookmarks: [...state.bookmarks, newBookmark]
        }))
      },

      removeBookmark: (id) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id)
        }))
      },

      toggleBookmark: (path, line) => {
        const { bookmarks, addBookmark, removeBookmark } = get()
        const existing = bookmarks.find(
          (b) => b.path === path && (line === undefined || b.line === line)
        )

        if (existing) {
          removeBookmark(existing.id)
        } else {
          const name = path.split(/[\\/]/).pop() || path
          addBookmark({ path, name, line })
        }
      },

      updateBookmarkLabel: (id, label) => {
        set((state) => ({
          bookmarks: state.bookmarks.map((b) => (b.id === id ? { ...b, label } : b))
        }))
      },

      clearBookmarks: () => set({ bookmarks: [] }),

      getBookmarksForFile: (path) => {
        return get().bookmarks.filter((b) => b.path === path)
      },

      hasBookmark: (path, line) => {
        const { bookmarks } = get()
        return bookmarks.some((b) => b.path === path && (line === undefined || b.line === line))
      }
    }),
    {
      name: 'bookmark-storage',
      storage: createJSONStorage(() => electronZustandStorage)
    }
  )
)
