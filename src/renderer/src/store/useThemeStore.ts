import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export type ThemeMode = 'dark' | 'light'

export type ThemePreset =
  | 'default'
  | 'midnight'
  | 'forest'
  | 'ocean'
  | 'sunset'
  | 'paper'
  | 'snow'
  | 'sand'
  | 'custom'

export interface ThemeColors {
  surface0: string
  surface1: string
  surface2: string
  surface3: string
  surface4: string
  surface5: string
  surface6: string
  accentDim: string
  accent: string
  accentBright: string
  secondary: string
  secondaryDim: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  textMuted: string
  borderSubtle: string
  borderDefault: string
  borderHover: string
  editorBg: string
  editorLineHighlight: string
  editorLineNumber: string
  editorIndentGuide: string
  terminalBg: string
  terminalFg: string
  terminalCursor: string
  terminalSelection: string
  buttonText: string
}

export interface ThemePresetMeta {
  mode: ThemeMode
  label: string
  colors: ThemeColors
}

const DARK_BORDERS = {
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderDefault: 'rgba(255, 255, 255, 0.07)',
  borderHover: 'rgba(255, 255, 255, 0.13)'
}

const LIGHT_BORDERS = {
  borderSubtle: 'rgba(0, 0, 0, 0.06)',
  borderDefault: 'rgba(0, 0, 0, 0.10)',
  borderHover: 'rgba(0, 0, 0, 0.18)'
}

const DARK_TEXT_DIM = {
  textTertiary: '#71717a',
  textMuted: '#52525b'
}

const LIGHT_TEXT_DIM = {
  textTertiary: '#52525b',
  textMuted: '#71717a'
}

