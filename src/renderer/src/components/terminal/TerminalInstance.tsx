import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalInstanceProps {
  id: string
  command: string
}

export const TerminalInstance = ({ id, command }: TerminalInstanceProps) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const term = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!terminalRef.current) return

    term.current = new Terminal({
      theme: {
        background: '#0a0a0b',
        foreground: '#d4d4d8',
        cursor: '#d4d4d8',
        selectionBackground: '#52525b'
      },
      fontFamily: 'monospace',
      fontSize: 14,
      cursorBlink: true
    })

    fitAddon.current = new FitAddon()
    term.current.loadAddon(fitAddon.current)
    term.current.open(terminalRef.current)

    // Fit on mount
    fitAddon.current.fit()

    // Setup IPC
    const { cols, rows } = term.current
    window.api.terminal.create(id, cols, rows, command).catch(console.error)

    // Setup input
    const disposable = term.current.onData((data) => {
      window.api.terminal.write(id, data)
    })

    // Setup output
    const onDataHandler = (tid: string, data: string) => {
      if (tid === id && term.current) {
        term.current.write(data)
      }
    }

    // Add event listeners
    const unsubscribeOnData = window.api.terminal.onData(onDataHandler)

    const handleResize = () => {
      if (fitAddon.current && term.current) {
        fitAddon.current.fit()
        window.api.terminal.resize(id, term.current.cols, term.current.rows)
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      unsubscribeOnData()
      disposable.dispose()
      window.removeEventListener('resize', handleResize)
      window.api.terminal.kill(id)
      term.current?.dispose()
    }
  }, [id, command])

  return (
    <div className="w-full h-full overflow-hidden bg-[#0a0a0b] p-2 border border-white/5 rounded-lg shadow-inner">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  )
}
