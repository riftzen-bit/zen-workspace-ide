import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export interface GeneratedTrack {
  id: string
  prompt: string
  model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview'
  lyrics: string | null
  audioBase64: string
  mimeType: string
  blobUrl: string | null
  createdAt: number
}

interface MusicState {
  isGenerating: boolean
  generationError: string | null
  currentTrack: GeneratedTrack | null
  isLyriaPlaying: boolean
  lyriaVolume: number
  trackHistory: GeneratedTrack[]
  pendingPrompt: string | null
  vibe: 'focus' | 'upbeat'

  setIsGenerating: (v: boolean) => void
  setGenerationError: (e: string | null) => void
  setCurrentTrack: (track: GeneratedTrack) => void
  setIsLyriaPlaying: (v: boolean) => void
  setLyriaVolume: (v: number) => void
  clearCurrentTrack: () => void
  removeFromHistory: (id: string) => void
  setPendingPrompt: (prompt: string | null) => void
  setVibe: (vibe: 'focus' | 'upbeat') => void
}

const MAX_HISTORY = 10

export const useMusicStore = create<MusicState>()(
  persist(
    (set) => ({
      isGenerating: false,
      generationError: null,
      currentTrack: null,
      isLyriaPlaying: false,
      lyriaVolume: 70,
      trackHistory: [],
      pendingPrompt: null,
      vibe: 'focus',

      setIsGenerating: (v) => set({ isGenerating: v }),
      setGenerationError: (e) => set({ generationError: e }),
      setCurrentTrack: (track) => {
        // Side effects (createObjectURL / revokeObjectURL) must run OUTSIDE the
        // set() updater — React StrictMode double-invokes updater functions,
        // which would otherwise allocate two blob URLs and leak one.
        let blobUrl: string | null = null
        try {
          const binary = atob(track.audioBase64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }
          const blob = new Blob([bytes], { type: track.mimeType })
          blobUrl = URL.createObjectURL(blob)
        } catch {
          // Blob URL creation failed, audio won't play inline
        }

        const previous = useMusicStore.getState().currentTrack
        if (previous?.blobUrl && previous.blobUrl !== blobUrl) {
          URL.revokeObjectURL(previous.blobUrl)
        }

        const trackWithBlob = { ...track, blobUrl }

        set((state) => {
          const historyEntry = { ...trackWithBlob, blobUrl: null }
          const newHistory = [
            historyEntry,
            ...state.trackHistory.filter((t) => t.id !== track.id)
          ].slice(0, MAX_HISTORY)
          return {
            currentTrack: trackWithBlob,
            trackHistory: newHistory,
            isLyriaPlaying: false,
            generationError: null
          }
        })
      },
      setIsLyriaPlaying: (v) => set({ isLyriaPlaying: v }),
      setLyriaVolume: (v) => set({ lyriaVolume: v }),
      clearCurrentTrack: () => {
        const previous = useMusicStore.getState().currentTrack
        if (previous?.blobUrl) {
          URL.revokeObjectURL(previous.blobUrl)
        }
        set({ currentTrack: null, isLyriaPlaying: false })
      },
      removeFromHistory: (id) =>
        set((state) => ({ trackHistory: state.trackHistory.filter((t) => t.id !== id) })),
      setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
      setVibe: (vibe) => set({ vibe })
    }),
    {
      name: 'music-storage',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        lyriaVolume: state.lyriaVolume,
        vibe: state.vibe,
        // Persist history without blob URLs or large base64 data (they're runtime-only)
        trackHistory: state.trackHistory.map((t) => ({ ...t, blobUrl: null, audioBase64: '' }))
      })
    }
  )
)
