import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TerminalSquare, Trash2, KeyRound, Plus, History, ChevronDown } from 'lucide-react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { useChatStore } from '../../store/useChatStore'
import { useUIStore } from '../../store/useUIStore'
import { useResizable } from '../../hooks/useResizable'
import { useFileStore } from '../../store/useFileStore'
import { useMediaStore } from '../../store/useMediaStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { transition } from '../../lib/motion'

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

export const GeminiChat = () => {
  const [input, setInput] = useState('')
  const { geminiApiKey, setGeminiApiKey } = useSettingsStore()
  const [isEditingKey, setIsEditingKey] = useState(!geminiApiKey)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<'chat' | 'history'>('chat')

  const {
    sessions,
    activeSessionId,
    addMessage,
    updateLastMessage,
    isStreaming,
    setIsStreaming,
    clearChat,
    model,
    createNewSession,
    deleteSession,
    setActiveSession
  } = useChatStore()

  const messages = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId)?.messages || []
  }, [sessions, activeSessionId])

  const { activeFile, fileContents } = useFileStore()
  const { chatWidth, setChatWidth } = useUIStore()
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

  const handleSaveKey = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const key = formData.get('apiKey') as string
    if (key.trim()) {
      setGeminiApiKey(key.trim())
      setIsEditingKey(false)
    }
  }

  const genAI = useMemo(
    () => (geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null),
    [geminiApiKey]
  )

  const generativeModel = useMemo(
    () => (genAI ? genAI.getGenerativeModel({ model }) : null),
    [genAI, model]
  )

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !geminiApiKey || !generativeModel) return
    const userText = input.trim()
    setInput('')

    addMessage({ id: crypto.randomUUID(), role: 'user', text: userText })
    setIsStreaming(true)

    let contextText = ''
    if (activeFile && fileContents[activeFile]) {
      contextText = `\nCurrent active file (${activeFile}):\n\`\`\`\n${fileContents[activeFile]}\n\`\`\`\n`
    }

    const SYSTEM_PROMPT = `You are "Zen AI", an elite coding assistant and a chill vibe companion built into the Zen Workspace IDE.

YOUR CAPABILITIES:
1. You are a world-class software engineer. You can write, refactor, debug, and explain code efficiently.
2. You act as a general AI, capable of answering any question, brainstorming, or chatting casually about any topic.
3. You control the workspace's built-in Vibe Player (Music Player).

MUSIC COMMAND INSTRUCTIONS:
If the user asks you to play music, play a song, switch the vibe, or listen to an artist/playlist, you MUST trigger the music player by using this exact string format anywhere in your response:
[PLAY_MUSIC: <detailed youtube search query>]

Examples:
- User: "Play some The Weeknd" -> You: "Sure thing! Setting the vibe with The Weeknd. [PLAY_MUSIC: The Weeknd full album playlist]"
- User: "I need focus music" -> You: "Focus mode activated. [PLAY_MUSIC: deep focus coding lofi mix]"
- User: "Mở bài nhạc chill" -> You: "Bật nhạc chill cho bạn ngay! [PLAY_MUSIC: nhạc chill tiktok playlist]"

CRITICAL RULES FOR MUSIC:
- ALWAYS append words like 'playlist', 'mix', or 'full album' to the search query so the music plays uninterrupted for hours.
- Keep your conversational response friendly, concise, and professional.`

    const fullPrompt = `${SYSTEM_PROMPT}\n\n${contextText}\nUser question: ${userText}`
    addMessage({ id: crypto.randomUUID(), role: 'model', text: '' })

    let accumulatedText = ''
    let musicTriggered = false

    try {
      const result = await generativeModel.generateContentStream(fullPrompt)

      for await (const chunk of result.stream) {
        const chunkText = chunk.text()
        accumulatedText += chunkText

        const match = accumulatedText.match(/\[PLAY_MUSIC:(.+?)\]/)
        if (match && !musicTriggered) {
          musicTriggered = true
          const query = match[1].trim()
          window.api
            .searchYoutube(query)
            .then((res) => {
              if (res) {
                useMediaStore.getState().setCustomVibe(res.videoId, res.title)
                useMediaStore.getState().setIsPlaying(true)
              }
            })
            .catch((err: unknown) => console.error('Failed to search youtube:', err))
        }

        let displayText = accumulatedText.replace(
          /\[PLAY_MUSIC:[^\]]*\]?/g,
          '🎵 Searching for music...'
        )
        if (musicTriggered && match) {
          displayText = accumulatedText.replace(match[0], `🎵 Playing music: ${match[1].trim()}`)
        }
        updateLastMessage(displayText)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(error)
      updateLastMessage(accumulatedText + `\n\nError: ${message}`)
      if (message?.includes('API key not valid')) {
        setIsEditingKey(true)
      }
    } finally {
      setIsStreaming(false)
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
          {/* Static sage indicator — no breathing animation */}
          <div
            className="w-1.5 h-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: isStreaming ? 'var(--color-secondary)' : 'var(--color-secondary-dim)'
            }}
          />
          <span className="text-label" style={{ color: 'var(--color-text-muted)' }}>
            {viewMode === 'history' ? 'History' : 'Assistant'}
          </span>
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
            onClick={() => setIsEditingKey(!isEditingKey)}
            className="btn-ghost"
            title="API key"
          >
            <KeyRound size={14} />
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

      {isEditingKey ? (
        /* API Key setup */
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{
              backgroundColor: 'var(--color-surface-3)',
              border: '1px solid var(--color-border-subtle)'
            }}
          >
            <KeyRound size={24} strokeWidth={1.5} style={{ color: 'var(--color-secondary)' }} />
          </div>
          <h2
            className="text-subhead mb-1.5 text-center"
            style={{ color: 'var(--color-text-primary)' }}
          >
            API Key Setup
          </h2>
          <p
            className="text-caption mb-6 text-center max-w-[200px] leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Enter your Google Gemini API key to start chatting.
          </p>
          <form onSubmit={handleSaveKey} className="w-full max-w-[240px] flex flex-col gap-3">
            <input
              name="apiKey"
              type="password"
              placeholder="AIzaSy..."
              defaultValue={geminiApiKey}
              className="input-field w-full"
              autoFocus
            />
            <button type="submit" className="btn-primary w-full text-center">
              Save Key
            </button>
            {geminiApiKey && (
              <button
                type="button"
                onClick={() => setIsEditingKey(false)}
                className="btn-ghost w-full text-center text-caption py-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Cancel
              </button>
            )}
          </form>
        </div>
      ) : viewMode === 'history' ? (
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
                    {msg.role === 'model' && (
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
                      className="max-w-[85%] rounded-2xl px-4 py-3 text-body leading-relaxed whitespace-pre-wrap"
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
                      {msg.text ? msg.text : isStreaming ? <ThinkingIndicator /> : null}
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
                disabled={!input.trim() || isStreaming || !geminiApiKey}
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
