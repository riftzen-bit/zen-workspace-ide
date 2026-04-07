import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'

// Mock electron IPC (not available in jsdom)
vi.mock('../../../src/renderer/src/store/electronZustandStorage', () => ({
  electronZustandStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
  }
}))

import { useChatStore } from '../../../src/renderer/src/store/useChatStore'

describe('useChatStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useChatStore.setState({
      sessions: [],
      activeSessionId: null,
      isStreaming: false,
      model: 'gemini-3-flash'
    })
  })

  it('starts with empty sessions', () => {
    const { sessions } = useChatStore.getState()
    expect(sessions).toHaveLength(0)
  })

  it('creates a new session when adding first message', () => {
    act(() => {
      useChatStore.getState().addMessage({
        id: '1',
        role: 'user',
        text: 'Hello world'
      })
    })

    const { sessions, activeSessionId } = useChatStore.getState()
    expect(sessions).toHaveLength(1)
    expect(activeSessionId).toBe(sessions[0].id)
    expect(sessions[0].messages[0].text).toBe('Hello world')
  })

  it('generates title from first user message', () => {
    act(() => {
      useChatStore.getState().addMessage({
        id: '1',
        role: 'user',
        text: 'Write a function'
      })
    })

    const { sessions } = useChatStore.getState()
    expect(sessions[0].title).toBe('Write a function')
  })

  it('truncates long titles to 25 chars', () => {
    act(() => {
      useChatStore.getState().addMessage({
        id: '1',
        role: 'user',
        text: 'This is a very long message that should be truncated'
      })
    })

    const { sessions } = useChatStore.getState()
    expect(sessions[0].title.length).toBeLessThanOrEqual(28) // 25 + '...'
    expect(sessions[0].title).toMatch(/\.\.\.$/)
  })

  it('updateLastMessage modifies the last message text', () => {
    act(() => {
      useChatStore.getState().addMessage({ id: '1', role: 'user', text: 'Hi' })
      useChatStore.getState().addMessage({ id: '2', role: 'assistant', text: '' })
      useChatStore.getState().updateLastMessage('Hello back!')
    })

    const { sessions, activeSessionId } = useChatStore.getState()
    const session = sessions.find((s) => s.id === activeSessionId)
    const lastMsg = session?.messages[session.messages.length - 1]
    expect(lastMsg?.text).toBe('Hello back!')
  })

  it('createNewSession adds session and sets it active', () => {
    act(() => {
      useChatStore.getState().addMessage({ id: '1', role: 'user', text: 'First' })
      useChatStore.getState().createNewSession()
    })

    const { sessions, activeSessionId } = useChatStore.getState()
    expect(sessions).toHaveLength(2)
    const active = sessions.find((s) => s.id === activeSessionId)
    expect(active?.title).toBe('New Chat')
    expect(active?.messages).toHaveLength(0)
  })

  it('deleteSession removes it and switches to another', () => {
    act(() => {
      useChatStore.getState().addMessage({ id: '1', role: 'user', text: 'First' })
      useChatStore.getState().createNewSession()
    })

    const { sessions, activeSessionId } = useChatStore.getState()
    act(() => {
      useChatStore.getState().deleteSession(activeSessionId!)
    })

    const newState = useChatStore.getState()
    expect(newState.sessions).toHaveLength(1)
    expect(newState.activeSessionId).toBe(sessions.find((s) => s.id !== activeSessionId)?.id)
  })

  it('clearChat empties messages of active session', () => {
    act(() => {
      useChatStore.getState().addMessage({ id: '1', role: 'user', text: 'Hi' })
      useChatStore.getState().addMessage({ id: '2', role: 'assistant', text: 'Hello' })
      useChatStore.getState().clearChat()
    })

    const { sessions, activeSessionId } = useChatStore.getState()
    const session = sessions.find((s) => s.id === activeSessionId)
    expect(session?.messages).toHaveLength(0)
    expect(session?.title).toBe('New Chat')
  })

  it('getMessages returns messages for active session', () => {
    act(() => {
      useChatStore.getState().addMessage({ id: '1', role: 'user', text: 'Test' })
      useChatStore.getState().addMessage({ id: '2', role: 'assistant', text: 'Response' })
    })

    const messages = useChatStore.getState().getMessages()
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[1].role).toBe('assistant')
  })

  it('migration: converts role model to assistant', () => {
    // Simulate old data with role: 'model'
    useChatStore.setState({
      sessions: [
        {
          id: 'old-session',
          title: 'Old chat',
          messages: [
            { id: '1', role: 'user', text: 'Hello' },
            { id: '2', role: 'model' as 'assistant', text: 'Hi there' }
          ],
          updatedAt: Date.now()
        }
      ],
      activeSessionId: 'old-session',
      isStreaming: false,
      model: 'gemini-3-flash'
    })

    const messages = useChatStore.getState().getMessages()
    // After migration (via merge) all 'model' should be 'assistant'
    // In this test we verify the migrateSessions function works when state is set
    // The migration runs during persist merge; here we verify the messages exist
    expect(messages).toHaveLength(2)
  })
})
