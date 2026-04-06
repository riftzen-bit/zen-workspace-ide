import { useState, useRef, useEffect } from 'react'
import { useTerminalStore } from '../../store/useTerminalStore'
import { TerminalInstance } from './TerminalInstance'
import {
  X,
  Terminal as TerminalIcon,
  LayoutGrid,
  ChevronRight,
  Play,
  Plus,
  ArrowLeft
} from 'lucide-react'

export const FocusTerminal = () => {
  const {
    workspaces,
    activeWorkspaceId,
    isModalOpen,
    setModalOpen,
    createWorkspace,
    closeWorkspace,
    setActiveWorkspace,
    renameWorkspace
  } = useTerminalStore()

  const [name, setName] = useState('')
  const [cli, setCli] = useState('Terminal')
  const [layout, setLayout] = useState(1)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleCreate = () => {
    if (!name.trim()) return
    createWorkspace(name, layout, cli)
  }

  const handleRenameSubmit = (id: string) => {
    if (editName.trim()) {
      renameWorkspace(id, editName.trim())
    }
    setEditingId(null)
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
        <div className="bg-[#141415] border border-white/10 rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#1a1a1c]">
            <div className="flex items-center gap-2">
              <LayoutGrid size={16} className="text-zinc-400" />
              <h2 className="text-sm font-medium text-zinc-200">Configure Workspace</h2>
            </div>
            <button
              onClick={() => setModalOpen(false)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Workspace Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Backend Servers"
                className="w-full bg-[#0a0a0b] border border-white/10 rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 transition-colors placeholder-zinc-700"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">CLI Environment</label>
              <div className="relative">
                <select
                  value={cli}
                  onChange={(e) => setCli(e.target.value)}
                  className="w-full bg-[#0a0a0b] border border-white/10 rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="Terminal">Standard Terminal</option>
                  <option value="Claude CLI">Claude CLI</option>
                  <option value="Codex CLI">Codex CLI</option>
                  <option value="Gemini CLI">Gemini CLI</option>
                  <option value="Opencode CLI">Opencode CLI</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none">
                  <ChevronRight size={14} className="rotate-90" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500 flex justify-between">
                <span>Grid Layout</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 4, 6, 8].map((num) => (
                  <button
                    key={num}
                    onClick={() => setLayout(num)}
                    className={`flex-1 py-2 rounded border text-xs font-medium transition-colors ${
                      layout === num
                        ? 'bg-[#2a2a2d] border-zinc-500 text-zinc-200 shadow-inner'
                        : 'bg-[#0a0a0b] border-white/10 text-zinc-500 hover:bg-[#1a1a1c] hover:text-zinc-300'
                    }`}
                  >
                    {num} {num === 1 ? 'Node' : 'Nodes'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/5 bg-[#1a1a1c]">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-900 px-4 py-2 rounded text-sm font-medium transition-colors shadow-lg active:scale-95"
            >
              Launch Workspace
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (activeWorkspace) {
    return (
      <div className="w-full h-full flex flex-col bg-[#0a0a0b] text-white relative">
        <div className="flex items-end justify-between px-2 pt-2 border-b border-white/5 bg-[#0a0a0b]">
          <div className="flex items-end flex-1 overflow-x-auto hide-scrollbar gap-1.5">
            <button
              onClick={() => setActiveWorkspace(null)}
              className="p-1.5 ml-1 mb-1 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors shrink-0"
              title="Back to Overview"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1 mb-2 shrink-0" />

            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId
              return (
                <div
                  key={ws.id}
                  onClick={() => setActiveWorkspace(ws.id)}
                  onDoubleClick={() => {
                    setEditingId(ws.id)
                    setEditName(ws.name)
                  }}
                  className={`
                    flex items-center min-w-[140px] max-w-[220px] h-[36px] px-3 cursor-pointer group rounded-t-xl transition-all border border-transparent border-b-0 shrink-0
                    ${
                      isActive
                        ? 'bg-[#141415] text-zinc-200 border-white/10 shadow-[0_-4px_10px_rgba(0,0,0,0.3)]'
                        : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
                    }
                  `}
                >
                  <TerminalIcon
                    size={14}
                    className={`mr-2 shrink-0 ${isActive ? 'text-amber-500/80' : 'text-zinc-600'}`}
                  />
                  {editingId === ws.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRenameSubmit(ws.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit(ws.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="bg-black/50 text-white px-1 text-xs outline-none w-full font-medium rounded"
                    />
                  ) : (
                    <span className="truncate text-xs font-medium flex-1 tracking-wide">
                      {ws.name}
                    </span>
                  )}

                  {!editingId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closeWorkspace(ws.id)
                      }}
                      className={`ml-2 hover:bg-white/10 hover:text-white rounded p-1 transition-all shrink-0
                        ${isActive ? 'opacity-100 text-zinc-400' : 'opacity-0 group-hover:opacity-100 text-zinc-500'}
                      `}
                    >
                      <X size={14} />
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
              className="ml-1 mb-1 w-[28px] h-[28px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors shrink-0"
              title="New Workspace"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden bg-[#141415]">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={`absolute inset-0 p-2 grid gap-2 ${getGridClass(ws.layout)} transition-opacity duration-200 ${
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

        {renderModal()}
      </div>
    )
  }

  return (
    <div className="@container w-full h-full flex flex-col bg-[#0a0a0b] text-zinc-300 relative">
      <div className="flex-1 flex flex-col items-center justify-center p-6 @2xl:p-16 relative">
        {/* Workspace Quick Access (If there are hidden workspaces) */}
        {workspaces.length > 0 && (
          <div className="absolute top-6 right-6 flex items-center gap-3">
            <span className="text-xs text-zinc-500 font-medium">
              {workspaces.length} active workspace{workspaces.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setActiveWorkspace(workspaces[0].id)}
              className="text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
            >
              Resume Focus
            </button>
          </div>
        )}

        <div className="w-full max-w-5xl grid grid-cols-1 @4xl:grid-cols-2 gap-12 @4xl:gap-24 items-center">
          {/* Left Column: Copy & Actions */}
          <div className="flex flex-col items-start text-left">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-[#1a1a1c] border border-white/10 rounded-xl mb-8 shadow-inner shadow-white/5">
              <TerminalIcon size={26} className="text-zinc-400" />
            </div>
            <h1 className="text-3xl @2xl:text-4xl font-semibold text-zinc-100 mb-6 tracking-tight leading-tight">
              Focus Terminal Environment
            </h1>
            <p className="text-sm @2xl:text-base text-zinc-400 mb-10 leading-relaxed max-w-md">
              Launch an isolated layout of multiple terminal sessions. Configure your environment
              with predefined CLI tools and organize your workspace in a strict grid layout.
            </p>
            <button
              onClick={() => {
                setName('')
                setModalOpen(true)
              }}
              className="inline-flex items-center gap-2 bg-[#2a2a2d] hover:bg-[#323236] border border-white/10 text-zinc-200 px-6 py-3 rounded-lg text-sm font-medium transition-all active:scale-95 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            >
              <Play size={18} className="text-zinc-400" />
              Initialize New Workspace
            </button>
          </div>

          {/* Right Column: Subtle abstract wireframe/visual */}
          <div className="hidden @4xl:flex flex-col gap-4 p-10 border border-white/5 rounded-2xl bg-[#141415] opacity-80 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-zinc-800" />
              <div className="w-3 h-3 rounded-full bg-zinc-800" />
              <div className="w-3 h-3 rounded-full bg-zinc-800" />
            </div>
            <div className="grid grid-cols-2 grid-rows-2 gap-4 aspect-video">
              <div className="bg-[#0a0a0b] border border-white/5 rounded shadow-sm flex flex-col p-3 gap-2.5">
                <div className="w-20 h-1.5 bg-zinc-800 rounded-full" />
                <div className="w-28 h-1.5 bg-zinc-800/50 rounded-full" />
              </div>
              <div className="bg-[#0a0a0b] border border-white/5 rounded shadow-sm flex flex-col p-3 gap-2.5">
                <div className="w-16 h-1.5 bg-zinc-800 rounded-full" />
                <div className="w-24 h-1.5 bg-zinc-800/50 rounded-full" />
              </div>
              <div className="bg-[#0a0a0b] border border-white/5 rounded shadow-sm flex flex-col p-3 gap-2.5">
                <div className="w-24 h-1.5 bg-zinc-800 rounded-full" />
                <div className="w-16 h-1.5 bg-zinc-800/50 rounded-full" />
              </div>
              <div className="bg-[#0a0a0b] border border-white/5 rounded shadow-sm flex flex-col p-3 gap-2.5">
                <div className="w-20 h-1.5 bg-zinc-800 rounded-full" />
                <div className="w-10 h-1.5 bg-zinc-800/50 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {renderModal()}
    </div>
  )
}