const PRESETS: Record<Exclude<ThemePreset, 'custom'>, ThemePresetMeta> = {
  default: {
    mode: 'dark',
    label: 'Default',
    colors: {
      surface0: '#050506',
      surface1: '#0a0a0c',
      surface2: '#111114',
      surface3: '#17171b',
      surface4: '#1e1e23',
      surface5: '#26262c',
      surface6: '#333339',
      accentDim: '#b8860b',
      accent: '#d4a017',
      accentBright: '#f0c040',
      secondary: '#7c9a92',
      secondaryDim: '#5a7a71',
      textPrimary: '#e4e4e7',
      textSecondary: '#a1a1aa',
      ...DARK_TEXT_DIM,
      ...DARK_BORDERS,
      editorBg: '#000000',
      editorLineHighlight: '#ffffff06',
      editorLineNumber: '#3f3f46',
      editorIndentGuide: '#ffffff08',
      terminalBg: '#000000',
      terminalFg: '#d4d4d8',
      terminalCursor: '#a1a1aa',
      terminalSelection: '#3f3f46',
      buttonText: '#0a0a0c'
    }
  },
  midnight: {
    mode: 'dark',
    label: 'Midnight',
    colors: {
      surface0: '#0a0a1a',
      surface1: '#0f0f25',
      surface2: '#151530',
      surface3: '#1a1a40',
      surface4: '#22224d',
      surface5: '#2a2a5a',
      surface6: '#363676',
      accentDim: '#6366f1',
      accent: '#818cf8',
      accentBright: '#a5b4fc',
      secondary: '#7c9a92',
      secondaryDim: '#5a7a71',
      textPrimary: '#e0e7ff',
      textSecondary: '#a5b4fc',
      ...DARK_TEXT_DIM,
      ...DARK_BORDERS,
      editorBg: '#0a0a1a',
      editorLineHighlight: '#ffffff06',
      editorLineNumber: '#3f3f76',
      editorIndentGuide: '#ffffff08',
      terminalBg: '#0a0a1a',
      terminalFg: '#e0e7ff',
      terminalCursor: '#a5b4fc',
      terminalSelection: '#363676',
      buttonText: '#0a0a1a'
    }
  },
  forest: {
    mode: 'dark',
    label: 'Forest',
    colors: {
      surface0: '#0a0f0a',
      surface1: '#0f1a0f',
      surface2: '#142014',
      surface3: '#1a2a1a',
      surface4: '#213421',
      surface5: '#293f29',
      surface6: '#345234',
      accentDim: '#059669',
      accent: '#10b981',
      accentBright: '#34d399',
      secondary: '#7c9a92',
      secondaryDim: '#5a7a71',
      textPrimary: '#d1fae5',
      textSecondary: '#6ee7b7',
      ...DARK_TEXT_DIM,
      ...DARK_BORDERS,
      editorBg: '#0a0f0a',
      editorLineHighlight: '#ffffff06',
      editorLineNumber: '#3f5246',
      editorIndentGuide: '#ffffff08',
      terminalBg: '#0a0f0a',
      terminalFg: '#d1fae5',
      terminalCursor: '#34d399',
      terminalSelection: '#345234',
      buttonText: '#0a0f0a'
    }
  },
  ocean: {
    mode: 'dark',
    label: 'Ocean',
    colors: {
      surface0: '#0a0f14',
      surface1: '#0f1820',
      surface2: '#14202a',
      surface3: '#1a2a38',
      surface4: '#213545',
      surface5: '#294155',
      surface6: '#345470',
      accentDim: '#0891b2',
      accent: '#06b6d4',
      accentBright: '#22d3ee',
      secondary: '#7c9a92',
      secondaryDim: '#5a7a71',
      textPrimary: '#cffafe',
      textSecondary: '#67e8f9',
      ...DARK_TEXT_DIM,
      ...DARK_BORDERS,
      editorBg: '#0a0f14',
      editorLineHighlight: '#ffffff06',
      editorLineNumber: '#3f5566',
      editorIndentGuide: '#ffffff08',
      terminalBg: '#0a0f14',
      terminalFg: '#cffafe',
      terminalCursor: '#22d3ee',
      terminalSelection: '#345470',
      buttonText: '#0a0f14'
    }
  },
  sunset: {
    mode: 'dark',
    label: 'Sunset',
    colors: {
      surface0: '#140a0a',
      surface1: '#1a0f0f',
      surface2: '#251414',
      surface3: '#301a1a',
      surface4: '#3d2121',
      surface5: '#4a2929',
      surface6: '#5e3434',
      accentDim: '#dc2626',
      accent: '#ef4444',
      accentBright: '#f87171',
      secondary: '#7c9a92',
      secondaryDim: '#5a7a71',
      textPrimary: '#fee2e2',
      textSecondary: '#fca5a5',
      ...DARK_TEXT_DIM,
      ...DARK_BORDERS,
      editorBg: '#140a0a',
      editorLineHighlight: '#ffffff06',
      editorLineNumber: '#5f3f3f',
      editorIndentGuide: '#ffffff08',
      terminalBg: '#140a0a',
      terminalFg: '#fee2e2',
      terminalCursor: '#f87171',
      terminalSelection: '#5e3434',
      buttonText: '#140a0a'
    }
  },
  paper: {
    mode: 'light',
    label: 'Paper',
    colors: {
      surface0: '#fafaf7',
      surface1: '#f5f5f0',
      surface2: '#eeeee8',
      surface3: '#e6e6dd',
      surface4: '#dcdcd2',
      surface5: '#cfcfc4',
      surface6: '#bcbcb1',
      accentDim: '#a47107',
      accent: '#b8860b',
      accentBright: '#d4a017',
      secondary: '#5a7a71',
      secondaryDim: '#3f5d54',
      textPrimary: '#1a1a1a',
      textSecondary: '#3f3f46',
      ...LIGHT_TEXT_DIM,
      ...LIGHT_BORDERS,
      editorBg: '#fafaf7',
      editorLineHighlight: '#00000008',
      editorLineNumber: '#a1a1aa',
      editorIndentGuide: '#0000000d',
      terminalBg: '#fafaf7',
      terminalFg: '#1a1a1a',
      terminalCursor: '#3f3f46',
      terminalSelection: '#d4d4d8',
      buttonText: '#ffffff'
    }
  },
  snow: {
    mode: 'light',
    label: 'Snow',
    colors: {
      surface0: '#ffffff',
      surface1: '#f8fafc',
      surface2: '#f1f5f9',
      surface3: '#e2e8f0',
      surface4: '#cbd5e1',
      surface5: '#94a3b8',
      surface6: '#64748b',
      accentDim: '#1d4ed8',
      accent: '#2563eb',
      accentBright: '#3b82f6',
      secondary: '#0891b2',
      secondaryDim: '#0e7490',
      textPrimary: '#0f172a',
      textSecondary: '#1e293b',
      ...LIGHT_TEXT_DIM,
      ...LIGHT_BORDERS,
      editorBg: '#ffffff',
      editorLineHighlight: '#0000000a',
      editorLineNumber: '#94a3b8',
      editorIndentGuide: '#0000000d',
      terminalBg: '#ffffff',
      terminalFg: '#0f172a',
      terminalCursor: '#1e293b',
      terminalSelection: '#bfdbfe',
      buttonText: '#ffffff'
    }
  },
  sand: {
    mode: 'light',
    label: 'Sand',
    colors: {
      surface0: '#fdf6e3',
      surface1: '#f5ecd0',
      surface2: '#ede0ba',
      surface3: '#e0d0a3',
      surface4: '#d2bf8c',
      surface5: '#bfa872',
      surface6: '#a08956',
      accentDim: '#c2410c',
      accent: '#ea580c',
      accentBright: '#f97316',
      secondary: '#65a30d',
      secondaryDim: '#4d7c0f',
      textPrimary: '#1c1917',
      textSecondary: '#44403c',
      ...LIGHT_TEXT_DIM,
      ...LIGHT_BORDERS,
      editorBg: '#fdf6e3',
      editorLineHighlight: '#00000008',
      editorLineNumber: '#a0896f',
      editorIndentGuide: '#0000000d',
      terminalBg: '#fdf6e3',
      terminalFg: '#1c1917',
      terminalCursor: '#44403c',
      terminalSelection: '#fed7aa',
      buttonText: '#ffffff'
    }
  }
}

