import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'
import { FileNode } from '../types'

interface RecentFile {
  path: string
  name: string
  lastOpened: number
}

export interface PinnedFile {
  path: string
  name: string
  pinnedAt: number
}

interface FileState {
  workspaceDir: string | null
  fileTree: FileNode[]
  openFiles: { path: string; name: string }[]
  activeFile: string | null
  activeSearchQuery: string | null
  pendingLocation: { path: string; line: number; column: number } | null
  editorSelection: string
  fileContents: Record<string, string>
  savedContents: Record<string, string>
  isSaving: boolean
  recentFiles: RecentFile[]
  pinnedFiles: PinnedFile[]

  // Actions
  setWorkspaceDir: (dir: string) => void
  setFileTree: (tree: FileNode[]) => void
  openFile: (path: string, name: string, content: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  setActiveSearchQuery: (query: string | null) => void
  setPendingLocation: (path: string, line: number, column?: number) => void
  clearPendingLocation: () => void
  setEditorSelection: (value: string) => void
  setIsSaving: (isSaving: boolean) => void
  resetForProjectSwitch: () => void
  reloadFileFromDisk: (path: string, content: string) => void
  markFileSaved: (path: string, content: string) => void
  markFileDeleted: (path: string) => void
  clearRecentFiles: () => void
  removeFromRecentFiles: (path: string) => void
  togglePinnedFile: (path: string, name: string) => void
  removePinnedFile: (path: string) => void
  isPinned: (path: string) => boolean
}

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      workspaceDir: null,
      fileTree: [],
      openFiles: [],
      activeFile: null,
      activeSearchQuery: null,
      pendingLocation: null,
      editorSelection: '',
      fileContents: {},
      savedContents: {},
      isSaving: false,
      recentFiles: [],
      pinnedFiles: [],

      setWorkspaceDir: (dir) => set({ workspaceDir: dir }),
      setFileTree: (tree) => set({ fileTree: tree }),

      openFile: (path, name, content) => {
        const { openFiles, recentFiles } = get()
        const alreadyOpen = openFiles.find((f) => f.path === path)

        const MAX_RECENT_FILES = 20
        const now = Date.now()
        const existingIndex = recentFiles.findIndex((f) => f.path === path)
        let updatedRecentFiles: RecentFile[]

        if (existingIndex >= 0) {
          updatedRecentFiles = [
            { path, name, lastOpened: now },
            ...recentFiles.slice(0, existingIndex),
            ...recentFiles.slice(existingIndex + 1)
          ]
        } else {
          updatedRecentFiles = [{ path, name, lastOpened: now }, ...recentFiles]
        }

        if (updatedRecentFiles.length > MAX_RECENT_FILES) {
          updatedRecentFiles = updatedRecentFiles.slice(0, MAX_RECENT_FILES)
        }

        set((state) => ({
          activeFile: path,
          fileContents: {
            ...state.fileContents,
            [path]: state.fileContents[path] ?? content
          },
          savedContents: {
            ...state.savedContents,
            [path]: state.savedContents[path] ?? content
          },
          openFiles: alreadyOpen ? state.openFiles : [...state.openFiles, { path, name }],
          recentFiles: updatedRecentFiles
        }))
      },

      closeFile: (path) => {
        set((state) => {
          const newOpenFiles = state.openFiles.filter((f) => f.path !== path)
          let newActiveFile = state.activeFile
          if (state.activeFile === path) {
            newActiveFile =
              newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].path : null
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [path]: _removed, ...remainingContents } = state.fileContents
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [path]: _savedRemoved, ...remainingSaved } = state.savedContents
          return {
            openFiles: newOpenFiles,
            activeFile: newActiveFile,
            fileContents: remainingContents,
            savedContents: remainingSaved,
            pendingLocation:
              state.pendingLocation?.path === path && newActiveFile !== path
                ? null
                : state.pendingLocation
          }
        })
      },

      setActiveFile: (path) => set({ activeFile: path }),
      setActiveSearchQuery: (query) => set({ activeSearchQuery: query }),
      setPendingLocation: (path, line, column = 1) =>
        set({
          activeFile: path,
          pendingLocation: { path, line, column }
        }),
      clearPendingLocation: () => set({ pendingLocation: null }),
      setEditorSelection: (value) => set({ editorSelection: value }),
      updateFileContent: (path, content) =>
        set((state) => ({
          fileContents: {
            ...state.fileContents,
            [path]: content
          }
        })),
      setIsSaving: (isSaving) => set({ isSaving }),

      reloadFileFromDisk: (path, content) =>
        set((state) => ({
          fileContents: { ...state.fileContents, [path]: content },
          savedContents: { ...state.savedContents, [path]: content }
        })),

      markFileSaved: (path, content) =>
        set((state) => ({
          savedContents: { ...state.savedContents, [path]: content }
        })),

      markFileDeleted: (path) => {
        set((state) => {
          const newOpenFiles = state.openFiles.filter((f) => f.path !== path)
          let newActiveFile = state.activeFile
          if (state.activeFile === path) {
            newActiveFile =
              newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].path : null
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [path]: _removed, ...remainingContents } = state.fileContents
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [path]: _savedRemoved, ...remainingSaved } = state.savedContents
          return {
            openFiles: newOpenFiles,
            activeFile: newActiveFile,
            fileContents: remainingContents,
            savedContents: remainingSaved,
            pendingLocation:
              state.pendingLocation?.path === path && newActiveFile !== path
                ? null
                : state.pendingLocation
          }
        })
      },

      resetForProjectSwitch: () =>
        set({
          fileTree: [],
          openFiles: [],
          activeFile: null,
          fileContents: {},
          savedContents: {},
          activeSearchQuery: null,
          pendingLocation: null,
          editorSelection: ''
        }),

      clearRecentFiles: () => set({ recentFiles: [] }),

      removeFromRecentFiles: (path) =>
        set((state) => ({
          recentFiles: state.recentFiles.filter((f) => f.path !== path)
        })),

      togglePinnedFile: (path, name) => {
        const { pinnedFiles } = get()
        const existing = pinnedFiles.find((f) => f.path === path)
        if (existing) {
          set({ pinnedFiles: pinnedFiles.filter((f) => f.path !== path) })
        } else {
          const MAX_PINNED = 12
          const next = [{ path, name, pinnedAt: Date.now() }, ...pinnedFiles].slice(0, MAX_PINNED)
          set({ pinnedFiles: next })
        }
      },

      removePinnedFile: (path) =>
        set((state) => ({
          pinnedFiles: state.pinnedFiles.filter((f) => f.path !== path)
        })),

      isPinned: (path) => get().pinnedFiles.some((f) => f.path === path)
    }),
    {
      name: 'file-storage',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        workspaceDir: state.workspaceDir,
        openFiles: state.openFiles,
        activeFile: state.activeFile,
        fileContents: state.fileContents,
        savedContents: state.savedContents,
        recentFiles: state.recentFiles,
        pinnedFiles: state.pinnedFiles
      })
    }
  )
)
