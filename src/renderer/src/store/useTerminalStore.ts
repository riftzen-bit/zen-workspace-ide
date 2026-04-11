import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export interface TerminalConfig {
  id: string
  command: string
  cliType: string
}

export interface Workspace {
  id: string
  name: string
  layout: number
  cliType: string // Primary display type (for backward compat / WorkspaceCard)
  terminals: TerminalConfig[]
  status: 'active' | 'paused'
  createdAt: number
}

interface TerminalState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  isModalOpen: boolean

  setModalOpen: (open: boolean) => void
  createWorkspace: (name: string, layout: number, cliTypes: string[]) => void
  deleteWorkspace: (id: string) => void
  setActiveWorkspace: (id: string | null) => void
  renameWorkspace: (id: string, newName: string) => void
  pauseWorkspace: (id: string) => Promise<{ success: boolean; reason?: string }>
  resumeWorkspace: (id: string) => Promise<{ success: boolean; reason?: string }>
  reorderWorkspaces: (workspaceIds: string[]) => void
}

export const commandMap: Record<string, string> = {
  Terminal: 'Terminal',
  'Claude CLI': 'claude',
  'Codex CLI': 'codex',
  'Gemini CLI': 'gemini',
  'Opencode CLI': 'opencode'
}

// Determine the primary display CLI type from an array of per-pane types
function primaryCliType(cliTypes: string[]): string {
  const counts: Record<string, number> = {}
  for (const t of cliTypes) {
    counts[t] = (counts[t] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Terminal'
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,
      isModalOpen: false,

      setModalOpen: (open) => set({ isModalOpen: open }),

      createWorkspace: (name, layout, cliTypes) => {
        // Ensure cliTypes array matches layout length (pad/trim as needed)
        const resolvedTypes = Array.from(
          { length: layout },
          (_, i) => cliTypes[i] ?? cliTypes[0] ?? 'Terminal'
        )

        const newTerminals: TerminalConfig[] = resolvedTypes.map((type, i) => ({
          id: `term-${Date.now()}-${i}`,
          command: commandMap[type] || 'Terminal',
          cliType: type
        }))

        const newWorkspace: Workspace = {
          id: `ws-${Date.now()}`,
          name,
          layout,
          cliType: primaryCliType(resolvedTypes),
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

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      renameWorkspace: (id, newName) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, name: newName } : w))
        }))
      },

      pauseWorkspace: async (id) => {
        const ws = get().workspaces.find((w) => w.id === id)
        if (!ws || ws.status === 'paused') return { success: false, reason: 'not-found-or-paused' }

        const terminalIds = ws.terminals.map((t) => t.id)
        const result = await window.api.terminal.pauseWorkspace(terminalIds).catch(() => null)
        if (!result?.success || result.reason === 'unsupported-platform') {
          return { success: false, reason: result?.reason ?? 'pause-failed' }
        }

        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, status: 'paused' } : w)),
          activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId
        }))
        return { success: true }
      },

      resumeWorkspace: async (id) => {
        const ws = get().workspaces.find((w) => w.id === id)
        if (!ws) return { success: false, reason: 'not-found' }

        const terminalIds = ws.terminals.map((t) => t.id)
        const result = await window.api.terminal.resumeWorkspace(terminalIds).catch(() => null)
        if (!result?.success || result.reason === 'unsupported-platform') {
          return { success: false, reason: result?.reason ?? 'resume-failed' }
        }

        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, status: 'active' } : w)),
          activeWorkspaceId: id
        }))
        return { success: true }
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
          // Migrate old workspaces: add missing fields and per-terminal cliType
          workspaces: (p.workspaces || []).map((w) => ({
            ...w,
            status: w.status ?? 'active',
            createdAt: w.createdAt ?? Date.now(),
            terminals: w.terminals.map((t) => ({
              ...t,
              cliType: (t as TerminalConfig).cliType ?? w.cliType ?? 'Terminal'
            }))
          }))
        }
      }
    }
  )
)
