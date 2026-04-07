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
import { GitDiffEditor } from '../git/GitDiffEditor'

export const AppLayout = () => {
  const { workspaceDir, fileTree, setFileTree, reloadFileFromDisk, markFileDeleted } =
    useFileStore()
  const {
    isSidebarOpen,
    activeView,
    sidebarWidth,
    chatWidth,
    isChatOpen,
    isZenMode,
    enterZenMode,
    exitZenMode,
    setCommandPaletteOpen
  } = useUIStore()
  const { activeWorkspaceId } = useTerminalStore()
  const { autoPlayVibe } = useSettingsStore()
  const isWorkspaceActive = activeWorkspaceId !== null

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
        const { isZenMode: zen } = useUIStore.getState()
        zen ? exitZenMode() : enterZenMode()
        return
      }

      // ESC — Exit Zen Mode (only when palette is closed)
      if (e.key === 'Escape') {
        const { isZenMode: zen, isCommandPaletteOpen } = useUIStore.getState()
        if (zen && !isCommandPaletteOpen) {
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

  return (
    <div
      className="flex h-screen w-screen overflow-hidden text-zinc-300 font-sans p-3 gap-3 selection:bg-amber-500/25"
      style={{ backgroundColor: 'var(--color-surface-0)' }}
    >
      {/* Left Navigation Dock */}
      {!isWorkspaceActive && !isZenMode && <ActivityBar />}

      {/* Main Workspace Frame */}
      <div
        className="flex-1 flex flex-col overflow-hidden rounded-2xl relative"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)'
        }}
      >
        {!isWorkspaceActive && <SettingsOverlay />}

        {/* Three-column area (sidebar + content + chat) */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar with smooth animation */}
          {!isWorkspaceActive && (
            <motion.div
              initial={false}
              animate={{
                width: showSidebar ? sidebarWidth : 0,
                opacity: showSidebar ? 1 : 0
              }}
              transition={transition.panel}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <div style={{ width: sidebarWidth, minWidth: sidebarWidth, height: '100%' }}>
                {activeView === 'projects' ? <ProjectList /> : <Sidebar />}
              </div>
            </motion.div>
          )}

          {/* Main Content Area */}
          <div
            className={`flex-1 min-w-0 flex flex-col relative z-0 overflow-hidden shadow-inner ${
              isWorkspaceActive ? 'bg-transparent' : 'rounded-xl border m-2'
            }`}
            style={
              isWorkspaceActive
                ? undefined
                : {
                    backgroundColor: 'var(--color-surface-0)',
                    borderColor: 'var(--color-border-subtle)'
                  }
            }
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
                width: showChat ? chatWidth : 0,
                opacity: showChat ? 1 : 0
              }}
              transition={transition.panel}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <div style={{ width: chatWidth, minWidth: chatWidth, height: '100%' }}>
                <AIChat />
              </div>
            </motion.div>
          )}
        </div>

        {/* Status Bar */}
        {!isWorkspaceActive && <StatusBar />}
      </div>

      {/* Floating Pill Player */}
      <VibePlayer />

      {/* Music Generator */}
      <MusicGenerator />

      {/* Global UI overlays */}
      <CommandPalette />
      <PromptLibrary />
      <ToastContainer />
    </div>
  )
}
