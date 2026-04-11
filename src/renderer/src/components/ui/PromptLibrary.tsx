import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MessageSquare, Terminal, X, Plus, Trash2 } from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useTerminalStore } from '../../store/useTerminalStore'
import { usePromptStore } from '../../store/usePromptStore'
import { transition } from '../../lib/motion'

// ── Built-in prompts ──────────────────────────────────────────────────────────

interface Prompt {
  id: string
  category: string
  label: string
  text: string
  builtin?: boolean
}

const BUILTIN_PROMPTS: Prompt[] = [
  {
    id: 'review',
    category: 'Code',
    label: 'Review this code',
    text: 'Please review the following code for bugs, security issues, and potential improvements:\n\n',
    builtin: true
  },
  {
    id: 'tests',
    category: 'Code',
    label: 'Write tests',
    text: 'Write comprehensive unit tests for the following code:\n\n',
    builtin: true
  },
  {
    id: 'refactor',
    category: 'Code',
    label: 'Refactor for readability',
    text: 'Refactor the following code for better readability and maintainability. Explain each change:\n\n',
    builtin: true
  },
  {
    id: 'docs',
    category: 'Code',
    label: 'Add documentation',
    text: 'Add comprehensive documentation and comments to the following code:\n\n',
    builtin: true
  },
  {
    id: 'explain-error',
    category: 'Debug',
    label: 'Explain this error',
    text: 'Explain this error in simple terms and provide a step-by-step fix:\n\n',
    builtin: true
  },
  {
    id: 'debug',
    category: 'Debug',
    label: 'Debug this code',
    text: 'Find and fix the bug in the following code. Explain what was wrong and why:\n\n',
    builtin: true
  },
  {
    id: 'optimize',
    category: 'Performance',
    label: 'Optimize performance',
    text: 'Analyze the performance of this code and suggest optimizations with explanations:\n\n',
    builtin: true
  },
  {
    id: 'security',
    category: 'Security',
    label: 'Security audit',
    text: 'Perform a security audit on this code. Look for vulnerabilities, injection risks, and unsafe patterns:\n\n',
    builtin: true
  },
  {
    id: 'git-commit',
    category: 'Git',
    label: 'Generate commit message',
    text: 'Generate a concise, descriptive git commit message (conventional commits format) for these changes:\n\n',
    builtin: true
  },
  {
    id: 'pr-desc',
    category: 'Git',
    label: 'Write PR description',
    text: 'Write a clear pull request description with summary, motivation, and testing notes for these changes:\n\n',
    builtin: true
  },
  {
    id: 'explain',
    category: 'Learning',
    label: 'Explain this concept',
    text: 'Explain the following code/concept in simple terms, with examples:\n\n',
    builtin: true
  },
  {
    id: 'architecture',
    category: 'Learning',
    label: 'Architecture review',
    text: 'Review the architecture of this code and suggest improvements for scalability and maintainability:\n\n',
    builtin: true
  }
]

// ── Main component ────────────────────────────────────────────────────────────

