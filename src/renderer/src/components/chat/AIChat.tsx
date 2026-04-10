import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TerminalSquare,
  Trash2,
  Plus,
  History,
  Settings,
  Copy,
  Check,
  ChevronRight,
  Code2
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useChatStore } from '../../store/useChatStore'
import { useUIStore } from '../../store/useUIStore'
import { useResizable } from '../../hooks/useResizable'
import { useFileStore } from '../../store/useFileStore'
import { useMediaStore } from '../../store/useMediaStore'
import { useSettingsStore, AIProviderType } from '../../store/useSettingsStore'
import { useMusicStore } from '../../store/useMusicStore'

const PROVIDER_LABELS: Record<AIProviderType, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
  groq: 'Groq',
  ollama: 'Ollama',
  antigravity: 'Antigravity'
}

const isMac = navigator.platform.toLowerCase().includes('mac')
const mod = isMac ? '⌘' : 'Ctrl'

const CodeBlock = ({ children, className }: { children?: React.ReactNode; className?: string }) => {
  const [copied, setCopied] = useState(false)
  const codeText =
    typeof children === 'string' ? children : String(children ?? '').replace(/\n$/, '')
  const language = className ? className.replace(/language-/, '') : 'typescript'

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [codeText])

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-white/[0.06] bg-[#0A0A0A] shadow-sm">
      <div className="absolute right-2 top-2 z-10 flex items-center">
        {language && (
          <span className="text-[10px] text-zinc-500 font-mono mr-3 opacity-0 group-hover:opacity-100 transition-opacity select-none uppercase tracking-wider">
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-zinc-300" /> : <Copy size={14} />}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '16px',
          fontSize: '12.5px',
          fontFamily: '"JetBrains Mono", monospace',
          lineHeight: '1.6',
          backgroundColor: 'transparent'
        }}
        codeTagProps={{
          style: {
            fontFamily: '"JetBrains Mono", monospace'
          }
        }}
      >
        {codeText}
      </SyntaxHighlighter>
    </div>
  )
}

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const isInline = !className || !className.startsWith('language-')
    if (isInline && typeof children === 'string' && !children.includes('\n')) {
      return (
        <code
          {...props}
          className="px-1.5 py-0.5 rounded-md bg-white/[0.03] text-zinc-200 font-mono text-[12px] border border-white/5"
        >
          {children}
        </code>
      )
    }
    return <CodeBlock className={className}>{children}</CodeBlock>
  },
  pre({ children }) {
    return <>{children}</>
  },
  p({ children }) {
    return <p className="mb-3 leading-relaxed text-[14px] text-zinc-300">{children}</p>
  },
  ul({ children }) {
    return (
      <ul className="pl-5 mb-4 list-disc text-[14px] text-zinc-300 marker:text-zinc-600">
        {children}
      </ul>
    )
  },
  ol({ children }) {
    return (
      <ol className="pl-5 mb-4 list-decimal text-[14px] text-zinc-300 marker:text-zinc-600">
        {children}
      </ol>
    )
  },
  li({ children }) {
    return <li className="mb-1.5 leading-relaxed">{children}</li>
  },
  h1({ children }) {
    return (
      <h1 className="text-[18px] font-semibold mb-4 text-zinc-100 tracking-tight mt-6">
        {children}
      </h1>
    )
  },
  h2({ children }) {
    return (
      <h2 className="text-[16px] font-medium mb-3 text-zinc-200 tracking-tight mt-5">{children}</h2>
    )
  },
  h3({ children }) {
    return (
      <h3 className="text-[14px] font-medium mb-2 text-zinc-300 tracking-tight mt-4">{children}</h3>
    )
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-white/10 pl-4 py-1 my-4 text-zinc-400 italic bg-white/[0.02] rounded-r-lg">
        {children}
      </blockquote>
    )
  },
  strong({ children }) {
    return <strong className="font-semibold text-zinc-100">{children}</strong>
  },
  hr() {
    return <hr className="border-none border-t border-white/5 my-6" />
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
    <div className="flex gap-3 items-center text-[13px] text-zinc-500 italic font-mono bg-white/[0.02] border border-white/5 px-4 py-2 rounded-xl w-fit">
      <span className="flex space-x-1.5">
        {[0, 0.15, 0.3].map((delay, i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-zinc-500"
            animate={{ y: [-2, 2, -2], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay }}
          />
        ))}
      </span>
      <span className="tracking-widest">THINKING {seconds}s</span>
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
    280,
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
          const { lyriaApiKey, geminiOAuthActive } = useSettingsStore.getState()
          useMusicStore.getState().setPendingPrompt(genPrompt)
          useUIStore.getState().setMusicGeneratorOpen(true)
          if (lyriaApiKey || geminiOAuthActive) {
            window.api.music
              .generate({
                model: 'lyria-3-clip-preview',
                prompt: genPrompt,
                instrumental: false,
                apiKey: lyriaApiKey,
                useGeminiOAuth: geminiOAuthActive
              })
              .catch(() => {})
          }
        }

        let displayText = accumulatedText.replace(
          /\[PLAY_MUSIC:[^\]]*\]?/g,
          '🎵 Searching for music...'
        )
        displayText = displayText.replace(/\[GENERATE_MUSIC:[^\]]*\]?/g, '🎵 Generating music...')

        // Hide tool calls and tool responses from the UI
        displayText = displayText.replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/g, '')
        displayText = displayText.replace(/<tool_response>[\s\S]*?(?:<\/tool_response>|$)/g, '')

        if (musicTriggered && musicMatch) {
          displayText = displayText.replace(musicMatch[0], `🎵 Playing: ${musicMatch[1].trim()}`)
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
        workspaceDir: useFileStore.getState().workspaceDir || undefined,
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
      className="h-full flex flex-col shrink-0 relative border-l border-white/5 bg-[#050505]"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10 cursor-col-resize flex items-center justify-center group"
        style={{ width: '4px', transform: 'translateX(-50%)' }}
        onMouseDown={startResizing}
      >
        <div
          className={`w-[2px] h-full transition-colors duration-300 ${isResizing ? 'bg-white/20' : 'bg-transparent group-hover:bg-white/10'}`}
        />
      </div>

      {/* Header */}
      <div className="h-14 px-5 flex justify-between items-center border-b border-white/5 shrink-0 bg-transparent">
        <div className="flex items-center gap-3">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
              isStreaming ? 'bg-zinc-300' : 'bg-zinc-600'
            }`}
          />
          <span className="text-[12px] font-medium tracking-wide text-zinc-400">
            {viewMode === 'history' ? 'History' : 'Assistant'}
          </span>
          {viewMode === 'chat' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono text-zinc-500 bg-white/[0.03] border border-white/5">
              {PROVIDER_LABELS[activeProvider]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              createNewSession()
              setViewMode('chat')
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
            title="New session"
          >
            <Plus size={15} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'history' ? 'chat' : 'history')}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
              viewMode === 'history'
                ? 'text-zinc-200 bg-white/[0.06]'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
            title="History"
          >
            <History size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setActiveView('settings')}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
            title="AI settings"
          >
            <Settings size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => {
              if (viewMode === 'chat') clearChat()
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
            title="Clear chat"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {viewMode === 'history' ? (
        /* History list */
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 hide-scrollbar">
          <AnimatePresence>
            {sessions.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[13px] text-center mt-10 text-zinc-500"
              >
                No history yet
              </motion.div>
            )}
            {sessions.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => {
                  setActiveSession(s.id)
                  setViewMode('chat')
                }}
                className={`p-4 rounded-xl flex flex-col gap-2 cursor-pointer transition-colors duration-200 group ${
                  s.id === activeSessionId
                    ? 'bg-white/[0.04]'
                    : 'bg-transparent hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div
                    className={`text-[13px] leading-snug line-clamp-2 ${
                      s.id === activeSessionId
                        ? 'text-zinc-200'
                        : 'text-zinc-400 group-hover:text-zinc-300'
                    }`}
                  >
                    {s.title}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(s.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 -m-1.5 rounded-md text-zinc-500 hover:text-zinc-300 transition-all shrink-0"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-600">
                  <span>{s.messages.length} messages</span>
                  <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <>
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6 hide-scrollbar relative">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-4 opacity-80">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 flex items-center justify-center shadow-lg shadow-black/50">
                  <TerminalSquare size={20} className="text-zinc-200" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] text-zinc-500 font-medium tracking-wide">
                  How can I help you?
                </p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                if (!msg.text && !isStreaming) return null
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className={`flex gap-3 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                        <Code2 size={13} className="text-zinc-400" strokeWidth={1.5} />
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] text-[13.5px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'whitespace-pre-wrap px-4 py-2.5 rounded-2xl bg-[#111] border border-white/[0.04] shadow-sm text-zinc-200'
                          : 'text-zinc-300 pt-1'
                      }`}
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
            <div ref={messagesEndRef} className="h-4 shrink-0" />
          </div>

          {/* Input area */}
          <div className="p-4 pt-2 bg-[#050505] shrink-0 border-t border-white/[0.04]">
            <div className="relative group">
              <div className="relative flex items-end rounded-2xl bg-[#0A0A0A] border border-white/[0.06] shadow-xl shadow-black/50 transition-colors duration-300 focus-within:border-white/[0.15]">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Message..."
                  className="w-full bg-transparent text-[14px] text-zinc-200 pl-4 pr-12 py-3.5 resize-none focus:outline-none hide-scrollbar placeholder:text-zinc-600 font-medium"
                  style={{
                    minHeight: '48px',
                    maxHeight: '200px'
                  }}
                  rows={1}
                />

                <AnimatePresence>
                  {input.trim() && !isStreaming && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={handleSend}
                      className="absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-zinc-300 hover:bg-white/20 hover:text-white transition-all duration-200"
                    >
                      <ChevronRight size={18} strokeWidth={2} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="flex justify-between items-center mt-3 px-1">
              <span className="text-[10px] font-mono tracking-wide text-zinc-600">
                {mod} I to focus
              </span>
              <span className="text-[10px] text-zinc-600">AI can make mistakes</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
