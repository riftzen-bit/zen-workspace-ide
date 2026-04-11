import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'
import { FileNode } from '../types'

interface FileState {
  workspaceDir: string | null
  fileTree: FileNode[]
  openFiles: { path: string; name: string }[]
  activeFile: string | null
  activeSearchQuery: string | null
  pendingLocation: { path: string; line: number; column: number } | null
  editorSelection: string
  fileContents: Record<string, string>
  isSaving: boolean

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
  markFileDeleted: (path: string) => void
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
      isSaving: false,

      setWorkspaceDir: (dir) => set({ workspaceDir: dir }),
      setFileTree: (tree) => set({ fileTree: tree }),

      openFile: (path, name, content) => {
        const { openFiles } = get()
        const alreadyOpen = openFiles.find((f) => f.path === path)

        set((state) => ({
          activeFile: path,
          fileContents: {
            ...state.fileContents,
            [path]: state.fileContents[path] ?? content
          },
          openFiles: alreadyOpen ? state.openFiles : [...state.openFiles, { path, name }]
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
          return {
            openFiles: newOpenFiles,
            activeFile: newActiveFile,
            fileContents: remainingContents,
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
          fileContents: { ...state.fileContents, [path]: content }
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
          return {
            openFiles: newOpenFiles,
            activeFile: newActiveFile,
            fileContents: remainingContents,
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
          activeSearchQuery: null,
          pendingLocation: null,
          editorSelection: ''
        })
    }),
    {
      name: 'file-storage',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        workspaceDir: state.workspaceDir,
        openFiles: state.openFiles,
        activeFile: state.activeFile,
        fileContents: state.fileContents
      })
    }
  )
)
