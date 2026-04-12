import { memo, useState, useCallback } from 'react'
import { Bookmark, X, Trash2, Pencil } from 'lucide-react'
import { useBookmarkStore, Bookmark as BookmarkType } from '../../store/useBookmarkStore'
import { useFileStore } from '../../store/useFileStore'

const BookmarkItem = memo(function BookmarkItem({
  bookmark,
  onOpen,
  onRemove,
  onUpdateLabel
}: {
  bookmark: BookmarkType
  onOpen: () => void
  onRemove: () => void
  onUpdateLabel: (label: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(bookmark.label || '')

  const handleSubmit = useCallback(() => {
    onUpdateLabel(editLabel)
    setIsEditing(false)
  }, [editLabel, onUpdateLabel])

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.03] transition-colors"
      onClick={onOpen}
    >
      <Bookmark size={14} className="text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
              if (e.key === 'Escape') {
                setEditLabel(bookmark.label || '')
                setIsEditing(false)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-full bg-[#0A0A0A] border border-white/[0.1] text-[12px] px-1.5 py-0.5 text-zinc-200 focus:outline-none focus:border-amber-500/50"
            placeholder="Add label..."
          />
        ) : (
          <>
            <div className="text-[12px] text-zinc-300 truncate font-medium">
              {bookmark.label || bookmark.name}
            </div>
            <div className="text-[10px] text-zinc-600 truncate">
              {bookmark.path.split(/[\\/]/).slice(-2).join('/')}
              {bookmark.line && `:${bookmark.line}`}
            </div>
          </>
        )}
      </div>
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setIsEditing(true)}
          className="p-1 hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Edit label"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onRemove}
          className="p-1 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
          title="Remove bookmark"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
})

export const BookmarkPanel = memo(function BookmarkPanel() {
  const { bookmarks, removeBookmark, updateBookmarkLabel, clearBookmarks } = useBookmarkStore()
  const { openFile, setPendingLocation } = useFileStore()

  const handleOpen = useCallback(
    async (bookmark: BookmarkType) => {
      const content = await window.api.readFile(bookmark.path)
      if (content !== null) {
        openFile(bookmark.path, bookmark.name, content)
        if (bookmark.line) {
          setPendingLocation(bookmark.path, bookmark.line, bookmark.column || 1)
        }
      }
    },
    [openFile, setPendingLocation]
  )

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#050505]">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50 pb-20">
          <div className="w-12 h-12 rounded-none bg-white/[0.02] border border-white/[0.04] shadow-inner flex items-center justify-center mb-1">
            <Bookmark size={20} strokeWidth={1.5} className="text-zinc-500" />
          </div>
          <p className="text-[13px] font-medium tracking-wide text-zinc-500 text-center px-6">
            No bookmarks yet
          </p>
          <p className="text-[11px] text-zinc-600 text-center px-6">
            Right-click on a file or use Ctrl+B to add bookmarks
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-10 border-b shrink-0 bg-[#0A0A0A]/50"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">
            Bookmarks
          </span>
          <span className="px-1.5 py-0.5 rounded-none text-[9px] font-bold bg-white/[0.03] text-zinc-500 border border-white/[0.04]">
            {bookmarks.length}
          </span>
        </div>
        <button
          onClick={clearBookmarks}
          className="p-1.5 rounded-none hover:bg-white/[0.04] text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Clear all bookmarks"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Bookmark list */}
      <div className="flex-1 overflow-y-auto hide-scrollbar py-1">
        {bookmarks
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((bookmark) => (
            <BookmarkItem
              key={bookmark.id}
              bookmark={bookmark}
              onOpen={() => handleOpen(bookmark)}
              onRemove={() => removeBookmark(bookmark.id)}
              onUpdateLabel={(label) => updateBookmarkLabel(bookmark.id, label)}
            />
          ))}
      </div>
    </div>
  )
})
