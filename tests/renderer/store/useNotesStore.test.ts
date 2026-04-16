import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'

vi.mock('../../../src/renderer/src/store/electronZustandStorage', () => ({
  electronZustandStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
  }
}))

import { useNotesStore } from '../../../src/renderer/src/store/useNotesStore'

describe('useNotesStore', () => {
  beforeEach(() => {
    useNotesStore.setState({ notes: [], activeNoteId: null })
  })

  describe('createNote', () => {
    it('creates a note scoped to a workspace with defaults', () => {
      let id = ''
      act(() => {
        id = useNotesStore.getState().createNote('/ws', 'Design')
      })

      const { notes, activeNoteId } = useNotesStore.getState()
      expect(notes).toHaveLength(1)
      expect(notes[0].id).toBe(id)
      expect(notes[0].title).toBe('Design')
      expect(notes[0].body).toBe('')
      expect(notes[0].workspaceDir).toBe('/ws')
      expect(notes[0].pinned).toBe(false)
      expect(notes[0].createdAt).toBeGreaterThan(0)
      expect(notes[0].updatedAt).toBe(notes[0].createdAt)
      expect(activeNoteId).toBe(id)
    })

    it('defaults title when none provided and supports global scope', () => {
      act(() => {
        useNotesStore.getState().createNote(null)
      })

      const { notes } = useNotesStore.getState()
      expect(notes[0].title).toBe('Untitled note')
      expect(notes[0].workspaceDir).toBeNull()
    })
  })

  describe('updateNote', () => {
    it('updates title and body and bumps updatedAt', async () => {
      let id = ''
      act(() => {
        id = useNotesStore.getState().createNote('/ws')
      })
      const createdAt = useNotesStore.getState().notes[0].createdAt

      await new Promise((resolve) => setTimeout(resolve, 2))

      act(() => {
        useNotesStore.getState().updateNote(id, { title: 'New', body: 'Hello' })
      })

      const note = useNotesStore.getState().notes[0]
      expect(note.title).toBe('New')
      expect(note.body).toBe('Hello')
      expect(note.updatedAt).toBeGreaterThan(createdAt)
    })

    it('ignores unknown id', () => {
      act(() => {
        useNotesStore.getState().createNote('/ws')
      })
      const before = useNotesStore.getState().notes[0]

      act(() => {
        useNotesStore.getState().updateNote('missing', { title: 'X' })
      })

      expect(useNotesStore.getState().notes[0]).toEqual(before)
    })
  })

  describe('removeNote', () => {
    it('removes by id and clears activeNoteId when active', () => {
      let id = ''
      act(() => {
        id = useNotesStore.getState().createNote('/ws')
      })
      expect(useNotesStore.getState().activeNoteId).toBe(id)

      act(() => {
        useNotesStore.getState().removeNote(id)
      })

      expect(useNotesStore.getState().notes).toHaveLength(0)
      expect(useNotesStore.getState().activeNoteId).toBeNull()
    })

    it('keeps activeNoteId when removing a different note', () => {
      let keep = ''
      let drop = ''
      act(() => {
        drop = useNotesStore.getState().createNote('/ws')
        keep = useNotesStore.getState().createNote('/ws')
      })
      act(() => {
        useNotesStore.getState().setActiveNote(keep)
      })

      act(() => {
        useNotesStore.getState().removeNote(drop)
      })

      expect(useNotesStore.getState().activeNoteId).toBe(keep)
      expect(useNotesStore.getState().notes).toHaveLength(1)
    })
  })

  describe('togglePin', () => {
    it('flips pinned state', () => {
      let id = ''
      act(() => {
        id = useNotesStore.getState().createNote('/ws')
      })

      act(() => {
        useNotesStore.getState().togglePin(id)
      })
      expect(useNotesStore.getState().notes[0].pinned).toBe(true)

      act(() => {
        useNotesStore.getState().togglePin(id)
      })
      expect(useNotesStore.getState().notes[0].pinned).toBe(false)
    })
  })

  describe('getNotesForWorkspace', () => {
    it('returns workspace notes plus global notes', () => {
      act(() => {
        useNotesStore.getState().createNote('/ws-a', 'A note')
        useNotesStore.getState().createNote('/ws-b', 'B note')
        useNotesStore.getState().createNote(null, 'Global note')
      })

      const forA = useNotesStore.getState().getNotesForWorkspace('/ws-a')
      expect(forA.map((note) => note.title).sort()).toEqual(['A note', 'Global note'])

      const forB = useNotesStore.getState().getNotesForWorkspace('/ws-b')
      expect(forB.map((note) => note.title).sort()).toEqual(['B note', 'Global note'])

      const forNull = useNotesStore.getState().getNotesForWorkspace(null)
      expect(forNull.map((note) => note.title)).toContain('Global note')
    })
  })

  describe('clearNotes', () => {
    it('removes all notes and resets active id', () => {
      act(() => {
        useNotesStore.getState().createNote('/ws')
        useNotesStore.getState().createNote('/ws')
      })
      expect(useNotesStore.getState().notes).toHaveLength(2)

      act(() => {
        useNotesStore.getState().clearNotes()
      })

      expect(useNotesStore.getState().notes).toHaveLength(0)
      expect(useNotesStore.getState().activeNoteId).toBeNull()
    })
  })

  describe('setActiveNote', () => {
    it('sets and unsets active note id', () => {
      let id = ''
      act(() => {
        id = useNotesStore.getState().createNote('/ws')
      })

      act(() => {
        useNotesStore.getState().setActiveNote(null)
      })
      expect(useNotesStore.getState().activeNoteId).toBeNull()

      act(() => {
        useNotesStore.getState().setActiveNote(id)
      })
      expect(useNotesStore.getState().activeNoteId).toBe(id)
    })
  })
})
