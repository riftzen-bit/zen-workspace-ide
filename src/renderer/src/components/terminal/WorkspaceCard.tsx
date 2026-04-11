import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal as TerminalIcon,
  Play,
  Pause,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  RotateCcw
} from 'lucide-react'
import type { Workspace } from '../../store/useTerminalStore'

interface WorkspaceCardProps {
  workspace: Workspace
  index: number
  total: number
  onOpen: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, newName: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

const cliColors: Record<string, string> = {
  'Claude CLI': 'text-amber-400',
  'Codex CLI': 'text-sky-400',
  'Gemini CLI': 'text-emerald-400',
  'Opencode CLI': 'text-violet-400',
  Terminal: 'text-zinc-400'
}

const formatDate = (ts: number) => {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const WorkspaceCard = ({
  workspace,
  index,
  total,
  onOpen,
  onPause,
  onResume,
  onDelete,
  onRename,
  onMoveUp,
  onMoveDown
}: WorkspaceCardProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(workspace.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const isPaused = workspace.status === 'paused'

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleRenameSubmit = () => {
    if (editName.trim()) onRename(workspace.id, editName.trim())
    setEditing(false)
  }

  const handleCardClick = () => {
    if (!confirmDelete && !editing) {
      if (isPaused) onResume(workspace.id)
      else onOpen(workspace.id)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onClick={handleCardClick}
      className={`
        group relative flex flex-col rounded-none border transition-all duration-200 cursor-pointer overflow-hidden
        ${
          isPaused
            ? 'bg-[#111113] border-amber-500/10 hover:border-amber-500/20'
            : 'bg-[#141415] border-white/5 hover:border-white/10 hover:bg-[#1a1a1c]'
        }
      `}
    >
      {/* Status accent line */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] rounded-none transition-opacity ${
          isPaused
            ? 'bg-amber-500/50 opacity-100'
            : 'bg-emerald-500/30 opacity-0 group-hover:opacity-100'
        }`}
      />

      {/* Card body */}
      <div className="p-4 flex flex-col gap-3">
        {/* Header: icon + name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-none flex items-center justify-center shrink-0 ${
                isPaused ? 'bg-amber-500/10' : 'bg-white/5'
              }`}
            >
              <TerminalIcon
                size={15}
                className={isPaused ? 'text-amber-400/70' : 'text-zinc-400'}
              />
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleRenameSubmit()
                    }
                    if (e.key === 'Escape') {
                      setEditing(false)
                      setEditName(workspace.name)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-black/40 border border-zinc-700 text-zinc-100 text-sm font-semibold px-1.5 py-0.5 rounded outline-none focus:border-zinc-500"
                />
              ) : (
                <p
                  className="text-sm font-semibold text-zinc-100 truncate leading-tight"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setEditing(true)
                  }}
                >
                  {workspace.name}
                </p>
              )}
              <p className="text-[10px] text-zinc-600 mt-0.5">{formatDate(workspace.createdAt)}</p>
            </div>
          </div>

          {/* Status badge */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-none border shrink-0 ${
              isPaused
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-none ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}
            />
            <span className="text-[10px] font-medium">{isPaused ? 'Paused' : 'Running'}</span>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 flex-wrap">
          {(() => {
            const types = workspace.terminals.map(
              (t) => (t as { cliType?: string }).cliType ?? workspace.cliType
            )
            const uniqueTypes = [...new Set(types)]
            return uniqueTypes.map((type) => (
              <span key={type} className={`font-medium ${cliColors[type] || 'text-zinc-400'}`}>
                {type}
              </span>
            ))
          })()}
          <span className="text-zinc-700">·</span>
          <span className="flex items-center gap-1">
            <LayoutGrid size={10} className="shrink-0" />
            {workspace.layout} {workspace.layout === 1 ? 'Node' : 'Nodes'}
          </span>
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-t border-white/[0.04] bg-black/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Primary action */}
        <div className="flex items-center gap-1">
          {isPaused ? (
            <button
              onClick={() => onResume(workspace.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-none bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-medium transition-colors"
            >
              <RotateCcw size={11} />
              Resume
            </button>
          ) : (
            <button
              onClick={() => onOpen(workspace.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-none bg-white/5 hover:bg-white/10 text-zinc-300 text-[11px] font-medium transition-colors"
            >
              <Play size={11} />
              Open
            </button>
          )}
        </div>

        {/* Secondary actions */}
        <div className="flex items-center gap-0.5">
          {!isPaused && (
            <button
              onClick={() => onPause(workspace.id)}
              title="Pause workspace"
              className="w-7 h-7 flex items-center justify-center rounded-none text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
            >
              <Pause size={13} />
            </button>
          )}
          <button
            onClick={() => {
              setEditing(true)
              setEditName(workspace.name)
            }}
            title="Rename"
            className="w-7 h-7 flex items-center justify-center rounded-none text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
          >
            <Pencil size={13} />
          </button>

          <div className="flex flex-col">
            <button
              onClick={() => onMoveUp(workspace.id)}
              disabled={index === 0}
              title="Move up"
              className="w-6 h-3.5 flex items-center justify-center text-zinc-600 hover:text-zinc-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronUp size={10} />
            </button>
            <button
              onClick={() => onMoveDown(workspace.id)}
              disabled={index === total - 1}
              title="Move down"
              className="w-6 h-3.5 flex items-center justify-center text-zinc-600 hover:text-zinc-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronDown size={10} />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {confirmDelete ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center gap-1 overflow-hidden"
              >
                <button
                  onClick={() => onDelete(workspace.id)}
                  className="px-2 py-1 text-[10px] font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-none transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-[10px] font-medium bg-white/5 hover:bg-white/10 text-zinc-400 rounded-none transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="delete-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmDelete(true)}
                title="Delete"
                className="w-7 h-7 flex items-center justify-center rounded-none text-zinc-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

