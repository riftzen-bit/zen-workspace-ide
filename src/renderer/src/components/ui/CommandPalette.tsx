import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search,
  Folder,
  FolderKanban,
  Terminal,
  Settings,
  Disc,
  MessageSquare,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  BookOpen,
  TestTube,
  type LucideIcon
} from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useFileStore } from '../../store/useFileStore'
import { useTerminalStore } from '../../store/useTerminalStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { transition } from '../../lib/motion'

interface Command {
  id: string
  label: string
  description?: string
  icon: LucideIcon
  category: string
  shortcut?: string
  action: () => void
}

const useCommands = (): Command[] => {
  const {
    setActiveView,
    toggleSidebar,
    isSidebarOpen,
    toggleChat,
    isChatOpen,
    toggleVibePlayer,
    isVibePlayerOpen,
    isZenMode,
    enterZenMode,
    exitZenMode,
    setCommandPaletteOpen,
    setPromptLibraryOpen
  } = useUIStore()
  const { workspaceDir } = useFileStore()
  const { setModalOpen } = useTerminalStore()

  const close = () => setCommandPaletteOpen(false)

  return [
    {
      id: 'explorer',
      label: 'Go to Explorer',
      description: 'Open file explorer panel',
      icon: Folder,
      category: 'Navigation',
      action: () => {
        setActiveView('explorer')
        if (!isSidebarOpen) toggleSidebar()
        close()
      }
    },
    {
      id: 'search',
      label: 'Go to Search',
      description: 'Open workspace search',
      icon: Search,
      category: 'Navigation',
      shortcut: '',
      action: () => {
        setActiveView('search')
        close()
      }
    },
    {
      id: 'projects',
      label: 'Go to Projects',
      description: 'Open project manager',
      icon: FolderKanban,
      category: 'Navigation',
      action: () => {
        setActiveView('projects')
        close()
      }
    },
    {
      id: 'terminal',
      label: 'Go to Terminal',
      description: 'Open terminal workspaces',
      icon: Terminal,
      category: 'Navigation',
      action: () => {
        setActiveView('terminal')
        close()
      }
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Configure API key, editor, and vibe player',
      icon: Settings,
      category: 'Navigation',
      action: () => {
        setActiveView('settings')
        close()
      }
    },
    {
      id: 'toggle-sidebar',
      label: isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar',
      description: 'Toggle the left panel',
      icon: isSidebarOpen ? PanelLeftClose : PanelLeftOpen,
      category: 'View',
      shortcut: 'Ctrl+B',
      action: () => {
        toggleSidebar()
        close()
      }
    },
    {
      id: 'toggle-chat',
      label: isChatOpen ? 'Hide AI Assistant' : 'Show AI Assistant',
      description: 'Toggle the AI chat panel',
      icon: MessageSquare,
      category: 'View',
      shortcut: 'Ctrl+I',
      action: () => {
        toggleChat()
        close()
      }
    },
    {
      id: 'toggle-vibe',
      label: isVibePlayerOpen ? 'Close Vibe Player' : 'Open Vibe Player',
      description: 'Toggle ambient music player',
      icon: Disc,
      category: 'View',
      action: () => {
        toggleVibePlayer()
        close()
      }
    },
    {
      id: 'zen-mode',
      label: isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode',
      description: isZenMode ? 'Restore panels' : 'Distraction-free full focus',
      icon: isZenMode ? Minimize2 : Maximize2,
      category: 'View',
      shortcut: 'Ctrl+Shift+Z',
      action: () => {
        isZenMode ? exitZenMode() : enterZenMode()
        close()
      }
    },
    {
      id: 'prompt-library',
      label: 'Prompt Library',
      description: 'Browse and send AI prompts to chat or terminal',
      icon: BookOpen,
      category: 'AI',
      action: () => {
        close()
        setPromptLibraryOpen(true)
      }
    },
    {
      id: 'generate-test',
      label: 'AI: Generate Test for Current File',
      description: 'Automatically generate a test file using AI',
      icon: TestTube,
      category: 'AI',
      action: async () => {
        close()
        const activeFile = useFileStore.getState().activeFile
        if (!activeFile) {
          useUIStore.getState().addToast('No active file to generate a test for.', 'error')
          return
        }

        const { activeProvider, modelPerProvider } = useSettingsStore.getState()
        const currentProvider = activeProvider
        const currentModel = currentProvider ? modelPerProvider[currentProvider] : undefined
        if (!currentProvider || !currentModel) {
          useUIStore.getState().addToast('AI provider or model not configured.', 'error')
          return
        }

        useUIStore.getState().addToast('Generating test...', 'info')
        try {
          const res = await window.api.ai.generateTest({
            filePath: activeFile,
            provider: currentProvider,
            model: currentModel,
            apiKey:
              currentProvider === 'gemini' ? useSettingsStore.getState().geminiApiKey : undefined,
            useGeminiOAuth:
              currentProvider === 'gemini'
                ? useSettingsStore.getState().geminiOAuthActive
                : undefined
          })
          if (res.success && res.targetPath) {
            useUIStore.getState().addToast(`Test generated at ${res.targetPath}`, 'success')
          } else {
            useUIStore.getState().addToast(res.error || 'Failed to generate test', 'error')
          }
        } catch (err: any) {
          useUIStore.getState().addToast(err.message || 'Error generating test', 'error')
        }
      }
    },
    {
      id: 'new-workspace',
      label: 'New Terminal Workspace',
      description: 'Create a new terminal workspace',
      icon: Plus,
      category: 'Terminal',
      action: () => {
        setActiveView('terminal')
        setModalOpen(true)
        close()
      }
    },
    ...(workspaceDir
      ? [
          {
            id: 'open-folder',
            label: 'Open Folder',
            description: 'Change workspace directory',
            icon: Folder,
            category: 'File',
            action: async () => {
              close()
              const dir = await window.api.openDirectory()
              if (dir) {
                useFileStore.getState().setWorkspaceDir(dir)
                setActiveView('explorer')
              }
            }
          }
        ]
      : [
          {
            id: 'open-folder',
            label: 'Open Folder',
            description: 'Select a workspace directory',
            icon: Folder,
            category: 'File',
            action: async () => {
              close()
              const dir = await window.api.openDirectory()
              if (dir) {
                useFileStore.getState().setWorkspaceDir(dir)
                setActiveView('explorer')
              }
            }
          }
        ])
  ]
}

