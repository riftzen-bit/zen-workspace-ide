import { useEffect } from 'react'
import { ActivityBar } from './ActivityBar'
import { Sidebar } from './Sidebar'
import { MonacoEditor } from '../editor/MonacoEditor'
import { GeminiChat } from '../chat/GeminiChat'
import { VibePlayer } from '../media/VibePlayer'
import { SettingsOverlay } from '../settings/SettingsOverlay'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { FocusTerminal } from '../terminal/FocusTerminal'
import { useTerminalStore } from '../../store/useTerminalStore'
import { useMediaStore } from '../../store/useMediaStore'

export const AppLayout = () => {
  const { workspaceDir, fileTree, setFileTree } = useFileStore()
  const { isSidebarOpen, activeView } = useUIStore()
  const { activeWorkspaceId } = useTerminalStore()
  const isWorkspaceActive = activeWorkspaceId !== null

  useEffect(() => {
    // Tự động chuyển nhạc về lofi khi mở lại app
    useMediaStore.getState().setCurrentVibe('lofi')
  }, [])

  useEffect(() => {
    if (workspaceDir && fileTree.length === 0) {
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
    <div className="flex h-screen w-screen overflow-hidden text-zinc-300 font-sans p-4 gap-4 bg-[#050505] selection:bg-amber-500/30">
      {/* Left Navigation Dock */}
      {!isWorkspaceActive && <ActivityBar />}

      {/* Main Workspace Frame */}
      <div
        className={`flex-1 flex overflow-hidden rounded-2xl border border-white/5 shadow-2xl relative ${isWorkspaceActive ? 'bg-[#0a0a0b]' : 'bg-[#0a0a0b]'}`}
      >
        {!isWorkspaceActive && <SettingsOverlay />}
        {!isWorkspaceActive && isSidebarOpen && <Sidebar />}

        {/* Main Content Area */}
        <div
          className={`flex-1 min-w-0 flex flex-col relative z-0 overflow-hidden shadow-inner ${isWorkspaceActive ? 'bg-transparent' : 'bg-[#050505] rounded-xl border border-white/5 m-2'}`}
        >
          {activeView === 'terminal' || isWorkspaceActive ? <FocusTerminal /> : <MonacoEditor />}
        </div>

        {!isWorkspaceActive && <GeminiChat />}
      </div>

      {/* Floating Pill Player (Rendered consistently outside the main flow to avoid unmounting) */}
      <VibePlayer />
    </div>
  )
}
