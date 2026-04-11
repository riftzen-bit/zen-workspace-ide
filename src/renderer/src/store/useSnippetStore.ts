import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CodeSnippet } from '../types'
import { electronZustandStorage } from './electronZustandStorage'

interface SnippetState {
  customSnippets: CodeSnippet[]
  addSnippet: (snippet: CodeSnippet) => void
  removeSnippet: (id: string) => void
  updateSnippet: (id: string, snippet: Partial<CodeSnippet>) => void
}

export const useSnippetStore = create<SnippetState>()(
  persist(
    (set) => ({
      customSnippets: [],
      addSnippet: (snippet) =>
        set((state) => ({
          customSnippets: [
            snippet,
            ...state.customSnippets.filter((item) => item.id !== snippet.id)
          ]
        })),
      removeSnippet: (id) =>
        set((state) => ({
          customSnippets: state.customSnippets.filter((snippet) => snippet.id !== id)
        })),
      updateSnippet: (id, snippet) =>
        set((state) => ({
          customSnippets: state.customSnippets.map((item) =>
            item.id === id ? { ...item, ...snippet } : item
          )
        }))
    }),
    {
      name: 'zen-snippets',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        customSnippets: state.customSnippets
      })
    }
  )
)