export const CommandPalette = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useUIStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const commands = useCommands()

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isCommandPaletteOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const runSelected = () => {
    if (filtered[selectedIndex]) {
      filtered[selectedIndex].action()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setCommandPaletteOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runSelected()
    }
  }

  // Group by category
  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  // Flat index for keyboard nav
  let flatIndex = 0

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition.fade}
          className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh]"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCommandPaletteOpen(false)
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={transition.overlay}
            className="w-full max-w-lg flex flex-col overflow-hidden rounded-2xl bg-[#0A0A0A] border border-white/[0.06] shadow-2xl shadow-black/80"
            style={{
              maxHeight: '60vh'
            }}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.04] bg-white/[0.01]">
              <Search size={15} className="text-zinc-500 shrink-0" strokeWidth={2} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent border-none outline-none text-[14px] text-zinc-200 placeholder:text-zinc-600 font-medium tracking-wide"
                autoFocus
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.03] text-zinc-500 border border-white/[0.04] tracking-wide">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="overflow-y-auto flex-1 hide-scrollbar">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-zinc-500 font-medium tracking-wide">
                  No commands found
                </div>
              ) : (
                <div className="py-2">
                  {Object.entries(grouped).map(([category, cmds]) => (
                    <div key={category} className="mb-2 last:mb-0 px-2">
                      <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-zinc-600">
                        {category}
                      </div>
                      {cmds.map((cmd) => {
                        const currentIndex = flatIndex++
                        const isSelected = currentIndex === selectedIndex
                        const Icon = cmd.icon
                        return (
                          <button
                            key={cmd.id}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${isSelected ? 'bg-white/[0.06] text-white' : 'text-zinc-400 hover:bg-white/[0.02] hover:text-zinc-300'}`}
                            onMouseEnter={() => setSelectedIndex(currentIndex)}
                            onClick={cmd.action}
                          >
                            <Icon
                              size={15}
                              className={isSelected ? 'text-zinc-200' : 'text-zinc-500'}
                              strokeWidth={isSelected ? 2 : 1.5}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] tracking-wide font-medium truncate">
                                {cmd.label}
                              </div>
                              {cmd.description && (
                                <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                            {cmd.shortcut && (
                              <kbd className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-white/[0.03] text-zinc-500 border border-white/[0.04] tracking-wide">
                                {cmd.shortcut}
                              </kbd>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/[0.04] bg-[#0A0A0A]/50 backdrop-blur-sm flex items-center justify-center shrink-0">
              <span className="text-[10px] text-zinc-600 tracking-widest uppercase font-semibold">
                ↑↓ navigate · Enter select · Esc close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
