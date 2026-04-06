import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ChatMessage } from '../types'
import { electronZustandStorage } from './electronZustandStorage'

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}

interface ChatState {
  isOpen: boolean
  sessions: ChatSession[]
  activeSessionId: string | null
  isStreaming: boolean
  model: string

  toggleChat: () => void
  setChatOpen: (isOpen: boolean) => void
  addMessage: (msg: ChatMessage) => void
  updateLastMessage: (text: string) => void
  setIsStreaming: (isStreaming: boolean) => void
  setModel: (model: string) => void
  createNewSession: () => void
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void
  clearChat: () => void

  // Helper to get active session messages
  getMessages: () => ChatMessage[]
}

const generateTitle = (text: string) => {
  if (!text) return 'New Chat'
  return text.length > 25 ? text.substring(0, 25) + '...' : text
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      sessions: [],
      activeSessionId: null,
      isStreaming: false,
      model: 'gemini-2.5-flash',

      toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
      setChatOpen: (isOpen) => set({ isOpen }),

      getMessages: () => {
        const { sessions, activeSessionId } = get()
        if (!activeSessionId) return []
        const session = sessions.find((s) => s.id === activeSessionId)
        return session ? session.messages : []
      },

      addMessage: (msg) =>
        set((state) => {
          let updatedSessions = [...state.sessions]
          const activeId = state.activeSessionId

          // If no active session, or adding the first message, create one correctly if needed
          if (!activeId || updatedSessions.length === 0) {
            const newSession: ChatSession = {
              id: Date.now().toString(),
              title: generateTitle(msg.text),
              messages: [msg],
              updatedAt: Date.now()
            }
            return {
              sessions: [newSession, ...updatedSessions],
              activeSessionId: newSession.id
            }
          }

          const sessionIndex = updatedSessions.findIndex((s) => s.id === activeId)
          if (sessionIndex > -1) {
            const currentSession = updatedSessions[sessionIndex]

            // Set title from first user message if current title is default
            let newTitle = currentSession.title
            if (currentSession.messages.length === 0 && msg.role === 'user') {
              newTitle = generateTitle(msg.text)
            }

            updatedSessions[sessionIndex] = {
              ...currentSession,
              title: newTitle,
              messages: [...currentSession.messages, msg],
              updatedAt: Date.now()
            }

            // Move updated session to top
            const [targetSession] = updatedSessions.splice(sessionIndex, 1)
            updatedSessions = [targetSession, ...updatedSessions]
          }

          return { sessions: updatedSessions }
        }),

      updateLastMessage: (text) =>
        set((state) => {
          const { sessions, activeSessionId } = state
          if (!activeSessionId) return state

          const sessionIndex = sessions.findIndex((s) => s.id === activeSessionId)
          if (sessionIndex === -1) return state

          const updatedSessions = [...sessions]
          const currentSession = updatedSessions[sessionIndex]
          const newMessages = [...currentSession.messages]

          if (newMessages.length > 0) {
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              text: text
            }
          }

          updatedSessions[sessionIndex] = {
            ...currentSession,
            messages: newMessages,
            updatedAt: Date.now()
          }

          return { sessions: updatedSessions }
        }),

      createNewSession: () =>
        set((state) => {
          const newSession: ChatSession = {
            id: Date.now().toString(),
            title: 'New Chat',
            messages: [],
            updatedAt: Date.now()
          }
          return {
            sessions: [newSession, ...state.sessions],
            activeSessionId: newSession.id
          }
        }),

      deleteSession: (id) =>
        set((state) => {
          const updatedSessions = state.sessions.filter((s) => s.id !== id)
          const newActiveId =
            state.activeSessionId === id
              ? updatedSessions.length > 0
                ? updatedSessions[0].id
                : null
              : state.activeSessionId
          return { sessions: updatedSessions, activeSessionId: newActiveId }
        }),

      setActiveSession: (id) => set({ activeSessionId: id }),

      setIsStreaming: (isStreaming) => set({ isStreaming }),
      setModel: (model) => set({ model }),

      // Clear current active chat content instead of deleting array
      clearChat: () =>
        set((state) => {
          if (!state.activeSessionId) return state
          const sessionIndex = state.sessions.findIndex((s) => s.id === state.activeSessionId)
          if (sessionIndex === -1) return state

          const updatedSessions = [...state.sessions]
          updatedSessions[sessionIndex] = {
            ...updatedSessions[sessionIndex],
            messages: [],
            title: 'New Chat',
            updatedAt: Date.now()
          }
          return { sessions: updatedSessions }
        })
    }),
    {
      name: 'vibe-ide-chat-history',
      storage: createJSONStorage(() => electronZustandStorage),
      // Don't persist isOpen or isStreaming states across restarts
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        model: state.model
      })
    }
  )
)
