import { memo, useCallback, useMemo, useState } from 'react'
import { StickyNote, Plus, Pin, PinOff, Trash2, Search, Globe, Folder } from 'lucide-react'
import { useNotesStore, Note } from '../../store/useNotesStore'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(ts).toLocaleDateString()
}

function notePreview(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return 'Empty note'
  const firstLine = trimmed.split('\n').find((line) => line.trim().length > 0) ?? ''
  return firstLine.slice(0, 80)
}

const NoteListItem = memo(function NoteListItem({
  note,
  isActive,
  onSelect,
  onTogglePin,
  onRemove
}: {
  note: Note
  isActive: boolean
  onSelect: () => void
  onTogglePin: () => void
  onRemove: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex flex-col gap-1 px-3 py-2.5 border-b cursor-pointer transition-colors ${
        isActive ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'
      }`}
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {note.pinned && <Pin size={11} className="text-amber-400 shrink-0" />}
        <span
          className={`truncate text-[12px] font-medium ${
            isActive ? 'text-zinc-200' : 'text-zinc-300'
          }`}
        >
          {note.title || 'Untitled note'}
        </span>
      </div>
      <div className="text-[11px] text-zinc-500 truncate font-mono">{notePreview(note.body)}</div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-600">{formatTimestamp(note.updatedAt)}</span>
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onTogglePin}
            className="p-1 hover:bg-white/[0.06] text-zinc-500 hover:text-amber-400 transition-colors"
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            {note.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
          <button
            onClick={onRemove}
            className="p-1 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
            title="Delete note"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  )
})

export const NotesPanel = memo(function NotesPanel() {
  const { workspaceDir } = useFileStore()
  const { showConfirm } = useUIStore()
  const { notes, activeNoteId, createNote, updateNote, removeNote, togglePin, setActiveNote } =
    useNotesStore()

  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<'workspace' | 'all'>('workspace')

  const visibleNotes = useMemo(() => {
    const filteredByScope =
      scope === 'all'
        ? notes
        : notes.filter((note) => note.workspaceDir === workspaceDir || note.workspaceDir === null)

    const query = search.trim().toLowerCase()
    const filtered = query
      ? filteredByScope.filter(
          (note) =>
            note.title.toLowerCase().includes(query) || note.body.toLowerCase().includes(query)
        )
      : filteredByScope

    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  }, [notes, workspaceDir, scope, search])

  const activeNote = useMemo(
    () => visibleNotes.find((note) => note.id === activeNoteId) ?? visibleNotes[0] ?? null,
    [visibleNotes, activeNoteId]
  )

  const handleCreate = useCallback(() => {
    createNote(scope === 'all' ? null : workspaceDir)
  }, [createNote, scope, workspaceDir])

  const handleRemove = useCallback(
    async (note: Note) => {
      const confirmed = await showConfirm(`Delete note "${note.title || 'Untitled note'}"?`)
      if (confirmed) removeNote(note.id)
    },
    [removeNote, showConfirm]
  )

  const handleTitleChange = useCallback(
    (value: string) => {
      if (!activeNote) return
      updateNote(activeNote.id, { title: value })
    },
    [activeNote, updateNote]
  )

  const handleBodyChange = useCallback(
    (value: string) => {
      if (!activeNote) return
      updateNote(activeNote.id, { body: value })
    },
    [activeNote, updateNote]
  )

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden">
      <div
        className="h-12 px-4 flex items-center justify-between border-b shrink-0 bg-[#0A0A0A]/50"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">
            Notes
          </span>
          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-white/[0.03] text-zinc-500 border border-white/[0.04]">
            {visibleNotes.length}
          </span>
        </div>
        <button
          onClick={handleCreate}
          className="p-1.5 rounded-none hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200 transition-colors"
          title="New note"
        >
          <Plus size={14} />
        </button>
      </div>

      <div
        className="p-3 flex flex-col gap-2 border-b shrink-0"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            size={13}
            strokeWidth={2}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-none text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.14] transition-colors py-1.5"
            style={{ paddingLeft: '2rem' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScope('workspace')}
            className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-none transition-colors ${
              scope === 'workspace'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
            title="Show notes for current workspace"
          >
            <Folder size={11} />
            <span>Workspace</span>
          </button>
          <button
            onClick={() => setScope('all')}
            className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-none transition-colors ${
              scope === 'all'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
            title="Show all notes"
          >
            <Globe size={11} />
            <span>All</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className="w-[45%] min-w-[140px] max-w-[220px] overflow-y-auto hide-scrollbar border-r shrink-0"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          {visibleNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 opacity-60 text-center p-6 h-full">
              <StickyNote size={22} className="text-zinc-600" />
              <p className="text-[12px] text-zinc-500">
                {search ? 'No matching notes' : 'No notes yet'}
              </p>
              {!search && (
                <button
                  onClick={handleCreate}
                  className="px-2.5 py-1.5 text-[11px] border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.18] transition-colors"
                >
                  Create first note
                </button>
              )}
            </div>
          ) : (
            visibleNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isActive={activeNote?.id === note.id}
                onSelect={() => setActiveNote(note.id)}
                onTogglePin={() => togglePin(note.id)}
                onRemove={() => handleRemove(note)}
              />
            ))
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeNote ? (
            <>
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Title"
                className="bg-transparent px-4 py-3 text-[14px] font-medium text-zinc-200 placeholder:text-zinc-600 border-b focus:outline-none"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              />
              <textarea
                value={activeNote.body}
                onChange={(e) => handleBodyChange(e.target.value)}
                placeholder="Write markdown…"
                spellCheck={false}
                className="flex-1 w-full bg-transparent px-4 py-3 text-[12.5px] text-zinc-300 placeholder:text-zinc-600 font-mono leading-relaxed resize-none focus:outline-none hide-scrollbar"
              />
              <div
                className="px-4 py-2 text-[10px] text-zinc-600 border-t flex items-center justify-between shrink-0"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <span>
                  {activeNote.workspaceDir
                    ? activeNote.workspaceDir.split(/[\\/]/).pop()
                    : 'Global'}
                </span>
                <span>Updated {formatTimestamp(activeNote.updatedAt)}</span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[12px] text-zinc-600">
              Select or create a note
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
