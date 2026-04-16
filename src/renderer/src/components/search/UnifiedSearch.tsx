import { useEffect, useMemo, useState } from 'react'
import { Search, FileText, Bookmark, StickyNote, FileCode } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useBookmarkStore } from '../../store/useBookmarkStore'
import { useNotesStore } from '../../store/useNotesStore'
import { useUIStore } from '../../store/useUIStore'

type ResultKind = 'file' | 'bookmark' | 'note'

interface UnifiedResult {
  kind: ResultKind
  id: string
  title: string
  subtitle: string
  line?: number
  column?: number
  noteId?: string
  path?: string
  name?: string
}

const KIND_ICON = {
  file: FileCode,
  bookmark: Bookmark,
  note: StickyNote
}

const KIND_LABEL: Record<ResultKind, string> = {
  file: 'Files',
  bookmark: 'Bookmarks',
  note: 'Notes'
}

export const UnifiedSearch = () => {
  const { workspaceDir, openFile, setPendingLocation, setActiveSearchQuery } = useFileStore()
  const { bookmarks } = useBookmarkStore()
  const { notes, setActiveNote } = useNotesStore()
  const { setActiveView } = useUIStore()

  const [query, setQuery] = useState('')
  const [fileMatches, setFileMatches] = useState<
    Array<{
      path: string
      relativePath: string
      name: string
      line: number
      column: number
      lineContent: string
      matchLength: number
    }>
  >([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (!query.trim() || !workspaceDir) {
      setFileMatches([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await window.api.searchWithContext(query, workspaceDir, false)
        if (!cancelled) setFileMatches(results || [])
      } catch {
        if (!cancelled) setFileMatches([])
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, workspaceDir])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as UnifiedResult[]

    const matches: UnifiedResult[] = []

    for (const m of fileMatches.slice(0, 50)) {
      matches.push({
        kind: 'file',
        id: `file:${m.path}:${m.line}:${m.column}`,
        title: `${m.relativePath}:${m.line}`,
        subtitle: m.lineContent.slice(0, 100),
        line: m.line,
        column: m.column,
        path: m.path,
        name: m.name
      })
    }

    for (const b of bookmarks) {
      const label = b.label || b.name
      if (label.toLowerCase().includes(q) || b.path.toLowerCase().includes(q)) {
        matches.push({
          kind: 'bookmark',
          id: `bookmark:${b.id}`,
          title: label,
          subtitle: b.path.split(/[\\/]/).slice(-2).join('/') + (b.line ? `:${b.line}` : ''),
          line: b.line,
          column: b.column,
          path: b.path,
          name: b.name
        })
      }
    }

    for (const n of notes) {
      if (n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) {
        const previewIdx = n.body.toLowerCase().indexOf(q)
        const preview =
          previewIdx >= 0
            ? n.body.slice(Math.max(0, previewIdx - 20), previewIdx + 60).replace(/\n/g, ' ')
            : n.body.slice(0, 80).replace(/\n/g, ' ')
        matches.push({
          kind: 'note',
          id: `note:${n.id}`,
          title: n.title || 'Untitled note',
          subtitle: preview || 'Empty note',
          noteId: n.id
        })
      }
    }

    return matches
  }, [query, fileMatches, bookmarks, notes])

  const grouped = useMemo(() => {
    const out: Record<ResultKind, UnifiedResult[]> = { file: [], bookmark: [], note: [] }
    for (const r of results) out[r.kind].push(r)
    return out
  }, [results])

  const handleOpen = async (r: UnifiedResult) => {
    if (r.kind === 'note' && r.noteId) {
      setActiveNote(r.noteId)
      setActiveView('notes')
      return
    }
    if (!r.path || !r.name) return
    if (r.kind === 'file') setActiveSearchQuery(query)
    const content = await window.api.readFile(r.path)
    if (content !== null) {
      openFile(r.path, r.name, content)
      if (r.line) setPendingLocation(r.path, r.line, r.column || 1)
    }
  }

  const totalCount = results.length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 shrink-0">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            size={14}
            strokeWidth={2}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find in files, notes, bookmarks…"
            className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-none text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.12] transition-colors py-2"
            style={{ paddingLeft: '2.25rem' }}
            autoFocus
          />
        </div>
        {query && (
          <div className="mt-2 text-[10px] tracking-wider uppercase text-zinc-600">
            {isSearching ? 'Searching…' : `${totalCount} result${totalCount === 1 ? '' : 's'}`}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-2 pb-4">
        {!query ? (
          <div className="text-[12px] text-zinc-600 px-2 py-6 text-center">
            <FileText size={16} className="mx-auto mb-2 opacity-50" />
            Type to search across files, bookmarks, and notes.
          </div>
        ) : totalCount === 0 && !isSearching ? (
          <div className="text-[12px] text-zinc-500 px-2 py-6 text-center">No results</div>
        ) : (
          (Object.keys(grouped) as ResultKind[]).map((kind) => {
            const items = grouped[kind]
            if (items.length === 0) return null
            const Icon = KIND_ICON[kind]
            return (
              <div key={kind} className="mb-3">
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] tracking-widest uppercase text-zinc-600">
                  <Icon size={11} />
                  <span>{KIND_LABEL[kind]}</span>
                  <span className="ml-auto text-zinc-700">{items.length}</span>
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 50).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleOpen(r)}
                      className="w-full text-left px-2 py-1.5 rounded-none cursor-pointer group text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="text-[12px] font-medium text-zinc-300 truncate">
                        {r.title}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate font-mono">
                        {r.subtitle}
                      </div>
                    </button>
                  ))}
                  {items.length > 50 && (
                    <div className="text-[10px] text-zinc-600 text-center py-1">
                      +{items.length - 50} more
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
