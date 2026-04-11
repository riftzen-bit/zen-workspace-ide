import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useFileStore } from '../../store/useFileStore'
import { TerminalContextMenu } from './TerminalContextMenu'

interface TerminalInstanceProps {
  id: string
  command: string
}

export const TerminalInstance = ({ id, command }: TerminalInstanceProps) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const term = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const workspaceDir = useFileStore.getState().workspaceDir
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    selection: string
  } | null>(null)

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
      // ensure we kill the terminal process if the component unmounts
      window.api.terminal.kill(id).catch(() => {})
    }
  }, [id, command, workspaceDir])

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