const PRESET_THEMES: Record<Exclude<ThemePreset, 'custom'>, ThemeColors> = Object.fromEntries(
  Object.entries(PRESETS).map(([k, v]) => [k, v.colors])
) as Record<Exclude<ThemePreset, 'custom'>, ThemeColors>

const PRESET_LABELS: Record<ThemePreset, string> = {
  default: 'Default',
  midnight: 'Midnight',
  forest: 'Forest',
  ocean: 'Ocean',
  sunset: 'Sunset',
  paper: 'Paper',
  snow: 'Snow',
  sand: 'Sand',
  custom: 'Custom'
}

const PRESET_MODES: Record<Exclude<ThemePreset, 'custom'>, ThemeMode> = Object.fromEntries(
  Object.entries(PRESETS).map(([k, v]) => [k, v.mode])
) as Record<Exclude<ThemePreset, 'custom'>, ThemeMode>

interface ThemeState {
  activePreset: ThemePreset
  customColors: ThemeColors
  customMode: ThemeMode

  setPreset: (preset: ThemePreset) => void
  setCustomColor: (key: keyof ThemeColors, value: string) => void
  setCustomMode: (mode: ThemeMode) => void
  resetToDefault: () => void
  getActiveColors: () => ThemeColors
  getActiveMode: () => ThemeMode
}

function mergeWithDefault(partial: Partial<ThemeColors>): ThemeColors {
  return { ...PRESET_THEMES.default, ...partial }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      activePreset: 'default',
      customColors: { ...PRESET_THEMES.default },
      customMode: 'dark',

      setPreset: (preset) => set({ activePreset: preset }),

      setCustomColor: (key, value) =>
        set((state) => ({
          activePreset: 'custom',
          customColors: { ...state.customColors, [key]: value }
        })),

      setCustomMode: (mode) => set({ customMode: mode }),

      resetToDefault: () =>
        set({
          activePreset: 'default',
          customColors: { ...PRESET_THEMES.default },
          customMode: 'dark'
        }),

      getActiveColors: () => {
        const { activePreset, customColors } = get()
        if (activePreset === 'custom') return mergeWithDefault(customColors)
        return PRESET_THEMES[activePreset]
      },

      getActiveMode: () => {
        const { activePreset, customMode } = get()
        if (activePreset === 'custom') return customMode
        return PRESET_MODES[activePreset]
      }
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => electronZustandStorage),
      version: 2,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<ThemeState>
        if (version < 2) {
          return {
            activePreset: state.activePreset ?? 'default',
            customColors: mergeWithDefault((state.customColors ?? {}) as Partial<ThemeColors>),
            customMode: 'dark' as ThemeMode
          }
        }
        return state as ThemeState
      }
    }
  )
)

export function applyTheme(colors: ThemeColors, mode: ThemeMode = 'dark'): void {
  const root = document.documentElement
  root.setAttribute('data-theme', mode)
  root.style.setProperty('--color-surface-0', colors.surface0)
  root.style.setProperty('--color-surface-1', colors.surface1)
  root.style.setProperty('--color-surface-2', colors.surface2)
  root.style.setProperty('--color-surface-3', colors.surface3)
  root.style.setProperty('--color-surface-4', colors.surface4)
  root.style.setProperty('--color-surface-5', colors.surface5)
  root.style.setProperty('--color-surface-6', colors.surface6)
  root.style.setProperty('--color-accent-dim', colors.accentDim)
  root.style.setProperty('--color-accent', colors.accent)
  root.style.setProperty('--color-accent-bright', colors.accentBright)
  root.style.setProperty('--color-secondary', colors.secondary)
  root.style.setProperty('--color-secondary-dim', colors.secondaryDim)
  root.style.setProperty('--color-text-primary', colors.textPrimary)
  root.style.setProperty('--color-text-secondary', colors.textSecondary)
  root.style.setProperty('--color-text-tertiary', colors.textTertiary)
  root.style.setProperty('--color-text-muted', colors.textMuted)
  root.style.setProperty('--color-border-subtle', colors.borderSubtle)
  root.style.setProperty('--color-border-default', colors.borderDefault)
  root.style.setProperty('--color-border-hover', colors.borderHover)
  root.style.setProperty('--color-button-text', colors.buttonText)

  const accentRgb = hexToRgb(colors.accent)
  if (accentRgb) {
    root.style.setProperty('--color-accent-glow', `rgba(${accentRgb}, 0.09)`)
    root.style.setProperty('--color-accent-glow-strong', `rgba(${accentRgb}, 0.2)`)
    root.style.setProperty('--color-border-accent', `rgba(${accentRgb}, 0.18)`)
  }
  const secondaryRgb = hexToRgb(colors.secondary)
  if (secondaryRgb) {
    root.style.setProperty('--color-secondary-glow', `rgba(${secondaryRgb}, 0.08)`)
    root.style.setProperty('--color-border-secondary', `rgba(${secondaryRgb}, 0.2)`)
  }
}

function hexToRgb(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}

export { PRESET_THEMES, PRESET_LABELS, PRESET_MODES }
