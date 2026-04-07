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
  type LucideIcon
} from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useFileStore } from '../../store/useFileStore'
import { useTerminalStore } from '../../store/useTerminalStore'
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
            className="w-full max-w-lg flex flex-col overflow-hidden rounded-2xl"
            style={{
              backgroundColor: 'var(--color-surface-3)',
              border: '1px solid var(--color-border-default)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
              maxHeight: '60vh'
            }}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 border-b"
              style={{ borderColor: 'var(--color-border-subtle)' }}
            >
              <Search size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent outline-none text-body"
                style={{ color: 'var(--color-text-primary)' }}
              />
              <kbd
                className="text-caption px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: 'var(--color-surface-5)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: '10px'
                }}
              >
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="overflow-y-auto flex-1 hide-scrollbar">
              {filtered.length === 0 ? (
                <div
                  className="px-4 py-8 text-center text-body"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  No commands found
                </div>
              ) : (
                <div className="py-1.5">
                  {Object.entries(grouped).map(([category, cmds]) => (
                    <div key={category}>
                      <div
                        className="px-4 py-1.5 text-label uppercase tracking-widest"
                        style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}
                      >
                        {category}
                      </div>
                      {cmds.map((cmd) => {
                        const currentIndex = flatIndex++
                        const isSelected = currentIndex === selectedIndex
                        const Icon = cmd.icon
                        return (
                          <button
                            key={cmd.id}
                            className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                            style={{
                              backgroundColor: isSelected
                                ? 'var(--color-surface-5)'
                                : 'transparent',
                              color: isSelected
                                ? 'var(--color-text-primary)'
                                : 'var(--color-text-secondary)'
                            }}
                            onMouseEnter={() => setSelectedIndex(currentIndex)}
                            onClick={cmd.action}
                          >
                            <Icon
                              size={15}
                              style={{
                                color: isSelected
                                  ? 'var(--color-accent)'
                                  : 'var(--color-text-muted)',
                                flexShrink: 0
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-body font-medium truncate">{cmd.label}</div>
                              {cmd.description && (
                                <div
                                  className="text-caption truncate"
                                  style={{ color: 'var(--color-text-muted)' }}
                                >
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                            {cmd.shortcut && (
                              <kbd
                                className="text-caption px-1.5 py-0.5 rounded shrink-0"
                                style={{
                                  backgroundColor: 'var(--color-surface-5)',
                                  color: 'var(--color-text-muted)',
                                  border: '1px solid var(--color-border-subtle)',
                                  fontSize: '10px'
                                }}
                              >
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
            <div
              className="flex items-center gap-3 px-4 py-2 border-t"
              style={{
                borderColor: 'var(--color-border-subtle)',
                backgroundColor: 'var(--color-surface-2)'
              }}
            >
              <span
                className="text-caption"
                style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}
              >
                ↑↓ navigate · Enter select · Esc close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
