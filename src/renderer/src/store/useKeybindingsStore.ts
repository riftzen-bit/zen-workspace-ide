import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export interface Keybinding {
  id: string
  keys: string
  action: string
  description: string
  category: 'navigation' | 'editor' | 'terminal' | 'general'
}

interface KeybindingsState {
  keybindings: Record<string, Keybinding>
  getKeybinding: (id: string) => Keybinding | undefined
  setKeybinding: (id: string, keys: string) => void
  resetToDefaults: () => void
}

const DEFAULT_KEYBINDINGS: Record<string, Keybinding> = {
  'command-palette': {
    id: 'command-palette',
    keys: 'Ctrl+K',
    action: 'openCommandPalette',
    description: 'Open Command Palette',
    category: 'navigation'
  },
  'toggle-sidebar': {
    id: 'toggle-sidebar',
    keys: 'Ctrl+B',
    action: 'toggleSidebar',
    description: 'Toggle Sidebar',
    category: 'navigation'
  },
  'toggle-chat': {
    id: 'toggle-chat',
    keys: 'Ctrl+I',
    action: 'toggleChat',
    description: 'Toggle AI Chat Panel',
    category: 'navigation'
  },
  'toggle-zen-mode': {
    id: 'toggle-zen-mode',
    keys: 'Ctrl+Shift+Z',
    action: 'toggleZenMode',
    description: 'Toggle Zen Focus Mode',
    category: 'general'
  },
  'exit-zen-mode': {
    id: 'exit-zen-mode',
    keys: 'Escape',
    action: 'exitZenMode',
    description: 'Exit Zen Mode',
    category: 'general'
  }
}

export const useKeybindingsStore = create<KeybindingsState>()(
  persist(
    (set, get) => ({
      keybindings: { ...DEFAULT_KEYBINDINGS },

      getKeybinding: (id: string) => {
        return get().keybindings[id]
      },

      setKeybinding: (id: string, keys: string) => {
        const current = get().keybindings[id]
        if (!current) return

        set((state) => ({
          keybindings: {
            ...state.keybindings,
            [id]: { ...current, keys }
          }
        }))
      },

      resetToDefaults: () => {
        set({ keybindings: { ...DEFAULT_KEYBINDINGS } })
      }
    }),
    {
      name: 'zen-keybindings',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        keybindings: state.keybindings
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<KeybindingsState>
        // Merge persisted keybindings with defaults (in case new keybindings added)
        const mergedKeybindings = { ...DEFAULT_KEYBINDINGS }
        if (persistedState.keybindings) {
          for (const [id, binding] of Object.entries(persistedState.keybindings)) {
            if (mergedKeybindings[id]) {
              mergedKeybindings[id] = { ...mergedKeybindings[id], keys: binding.keys }
            }
          }
        }
        return {
          ...current,
          keybindings: mergedKeybindings
        }
      }
    }
  )
)
