import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export interface TerminalConfig {
  id: string
  command: string
}

export interface Workspace {
  id: string
  name: string
  layout: number
  cliType: string
  terminals: TerminalConfig[]
}

interface TerminalState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  isModalOpen: boolean

  setModalOpen: (open: boolean) => void
  createWorkspace: (name: string, layout: number, cliType: string) => void
  closeWorkspace: (id: string) => void
  setActiveWorkspace: (id: string | null) => void
  renameWorkspace: (id: string, newName: string) => void
}

const commandMap: Record<string, string> = {
  Terminal: 'Terminal',
  'Claude CLI': 'claude',
  'Codex CLI': 'codex',
  'Gemini CLI': 'gemini',
  'Opencode CLI': 'opencode'
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      workspaces: [],
      activeWorkspaceId: null,
      isModalOpen: false,

      setModalOpen: (open) => set({ isModalOpen: open }),

      createWorkspace: (name, layout, cliType) => {
        const cmd = commandMap[cliType] || 'Terminal'
        const newTerminals: TerminalConfig[] = Array.from({ length: layout }).map((_, i) => ({
          id: `term-${Date.now()}-${i}`,
          command: cmd
        }))

        const newWorkspace: Workspace = {
          id: `ws-${Date.now()}`,
          name,
          layout,
          cliType,
          terminals: newTerminals
        }

        set((state) => ({
          workspaces: [...state.workspaces, newWorkspace],
          activeWorkspaceId: newWorkspace.id,
          isModalOpen: false
        }))
      },

      closeWorkspace: (id) => {
        set((state) => {
          const updatedWorkspaces = state.workspaces.filter((w) => w.id !== id)
          const newActiveId =
            state.activeWorkspaceId === id
              ? updatedWorkspaces.length > 0
                ? updatedWorkspaces[updatedWorkspaces.length - 1].id
                : null
              : state.activeWorkspaceId

          return { workspaces: updatedWorkspaces, activeWorkspaceId: newActiveId }
        })
      },

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      renameWorkspace: (id, newName) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, name: newName } : w))
        }))
      }
    }),
    {
      name: 'vibe-ide-terminal-workspaces',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId
      })
    }
  )
)
