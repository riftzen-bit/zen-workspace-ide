import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

interface SettingsState {
  geminiApiKey: string
  autoPlayVibe: boolean
  fontSize: number
  wordWrap: boolean

  setGeminiApiKey: (key: string) => void
  setAutoPlayVibe: (autoPlay: boolean) => void
  setFontSize: (size: number) => void
  setWordWrap: (wrap: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      geminiApiKey: '',
      autoPlayVibe: true,
      fontSize: 14,
      wordWrap: true,

      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      setAutoPlayVibe: (autoPlay) => set({ autoPlayVibe: autoPlay }),
      setFontSize: (size) => set({ fontSize: size }),
      setWordWrap: (wrap) => set({ wordWrap: wrap })
    }),
    {
      name: 'vibe-ide-settings',
      storage: createJSONStorage(() => electronZustandStorage)
    }
  )
)
