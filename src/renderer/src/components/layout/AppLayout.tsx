import { useEffect, useRef } from 'react'
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
import { SnippetLibrary } from '../ui/SnippetLibrary'
import { FocusAnalyticsDashboard } from '../activity/FocusAnalyticsDashboard'
import { AgentOrchestratorDashboard } from '../terminal/AgentOrchestratorDashboard'

export const AppLayout = () => {
  const { workspaceDir, fileTree, setFileTree, reloadFileFromDisk, markFileDeleted } =
    useFileStore()
  const {
    isSidebarOpen,
    activeView,
    activeDiffFile,
    sidebarWidth,
    chatWidth,
    isChatOpen,
    enterZenMode,
    exitZenMode,
    setCommandPaletteOpen
  } = useUIStore()
  const { activeWorkspaceId } = useTerminalStore()
  const {
    autoPlayVibe,
    agentBudgetLimit,
    autoPauseAgentBudget,
    adaptiveAmbientEnabled
  } = useSettingsStore()
  const isWorkspaceActive = activeWorkspaceId !== null
  const { isZenMode, currentWpm, errorCount } = useZenStore()
  const adaptiveAmbientRef = useRef<{ vibe: 'lofi' | 'rain' | null; changedAt: number }>({
    vibe: null,
    changedAt: 0
  })

  const pauseActiveWorkspacesForBudget = async () => {
    const terminalStore = useTerminalStore.getState()
    const activeWorkspaces = terminalStore.workspaces.filter((workspace) => workspace.status === 'active')
    if (activeWorkspaces.length === 0) {
      return
    }

    const results = await Promise.all(
      activeWorkspaces.map((workspace) => terminalStore.pauseWorkspace(workspace.id))
    )
    const failures = results.filter((result) => !result.success)

    if (failures.length === 0) {
      useUIStore
        .getState()
        .addToast(
          `Paused ${activeWorkspaces.length} workspace${activeWorkspaces.length === 1 ? '' : 's'} after budget limit.`,
          'warning'
        )
      return
    }

    if (failures.some((result) => result.reason === 'unsupported-platform')) {
      useUIStore
        .getState()
        .addToast('Budget limit reached, but workspace auto-pause is not supported on this platform.', 'warning')
      return
    }

    useUIStore
      .getState()
      .addToast('Budget limit reached, but some workspaces could not be auto-paused.', 'warning')
  }

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
    useCostStore.getState().setBudgetLimit(agentBudgetLimit)
  }, [agentBudgetLimit])

  useEffect(() => {
    useCostStore.getState().setAutoPauseOnLimit(autoPauseAgentBudget)
  }, [autoPauseAgentBudget])

  useEffect(() => {
    if (agentBudgetLimit === null || agentBudgetLimit <= 0) {
      return
    }

    const costState = useCostStore.getState()
    if (costState.totalCost >= agentBudgetLimit && !costState.limitTriggered) {
      useCostStore.getState().setLimitTriggered(true)
      useUIStore
        .getState()
        .addToast(`AI budget limit reached at $${agentBudgetLimit.toFixed(2)}.`, 'error')

      if (autoPauseAgentBudget) {
        void pauseActiveWorkspacesForBudget()
      }
    }
  }, [agentBudgetLimit, autoPauseAgentBudget])

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
        const before = useCostStore.getState()
        before.addTerminalCost(raw.terminalId, raw.costValue)
        const after = useCostStore.getState()

        if (after.budgetLimit !== null && after.budgetLimit > 0) {
          if (!before.warnedAt80 && after.warnedAt80 && after.totalCost < after.budgetLimit) {
            useUIStore
              .getState()
              .addToast(`AI budget is ${Math.round((after.totalCost / after.budgetLimit) * 100)}% used.`, 'warning')
          }

          if (!before.limitTriggered && after.totalCost >= after.budgetLimit) {
            useCostStore.getState().setLimitTriggered(true)
            useUIStore
              .getState()
              .addToast(`AI budget limit reached at $${after.budgetLimit.toFixed(2)}.`, 'error')

            if (after.autoPauseOnLimit) {
              void pauseActiveWorkspacesForBudget()
            }
          }
        }
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!adaptiveAmbientEnabled) {
      adaptiveAmbientRef.current = { vibe: null, changedAt: 0 }
      return
    }

    const mediaState = useMediaStore.getState()
    const now = Date.now()
    let nextVibe: 'lofi' | 'rain' | null = null

    if (errorCount >= 4 || (currentWpm > 0 && currentWpm < 18)) {
      nextVibe = 'rain'
    } else if (currentWpm >= 18) {
      nextVibe = 'lofi'
    }

    if (!nextVibe) {
      return
    }

    const cooldownMs = 45000
    const lastAdaptive = adaptiveAmbientRef.current
    if (lastAdaptive.vibe === nextVibe && now - lastAdaptive.changedAt < cooldownMs) {
      return
    }

    if (mediaState.currentVibe === nextVibe && mediaState.isPlaying) {
      adaptiveAmbientRef.current = { vibe: nextVibe, changedAt: now }
      return
    }

    useMediaStore.getState().setCurrentVibe(nextVibe)
    useMediaStore.getState().setIsPlaying(true)
    useUIStore.getState().setVibePlayerOpen(true)
    adaptiveAmbientRef.current = { vibe: nextVibe, changedAt: now }
  }, [adaptiveAmbientEnabled, currentWpm, errorCount])

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
  const showTerminalView = activeView === 'terminal' || isWorkspaceActive
  const showFocusView = !isWorkspaceActive && activeView === 'focus'
  const showOrchestratorView = !isWorkspaceActive && activeView === 'orchestrator'
  const showGitDiffView = !isWorkspaceActive && activeView === 'git' && activeDiffFile !== null
  const showEditorView =
    !showTerminalView && !showFocusView && !showOrchestratorView && !showGitDiffView

  useEffect(() => {
    if (!showTerminalView) {
      return
    }

    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event('terminal:force-fit'))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [showTerminalView])

  const themeStyles = {
    '--color-bg-warm': '#050505',
    '--color-surface-warm': '#0a0a0a',
    '--color-border-warm': '#222222',

    '--color-bg-cold': '#050505',
    '--color-surface-cold': '#0a0a0a',
    '--color-border-cold': '#222222',

    '--color-surface-0': '#050505',
    '--color-surface-1': '#0a0a0a',
    '--color-border-subtle': '#222222',

    '--color-text-primary': '#cccccc',
    '--color-selection-bg': '#333333',
    '--font-primary':
      '"Space Mono", "JetBrains Mono", Consolas, Menlo, monospace'
  } as React.CSSProperties

  return (
    <div
      className="flex h-screen w-screen overflow-hidden custom-selection"
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
        className="flex-1 flex flex-col overflow-hidden relative"
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
            className={`flex-1 min-w-0 flex flex-col relative z-0 overflow-hidden bg-[#050505]`}
          >
            <div className="flex-1 min-h-0" style={{ display: showTerminalView ? 'flex' : 'none' }}>
              <FocusTerminal />
            </div>
            {showFocusView ? <FocusAnalyticsDashboard /> : null}
            {showOrchestratorView ? <AgentOrchestratorDashboard /> : null}
            {showGitDiffView ? <GitDiffEditor /> : null}
            {showEditorView ? <MonacoEditor /> : null}
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
      <SnippetLibrary />
      <GlobalDialogs />
      <ToastContainer />
    </div>
  )
}
