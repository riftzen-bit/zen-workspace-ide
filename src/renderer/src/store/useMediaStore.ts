import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export type VibeType = 'lofi' | 'rain' | 'custom' | null

interface MediaState {
  currentVibe: VibeType
  customVibe: { id: string; name: string } | null
  isPlaying: boolean
  volume: number

  setCurrentVibe: (vibe: VibeType) => void
  setCustomVibe: (id: string, name: string) => void
  setIsPlaying: (isPlaying: boolean) => void
  setVolume: (volume: number) => void
}

export const useMediaStore = create<MediaState>()(
  persist(
    (set) => ({
      currentVibe: null,
      customVibe: null,
      isPlaying: false,
      volume: 50,

      setCurrentVibe: (vibe) => set({ currentVibe: vibe }),
      setCustomVibe: (id, name) => set({ currentVibe: 'custom', customVibe: { id, name } }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setVolume: (volume) => set({ volume })
    }),
    {
      name: 'media-storage',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        currentVibe: state.currentVibe,
        customVibe: state.customVibe,
        volume: state.volume
      })
    }
  )
)
