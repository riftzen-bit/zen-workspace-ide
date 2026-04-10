import { create } from 'zustand'

interface ZenState {
  // Pomodoro State
  isZenMode: boolean
  timer: number
  isBreak: boolean

  // Code-Vibe State
  currentWpm: number
  errorCount: number

  // Health Metrics
  continuousCodingTime: number

  // Actions
  setZenMode: (isZen: boolean) => void
  setTimer: (time: number) => void
  setIsBreak: (isBreak: boolean) => void
  setWpm: (wpm: number) => void
  setErrorCount: (count: number) => void
  incrementErrorCount: () => void
  incrementCodingTime: (seconds: number) => void
  resetTimer: (initialTime: number) => void
}

export const useZenStore = create<ZenState>((set) => ({
  // Initial State
  isZenMode: false,
  timer: 25 * 60, // Default 25 minutes
  isBreak: false,
  currentWpm: 0,
  errorCount: 0,
  continuousCodingTime: 0,

  // Actions
  setZenMode: (isZen) => set({ isZenMode: isZen }),
  setTimer: (time) => set({ timer: time }),
  setIsBreak: (isBreak) => set({ isBreak }),
  setWpm: (wpm) => set({ currentWpm: wpm }),
  setErrorCount: (count) => set({ errorCount: count }),
  incrementErrorCount: () => set((state) => ({ errorCount: state.errorCount + 1 })),
  incrementCodingTime: (seconds) =>
    set((state) => ({ continuousCodingTime: state.continuousCodingTime + seconds })),
  resetTimer: (initialTime) => set({ timer: initialTime })
}))
