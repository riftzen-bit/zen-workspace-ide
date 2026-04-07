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
        background: '#050506',
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
    term.current.open(terminalRef.current)

    const doFit = () => {
      if (fitAddon.current && term.current) {
        fitAddon.current.fit()
      }
    }

    const fitTimer = setTimeout(() => {
      doFit()
      const { cols, rows } = term.current!
      window.api.terminal
        .create(id, cols, rows, command, workspaceDir ?? undefined)
        .catch(console.error)
    }, 50)

    const disposable = term.current.onData((data) => {
      window.api.terminal.write(id, data)
    })

    const onDataHandler = (tid: string, data: string) => {
      if (tid === id && term.current) {
        term.current.write(data)
      }
    }

    const unsubscribeOnData = window.api.terminal.onData(onDataHandler)

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current && term.current) {
        fitAddon.current.fit()
        window.api.terminal.resize(id, term.current.cols, term.current.rows)
      }
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
      clearTimeout(fitTimer)
      resizeObserver.disconnect()
      unsubscribeOnData()
      disposable.dispose()
      term.current?.dispose()
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
      className="w-full h-full overflow-hidden p-2 rounded-lg"
      style={{
        backgroundColor: 'var(--color-surface-0)',
        border: '1px solid var(--color-border-subtle)'
      }}
      onContextMenu={handleContextMenu}
    >
      <div ref={terminalRef} className="w-full h-full" />
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
