import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckSquare, RefreshCw, MessageSquare, AlertTriangle } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import type { TodoTag, WorkspaceTodo } from '../../types'

type FilterTag = 'ALL' | TodoTag

const TAG_STYLES: Record<TodoTag, { color: string; border: string }> = {
  TODO: { color: '#60a5fa', border: 'rgba(96,165,250,0.22)' },
  FIXME: { color: '#f87171', border: 'rgba(248,113,113,0.22)' },
  HACK: { color: '#fbbf24', border: 'rgba(251,191,36,0.22)' }
}

export const TaskTracker = () => {
  const { workspaceDir, openFile, setPendingLocation } = useFileStore()
  const { addToast, setChatOpen } = useUIStore()
  const [todos, setTodos] = useState<WorkspaceTodo[]>([])
  const [filter, setFilter] = useState<FilterTag>('ALL')
  const [loading, setLoading] = useState(false)

  const refreshTodos = useCallback(
    async (isCancelled?: () => boolean) => {
      if (!workspaceDir) {
        if (!isCancelled?.()) setTodos([])
        return
      }

      if (!isCancelled?.()) setLoading(true)
      try {
        const nextTodos = await window.api.scanTodos(workspaceDir)
        if (isCancelled?.()) return
        setTodos(nextTodos)
      } catch (error) {
        if (!isCancelled?.()) {
          addToast(error instanceof Error ? error.message : 'Failed to scan TODO comments', 'error')
        }
      } finally {
        if (!isCancelled?.()) setLoading(false)
      }
    },
    [addToast, workspaceDir]
  )

  useEffect(() => {
    let cancelled = false
    void refreshTodos(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [refreshTodos])

  const filteredTodos = useMemo(() => {
    return filter === 'ALL' ? todos : todos.filter((todo) => todo.tag === filter)
  }, [filter, todos])

  const groupedTodos = useMemo(() => {
    return filteredTodos.reduce<Record<string, WorkspaceTodo[]>>((acc, todo) => {
      if (!acc[todo.relativePath]) {
        acc[todo.relativePath] = []
      }
      acc[todo.relativePath].push(todo)
      return acc
    }, {})
  }, [filteredTodos])

  const openTodo = async (todo: WorkspaceTodo) => {
    const content = await window.api.readFile(todo.path)
    if (content === null) {
      addToast(`Could not open ${todo.relativePath}`, 'error')
      return
    }

    openFile(todo.path, todo.name, content)
    setPendingLocation(todo.path, todo.line, todo.column)
  }

  const askAI = (todo: WorkspaceTodo) => {
    setChatOpen(true)
    window.dispatchEvent(
      new CustomEvent('zen:set-chat-input', {
        detail:
          `Help me resolve this ${todo.tag} comment.\n` +
          `File: ${todo.path}\n` +
          `Line: ${todo.line}\n` +
          `Comment: ${todo.text}\n\n` +
          `Please suggest the safest implementation and call out any risks.`
      })
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      <div
        className="h-12 px-4 flex items-center justify-between border-b shrink-0 bg-[#0A0A0A]/50 backdrop-blur-sm"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">
            Tasks
          </span>
          <span className="text-[10px] px-1.5 py-0.5 border border-white/[0.05] text-zinc-500">
            {filteredTodos.length}
          </span>
        </div>
        <button
          onClick={() => void refreshTodos()}
          className="btn-ghost p-1.5"
          title="Refresh tasks"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div
        className="p-3 flex gap-2 border-b"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        {(['ALL', 'TODO', 'FIXME', 'HACK'] as FilterTag[]).map((tag) => {
          const active = filter === tag
          return (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className="px-2.5 py-1.5 text-[11px] uppercase tracking-wide rounded-none transition-colors"
              style={{
                backgroundColor: active ? 'var(--color-accent-glow)' : 'var(--color-surface-3)',
                color: active ? 'var(--color-accent-bright)' : 'var(--color-text-muted)',
                border: `1px solid ${active ? 'var(--color-border-accent)' : 'var(--color-border-subtle)'}`
              }}
            >
              {tag}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-3 flex flex-col gap-3">
        {!workspaceDir ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-60 text-center">
            <CheckSquare size={24} className="text-zinc-600" />
            <p className="text-[13px] text-zinc-500">Open a workspace to scan task comments.</p>
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-60 text-center">
            <CheckSquare size={24} className="text-zinc-600" />
            <p className="text-[13px] text-zinc-500">No matching task comments found.</p>
          </div>
        ) : (
          Object.entries(groupedTodos).map(([relativePath, fileTodos]) => (
            <div
              key={relativePath}
              className="border rounded-none"
              style={{
                borderColor: 'var(--color-border-subtle)',
                backgroundColor: 'var(--color-surface-3)'
              }}
            >
              <div
                className="px-3 py-2 text-[11px] uppercase tracking-wide text-zinc-500 border-b"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                {relativePath}
              </div>
              <div className="flex flex-col">
                {fileTodos.map((todo) => {
                  const style = TAG_STYLES[todo.tag]
                  return (
                    <div
                      key={todo.id}
                      className="px-3 py-3 border-b last:border-b-0"
                      style={{ borderColor: 'var(--color-border-subtle)' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 border"
                              style={{
                                color: style.color,
                                borderColor: style.border
                              }}
                            >
                              {todo.tag}
                            </span>
                            <span className="text-[10px] text-zinc-600">Line {todo.line}</span>
                          </div>
                          <p className="text-[12px] text-zinc-300 mt-2 leading-relaxed">
                            {todo.text}
                          </p>
                        </div>
                        {todo.tag === 'HACK' && (
                          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-3">
                        <button
                          onClick={() => openTodo(todo)}
                          className="px-2.5 py-1.5 text-[11px] rounded-none border border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.14] transition-colors"
                        >
                          Open in Editor
                        </button>
                        <button
                          onClick={() => askAI(todo)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-none border transition-colors"
                          style={{
                            borderColor: 'var(--color-border-secondary)',
                            color: 'var(--color-secondary)'
                          }}
                        >
                          <MessageSquare size={11} />
                          Ask AI
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
