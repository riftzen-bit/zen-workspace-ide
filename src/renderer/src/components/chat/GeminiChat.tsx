import { useState, useRef, useEffect, useMemo } from 'react'
import { TerminalSquare, Trash2, KeyRound, Plus, History, ChevronDown } from 'lucide-react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { useChatStore } from '../../store/useChatStore'
import { useUIStore } from '../../store/useUIStore'
import { useResizable } from '../../hooks/useResizable'
import { useFileStore } from '../../store/useFileStore'
import { useMediaStore } from '../../store/useMediaStore'

import { useSettingsStore } from '../../store/useSettingsStore'

const ThinkingIndicator = () => {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex gap-2 items-center text-zinc-400 font-medium text-[13px] italic">
      <span className="flex space-x-1 mr-1">
        <span className="w-1.5 h-1.5 bg-amber-500/70 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-1.5 h-1.5 bg-amber-500/70 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-1.5 h-1.5 bg-amber-500/70 rounded-full animate-bounce"></span>
      </span>
      Thinking... {seconds}s
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

  const { isChatOpen } = useUIStore()
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

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !geminiApiKey) return
    const userText = input.trim()
    setInput('')

    addMessage({ id: Date.now().toString(), role: 'user', text: userText })
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
    addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: '' })

    let accumulatedText = ''
    let musicTriggered = false

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey)
      const generativeModel = genAI.getGenerativeModel({ model })
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
            .then((res: any) => {
              if (res) {
                useMediaStore.getState().setCustomVibe(res.videoId, res.title)
                useMediaStore.getState().setIsPlaying(true)
              }
            })
            .catch((err: any) => console.error('Failed to search youtube:', err))
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
    } catch (error: any) {
      console.error(error)
      updateLastMessage(accumulatedText + `\n\nError: ${error.message}`)
      if (error.message?.includes('API key not valid')) {
        setIsEditingKey(true)
      }
    } finally {
      setIsStreaming(false)
    }
  }

  if (!isChatOpen) return null

  return (
    <div
      className="h-full flex flex-col shrink-0 relative bg-[#141415] border-l border-white/5"
      style={{ width: `${width}px` }}
    >
      <div
        className={`w-1 cursor-col-resize absolute left-0 top-0 bottom-0 z-10 transition-colors
          ${isResizing ? 'bg-amber-500/50' : 'bg-transparent hover:bg-white/10'}
        `}
        onMouseDown={startResizing}
      />

      <div className="h-12 px-4 flex justify-between items-center border-b border-white/5 bg-transparent">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          {viewMode === 'history' ? 'History' : 'Assistant'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              createNewSession()
              setViewMode('chat')
            }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-white/5 transition-colors"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'history' ? 'chat' : 'history')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'history'
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
          >
            <History size={14} />
          </button>
          <button
            onClick={() => setIsEditingKey(!isEditingKey)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <KeyRound size={14} />
          </button>
          <button
            onClick={() => {
              if (viewMode === 'chat') clearChat()
            }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isEditingKey ? (
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <KeyRound size={32} className="text-amber-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-sm font-semibold text-zinc-200 mb-2 text-center">API Key Setup</h2>
          <p className="text-xs text-zinc-500 mb-6 text-center max-w-[220px] leading-relaxed">
            Enter your Google Gemini API key to interact with the assistant.
          </p>
          <form onSubmit={handleSaveKey} className="w-full max-w-[260px] flex flex-col gap-3">
            <input
              name="apiKey"
              type="password"
              placeholder="AIzaSy..."
              defaultValue={geminiApiKey}
              className="w-full bg-[#1e1e20] border border-white/5 text-sm text-zinc-200 px-4 py-2.5 rounded-xl focus:outline-none focus:border-amber-500/50 shadow-inner transition-all placeholder:text-zinc-600"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium py-2.5 rounded-xl shadow-md shadow-amber-900/20 transition-all"
            >
              Save Key
            </button>
            {geminiApiKey && (
              <button
                type="button"
                onClick={() => setIsEditingKey(false)}
                className="w-full bg-transparent hover:bg-white/5 text-zinc-400 text-sm font-medium py-2 rounded-xl transition-all"
              >
                Cancel
              </button>
            )}
          </form>
        </div>
      ) : viewMode === 'history' ? (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 hide-scrollbar">
          {sessions.length === 0 && (
            <div className="text-center text-zinc-500 text-sm mt-10">No history yet</div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => {
                setActiveSession(s.id)
                setViewMode('chat')
              }}
              className={`p-4 rounded-xl flex flex-col gap-1 cursor-pointer border transition-all group shadow-sm ${
                s.id === activeSessionId
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                  : 'bg-[#1e1e20] border-white/5 hover:bg-white/10 hover:border-white/10 text-zinc-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="font-semibold text-[13px] truncate pr-4 leading-relaxed">
                  {s.title}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(s.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all p-1 -m-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between font-medium">
                <span>{s.messages.length} msgs</span>
                <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 hide-scrollbar">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4 opacity-70">
                <TerminalSquare size={32} strokeWidth={1.5} className="text-zinc-400" />
                <p className="text-sm font-medium">How can I help you?</p>
              </div>
            )}

            {messages.map((msg) => {
              if (!msg.text && !isStreaming) return null

              return (
                <div
                  key={msg.id}
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'model' && (
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                        !msg.text && isStreaming
                          ? 'bg-amber-500/20 text-amber-500 animate-pulse'
                          : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                      }`}
                    >
                      <TerminalSquare size={14} strokeWidth={2} />
                    </div>
                  )}

                  <div
                    className={`
                    max-w-[85%] rounded-[24px] px-6 py-4 text-[14px] leading-relaxed whitespace-pre-wrap shadow-sm
                    ${
                      msg.role === 'user'
                        ? 'bg-zinc-800 text-white rounded-tr-sm border border-white/10'
                        : 'bg-[#141415] text-zinc-300 rounded-tl-sm border border-white/5'
                    }
                  `}
                  >
                    {msg.text ? msg.text : isStreaming ? <ThinkingIndicator /> : null}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} className="h-6" />
          </div>

          <div className="p-6 bg-[#0a0a0b] border-t border-white/5">
            <div className="relative flex items-end bg-[#141415] border border-white/5 rounded-2xl focus-within:border-amber-500/50 focus-within:ring-4 ring-amber-500/10 transition-all shadow-inner">
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
                className="w-full bg-transparent text-sm text-zinc-200 pl-5 pr-14 py-4 resize-none focus:outline-none hide-scrollbar placeholder:text-zinc-600 font-medium"
                rows={1}
                style={{ minHeight: '52px', maxHeight: '160px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming || !geminiApiKey}
                className="absolute right-2 bottom-2 p-2.5 rounded-xl text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 disabled:text-zinc-700 disabled:hover:bg-transparent transition-colors"
              >
                <div className="rotate-[-90deg]">
                  <ChevronDown size={20} strokeWidth={2.5} />
                </div>
              </button>
            </div>
            <div className="text-center mt-3">
              <span className="text-[11px] text-zinc-600 font-medium tracking-wide">
                Assistant can make mistakes
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
