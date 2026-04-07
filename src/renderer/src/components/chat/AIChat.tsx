import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TerminalSquare,
  Trash2,
  Plus,
  History,
  ChevronDown,
  Settings,
  Copy,
  Check
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { useChatStore } from '../../store/useChatStore'
import { useUIStore } from '../../store/useUIStore'
import { useResizable } from '../../hooks/useResizable'
import { useFileStore } from '../../store/useFileStore'
import { useMediaStore } from '../../store/useMediaStore'
import { useSettingsStore, AIProviderType } from '../../store/useSettingsStore'
import { useMusicStore } from '../../store/useMusicStore'
import { transition } from '../../lib/motion'

const PROVIDER_LABELS: Record<AIProviderType, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
  groq: 'Groq',
  ollama: 'Ollama',
  antigravity: 'Antigravity'
}

const CodeBlock = ({ children, className }: { children?: React.ReactNode; className?: string }) => {
  const [copied, setCopied] = useState(false)
  const codeText = typeof children === 'string' ? children : String(children ?? '')

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [codeText])

  return (
    <div
      className="relative group my-2 rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface-3)',
        border: '1px solid var(--color-border-subtle)'
      }}
    >
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: 'var(--color-surface-5)', color: 'var(--color-text-tertiary)' }}
        title="Copy code"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <code
        className={className}
        style={{
          display: 'block',
          padding: '14px 16px',
          overflowX: 'auto',
          fontSize: '12px',
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: '1.6',
          color: 'var(--color-text-secondary)'
        }}
      >
        {children}
      </code>
    </div>
  )
}

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>
    }
    return (
      <code
        {...props}
        className={className}
        style={{
          backgroundColor: 'var(--color-surface-4)',
          padding: '1px 6px',
          borderRadius: '4px',
          fontSize: '11.5px',
          fontFamily: 'JetBrains Mono, monospace',
          color: 'var(--color-accent)'
        }}
      >
        {children}
      </code>
    )
  },
  pre({ children }) {
    return <>{children}</>
  },
  p({ children }) {
    return <p style={{ marginBottom: '6px', lineHeight: '1.6' }}>{children}</p>
  },
  ul({ children }) {
    return (
      <ul style={{ paddingLeft: '18px', marginBottom: '6px', listStyleType: 'disc' }}>
        {children}
      </ul>
    )
  },
  ol({ children }) {
    return (
      <ol style={{ paddingLeft: '18px', marginBottom: '6px', listStyleType: 'decimal' }}>
        {children}
      </ol>
    )
  },
  li({ children }) {
    return <li style={{ marginBottom: '2px', lineHeight: '1.6' }}>{children}</li>
  },
  h1({ children }) {
    return (
      <h1
        style={{
          fontSize: '16px',
          fontWeight: 700,
          marginBottom: '8px',
          color: 'var(--color-text-primary)'
        }}
      >
        {children}
      </h1>
    )
  },
  h2({ children }) {
    return (
      <h2
        style={{
          fontSize: '14px',
          fontWeight: 650,
          marginBottom: '6px',
          color: 'var(--color-text-primary)'
        }}
      >
        {children}
      </h2>
    )
  },
  h3({ children }) {
    return (
      <h3
        style={{
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '4px',
          color: 'var(--color-text-primary)'
        }}
      >
        {children}
      </h3>
    )
  },
  blockquote({ children }) {
    return (
      <blockquote
        style={{
          borderLeft: '2px solid var(--color-border-secondary)',
          paddingLeft: '12px',
          margin: '6px 0',
          color: 'var(--color-text-tertiary)',
          fontStyle: 'italic'
        }}
      >
        {children}
      </blockquote>
    )
  },
  strong({ children }) {
    return (
      <strong style={{ fontWeight: 650, color: 'var(--color-text-primary)' }}>{children}</strong>
    )
  },
  hr() {
    return (
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--color-border-subtle)',
          margin: '10px 0'
        }}
      />
    )
  }
}

const MarkdownMessage = ({ text }: { text: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
    {text}
  </ReactMarkdown>
)

const ThinkingIndicator = () => {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className="flex gap-2 items-center text-caption italic"
      style={{ color: 'var(--color-text-tertiary)' }}
    >
      <span className="flex space-x-1 mr-0.5">
        {[0, 0.12, 0.24].map((delay, i) => (
          <motion.span
            key={i}
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: 'var(--color-secondary)' }}
            animate={{ y: [-2, 0, -2], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut', delay }}
          />
        ))}
      </span>
      Thinking… {seconds}s
    </div>
  )
}

