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
  fileContents: Record<string, string>
  isSaving: boolean
  isLoadingDir: boolean

  // Actions
  setWorkspaceDir: (dir: string) => void
  setFileTree: (tree: FileNode[]) => void
  openFile: (path: string, name: string, content: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  setActiveSearchQuery: (query: string | null) => void
  setIsSaving: (isSaving: boolean) => void
  setIsLoadingDir: (isLoading: boolean) => void
}

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      workspaceDir: null,
      fileTree: [],
      openFiles: [],
      activeFile: null,
      activeSearchQuery: null,
      fileContents: {},
      isSaving: false,
      isLoadingDir: false,

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
          return {
            openFiles: newOpenFiles,
            activeFile: newActiveFile
          }
        })
      },

      setActiveFile: (path) => set({ activeFile: path }),
      setActiveSearchQuery: (query) => set({ activeSearchQuery: query }),
      updateFileContent: (path, content) =>
        set((state) => ({
          fileContents: {
            ...state.fileContents,
            [path]: content
          }
        })),
      setIsSaving: (isSaving) => set({ isSaving }),
      setIsLoadingDir: (isLoadingDir) => set({ isLoadingDir })
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
