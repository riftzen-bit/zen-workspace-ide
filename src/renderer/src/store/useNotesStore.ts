import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { electronZustandStorage } from './electronZustandStorage'

export interface Note {
  id: string
  title: string
  body: string
  workspaceDir: string | null
  pinned: boolean
  createdAt: number
  updatedAt: number
}

interface NotesState {
  notes: Note[]
  activeNoteId: string | null

  createNote: (workspaceDir: string | null, title?: string) => string
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void
  removeNote: (id: string) => void
  togglePin: (id: string) => void
  setActiveNote: (id: string | null) => void
  getNotesForWorkspace: (workspaceDir: string | null) => Note[]
  clearNotes: () => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      activeNoteId: null,

      createNote: (workspaceDir, title) => {
        const now = Date.now()
        const note: Note = {
          id: generateId(),
          title: title ?? 'Untitled note',
          body: '',
          workspaceDir,
          pinned: false,
          createdAt: now,
          updatedAt: now
        }
        set((state) => ({
          notes: [note, ...state.notes],
          activeNoteId: note.id
        }))
        return note.id
      },

      updateNote: (id, patch) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, ...patch, updatedAt: Date.now() } : note
          )
        }))
      },

      removeNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
          activeNoteId: state.activeNoteId === id ? null : state.activeNoteId
        }))
      },

      togglePin: (id) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, pinned: !note.pinned, updatedAt: Date.now() } : note
          )
        }))
      },

      setActiveNote: (id) => set({ activeNoteId: id }),

      getNotesForWorkspace: (workspaceDir) => {
        return get().notes.filter(
          (note) => note.workspaceDir === workspaceDir || note.workspaceDir === null
        )
      },

      clearNotes: () => set({ notes: [], activeNoteId: null })
    }),
    {
      name: 'zen-notes',
      storage: createJSONStorage(() => electronZustandStorage),
      partialize: (state) => ({
        notes: state.notes,
        activeNoteId: state.activeNoteId
      })
    }
  )
)