export const AIChat = () => {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<'chat' | 'history'>('chat')

  const settings = useSettingsStore()
  const {
    activeProvider,
    geminiApiKey,
    openaiApiKey,
    anthropicApiKey,
    groqApiKey,
    ollamaUrl,
    modelPerProvider,
    geminiOAuthActive
  } = settings

  const {
    sessions,
    activeSessionId,
    addMessage,
    updateLastMessage,
    isStreaming,
    setIsStreaming,
    clearChat,
    createNewSession,
    deleteSession,
    setActiveSession
  } = useChatStore()

  const messages = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId)?.messages || []
  }, [sessions, activeSessionId])

  const { activeFile, fileContents } = useFileStore()
  const { chatWidth, setChatWidth, setActiveView } = useUIStore()
  const { width, startResizing, isResizing } = useResizable(
    chatWidth,
    250,
    800,
    setChatWidth,
    'right'
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      if (typeof text === 'string') setInput(text)
    }
    window.addEventListener('zen:set-chat-input', handler)
    return () => window.removeEventListener('zen:set-chat-input', handler)
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return
    const userText = input.trim()
    setInput('')

    // Add file context to the message if a file is open
    const MAX_CONTEXT_CHARS = 30_000
    let messageText = userText
    if (activeFile && fileContents[activeFile]) {
      let contextContent = fileContents[activeFile]
      // Strip music command patterns to prevent prompt injection from file contents
      contextContent = contextContent.replace(/\[PLAY_MUSIC:[^\]]*\]/g, '[PLAY_MUSIC:REDACTED]')
      contextContent = contextContent.replace(
        /\[GENERATE_MUSIC:[^\]]*\]/g,
        '[GENERATE_MUSIC:REDACTED]'
      )
      // Truncate very large files to avoid excessive token usage and API errors
      if (contextContent.length > MAX_CONTEXT_CHARS) {
        contextContent = contextContent.slice(0, MAX_CONTEXT_CHARS) + '\n... (truncated)'
      }
      messageText = `[Context: ${activeFile}]\n\`\`\`\n${contextContent}\n\`\`\`\n\n${userText}`
    }

    // Build API messages BEFORE mutating store (avoid stale closure bug)
    const currentMessages = sessions.find((s) => s.id === activeSessionId)?.messages ?? []
    const historyMessages = currentMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.text
    }))
    const apiMessages = [...historyMessages, { role: 'user' as const, content: messageText }]

    addMessage({ id: crypto.randomUUID(), role: 'user', text: userText })
    addMessage({ id: crypto.randomUUID(), role: 'assistant', text: '' })
    setIsStreaming(true)

    // Determine credential
    let apiKey: string | undefined
    let useGeminiOAuth = false

    if (activeProvider === 'gemini') {
      if (geminiOAuthActive) {
        useGeminiOAuth = true
      } else {
        apiKey = geminiApiKey
      }
    } else if (activeProvider === 'openai') {
      apiKey = openaiApiKey
    } else if (activeProvider === 'anthropic') {
      apiKey = anthropicApiKey
    } else if (activeProvider === 'groq') {
      apiKey = groqApiKey
    }

    let accumulatedText = ''
    let musicTriggered = false
    let musicMatch: RegExpMatchArray | null = null
    let genMusicTriggered = false
    // Listen for streaming chunks
    const unsubscribe = window.api.ai.onChunk((chunk) => {
      if (chunk.type === 'text' && chunk.text) {
        accumulatedText += chunk.text

        const match = accumulatedText.match(/\[PLAY_MUSIC:(.+?)\]/)
        if (match && !musicTriggered) {
          musicTriggered = true
          musicMatch = match
          const query = match[1].trim()
          window.api
            .searchYoutube(query)
            .then((res) => {
              if (res) {
                useMediaStore.getState().setCustomVibe(res.videoId, res.title)
                useMediaStore.getState().setIsPlaying(true)
              }
            })
            .catch(() => {})
        }

        // Detect [GENERATE_MUSIC:...] tag and trigger Lyria generation
        const genMusicMatch = accumulatedText.match(/\[GENERATE_MUSIC:(.+?)\]/)
        if (genMusicMatch && !genMusicTriggered) {
          genMusicTriggered = true
          const genPrompt = genMusicMatch[1].trim()
          const { lyriaApiKey } = useSettingsStore.getState()
          useMusicStore.getState().setPendingPrompt(genPrompt)
          useUIStore.getState().setMusicGeneratorOpen(true)
          if (lyriaApiKey) {
            window.api.music
              .generate({
                model: 'lyria-3-clip-preview',
                prompt: genPrompt,
                instrumental: false,
                apiKey: lyriaApiKey
              })
              .catch(() => {})
          }
        }

        let displayText = accumulatedText.replace(
          /\[PLAY_MUSIC:[^\]]*\]?/g,
          '🎵 Searching for music...'
        )
        displayText = displayText.replace(/\[GENERATE_MUSIC:[^\]]*\]?/g, '🎵 Generating music...')
        if (musicTriggered && musicMatch) {
          displayText = accumulatedText
            .replace(/\[GENERATE_MUSIC:[^\]]*\]?/g, '🎵 Generating music...')
            .replace(musicMatch[0], `🎵 Playing: ${musicMatch[1].trim()}`)
        }
        updateLastMessage(displayText)
      } else if (chunk.type === 'done') {
        setIsStreaming(false)
        unsubscribe()
      } else if (chunk.type === 'error') {
        updateLastMessage(accumulatedText + `\n\nError: ${chunk.error}`)
        setIsStreaming(false)
        unsubscribe()
      }
    })

    try {
      await window.api.ai.chat({
        provider: activeProvider,
        model: modelPerProvider[activeProvider],
        apiKey,
        ollamaUrl: activeProvider === 'ollama' ? ollamaUrl : undefined,
        useGeminiOAuth,
        messages: apiMessages
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      updateLastMessage(accumulatedText + `\n\nError: ${message}`)
      setIsStreaming(false)
      unsubscribe()
    }
  }

  return (
    <div
      className="h-full flex flex-col shrink-0 relative border-l"
      style={{
        width: `${width}px`,
        backgroundColor: 'var(--color-surface-2)',
        borderColor: 'var(--color-border-subtle)'
      }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10 cursor-col-resize transition-colors"
        style={{
          width: '3px',
          borderRadius: '2px',
          backgroundColor: isResizing ? 'var(--color-secondary)' : 'transparent'
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            ;(e.currentTarget as HTMLDivElement).style.backgroundColor =
              'var(--color-secondary-glow)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
          }
        }}
        onMouseDown={startResizing}
      />

      {/* Header */}
      <div
        className="h-11 px-4 flex justify-between items-center border-b shrink-0"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: isStreaming ? 'var(--color-secondary)' : 'var(--color-secondary-dim)'
            }}
          />
          <span className="text-label" style={{ color: 'var(--color-text-muted)' }}>
            {viewMode === 'history' ? 'History' : 'Assistant'}
          </span>
          {viewMode === 'chat' && (
            <span
              className="text-label px-1.5 py-0.5 rounded-md"
              style={{
                color: 'var(--color-secondary)',
                backgroundColor: 'var(--color-secondary-glow)',
                fontSize: '10px'
              }}
            >
              {PROVIDER_LABELS[activeProvider]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              createNewSession()
              setViewMode('chat')
            }}
            className="btn-ghost"
            title="New session"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'history' ? 'chat' : 'history')}
            className="btn-ghost"
            title="History"
            style={
              viewMode === 'history'
                ? {
                    color: 'var(--color-secondary)',
                    backgroundColor: 'var(--color-secondary-glow)'
                  }
                : undefined
            }
          >
            <History size={14} />
          </button>
          <button
            onClick={() => setActiveView('settings')}
            className="btn-ghost"
            title="AI settings"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={() => {
              if (viewMode === 'chat') clearChat()
            }}
            className="btn-ghost-danger"
            title="Clear chat"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {viewMode === 'history' ? (
        /* History list */
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 hide-scrollbar">
          {sessions.length === 0 && (
            <div
              className="text-caption text-center mt-10"
              style={{ color: 'var(--color-text-muted)' }}
            >
              No history yet
            </div>
          )}
          {sessions.map((s) => (
            <motion.div
              key={s.id}
              onClick={() => {
                setActiveSession(s.id)
                setViewMode('chat')
              }}
              className="p-3.5 rounded-xl flex flex-col gap-1 cursor-pointer border group transition-all"
              style={{
                backgroundColor:
                  s.id === activeSessionId
                    ? 'var(--color-secondary-glow)'
                    : 'var(--color-surface-3)',
                borderColor:
                  s.id === activeSessionId
                    ? 'var(--color-border-secondary)'
                    : 'var(--color-border-subtle)',
                color:
                  s.id === activeSessionId
                    ? 'var(--color-secondary)'
                    : 'var(--color-text-secondary)'
              }}
              onMouseEnter={(e) => {
                if (s.id !== activeSessionId) {
                  ;(e.currentTarget as HTMLDivElement).style.borderColor =
                    'var(--color-border-hover)'
                  ;(e.currentTarget as HTMLDivElement).style.backgroundColor =
                    'var(--color-surface-4)'
                }
              }}
              onMouseLeave={(e) => {
                if (s.id !== activeSessionId) {
                  ;(e.currentTarget as HTMLDivElement).style.borderColor =
                    'var(--color-border-subtle)'
                  ;(e.currentTarget as HTMLDivElement).style.backgroundColor =
                    'var(--color-surface-3)'
                }
              }}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="text-body font-semibold truncate leading-relaxed">{s.title}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(s.id)
                  }}
                  className="btn-ghost-danger opacity-0 group-hover:opacity-100 p-1 -m-1 shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div
                className="text-caption flex items-center justify-between"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <span>{s.messages.length} msgs</span>
                <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <>
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 hide-scrollbar">
            {messages.length === 0 && (
              <div
                className="h-full flex flex-col items-center justify-center gap-3 opacity-50"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <TerminalSquare
                  size={24}
                  strokeWidth={1.4}
                  style={{ color: 'var(--color-secondary-dim)' }}
                />
                <p className="text-body">How can I help you?</p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                if (!msg.text && !isStreaming) return null
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10, y: 3 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={transition.micro}
                    className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
                        style={{
                          backgroundColor: 'var(--color-secondary-glow)',
                          border: '1px solid var(--color-border-secondary)',
                          color: 'var(--color-secondary)'
                        }}
                      >
                        <TerminalSquare size={12} strokeWidth={2} />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-body leading-relaxed ${msg.role === 'user' ? 'whitespace-pre-wrap' : ''}`}
                      style={
                        msg.role === 'user'
                          ? {
                              backgroundColor: 'var(--color-surface-4)',
                              color: 'var(--color-text-primary)',
                              border: '1px solid var(--color-border-default)',
                              borderTopRightRadius: '6px'
                            }
                          : {
                              backgroundColor: 'var(--color-surface-1)',
                              color: 'var(--color-text-secondary)',
                              border: '1px solid var(--color-border-subtle)',
                              borderLeft: '2px solid var(--color-secondary-dim)',
                              borderTopLeftRadius: '6px'
                            }
                      }
                    >
                      {msg.role === 'user' ? (
                        msg.text || null
                      ) : msg.text ? (
                        <MarkdownMessage text={msg.text} />
                      ) : isStreaming ? (
                        <ThinkingIndicator />
                      ) : null}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* Input area */}
          <div
            className="p-4 border-t shrink-0"
            style={{
              backgroundColor: 'var(--color-surface-1)',
              borderColor: 'var(--color-border-subtle)'
            }}
          >
            <div
              className="relative flex items-end rounded-xl transition-all"
              style={{
                backgroundColor: 'var(--color-surface-3)',
                border: '1px solid var(--color-border-subtle)'
              }}
              onFocus={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.borderColor =
                  'var(--color-border-secondary)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow =
                  '0 0 0 2px var(--color-secondary-glow)'
              }}
              onBlur={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.borderColor =
                  'var(--color-border-subtle)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = ''
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Message…"
                className="w-full bg-transparent text-body pl-4 pr-12 py-3.5 resize-none focus:outline-none hide-scrollbar placeholder:text-zinc-600"
                style={{
                  color: 'var(--color-text-primary)',
                  minHeight: '48px',
                  maxHeight: '160px'
                }}
                rows={1}
              />
              <motion.button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="absolute right-2 bottom-2 p-2 rounded-lg transition-colors disabled:opacity-25"
                style={{ color: 'var(--color-secondary)' }}
                whileTap={{ scale: 0.9 }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--color-secondary-glow)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = ''
                }}
              >
                <div className="rotate-[-90deg]">
                  <ChevronDown size={18} strokeWidth={2.5} />
                </div>
              </motion.button>
            </div>
            <p className="text-center mt-2 text-label" style={{ color: 'var(--color-text-muted)' }}>
              AI can make mistakes
            </p>
          </div>
        </>
      )}
    </div>
  )
}
