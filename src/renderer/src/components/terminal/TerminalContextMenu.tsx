import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Copy, Send, MessageSquare } from 'lucide-react'
import { useTerminalStore } from '../../store/useTerminalStore'
import { useChatStore } from '../../store/useChatStore'
import { useUIStore } from '../../store/useUIStore'
import { transition } from '../../lib/motion'

interface ContextMenuProps {
  x: number
  y: number
  selection: string
  sourceTerminalId: string
  onClose: () => void
}

export const TerminalContextMenu = ({
  x,
  y,
  selection,
  sourceTerminalId,
  onClose
}: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const { workspaces } = useTerminalStore()

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // Adjust position to stay within viewport
  const menuWidth = 220
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x
  const adjustedY = Math.min(y, window.innerHeight - 300)

  const handleCopy = () => {
    navigator.clipboard.writeText(selection)
    useUIStore.getState().addToast('Copied to clipboard', 'success')
    onClose()
  }

  const handleSendToTerminal = (targetTerminalId: string, workspaceName: string) => {
    const normalizedSelection = selection.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const text = normalizedSelection.endsWith('\n')
      ? normalizedSelection.slice(0, -1).replace(/\n/g, '\r') + '\r'
      : normalizedSelection.replace(/\n/g, '\r') + '\r'
    window.api.terminal.write(targetTerminalId, text)
    useUIStore.getState().addToast(`Sent to ${workspaceName}`, 'info')
    onClose()
  }

  const handleSendToChat = () => {
    // Add selection as context to chat — prepend as a quoted block
    const contextText = `\`\`\`\n${selection}\n\`\`\``
    const currentSession = useChatStore
      .getState()
      .sessions.find((s) => s.id === useChatStore.getState().activeSessionId)
    if (currentSession) {
      // Open chat if closed and set the input
      useUIStore.getState().setChatOpen(true)
      // Dispatch a custom event to set chat input text
      window.dispatchEvent(new CustomEvent('zen:set-chat-input', { detail: contextText }))
    }
    onClose()
  }

  // Filter out workspaces that contain only the source terminal
  const targetWorkspaces = workspaces.filter(
    (ws) => ws.status !== 'paused' && !ws.terminals.every((t) => t.id === sourceTerminalId)
  )

  const preview = selection.length > 60 ? selection.slice(0, 60) + '…' : selection

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.97, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={transition.tooltip}
      className="fixed z-[9999] rounded-none overflow-hidden shadow-2xl"
      style={{
        left: adjustedX,
        top: adjustedY,
        width: menuWidth,
        backgroundColor: 'var(--color-surface-4)',
        border: '1px solid var(--color-border-default)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}
    >
      {/* Selection preview */}
      <div
        className="px-3 py-2 border-b"
        style={{
          borderColor: 'var(--color-border-subtle)',
          backgroundColor: 'var(--color-surface-3)'
        }}
      >
        <p
          className="text-label"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}
        >
          {preview}
        </p>
      </div>

      <div className="py-1">
        {/* Copy */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-body transition-colors text-left"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-5)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
        >
          <Copy size={13} style={{ color: 'var(--color-text-muted)' }} />
          Copy
        </button>

        {/* Send to Chat */}
        <button
          onClick={handleSendToChat}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-body transition-colors text-left"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-5)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
        >
          <MessageSquare size={13} style={{ color: 'var(--color-secondary)' }} />
          Send to Chat
        </button>

        {/* Send to other workspaces */}
        {targetWorkspaces.length > 0 && (
          <>
            <div
              className="mx-3 my-1 h-px"
              style={{ backgroundColor: 'var(--color-border-subtle)' }}
            />
            <div className="px-3 py-1">
              <span className="text-label" style={{ color: 'var(--color-text-muted)' }}>
                Send to workspace
              </span>
            </div>
            {targetWorkspaces.map((ws) => {
              const firstTerminal = ws.terminals[0]
              if (!firstTerminal) return null
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSendToTerminal(firstTerminal.id, ws.name)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-body transition-colors text-left"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = 'var(--color-surface-5)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  <Send size={13} style={{ color: 'var(--color-accent)' }} />
                  <span className="truncate">{ws.name}</span>
                  <span
                    className="text-label ml-auto shrink-0"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {ws.cliType === 'Terminal' ? 'term' : ws.cliType.replace(' CLI', '')}
                  </span>
                </button>
              )
            })}
          </>
        )}
      </div>
    </motion.div>
  )
}
