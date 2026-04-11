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
  sessions: ChatSession[]
  activeSessionId: string | null
  activeMessageId: string | null
  isStreaming: boolean
  model: string

  addMessage: (msg: ChatMessage) => void
  updateLastMessage: (text: string) => void
  updateMessage: (id: string, updater: Partial<ChatMessage>) => void
  setIsStreaming: (isStreaming: boolean) => void
  setModel: (model: string) => void
  createNewSession: () => void
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void
  setActiveMessage: (id: string | null) => void
  branchFromMessage: (messageId: string) => string | null
  clearChat: () => void
  getMessages: () => ChatMessage[]
  getActiveMessage: () => ChatMessage | null
}

const generateTitle = (text: string) => {
  if (!text) return 'New Chat'
  return text.length > 25 ? text.substring(0, 25) + '...' : text
}

// Migrate old 'model' role to 'assistant'
function migrateSessions(sessions: ChatSession[]): ChatSession[] {
  return sessions.map((session) => ({
    ...session,
    messages: session.messages.map((msg) => ({
      ...msg,
      role: (msg.role as string) === 'model' ? 'assistant' : msg.role,
      createdAt: msg.createdAt ?? Date.now(),
      parentId: msg.parentId ?? null
    })) as ChatMessage[]
  }))
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      activeMessageId: null,
      isStreaming: false,
      model: 'gemini-3-flash',

      getMessages: () => {
        const { sessions, activeSessionId } = get()
        if (!activeSessionId) return []
        const session = sessions.find((s) => s.id === activeSessionId)
        return session ? session.messages : []
      },

      getActiveMessage: () => {
        const { activeMessageId } = get()
        if (!activeMessageId) return null
        return get()
          .getMessages()
          .find((message) => message.id === activeMessageId) ?? null
      },

      addMessage: (msg) =>
        set((state) => {
          let updatedSessions = [...state.sessions]
          const activeId = state.activeSessionId
          const normalizedMessage: ChatMessage = {
            ...msg,
            createdAt: msg.createdAt ?? Date.now(),
            parentId: msg.parentId ?? null
          }

          if (!activeId || updatedSessions.length === 0) {
            const newSession: ChatSession = {
              id: crypto.randomUUID(),
              title: generateTitle(normalizedMessage.text),
              messages: [normalizedMessage],
              updatedAt: Date.now()
            }
            return {
              sessions: [newSession, ...updatedSessions],
              activeSessionId: newSession.id,
              activeMessageId: normalizedMessage.id
            }
          }

          const sessionIndex = updatedSessions.findIndex((s) => s.id === activeId)
          if (sessionIndex > -1) {
            const currentSession = updatedSessions[sessionIndex]
            let newTitle = currentSession.title
            if (currentSession.messages.length === 0 && normalizedMessage.role === 'user') {
              newTitle = generateTitle(normalizedMessage.text)
            }
            updatedSessions[sessionIndex] = {
              ...currentSession,
              title: newTitle,
              messages: [...currentSession.messages, normalizedMessage],
              updatedAt: Date.now()
            }
            const [targetSession] = updatedSessions.splice(sessionIndex, 1)
            updatedSessions = [targetSession, ...updatedSessions]
          }

          return { sessions: updatedSessions, activeMessageId: normalizedMessage.id }
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
              text
            }
          }
          updatedSessions[sessionIndex] = {
            ...currentSession,
            messages: newMessages,
            updatedAt: Date.now()
          }
          return {
            sessions: updatedSessions,
            activeMessageId: newMessages[newMessages.length - 1]?.id ?? state.activeMessageId
          }
        }),

      updateMessage: (id, updater) =>
        set((state) => ({
          sessions: state.sessions.map((session) => ({
            ...session,
            messages: session.messages.map((message) =>
              message.id === id ? { ...message, ...updater } : message
            )
          }))
        })),

      createNewSession: () =>
        set((state) => {
          const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: 'New Chat',
            messages: [],
            updatedAt: Date.now()
          }
          return {
            sessions: [newSession, ...state.sessions],
            activeSessionId: newSession.id,
            activeMessageId: null
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
          const nextActiveSession = updatedSessions.find((session) => session.id === newActiveId)
          const nextActiveMessageId =
            nextActiveSession?.messages[nextActiveSession.messages.length - 1]?.id ?? null
          return {
            sessions: updatedSessions,
            activeSessionId: newActiveId,
            activeMessageId: nextActiveMessageId
          }
        }),

      setActiveSession: (id) =>
        set((state) => {
          const session = state.sessions.find((item) => item.id === id)
          return {
            activeSessionId: id,
            activeMessageId: session?.messages[session.messages.length - 1]?.id ?? null
          }
        }),
      setActiveMessage: (id) => set({ activeMessageId: id }),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      setModel: (model) => set({ model }),

      branchFromMessage: (messageId) => {
        const { sessions, activeSessionId } = get()
        if (!activeSessionId) return null
        const session = sessions.find((item) => item.id === activeSessionId)
        if (!session) return null
        const targetIndex = session.messages.findIndex((message) => message.id === messageId)
        if (targetIndex === -1) return null

        const branchedMessages = session.messages.slice(0, targetIndex + 1).map((message) => ({
          ...message
        }))
        const baseTitle = session.messages[targetIndex]?.text || session.title
        const branchTitle = `${generateTitle(baseTitle)} (Branch)`
        const newSession: ChatSession = {
          id: crypto.randomUUID(),
          title: branchTitle,
          messages: branchedMessages,
          updatedAt: Date.now()
        }

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: newSession.id,
          activeMessageId: branchedMessages[branchedMessages.length - 1]?.id ?? null
        }))
        return newSession.id
      },

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
          return { sessions: updatedSessions, activeMessageId: null }
        })
    }),
    {
      name: 'vibe-ide-chat-history',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        activeMessageId: state.activeMessageId,
        model: state.model
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<ChatState>
        const sessions = migrateSessions(p.sessions ?? [])
        const activeSession = sessions.find((session) => session.id === p.activeSessionId) ?? null
        return {
          ...current,
          ...p,
          sessions,
          activeMessageId:
            p.activeMessageId ?? activeSession?.messages[activeSession.messages.length - 1]?.id ?? null
        }
      }
    }
  )
)
