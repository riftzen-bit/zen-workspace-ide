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
  status: 'active' | 'paused'
  createdAt: number
}

interface TerminalState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  isModalOpen: boolean

  setModalOpen: (open: boolean) => void
  createWorkspace: (name: string, layout: number, cliType: string) => void
  deleteWorkspace: (id: string) => void
  closeWorkspace: (id: string) => void
  setActiveWorkspace: (id: string | null) => void
  renameWorkspace: (id: string, newName: string) => void
  pauseWorkspace: (id: string) => Promise<void>
  resumeWorkspace: (id: string) => Promise<void>
  reorderWorkspaces: (workspaceIds: string[]) => void
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
    (set, get) => ({
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
          terminals: newTerminals,
          status: 'active',
          createdAt: Date.now()
        }

        set((state) => ({
          workspaces: [...state.workspaces, newWorkspace],
          activeWorkspaceId: newWorkspace.id,
          isModalOpen: false
        }))
      },

      deleteWorkspace: (id) => {
        const ws = get().workspaces.find((w) => w.id === id)
        if (ws) {
          ws.terminals.forEach((t) => {
            window.api.terminal.kill(t.id).catch(() => {})
          })
        }
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

      // Keep closeWorkspace as alias for backward compatibility
      closeWorkspace: (id) => {
        get().deleteWorkspace(id)
      },

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      renameWorkspace: (id, newName) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, name: newName } : w))
        }))
      },

      pauseWorkspace: async (id) => {
        const ws = get().workspaces.find((w) => w.id === id)
        if (!ws || ws.status === 'paused') return

        const terminalIds = ws.terminals.map((t) => t.id)
        await window.api.terminal.pauseWorkspace(terminalIds).catch(() => {})

        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, status: 'paused' } : w)),
          activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId
        }))
      },

      resumeWorkspace: async (id) => {
        const ws = get().workspaces.find((w) => w.id === id)
        if (!ws) return

        const terminalIds = ws.terminals.map((t) => t.id)
        await window.api.terminal.resumeWorkspace(terminalIds).catch(() => {})

        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, status: 'active' } : w)),
          activeWorkspaceId: id
        }))
      },

      reorderWorkspaces: (workspaceIds) => {
        set((state) => {
          const ordered = workspaceIds
            .map((id) => state.workspaces.find((w) => w.id === id))
            .filter((w): w is Workspace => !!w)
          return { workspaces: ordered }
        })
      }
    }),
    {
      name: 'vibe-ide-terminal-workspaces',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<TerminalState>
        return {
          ...current,
          ...p,
          // Migrate old workspaces that lack status/createdAt
          workspaces: (p.workspaces || []).map((w) => ({
            ...w,
            status: w.status ?? 'active',
            createdAt: w.createdAt ?? Date.now()
          }))
        }
      }
    }
  )
)
