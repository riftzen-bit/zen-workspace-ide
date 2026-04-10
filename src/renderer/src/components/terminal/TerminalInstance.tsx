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
    const staggerDelay = index * 250 // 250ms delay per terminal

    // Defer DOM insertion and measurement
    requestAnimationFrame(() => {
      if (!term.current || !terminalRef.current) return

      term.current.open(terminalRef.current)

      requestAnimationFrame(() => {
        if (
          fitAddon.current &&
          term.current &&
          terminalRef.current &&
          terminalRef.current.clientWidth > 0
        ) {
          try {
            fitAddon.current.fit()
          } catch {
            // ignore
          }
        }

        // Stagger the heavy PTY creation to avoid locking up CPU/GPU when opening 8 terminals
        setTimeout(() => {
          if (!term.current) return // check if unmounted during delay
          const { cols, rows } = term.current
          window.api.terminal
            .create(id, cols || 80, rows || 24, command, workspaceDir ?? undefined)
            .catch(console.error)
        }, staggerDelay)
      })
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

    let resizeTimeout: ReturnType<typeof setTimeout>

    const handleResize = () => {
      // Add a slight delay to allow the browser's layout engine to settle after a window maximize
      setTimeout(() => {
        requestAnimationFrame(() => {
          if (
            fitAddon.current &&
            term.current &&
            terminalRef.current &&
            terminalRef.current.clientWidth > 0 &&
            terminalRef.current.clientHeight > 0
          ) {
            try {
              fitAddon.current.fit()
              const { cols, rows } = term.current

              clearTimeout(resizeTimeout)
              resizeTimeout = setTimeout(() => {
                window.api.terminal.resize(id, cols, rows)
              }, 100) // Debounce PTY resize to avoid spamming SIGWINCH
            } catch {
              // ignore
            }
          }
        })
      }, 50)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(terminalRef.current)

    // Also listen to window resize directly as a fallback for maximize events
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
      resizeObserver.disconnect()
      unsubscribeOnData()
      disposable.dispose()
      term.current?.dispose()
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
      className="w-full h-full overflow-hidden p-2 rounded-lg flex flex-col"
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
