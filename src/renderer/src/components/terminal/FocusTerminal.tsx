import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTerminalStore } from '../../store/useTerminalStore'
import { TerminalInstance } from './TerminalInstance'
import { WorkspaceCard } from './WorkspaceCard'
import {
  X,
  Terminal as TerminalIcon,
  LayoutGrid,
  ChevronRight,
  Plus,
  ArrowLeft,
  Monitor,
  Columns2,
  LayoutDashboard,
  GitCompare,
  type LucideIcon
} from 'lucide-react'
import { transition } from '../../lib/motion'

const WORKSPACE_TEMPLATES: {
  id: string
  label: string
  description: string
  Icon: LucideIcon
  layout: number
  cliTypes: string[]
}[] = [
  {
    id: 'solo',
    label: 'Solo Focus',
    description: '1 pane · Claude',
    Icon: Monitor,
    layout: 1,
    cliTypes: ['Claude CLI']
  },
  {
    id: 'duo',
    label: 'Duo',
    description: '2 panes · Claude + Terminal',
    Icon: Columns2,
    layout: 2,
    cliTypes: ['Claude CLI', 'Terminal']
  },
  {
    id: 'fullstack',
    label: 'Full Stack',
    description: '4 panes · 2×Claude + Codex + Terminal',
    Icon: LayoutDashboard,
    layout: 4,
    cliTypes: ['Claude CLI', 'Claude CLI', 'Codex CLI', 'Terminal']
  },
  {
    id: 'review',
    label: 'Code Review',
    description: '2 panes · Claude + Gemini',
    Icon: GitCompare,
    layout: 2,
    cliTypes: ['Claude CLI', 'Gemini CLI']
  }
]

