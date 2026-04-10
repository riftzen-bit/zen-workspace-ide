import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ActivityBar } from './ActivityBar'
import { Sidebar } from './Sidebar'
import { ProjectList } from '../projects/ProjectList'
import { MonacoEditor } from '../editor/MonacoEditor'
import { AIChat } from '../chat/AIChat'
import { VibePlayer } from '../media/VibePlayer'
import { MusicGenerator } from '../media/MusicGenerator'
import { SettingsOverlay } from '../settings/SettingsOverlay'
import { ToastContainer } from '../ui/Toast'
import { CommandPalette } from '../ui/CommandPalette'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { FocusTerminal } from '../terminal/FocusTerminal'
import { useTerminalStore } from '../../store/useTerminalStore'
import { useMediaStore } from '../../store/useMediaStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { transition } from '../../lib/motion'
import { StatusBar } from './StatusBar'
import { useActivityStore } from '../../store/useActivityStore'
import { useCostStore } from '../../store/useCostStore'
import { PromptLibrary } from '../ui/PromptLibrary'
import { GlobalDialogs } from '../ui/GlobalDialogs'
import { GitDiffEditor } from '../git/GitDiffEditor'
import { useZenStore } from '../../store/useZenStore'
import { ZenOrchestrator } from '../activity/ZenOrchestrator'

