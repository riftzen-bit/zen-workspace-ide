import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { useFileStore } from '../../store/useFileStore'
import { TerminalContextMenu } from './TerminalContextMenu'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'

interface TerminalInstanceProps {
  id: string
  command: string
}

export const TerminalInstance = ({ id, command }: TerminalInstanceProps) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const term = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const searchAddon = useRef<SearchAddon | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const workspaceDir = useFileStore.getState().workspaceDir
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    selection: string
  } | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResultCount, setSearchResultCount] = useState<number | null>(null)

  useEffect(() => {
    if (!terminalRef.current) return

    let disposed = false
    let createTimeout: ReturnType<typeof setTimeout> | null = null
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null
    let retryFitTimeout: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null

    const fitAndResizePty = (attempt = 0) => {
      if (disposed) return
      if (!fitAddon.current || !term.current || !terminalRef.current) return

      const host = terminalRef.current
      if (host.clientWidth <= 0 || host.clientHeight <= 0) {
        if (attempt < 6) {
          retryFitTimeout = setTimeout(() => fitAndResizePty(attempt + 1), 60)
        }
        return
      }

      try {
        const prevCols = term.current.cols
        const prevRows = term.current.rows

        fitAddon.current.fit()

        const { cols, rows } = term.current
        if (cols <= 0 || rows <= 0) return

        if (resizeTimeout) clearTimeout(resizeTimeout)
        if (cols !== prevCols || rows !== prevRows || attempt === 0) {
          resizeTimeout = setTimeout(() => {
            if (!disposed) {
              window.api.terminal.resize(id, cols, rows)
            }
          }, 40)
        }
      } catch {
        if (attempt < 3) {
          retryFitTimeout = setTimeout(() => fitAndResizePty(attempt + 1), 80)
        }
      }
    }

    const scheduleFit = () => {
      if (disposed) return
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        fitAndResizePty()
      })
    }

    term.current = new Terminal({
      theme: {
        background: '#000000',
        foreground: '#d4d4d8',
        cursor: '#a1a1aa',
        selectionBackground: '#3f3f46'
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      cursorBlink: true
    })

    fitAddon.current = new FitAddon()
    term.current.loadAddon(fitAddon.current)

    searchAddon.current = new SearchAddon()
    term.current.loadAddon(searchAddon.current)

    // Extract index from ID to stagger initialization and prevent CPU spikes
    // ID format is typically "term-[timestamp]-[index]"
    const parts = id.split('-')
    const indexStr = parts.length > 1 ? parts[parts.length - 1] : '0'
    const index = parseInt(indexStr, 10) || 0
    const staggerDelay = Math.min(index * 15, 90)

    // Defer DOM insertion and measurement
    requestAnimationFrame(() => {
      if (!term.current || !terminalRef.current || disposed) return

      term.current.open(terminalRef.current)
      scheduleFit()

      // Stagger PTY startup slightly to avoid CPU spikes, but keep it responsive.
      createTimeout = setTimeout(async () => {
        if (!term.current || disposed) return

        const { cols, rows } = term.current

        try {
          await window.api.terminal.create(
            id,
            cols || 80,
            rows || 24,
            command,
            workspaceDir ?? undefined
          )
          scheduleFit()
        } catch (err) {
          console.error('Failed to initialize terminal', err)
        }
      }, staggerDelay)
    })

    const disposable = term.current.onData((data) => {
      window.api.terminal.write(id, data)
    })

    const onDataHandler = (tid: string, data: string) => {
      if (tid === id && term.current) {
        term.current.write(data)
      }
    }

    const unsubscribeOnData = window.api.terminal.onData(onDataHandler)

    const handleResize = () => {
      scheduleFit()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleFit()
      }
    }

    const handleForceFit = () => {
      scheduleFit()
    }

    const resizeObserver = new ResizeObserver(() => {
      scheduleFit()
    })
    resizeObserver.observe(terminalRef.current)

    window.addEventListener('resize', handleResize)
    window.visualViewport?.addEventListener('resize', handleResize)
    window.addEventListener('terminal:force-fit', handleForceFit)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    void document.fonts?.ready.then(() => {
      if (!disposed) scheduleFit()
    })

    return () => {
      disposed = true
      window.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('resize', handleResize)
      window.removeEventListener('terminal:force-fit', handleForceFit)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (createTimeout) clearTimeout(createTimeout)
      if (resizeTimeout) clearTimeout(resizeTimeout)
      if (retryFitTimeout) clearTimeout(retryFitTimeout)
      if (rafId !== null) cancelAnimationFrame(rafId)

      resizeObserver.disconnect()
      unsubscribeOnData()
      disposable.dispose()
      term.current?.dispose()
      term.current = null
      fitAddon.current = null
      searchAddon.current = null
      // ensure we kill the terminal process if the component unmounts
      window.api.terminal.kill(id).catch(() => {})
    }
  }, [id, command, workspaceDir])

  // Search functions
  const openSearch = useCallback(() => {
    setIsSearchOpen(true)
    setSearchResultCount(null)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [])

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false)
    setSearchQuery('')
    setSearchResultCount(null)
    searchAddon.current?.clearDecorations()
    term.current?.focus()
  }, [])

  const findNext = useCallback(() => {
    if (!searchAddon.current || !searchQuery) return
    const found = searchAddon.current.findNext(searchQuery, {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      decorations: {
        matchBackground: '#ffcc00',
        matchBorder: '#ffcc00',
        matchOverviewRuler: '#ffcc00',
        activeMatchBackground: '#ff9900',
        activeMatchBorder: '#ff9900',
        activeMatchColorOverviewRuler: '#ff9900'
      }
    })
    setSearchResultCount(found ? 1 : 0)
  }, [searchQuery])

  const findPrevious = useCallback(() => {
    if (!searchAddon.current || !searchQuery) return
    const found = searchAddon.current.findPrevious(searchQuery, {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      decorations: {
        matchBackground: '#ffcc00',
        matchBorder: '#ffcc00',
        matchOverviewRuler: '#ffcc00',
        activeMatchBackground: '#ff9900',
        activeMatchBorder: '#ff9900',
        activeMatchColorOverviewRuler: '#ff9900'
      }
    })
    setSearchResultCount(found ? 1 : 0)
  }, [searchQuery])

  // Handle Ctrl+F for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        e.stopPropagation()
        openSearch()
      }
    }

    const container = terminalRef.current?.parentElement
    container?.addEventListener('keydown', handleKeyDown)
    return () => container?.removeEventListener('keydown', handleKeyDown)
  }, [openSearch])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeSearch()
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        findPrevious()
      } else {
        findNext()
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const selection = term.current?.getSelection() ?? ''
    if (!selection.trim()) return
    setContextMenu({ x: e.clientX, y: e.clientY, selection })
  }

  return (
    <div
      className="w-full h-full overflow-hidden p-2 rounded-none flex flex-col"
      style={{
        backgroundColor: 'var(--color-surface-0)',
        border: '1px solid var(--color-border-subtle)'
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Search Bar */}
      {isSearchOpen && (
        <div
          className="flex items-center gap-2 px-2 py-1.5 mb-1"
          style={{
            backgroundColor: 'var(--color-surface-3)',
            border: '1px solid var(--color-border-subtle)'
          }}
        >
          <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchResultCount(null)
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search terminal..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          {searchResultCount !== null && (
            <span
              className="text-xs px-1.5"
              style={{ color: searchResultCount > 0 ? 'var(--color-text-muted)' : '#ef4444' }}
            >
              {searchResultCount > 0 ? 'Found' : 'No results'}
            </span>
          )}
          <button
            onClick={findPrevious}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Previous (Shift+Enter)"
          >
            <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} />
          </button>
          <button
            onClick={findNext}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Next (Enter)"
          >
            <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
          </button>
          <button
            onClick={closeSearch}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Close (Escape)"
          >
            <X size={14} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>
      )}
      <div className="relative flex-1 w-full overflow-hidden">
        <div ref={terminalRef} className="absolute inset-0" />
      </div>
      {contextMenu && (
        <TerminalContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selection={contextMenu.selection}
          sourceTerminalId={id}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