export const FocusTerminal = () => {
  const {
    workspaces,
    activeWorkspaceId,
    isModalOpen,
    setModalOpen,
    createWorkspace,
    deleteWorkspace,
    setActiveWorkspace,
    renameWorkspace,
    pauseWorkspace,
    resumeWorkspace,
    reorderWorkspaces
  } = useTerminalStore()

  const [name, setName] = useState('')
  const [cliTypes, setCliTypes] = useState<string[]>(['Terminal'])
  const [layout, setLayout] = useState(1)

  const CLI_OPTIONS = ['Terminal', 'Claude CLI', 'Codex CLI', 'Gemini CLI', 'Opencode CLI']

  const handleLayoutChange = (num: number) => {
    setLayout(num)
    setCliTypes((prev) => {
      const last = prev[prev.length - 1] ?? 'Terminal'
      return Array.from({ length: num }, (_, i) => prev[i] ?? last)
    })
  }

  const handleCliTypeChange = (paneIndex: number, value: string) => {
    setCliTypes((prev) => prev.map((t, i) => (i === paneIndex ? value : t)))
  }

  const handleSetAllCli = (value: string) => {
    setCliTypes(Array.from({ length: layout }, () => value))
  }

  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editTabName, setEditTabName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
  const isOverview = !activeWorkspace

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingTabId])

  const handleCreate = () => {
    if (!name.trim()) return
    createWorkspace(name, layout, cliTypes)
  }

  const handleTabRenameSubmit = (id: string) => {
    if (editTabName.trim()) renameWorkspace(id, editTabName.trim())
    setEditingTabId(null)
  }

  const handleMoveUp = (id: string) => {
    const idx = workspaces.findIndex((w) => w.id === id)
    if (idx <= 0) return
    const ids = workspaces.map((w) => w.id)
    ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
    reorderWorkspaces(ids)
  }

  const handleMoveDown = (id: string) => {
    const idx = workspaces.findIndex((w) => w.id === id)
    if (idx < 0 || idx >= workspaces.length - 1) return
    const ids = workspaces.map((w) => w.id)
    ;[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]
    reorderWorkspaces(ids)
  }

  const getGridClass = (num: number) => {
    switch (num) {
      case 1:
        return 'grid-cols-1 grid-rows-1'
      case 2:
        return 'grid-cols-2 grid-rows-1'
      case 4:
        return 'grid-cols-2 grid-rows-2'
      case 6:
        return 'grid-cols-3 grid-rows-2'
      case 8:
        return 'grid-cols-4 grid-rows-2'
      default:
        return 'grid-cols-1'
    }
  }

  const renderModal = () => {
    if (!isModalOpen) return null
    return (
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[4px] flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={transition.overlay}
          className="rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface-3)',
            border: '1px solid var(--color-border-default)'
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{
              borderColor: 'var(--color-border-subtle)',
              backgroundColor: 'var(--color-surface-2)'
            }}
          >
            <div className="flex items-center gap-2">
              <LayoutGrid size={15} style={{ color: 'var(--color-text-tertiary)' }} />
              <h2
                className="text-body font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Configure Workspace
              </h2>
            </div>
            <button onClick={() => setModalOpen(false)} className="btn-ghost">
              <X size={15} />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-5">
            {/* Templates */}
            <div className="flex flex-col gap-2">
              <label className="text-label" style={{ color: 'var(--color-text-muted)' }}>
                Quick Templates
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {WORKSPACE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setName(tpl.label)
                      setLayout(tpl.layout)
                      setCliTypes(tpl.cliTypes)
                    }}
                    className="flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors"
                    style={{
                      backgroundColor: 'var(--color-surface-2)',
                      borderColor: 'var(--color-border-subtle)',
                      color: 'var(--color-text-secondary)'
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                        'var(--color-border-hover)'
                      ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        'var(--color-surface-4)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                        'var(--color-border-subtle)'
                      ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        'var(--color-surface-2)'
                    }}
                  >
                    <tpl.Icon
                      size={14}
                      style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 2 }}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-body font-medium truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {tpl.label}
                      </p>
                      <p
                        className="text-label truncate"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {tpl.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px" style={{ backgroundColor: 'var(--color-border-subtle)' }} />

            <div className="flex flex-col gap-2">
              <label className="text-label" style={{ color: 'var(--color-text-muted)' }}>
                Workspace Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
                placeholder="e.g. Backend Servers"
                className="input-field w-full"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-label" style={{ color: 'var(--color-text-muted)' }}>
                Grid Layout
              </label>
              <div className="flex gap-2">
                {[1, 2, 4, 6, 8].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleLayoutChange(num)}
                    className="flex-1 py-2 rounded-lg border text-caption font-medium transition-colors"
                    style={{
                      backgroundColor:
                        layout === num ? 'var(--color-surface-5)' : 'var(--color-surface-2)',
                      borderColor:
                        layout === num ? 'var(--color-border-hover)' : 'var(--color-border-subtle)',
                      color:
                        layout === num ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-label" style={{ color: 'var(--color-text-muted)' }}>
                  {layout === 1 ? 'CLI Environment' : 'CLI Per Pane'}
                </label>
                {layout > 1 && (
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleSetAllCli(e.target.value)
                      }}
                      className="text-label appearance-none cursor-pointer pr-5 pl-2 py-1 rounded-md"
                      style={{
                        backgroundColor: 'var(--color-surface-4)',
                        color: 'var(--color-text-tertiary)',
                        border: '1px solid var(--color-border-subtle)'
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Set all…
                      </option>
                      {CLI_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <div
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <ChevronRight size={11} className="rotate-90" />
                    </div>
                  </div>
                )}
              </div>
              {layout === 1 ? (
                <div className="relative">
                  <select
                    value={cliTypes[0] ?? 'Terminal'}
                    onChange={(e) => handleCliTypeChange(0, e.target.value)}
                    className="input-field w-full appearance-none cursor-pointer pr-8"
                  >
                    {CLI_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === 'Terminal' ? 'Standard Terminal' : opt}
                      </option>
                    ))}
                  </select>
                  <div
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <ChevronRight size={13} className="rotate-90" />
                  </div>
                </div>
              ) : (
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: layout <= 2 ? '1fr 1fr' : 'repeat(2, 1fr)' }}
                >
                  {cliTypes.map((type, i) => (
                    <div key={i} className="relative">
                      <div className="text-label mb-1" style={{ color: 'var(--color-text-muted)' }}>
                        Pane {i + 1}
                      </div>
                      <select
                        value={type}
                        onChange={(e) => handleCliTypeChange(i, e.target.value)}
                        className="input-field w-full appearance-none cursor-pointer pr-7 text-caption"
                        style={{ paddingTop: '6px', paddingBottom: '6px' }}
                      >
                        {CLI_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt === 'Terminal' ? 'Terminal' : opt}
                          </option>
                        ))}
                      </select>
                      <div
                        className="absolute right-2 top-[26px] pointer-events-none"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <ChevronRight size={11} className="rotate-90" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            className="flex items-center justify-end gap-2 px-5 py-4 border-t"
            style={{
              borderColor: 'var(--color-border-subtle)',
              backgroundColor: 'var(--color-surface-2)'
            }}
          >
            <button
              onClick={() => setModalOpen(false)}
              className="btn-ghost px-4 py-2 text-body"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Cancel
            </button>
            <button onClick={handleCreate} disabled={!name.trim()} className="btn-primary">
              Launch Workspace
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative overflow-hidden text-white bg-[#000000]">
      {/* Workspace terminal view */}
      <div
        className={`absolute inset-0 flex flex-col transition-opacity duration-150 ${
          !isOverview ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
        }`}
      >
        {/* Tab bar */}
        <div
          className="flex items-end justify-between px-2 pt-2 pb-1 border-b shrink-0"
          style={{
            borderColor: 'var(--color-border-subtle)',
            backgroundColor: 'var(--color-surface-1)'
          }}
        >
          <div className="flex items-end flex-1 overflow-x-auto hide-scrollbar gap-1">
            <button
              onClick={() => setActiveWorkspace(null)}
              className="btn-ghost p-1.5 ml-1 shrink-0"
              title="Back to Overview"
            >
              <ArrowLeft size={15} />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1 mb-1.5 shrink-0" />

            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId
              return (
                <div
                  key={ws.id}
                  onClick={() => setActiveWorkspace(ws.id)}
                  onDoubleClick={() => {
                    setEditingTabId(ws.id)
                    setEditTabName(ws.name)
                  }}
                  className="flex items-center min-w-[140px] max-w-[220px] h-[30px] px-3 cursor-pointer group rounded-lg transition-colors border shrink-0"
                  style={{
                    backgroundColor: isActive ? 'var(--color-surface-3)' : 'transparent',
                    borderColor: isActive ? 'var(--color-border-subtle)' : 'transparent',
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
                  }}
                >
                  <TerminalIcon
                    size={13}
                    className={`mr-2 shrink-0 ${isActive ? 'text-amber-500/80' : 'text-zinc-600'}`}
                  />
                  {editingTabId === ws.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editTabName}
                      onChange={(e) => setEditTabName(e.target.value)}
                      onBlur={() => handleTabRenameSubmit(ws.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTabRenameSubmit(ws.id)
                        if (e.key === 'Escape') setEditingTabId(null)
                      }}
                      className="bg-black/50 text-white px-1 text-xs outline-none w-full font-medium rounded"
                    />
                  ) : (
                    <span className="truncate text-caption font-medium flex-1 tracking-wide">
                      {ws.name}
                    </span>
                  )}

                  {!editingTabId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteWorkspace(ws.id)
                      }}
                      className={`ml-2 hover:bg-white/10 hover:text-white rounded p-1 transition-all shrink-0
                        ${isActive ? 'opacity-100 text-zinc-400' : 'opacity-0 group-hover:opacity-100 text-zinc-500'}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              )
            })}

            <button
              onClick={() => {
                setName('')
                setModalOpen(true)
              }}
              className="btn-ghost ml-1 w-7 h-7 flex items-center justify-center shrink-0"
              title="New Workspace"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* Terminal grids */}
        <div className="flex-1 relative overflow-hidden bg-[#000000]">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={`absolute inset-0 p-2 grid gap-2 ${getGridClass(ws.layout)} transition-opacity duration-150 ${
                ws.id === activeWorkspaceId
                  ? 'opacity-100 z-10'
                  : 'opacity-0 pointer-events-none z-0'
              }`}
            >
              {ws.terminals.map((t) => (
                <TerminalInstance key={t.id} id={t.id} command={t.command} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Overview */}
      <div
        className={`@container absolute inset-0 flex flex-col text-zinc-300 transition-opacity duration-150 ${
          isOverview ? 'opacity-100 z-20 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-6 pb-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: 'var(--color-surface-3)',
                border: '1px solid var(--color-border-subtle)'
              }}
            >
              <TerminalIcon size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
            <div>
              <h1
                className="text-body font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Workspaces
              </h1>
              <p className="text-caption mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {workspaces.length === 0
                  ? 'No active sessions'
                  : `${workspaces.filter((w) => w.status === 'active').length} running · ${workspaces.filter((w) => w.status === 'paused').length} paused`}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setName('')
              setModalOpen(true)
            }}
            className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-caption font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Plus size={13} />
            New
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {workspaces.length === 0 ? (
            /* Empty state — unique: blinking cursor instead of icon-in-box */
            <div className="h-full flex flex-col items-center justify-center gap-5 text-center">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-col items-center gap-4"
              >
                <div
                  className="text-mono px-5 py-3 rounded-xl flex items-center gap-2"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-text-muted)'
                  }}
                >
                  <span>$ zen</span>
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                    className="inline-block w-[2px] h-[14px] rounded-sm"
                    style={{ backgroundColor: 'var(--color-text-tertiary)', marginTop: '1px' }}
                  />
                </div>
                <div>
                  <p
                    className="text-body font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    No workspaces yet
                  </p>
                  <p className="text-caption mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Create one to launch terminal sessions
                  </p>
                </div>
                <button
                  onClick={() => {
                    setName('')
                    setModalOpen(true)
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus size={13} />
                  New Workspace
                </button>
              </motion.div>
            </div>
          ) : (
            <div className="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {workspaces.map((ws, idx) => (
                  <WorkspaceCard
                    key={ws.id}
                    workspace={ws}
                    index={idx}
                    total={workspaces.length}
                    onOpen={(id) => setActiveWorkspace(id)}
                    onPause={(id) => pauseWorkspace(id)}
                    onResume={(id) => resumeWorkspace(id)}
                    onDelete={(id) => deleteWorkspace(id)}
                    onRename={(id, newName) => renameWorkspace(id, newName)}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                  />
                ))}
              </AnimatePresence>

              {/* Add new workspace card */}
              <motion.button
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => {
                  setName('')
                  setModalOpen(true)
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-all min-h-[140px] cursor-pointer"
                style={{
                  borderColor: 'var(--color-border-subtle)',
                  color: 'var(--color-text-muted)'
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                    'var(--color-border-hover)'
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--color-surface-2)'
                  ;(e.currentTarget as HTMLButtonElement).style.color =
                    'var(--color-text-secondary)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                    'var(--color-border-subtle)'
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = ''
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'
                }}
              >
                <Plus size={18} strokeWidth={1.5} />
                <span className="text-caption font-medium">New Workspace</span>
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {renderModal()}
    </div>
  )
}
