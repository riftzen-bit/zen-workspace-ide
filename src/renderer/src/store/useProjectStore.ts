import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'
import { useFileStore } from './useFileStore'

export interface Project {
  id: string
  name: string
  path: string
  lastOpenedAt: number
  pinned: boolean
}

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null

  addProject: (path: string) => void
  removeProject: (id: string) => void
  setActiveProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  togglePin: (id: string) => void
  getActiveProject: () => Project | undefined
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      addProject: (path) => {
        const existing = get().projects.find((p) => p.path === path)
        if (existing) return
        const name = path.split('/').filter(Boolean).pop() ?? path
        const project: Project = {
          id: `proj-${Date.now()}`,
          name,
          path,
          lastOpenedAt: Date.now(),
          pinned: false
        }
        set((state) => ({ projects: [...state.projects, project] }))
      },

      removeProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId
        }))
      },

      setActiveProject: (id) => {
        const project = get().projects.find((p) => p.id === id)
        if (!project) return
        set((state) => ({
          activeProjectId: id,
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, lastOpenedAt: Date.now() } : p
          )
        }))
        window.api.setWorkspace(project.path)
        useFileStore.getState().resetForProjectSwitch()
      },

      renameProject: (id, name) => {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, name } : p))
        }))
      },

      togglePin: (id) => {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p))
        }))
      },

      getActiveProject: () => {
        const { projects, activeProjectId } = get()
        return projects.find((p) => p.id === activeProjectId)
      }
    }),
    {
      name: 'zen-projects',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId
      })
    }
  )
)
