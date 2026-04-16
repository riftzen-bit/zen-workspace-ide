import { useEffect } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { useThemeStore, applyTheme } from './store/useThemeStore'

function App() {
  const activePreset = useThemeStore((s) => s.activePreset)
  const customColors = useThemeStore((s) => s.customColors)
  const customMode = useThemeStore((s) => s.customMode)

  useEffect(() => {
    const { getActiveColors, getActiveMode } = useThemeStore.getState()
    applyTheme(getActiveColors(), getActiveMode())
  }, [activePreset, customColors, customMode])

  return <AppLayout />
}

export default App
