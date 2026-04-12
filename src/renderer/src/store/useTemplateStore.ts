import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export interface WorkspaceTemplate {
  id: string
  label: string
  description: string
  layout: number
  cliTypes: string[]
  createdAt: number
  isBuiltIn: boolean
}

interface TemplateState {
  customTemplates: WorkspaceTemplate[]
  addTemplate: (template: Omit<WorkspaceTemplate, 'id' | 'createdAt' | 'isBuiltIn'>) => void
  updateTemplate: (
    id: string,
    updates: Partial<Omit<WorkspaceTemplate, 'id' | 'isBuiltIn'>>
  ) => void
  deleteTemplate: (id: string) => void
  getTemplate: (id: string) => WorkspaceTemplate | undefined
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      customTemplates: [],

      addTemplate: (template) => {
        const newTemplate: WorkspaceTemplate = {
          ...template,
          id: `custom-${Date.now()}`,
          createdAt: Date.now(),
          isBuiltIn: false
        }
        set((state) => ({
          customTemplates: [...state.customTemplates, newTemplate]
        }))
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          customTemplates: state.customTemplates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          )
        }))
      },

      deleteTemplate: (id) => {
        set((state) => ({
          customTemplates: state.customTemplates.filter((t) => t.id !== id)
        }))
      },

      getTemplate: (id) => {
        return get().customTemplates.find((t) => t.id === id)
      }
    }),
    {
      name: 'zen-workspace-templates',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        customTemplates: state.customTemplates
      })
    }
  )
)