export const PromptLibrary = () => {
  const { isPromptLibraryOpen, setPromptLibraryOpen } = useUIStore()
  const { workspaces } = useTerminalStore()
  const { customPrompts, addPrompt, removePrompt } = usePromptStore()
  const [query, setQuery] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newText, setNewText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isPromptLibraryOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isPromptLibraryOpen])

  if (!isPromptLibraryOpen) return null

  const allPrompts: Prompt[] = [...BUILTIN_PROMPTS, ...customPrompts]

  const filtered = query.trim()
    ? allPrompts.filter(
        (p) =>
          p.label.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase()) ||
          p.text.toLowerCase().includes(query.toLowerCase())
      )
    : allPrompts

  const grouped = filtered.reduce<Record<string, Prompt[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  const handleSendToChat = (prompt: Prompt) => {
    useUIStore.getState().setChatOpen(true)
    window.dispatchEvent(new CustomEvent('zen:set-chat-input', { detail: prompt.text }))
    setPromptLibraryOpen(false)
  }

  const handleSendToTerminal = (prompt: Prompt) => {
    const activeWorkspaces = workspaces.filter((ws) => ws.status !== 'paused')
    if (activeWorkspaces.length === 0) return
    // Send to first active workspace's first terminal
    const terminal = activeWorkspaces[0].terminals[0]
    if (terminal) {
      const normalizedPrompt = prompt.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const text = normalizedPrompt.endsWith('\n')
        ? normalizedPrompt.slice(0, -1).replace(/\n/g, '\r') + '\r'
        : normalizedPrompt.replace(/\n/g, '\r') + '\r'
      window.api.terminal.write(terminal.id, text)
      useUIStore.getState().addToast(`Sent to ${activeWorkspaces[0].name}`, 'info')
    }
    setPromptLibraryOpen(false)
  }

  const handleAddCustom = () => {
    if (!newLabel.trim() || !newText.trim()) return
    addPrompt({
      id: `custom-${Date.now()}`,
      category: 'Custom',
      label: newLabel.trim(),
      text: newText.trim() + '\n\n'
    })
    setNewLabel('')
    setNewText('')
    setIsAdding(false)
  }

  const handleDeleteCustom = (id: string) => {
    removePrompt(id)
  }

  const activeTerminalCount = workspaces.filter((ws) => ws.status !== 'paused').length

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition.fade}
        className="fixed inset-0 z-[9998] flex items-start justify-center pt-[10vh]"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPromptLibraryOpen(false)
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -8 }}
          transition={transition.overlay}
          className="w-full max-w-2xl flex flex-col overflow-hidden rounded-none"
          style={{
            backgroundColor: 'var(--color-surface-3)',
            border: '1px solid var(--color-border-default)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
            maxHeight: '75vh'
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
            style={{
              borderColor: 'var(--color-border-subtle)',
              backgroundColor: 'var(--color-surface-2)'
            }}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare size={15} style={{ color: 'var(--color-secondary)' }} />
              <span
                className="text-body font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Prompt Library
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-none text-caption transition-colors"
                style={{
                  backgroundColor: 'var(--color-surface-4)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-subtle)'
                }}
              >
                <Plus size={12} />
                Add prompt
              </button>
              <button onClick={() => setPromptLibraryOpen(false)} className="btn-ghost p-1.5">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div
            className="px-4 py-2.5 border-b shrink-0"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2"
                size={13}
                style={{ color: 'var(--color-text-muted)' }}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search prompts…"
                className="input-field w-full"
                style={{ paddingLeft: '2.25rem' }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setPromptLibraryOpen(false)
                }}
              />
            </div>
          </div>

          {/* Add custom prompt form */}
          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden shrink-0"
              >
                <div
                  className="p-4 border-b flex flex-col gap-2"
                  style={{
                    borderColor: 'var(--color-border-subtle)',
                    backgroundColor: 'var(--color-surface-2)'
                  }}
                >
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Prompt name…"
                    className="input-field w-full"
                    autoFocus
                  />
                  <textarea
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Prompt text… (will be sent as-is)"
                    className="input-field w-full resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setIsAdding(false)}
                      className="btn-ghost px-3 py-1.5 text-body"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddCustom}
                      disabled={!newLabel.trim() || !newText.trim()}
                      className="btn-primary"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Prompts list */}
          <div className="flex-1 overflow-y-auto hide-scrollbar py-1.5">
            {Object.entries(grouped).length === 0 ? (
              <div
                className="px-4 py-8 text-center text-body"
                style={{ color: 'var(--color-text-muted)' }}
              >
                No prompts found
              </div>
            ) : (
              Object.entries(grouped).map(([category, prompts]) => (
                <div key={category}>
                  <div
                    className="px-4 py-1.5 text-label uppercase tracking-widest sticky top-0"
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: '10px',
                      backgroundColor: 'var(--color-surface-3)'
                    }}
                  >
                    {category}
                  </div>
                  {prompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="flex items-center gap-3 px-4 py-2.5 group transition-colors"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'var(--color-surface-4)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-body font-medium truncate"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {prompt.label}
                        </p>
                        <p
                          className="text-caption truncate mt-0.5"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {prompt.text.slice(0, 80).trim()}
                          {prompt.text.length > 80 ? '…' : ''}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => handleSendToChat(prompt)}
                          className="flex items-center gap-1 px-2 py-1 rounded-none text-caption transition-colors"
                          style={{
                            backgroundColor: 'var(--color-surface-5)',
                            color: 'var(--color-secondary)',
                            border: '1px solid var(--color-border-subtle)'
                          }}
                          title="Send to Chat"
                        >
                          <MessageSquare size={11} />
                          Chat
                        </button>
                        {activeTerminalCount > 0 && (
                          <button
                            onClick={() => handleSendToTerminal(prompt)}
                            className="flex items-center gap-1 px-2 py-1 rounded-none text-caption transition-colors"
                            style={{
                              backgroundColor: 'var(--color-surface-5)',
                              color: 'var(--color-accent)',
                              border: '1px solid var(--color-border-subtle)'
                            }}
                            title="Send to active terminal"
                          >
                            <Terminal size={11} />
                            Terminal
                          </button>
                        )}
                        {!prompt.builtin && (
                          <button
                            onClick={() => handleDeleteCustom(prompt.id)}
                            className="p-1 rounded-none transition-colors"
                            style={{ color: '#f87171' }}
                            title="Delete prompt"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2 border-t shrink-0 flex items-center justify-between"
            style={{
              borderColor: 'var(--color-border-subtle)',
              backgroundColor: 'var(--color-surface-2)'
            }}
          >
            <span
              className="text-caption"
              style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}
            >
              {filtered.length} prompt{filtered.length !== 1 ? 's' : ''} · hover to send
            </span>
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
