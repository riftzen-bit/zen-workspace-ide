import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export interface CustomPrompt {
  id: string
  category: string
  label: string
  text: string
}

interface PromptState {
  customPrompts: CustomPrompt[]
  addPrompt: (prompt: CustomPrompt) => void
  removePrompt: (id: string) => void
}

export const usePromptStore = create<PromptState>()(
  persist(
    (set) => ({
      customPrompts: [],

      addPrompt: (prompt) => set((state) => ({ customPrompts: [...state.customPrompts, prompt] })),

      removePrompt: (id) =>
        set((state) => ({ customPrompts: state.customPrompts.filter((p) => p.id !== id) }))
    }),
    {
      name: 'zen-custom-prompts',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({ customPrompts: state.customPrompts })
    }
  )
)
