import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DailyFocusStats, FocusSample } from '../types'
import { electronZustandStorage } from './electronZustandStorage'

const MAX_SAMPLES = 240

function currentDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

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
  focusSamples: FocusSample[]
  dailyStats: Record<string, DailyFocusStats>

  // Actions
  setZenMode: (isZen: boolean) => void
  setTimer: (time: number) => void
  setIsBreak: (isBreak: boolean) => void
  setWpm: (wpm: number) => void
  setErrorCount: (count: number) => void
  incrementErrorCount: () => void
  incrementCodingTime: (seconds: number) => void
  recordFileTouch: (filePath: string) => void
  recordLineChange: (delta: number) => void
  resetTimer: (initialTime: number) => void
}

export const useZenStore = create<ZenState>()(
  persist(
    (set) => ({
      // Initial State
      isZenMode: false,
      timer: 25 * 60, // Default 25 minutes
      isBreak: false,
      currentWpm: 0,
      errorCount: 0,
      continuousCodingTime: 0,
      focusSamples: [],
      dailyStats: {},

      // Actions
      setZenMode: (isZen) => set({ isZenMode: isZen }),
      setTimer: (time) => set({ timer: time }),
      setIsBreak: (isBreak) => set({ isBreak }),
      setWpm: (wpm) =>
        set((state) => {
          const timestamp = Date.now()
          const date = currentDateKey(timestamp)
          const current = state.dailyStats[date] ?? {
            date,
            activeSeconds: 0,
            focusSessions: 0,
            maxWpm: 0,
            totalWpm: 0,
            sampleCount: 0,
            filesTouched: [],
            linesChanged: 0
          }
          return {
            currentWpm: wpm,
            focusSamples: [...state.focusSamples, { timestamp, wpm }].slice(-MAX_SAMPLES),
            dailyStats: {
              ...state.dailyStats,
              [date]: {
                ...current,
                maxWpm: Math.max(current.maxWpm, wpm),
                totalWpm: current.totalWpm + wpm,
                sampleCount: current.sampleCount + 1
              }
            }
          }
        }),
      setErrorCount: (count) => set({ errorCount: count }),
      incrementErrorCount: () => set((state) => ({ errorCount: state.errorCount + 1 })),
      incrementCodingTime: (seconds) =>
        set((state) => {
          const timestamp = Date.now()
          const date = currentDateKey(timestamp)
          const current = state.dailyStats[date] ?? {
            date,
            activeSeconds: 0,
            focusSessions: 0,
            maxWpm: 0,
            totalWpm: 0,
            sampleCount: 0,
            filesTouched: [],
            linesChanged: 0
          }
          return {
            continuousCodingTime: state.continuousCodingTime + seconds,
            dailyStats: {
              ...state.dailyStats,
              [date]: {
                ...current,
                activeSeconds: current.activeSeconds + seconds
              }
            }
          }
        }),
      recordFileTouch: (filePath) =>
        set((state) => {
          const timestamp = Date.now()
          const date = currentDateKey(timestamp)
          const current = state.dailyStats[date] ?? {
            date,
            activeSeconds: 0,
            focusSessions: 0,
            maxWpm: 0,
            totalWpm: 0,
            sampleCount: 0,
            filesTouched: [],
            linesChanged: 0
          }
          const filesTouched = Array.from(new Set([...current.filesTouched, filePath])).slice(-20)
          return {
            dailyStats: {
              ...state.dailyStats,
              [date]: {
                ...current,
                filesTouched
              }
            }
          }
        }),
      recordLineChange: (delta) =>
        set((state) => {
          const timestamp = Date.now()
          const date = currentDateKey(timestamp)
          const current = state.dailyStats[date] ?? {
            date,
            activeSeconds: 0,
            focusSessions: 0,
            maxWpm: 0,
            totalWpm: 0,
            sampleCount: 0,
            filesTouched: [],
            linesChanged: 0
          }
          return {
            dailyStats: {
              ...state.dailyStats,
              [date]: {
                ...current,
                linesChanged: current.linesChanged + Math.max(delta, 0)
              }
            }
          }
        }),
      resetTimer: (initialTime) => set({ timer: initialTime })
    }),
    {
      name: 'zen-focus-analytics',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        focusSamples: state.focusSamples,
        dailyStats: state.dailyStats
      })
    }
  )
)
