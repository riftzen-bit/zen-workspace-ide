import { useEffect } from 'react'
import type { Monaco } from '@monaco-editor/react'
import { useThemeStore, type ThemeColors, type ThemeMode } from '../store/useThemeStore'

const EDITOR_THEME_NAME = 'zen-editor'

function defineMonacoTheme(monaco: Monaco, colors: ThemeColors, mode: ThemeMode): void {
  monaco.editor.defineTheme(EDITOR_THEME_NAME, {
    base: mode === 'light' ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [{ token: '', background: colors.editorBg.replace('#', '') }],
    colors: {
      'editor.background': colors.editorBg,
      'editor.foreground': colors.textPrimary,
      'editor.lineHighlightBackground': colors.editorLineHighlight,
      'editorLineNumber.foreground': colors.editorLineNumber,
      'editorIndentGuide.background': colors.editorIndentGuide,
      'editorSuggestWidget.background': colors.surface2,
      'editorSuggestWidget.border': colors.borderSubtle,
      'editorSuggestWidget.foreground': colors.textPrimary,
      'editorSuggestWidget.selectedBackground': colors.surface4,
      'editorWidget.background': colors.surface2,
      'editorWidget.border': colors.borderSubtle,
      'diffEditor.insertedTextBackground': '#10b9811a',
      'diffEditor.removedTextBackground': '#ef44441a'
    }
  })
  monaco.editor.setTheme(EDITOR_THEME_NAME)
}

export function useEditorTheme(monaco: Monaco | null): string {
  const activePreset = useThemeStore((s) => s.activePreset)
  const customColors = useThemeStore((s) => s.customColors)
  const customMode = useThemeStore((s) => s.customMode)

  useEffect(() => {
    if (!monaco) return
    const { getActiveColors, getActiveMode } = useThemeStore.getState()
    defineMonacoTheme(monaco, getActiveColors(), getActiveMode())
  }, [monaco, activePreset, customColors, customMode])

  return EDITOR_THEME_NAME
}

export { EDITOR_THEME_NAME }
