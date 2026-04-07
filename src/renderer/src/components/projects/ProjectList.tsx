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
      className="relative flex items-center group cursor-pointer px-3 py-2.5 my-0.5 mx-2 rounded-lg transition-colors"
      style={{
        backgroundColor: isActive ? 'var(--color-surface-3)' : 'transparent'
      }}
      onMouseEnter={(e) => {
        setIsHovered(true)
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'
      }}
      onMouseLeave={(e) => {
        setIsHovered(false)
        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
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
        <div
          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
          style={{ backgroundColor: 'var(--color-accent)' }}
        />
      )}

      <div className="flex-1 flex items-center min-w-0 gap-3">
        <div className="shrink-0">
          <Folder size={16} className={isActive ? 'text-amber-500/90' : 'text-zinc-500'} />
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
              className="w-full border text-[13px] font-semibold px-1.5 py-0.5 rounded outline-none"
              style={{
                backgroundColor: 'var(--color-surface-4)',
                borderColor: 'var(--color-border-hover)',
                color: 'var(--color-text-primary)'
              }}
            />
          ) : (
            <span
              className="text-body font-semibold truncate leading-tight mb-0.5"
              style={{
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
            >
              {project.name}
            </span>
          )}
          {!editing && (
            <span
              className="text-caption truncate text-[11px] leading-none"
              style={{ color: 'var(--color-text-muted)' }}
            >
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
                className="px-2 py-1 text-[10px] font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md transition-colors"
              >
                Remove?
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDelete(false)
                }}
                className="px-2 py-1 text-[10px] font-medium rounded-md transition-colors hover:bg-white/10"
                style={{
                  backgroundColor: 'var(--color-surface-3)',
                  color: 'var(--color-text-tertiary)'
                }}
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
                className="flex items-center gap-0.5"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePin(project.id)
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-white/10"
                  style={{
                    color: project.pinned
                      ? 'var(--color-text-secondary)'
                      : 'var(--color-text-muted)'
                  }}
                  title={project.pinned ? 'Unpin' : 'Pin'}
                >
                  {project.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete(true)
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-red-500/10 hover:text-red-400"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="Remove"
                >
                  <X size={13} />
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
    <div
      className="h-full flex flex-col w-full"
      style={{ backgroundColor: 'var(--color-surface-1)' }}
    >
      {/* Header */}
      <div
        className="h-11 px-4 flex items-center justify-between border-b shrink-0"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-label font-semibold"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Projects
          </span>
          {projects.length > 0 && (
            <span
              className="text-caption px-1.5 py-0.5 rounded-full text-[10px]"
              style={{
                backgroundColor: 'var(--color-surface-3)',
                color: 'var(--color-text-muted)'
              }}
            >
              {projects.length}
            </span>
          )}
        </div>
        <button
          onClick={handleAddProject}
          className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-white/10"
          style={{ color: 'var(--color-text-secondary)' }}
          title="Add Project"
        >
          <Plus size={14} />
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
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border-subtle)'
              }}
            >
              <FolderOpen
                size={24}
                style={{ color: 'var(--color-text-muted)' }}
                strokeWidth={1.4}
              />
            </div>
            <p className="text-body" style={{ color: 'var(--color-text-tertiary)' }}>
              No projects yet
            </p>
            <button onClick={handleAddProject} className="btn-primary mt-2">
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
