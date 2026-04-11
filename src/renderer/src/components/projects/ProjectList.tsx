import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Folder, FolderOpen, Pin, PinOff, X, Plus } from 'lucide-react'
import { useProjectStore } from '../../store/useProjectStore'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'

import type { Project } from '../../store/useProjectStore'

interface ProjectItemProps {
  project: Project
  isActive: boolean
}

const ProjectItem = ({ project, isActive }: ProjectItemProps) => {
  const { setActiveProject, removeProject, renameProject, togglePin } = useProjectStore()
  const [isHovered, setIsHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleRenameSubmit = () => {
    if (editName.trim() && editName !== project.name) {
      renameProject(project.id, editName.trim())
    } else {
      setEditName(project.name)
    }
    setEditing(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`relative flex items-center group cursor-pointer px-3 py-2.5 my-[2px] mx-2 rounded-none transition-all duration-200 ${
        isActive
          ? 'bg-white/[0.06] text-white shadow-sm border border-white/[0.04]'
          : 'text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300 border border-transparent'
      }`}
      onMouseEnter={() => {
        setIsHovered(true)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
      }}
      onClick={async () => {
        if (!editing && !confirmDelete) {
          setActiveProject(project.id)
          useFileStore.getState().setWorkspaceDir(project.path)
          const tree = await window.api.readDirectory(project.path)
          useFileStore.getState().setFileTree(tree)
          useUIStore.getState().setSidebarOpen(true)
          useUIStore.getState().setActiveView('explorer')
        }
      }}
    >
      {isActive && (
        <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-none bg-[#EAB308] shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
      )}

      <div
        className={`flex-1 flex items-center min-w-0 gap-3 transition-transform duration-200 ${isActive ? 'scale-105 ml-1' : ''}`}
      >
        <div className="shrink-0">
          <Folder
            size={16}
            className={isActive ? 'text-amber-500' : 'text-zinc-500 group-hover:text-zinc-400'}
            strokeWidth={1.5}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {editing ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit()
                if (e.key === 'Escape') {
                  setEditing(false)
                  setEditName(project.name)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[#000000] border border-white/[0.12] text-[13px] font-medium tracking-wide px-2 py-1 rounded-none outline-none text-white shadow-inner"
            />
          ) : (
            <span
              className={`text-[13px] font-medium tracking-wide truncate leading-tight mb-0.5 ${isActive ? 'text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-300'}`}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
            >
              {project.name}
            </span>
          )}
          {!editing && (
            <span className="text-[10px] tracking-wide truncate leading-none text-zinc-600 group-hover:text-zinc-500 mt-0.5">
              {project.path}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center ml-2 h-7" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence mode="wait">
          {confirmDelete ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-1 overflow-hidden whitespace-nowrap"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeProject(project.id)
                }}
                className="px-2 py-1 text-[10px] font-bold tracking-widest uppercase bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-none transition-colors"
              >
                Remove?
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDelete(false)
                }}
                className="px-2 py-1 text-[10px] font-bold tracking-widest uppercase bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 rounded-none transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          ) : (
            isHovered &&
            !editing && (
              <motion.div
                key="actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePin(project.id)
                  }}
                  className={`w-7 h-7 flex items-center justify-center rounded-none transition-colors hover:bg-white/[0.06] ${project.pinned ? 'text-zinc-300' : 'text-zinc-500'}`}
                  title={project.pinned ? 'Unpin' : 'Pin'}
                >
                  {project.pinned ? (
                    <PinOff size={13} strokeWidth={2} />
                  ) : (
                    <Pin size={13} strokeWidth={2} />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete(true)
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-none transition-colors hover:bg-red-500/10 hover:text-red-400 text-zinc-500"
                  title="Remove"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export const ProjectList = () => {
  const { projects, activeProjectId, addProject, setActiveProject } = useProjectStore()

  const handleAddProject = async () => {
    if (!window.api?.openDirectory) return

    const dirPath = await window.api.openDirectory()
    if (dirPath) {
      addProject(dirPath)
      const { projects: updated } = useProjectStore.getState()
      const newProj = updated.find((p) => p.path === dirPath)
      if (newProj) {
        setActiveProject(newProj.id)
        useFileStore.getState().setWorkspaceDir(dirPath)
        const tree = await window.api.readDirectory(dirPath)
        useFileStore.getState().setFileTree(tree)
        useUIStore.getState().setSidebarOpen(true)
        useUIStore.getState().setActiveView('explorer')
      }
    }
  }

  const pinnedProjects = projects
    .filter((p) => p.pinned)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  const recentProjects = projects
    .filter((p) => !p.pinned)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)

  return (
    <div className="h-full flex flex-col w-full bg-[#050505] border-r border-white/[0.06]">
      {/* Header */}
      <div
        className="h-12 px-4 flex items-center justify-between border-b shrink-0 bg-[#0A0A0A]/50 backdrop-blur-sm"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">
            Projects
          </span>
          {projects.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-none text-[9px] font-bold bg-white/[0.03] text-zinc-500 border border-white/[0.04]">
              {projects.length}
            </span>
          )}
        </div>
        <button
          onClick={handleAddProject}
          className="w-7 h-7 flex items-center justify-center rounded-none transition-colors hover:bg-white/[0.04] text-zinc-500 hover:text-zinc-300"
          title="Add Project"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      {/* List / Empty State */}
      <div className="flex-1 overflow-y-auto hide-scrollbar py-2">
        {projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center mt-[-10%]"
          >
            <div className="w-12 h-12 rounded-none flex items-center justify-center mb-1 bg-white/[0.02] border border-white/[0.04] shadow-inner">
              <FolderOpen size={20} className="text-zinc-500" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] text-zinc-500 font-medium tracking-wide">No projects yet</p>
            <button
              onClick={handleAddProject}
              className="mt-2 px-4 py-2 rounded-none bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-[13px] text-zinc-300 font-medium transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Add your first project
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-6 pb-4">
            {pinnedProjects.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="px-5 mb-1.5">
                  <span
                    className="text-[10px] font-bold tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    PINNED
                  </span>
                </div>
                <div className="flex flex-col">
                  <AnimatePresence>
                    {pinnedProjects.map((p) => (
                      <ProjectItem key={p.id} project={p} isActive={p.id === activeProjectId} />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {recentProjects.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="px-5 mb-1.5">
                  <span
                    className="text-[10px] font-bold tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    RECENT
                  </span>
                </div>
                <div className="flex flex-col">
                  <AnimatePresence>
                    {recentProjects.map((p) => (
                      <ProjectItem key={p.id} project={p} isActive={p.id === activeProjectId} />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
