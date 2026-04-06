import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ActivityBar } from './ActivityBar'
import { Sidebar } from './Sidebar'
import { ProjectList } from '../projects/ProjectList'
import { MonacoEditor } from '../editor/MonacoEditor'
import { GeminiChat } from '../chat/GeminiChat'
import { VibePlayer } from '../media/VibePlayer'
import { SettingsOverlay } from '../settings/SettingsOverlay'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { FocusTerminal } from '../terminal/FocusTerminal'
import { useTerminalStore } from '../../store/useTerminalStore'
import { useMediaStore } from '../../store/useMediaStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { transition } from '../../lib/motion'

export const AppLayout = () => {
  const { workspaceDir, fileTree, setFileTree } = useFileStore()
  const { isSidebarOpen, activeView, sidebarWidth, chatWidth, isChatOpen } = useUIStore()
  const { activeWorkspaceId } = useTerminalStore()
  const { autoPlayVibe } = useSettingsStore()
  const isWorkspaceActive = activeWorkspaceId !== null

  useEffect(() => {
    if (autoPlayVibe) {
      useMediaStore.getState().setCurrentVibe('lofi')
      useMediaStore.getState().setIsPlaying(true)
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        useUIStore.getState().toggleSidebar()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        useUIStore.getState().toggleChat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      className="flex h-screen w-screen overflow-hidden text-zinc-300 font-sans p-3 gap-3 selection:bg-amber-500/25"
      style={{ backgroundColor: 'var(--color-surface-0)' }}
    >
      {/* Left Navigation Dock */}
      {!isWorkspaceActive && <ActivityBar />}

      {/* Main Workspace Frame */}
      <div
        className="flex-1 flex overflow-hidden rounded-2xl relative"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)'
        }}
      >
        {!isWorkspaceActive && <SettingsOverlay />}

        {/* Sidebar with smooth animation */}
        {!isWorkspaceActive && (
          <motion.div
            initial={false}
            animate={{
              width: isSidebarOpen && activeView !== 'settings' ? sidebarWidth : 0,
              opacity: isSidebarOpen && activeView !== 'settings' ? 1 : 0
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
          {activeView === 'terminal' || isWorkspaceActive ? <FocusTerminal /> : <MonacoEditor />}
        </div>

        {/* Chat Panel with smooth animation */}
        {!isWorkspaceActive && (
          <motion.div
            initial={false}
            animate={{
              width: isChatOpen ? chatWidth : 0,
              opacity: isChatOpen ? 1 : 0
            }}
            transition={transition.panel}
            style={{ overflow: 'hidden', flexShrink: 0 }}
          >
            <div style={{ width: chatWidth, minWidth: chatWidth, height: '100%' }}>
              <GeminiChat />
            </div>
          </motion.div>
        )}
      </div>

      {/* Floating Pill Player */}
      <VibePlayer />
    </div>
  )
}
