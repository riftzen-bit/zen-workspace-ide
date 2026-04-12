import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export type ThemePreset = 'default' | 'midnight' | 'forest' | 'ocean' | 'sunset' | 'custom'

export interface ThemeColors {
  surface0: string
  surface1: string
  surface2: string
  surface3: string
  accentDim: string
  accent: string
  accentBright: string
  textPrimary: string
  textSecondary: string
}

const PRESET_THEMES: Record<ThemePreset, ThemeColors> = {
  default: {
    surface0: '#050506',
    surface1: '#0a0a0c',
    surface2: '#111114',
    surface3: '#17171b',
    accentDim: '#b8860b',
    accent: '#d4a017',
    accentBright: '#f0c040',
    textPrimary: '#e4e4e7',
    textSecondary: '#a1a1aa'
  },
  midnight: {
    surface0: '#0a0a1a',
    surface1: '#0f0f25',
    surface2: '#151530',
    surface3: '#1a1a40',
    accentDim: '#6366f1',
    accent: '#818cf8',
    accentBright: '#a5b4fc',
    textPrimary: '#e0e7ff',
    textSecondary: '#a5b4fc'
  },
  forest: {
    surface0: '#0a0f0a',
    surface1: '#0f1a0f',
    surface2: '#142014',
    surface3: '#1a2a1a',
    accentDim: '#059669',
    accent: '#10b981',
    accentBright: '#34d399',
    textPrimary: '#d1fae5',
    textSecondary: '#6ee7b7'
  },
  ocean: {
    surface0: '#0a0f14',
    surface1: '#0f1820',
    surface2: '#14202a',
    surface3: '#1a2a38',
    accentDim: '#0891b2',
    accent: '#06b6d4',
    accentBright: '#22d3ee',
    textPrimary: '#cffafe',
    textSecondary: '#67e8f9'
  },
  sunset: {
    surface0: '#140a0a',
    surface1: '#1a0f0f',
    surface2: '#251414',
    surface3: '#301a1a',
    accentDim: '#dc2626',
    accent: '#ef4444',
    accentBright: '#f87171',
    textPrimary: '#fee2e2',
    textSecondary: '#fca5a5'
  },
  custom: {
    surface0: '#050506',
    surface1: '#0a0a0c',
    surface2: '#111114',
    surface3: '#17171b',
    accentDim: '#b8860b',
    accent: '#d4a017',
    accentBright: '#f0c040',
    textPrimary: '#e4e4e7',
    textSecondary: '#a1a1aa'
  }
}

interface ThemeState {
  activePreset: ThemePreset
  customColors: ThemeColors

  setPreset: (preset: ThemePreset) => void
  setCustomColor: (key: keyof ThemeColors, value: string) => void
  resetToDefault: () => void
  getActiveColors: () => ThemeColors
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      activePreset: 'default',
      customColors: { ...PRESET_THEMES.default },

      setPreset: (preset) => set({ activePreset: preset }),

      setCustomColor: (key, value) =>
        set((state) => ({
          activePreset: 'custom',
          customColors: { ...state.customColors, [key]: value }
        })),

      resetToDefault: () =>
        set({
          activePreset: 'default',
          customColors: { ...PRESET_THEMES.default }
        }),

      getActiveColors: () => {
        const { activePreset, customColors } = get()
        if (activePreset === 'custom') return customColors
        return PRESET_THEMES[activePreset]
      }
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => electronZustandStorage)
    }
  )
)

export function applyTheme(colors: ThemeColors): void {
  const root = document.documentElement
  root.style.setProperty('--color-surface-0', colors.surface0)
  root.style.setProperty('--color-surface-1', colors.surface1)
  root.style.setProperty('--color-surface-2', colors.surface2)
  root.style.setProperty('--color-surface-3', colors.surface3)
  root.style.setProperty('--color-accent-dim', colors.accentDim)
  root.style.setProperty('--color-accent', colors.accent)
  root.style.setProperty('--color-accent-bright', colors.accentBright)
  root.style.setProperty('--color-text-primary', colors.textPrimary)
  root.style.setProperty('--color-text-secondary', colors.textSecondary)

  // Derive glow colors from accent
  const accentRgb = hexToRgb(colors.accent)
  if (accentRgb) {
    root.style.setProperty('--color-accent-glow', `rgba(${accentRgb}, 0.09)`)
    root.style.setProperty('--color-accent-glow-strong', `rgba(${accentRgb}, 0.2)`)
  }
}

function hexToRgb(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}

export { PRESET_THEMES }
