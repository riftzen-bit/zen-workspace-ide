import { useEffect } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { useThemeStore, applyTheme } from './store/useThemeStore'

function App() {
  const { getActiveColors } = useThemeStore()

  useEffect(() => {
    applyTheme(getActiveColors())
  }, [getActiveColors])

  return <AppLayout />
}

export default App