export const AppLayout = () => {
  const { workspaceDir, fileTree, setFileTree, reloadFileFromDisk, markFileDeleted } =
    useFileStore()
  const {
    isSidebarOpen,
    activeView,
    sidebarWidth,
    chatWidth,
    isChatOpen,
    enterZenMode,
    exitZenMode,
    setCommandPaletteOpen
  } = useUIStore()
  const { activeWorkspaceId } = useTerminalStore()
  const { autoPlayVibe } = useSettingsStore()
  const isWorkspaceActive = activeWorkspaceId !== null
  const { errorCount, isZenMode } = useZenStore()

  useEffect(() => {
    if (autoPlayVibe) {
      useMediaStore.getState().setCurrentVibe('lofi')
      useMediaStore.getState().setIsPlaying(true)
      useUIStore.getState().setVibePlayerOpen(true)
    } else {
      useMediaStore.getState().setIsPlaying(false)
    }
  }, [autoPlayVibe])

  useEffect(() => {
    if (workspaceDir && fileTree.length === 0) {
      window.api.setWorkspace(workspaceDir)
      window.api
        .readDirectory(workspaceDir)
        .then((tree) => {
          if (tree) setFileTree(tree)
        })
        .catch((err) => console.error('Failed to read directory:', err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceDir])

  // Global activity + cost subscription (always active, not just when feed is open)
  useEffect(() => {
    const unsub = window.api.terminal.onActivity((raw) => {
      useActivityStore.getState().addEvent(raw as any)
      if (raw.costValue) {
        useCostStore.getState().addCost(raw.costValue)
      }
    })
    return unsub
  }, [])

  // Start/stop file watcher when workspace changes
  useEffect(() => {
    window.api.watchWorkspace(workspaceDir)

    const unsubChange = window.api.onFileChanged((filePath) => {
      const { fileContents, openFiles } = useFileStore.getState()
      // Only reload if file is currently open in editor
      if (openFiles.some((f) => f.path === filePath)) {
        // If editor buffer matches disk (no unsaved changes), reload silently
        window.api.readFile(filePath).then((content) => {
          if (content !== null && fileContents[filePath] !== undefined) {
            if (fileContents[filePath] === content) return // already in sync
            // File changed externally — reload and notify
            reloadFileFromDisk(filePath, content)
            const name = filePath.split('/').pop() || filePath
            useUIStore.getState().addToast(`${name} reloaded from disk`, 'info')
          }
        })
      }
    })

    const unsubDeleted = window.api.onFileDeleted((filePath) => {
      const { openFiles } = useFileStore.getState()
      if (openFiles.some((f) => f.path === filePath)) {
        markFileDeleted(filePath)
        const name = filePath.split('/').pop() || filePath
        useUIStore.getState().addToast(`${name} was deleted`, 'warning')
      }
    })

    const unsubCreated = window.api.onFileCreated(() => {
      // Refresh file tree when new files appear
      if (workspaceDir) {
        window.api.readDirectory(workspaceDir).then((tree) => {
          if (tree) setFileTree(tree)
        })
      }
    })

    const unsubDirCreated = window.api.onDirCreated(() => {
      if (workspaceDir) {
        window.api.readDirectory(workspaceDir).then((tree) => {
          if (tree) setFileTree(tree)
        })
      }
    })

    const unsubDirDeleted = window.api.onDirDeleted(() => {
      if (workspaceDir) {
        window.api.readDirectory(workspaceDir).then((tree) => {
          if (tree) setFileTree(tree)
        })
      }
    })

    return () => {
      unsubChange()
      unsubDeleted()
      unsubCreated()
      unsubDirCreated()
      unsubDirDeleted()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceDir])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+K — Command Palette
      if (ctrl && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }

      // Ctrl+B — Toggle Sidebar
      if (ctrl && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        useUIStore.getState().toggleSidebar()
        return
      }

      // Ctrl+I — Toggle Chat
      if (ctrl && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        useUIStore.getState().toggleChat()
        return
      }

      // Ctrl+Shift+Z — Toggle Zen Mode
      if (ctrl && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        const { isZenMode: uiZen } = useUIStore.getState()
        const { isZenMode: zen } = useZenStore.getState()
        if (uiZen || zen) {
          useZenStore.getState().setZenMode(false)
          exitZenMode()
        } else {
          useZenStore.getState().setZenMode(true)
          enterZenMode()
        }
        return
      }

      // ESC — Exit Zen Mode (only when palette is closed)
      if (e.key === 'Escape') {
        const { isCommandPaletteOpen, isZenMode: uiZen } = useUIStore.getState()
        const { isZenMode: zen } = useZenStore.getState()
        if ((uiZen || zen) && !isCommandPaletteOpen) {
          useZenStore.getState().setZenMode(false)
          exitZenMode()
        }
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enterZenMode, exitZenMode, setCommandPaletteOpen])

  // In zen mode, hide sidebar and chat regardless of their state
  const showSidebar = isSidebarOpen && !isZenMode && activeView !== 'settings'
  const showChat = isChatOpen && !isZenMode

  const themeStyles = {
    '--color-bg-warm': '#000000',
    '--color-surface-warm': '#050505',
    '--color-border-warm': 'rgba(255, 255, 255, 0.04)',

    '--color-bg-cold': '#000000',
    '--color-surface-cold': '#050505',
    '--color-border-cold': 'rgba(255, 255, 255, 0.04)',

    '--color-surface-0': errorCount > 0 ? 'var(--color-bg-cold)' : 'var(--color-bg-warm)',
    '--color-surface-1': errorCount > 0 ? 'var(--color-surface-cold)' : 'var(--color-surface-warm)',
    '--color-border-subtle':
      errorCount > 0 ? 'var(--color-border-cold)' : 'var(--color-border-warm)',

    '--color-text-primary': '#E4E4E7',
    '--color-selection-bg': 'rgba(255, 255, 255, 0.1)',
    '--font-primary':
      '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  } as React.CSSProperties

  return (
    <div
      className="flex h-screen w-screen overflow-hidden transition-colors duration-700 custom-selection"
      style={{
        ...themeStyles,
        backgroundColor: 'var(--color-surface-0)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-primary)'
      }}
    >
      <style>{`
        .custom-selection *::selection,
        .custom-selection::selection {
          background-color: var(--color-selection-bg);
        }
      `}</style>
      <ZenOrchestrator />

      {/* Left Navigation Dock */}
      {!isWorkspaceActive && !isZenMode && <ActivityBar />}

      {/* Main Workspace Frame */}
      <div
        className="flex-1 flex flex-col overflow-hidden relative transition-colors duration-700"
        style={{
          backgroundColor: 'var(--color-surface-1)'
        }}
      >
        {!isWorkspaceActive && !isZenMode && <SettingsOverlay />}

        {/* Three-column area (sidebar + content + chat) */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar with smooth animation */}
          {!isWorkspaceActive && (
            <motion.div
              initial={false}
              animate={{
                width: showSidebar ? sidebarWidth : 0
              }}
              transition={transition.panel}
              style={{
                overflow: 'hidden',
                flexShrink: 0,
                borderRight: showSidebar ? '1px solid var(--color-border-subtle)' : 'none'
              }}
            >
              <div style={{ width: sidebarWidth, minWidth: sidebarWidth, height: '100%' }}>
                {activeView === 'projects' ? <ProjectList /> : <Sidebar />}
              </div>
            </motion.div>
          )}

          {/* Main Content Area */}
          <div
            className={`flex-1 min-w-0 flex flex-col relative z-0 overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] transition-colors duration-700 bg-[#000000]`}
          >
            {activeView === 'terminal' || isWorkspaceActive ? (
              <FocusTerminal />
            ) : activeView === 'git' && useUIStore.getState().activeDiffFile ? (
              <GitDiffEditor />
            ) : (
              <MonacoEditor />
            )}
          </div>

          {/* Chat Panel with smooth animation */}
          {!isWorkspaceActive && (
            <motion.div
              initial={false}
              animate={{
                width: showChat ? chatWidth : 0
              }}
              transition={transition.panel}
              style={{
                overflow: 'hidden',
                flexShrink: 0,
                borderLeft: showChat ? '1px solid var(--color-border-subtle)' : 'none'
              }}
            >
              <div style={{ width: chatWidth, minWidth: chatWidth, height: '100%' }}>
                <AIChat />
              </div>
            </motion.div>
          )}
        </div>

        {/* Status Bar */}
        {!isWorkspaceActive && !isZenMode && <StatusBar />}
      </div>

      {/* Floating Pill Player */}
      <VibePlayer />

      {/* Music Generator */}
      <MusicGenerator />

      {/* Global UI overlays */}
      <CommandPalette />
      <PromptLibrary />
      <GlobalDialogs />
      <ToastContainer />
    </div>
  )
}
