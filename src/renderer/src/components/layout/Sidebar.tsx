import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  FolderOpen,
  Folder,
  FileText,
  Search,
  FileCode,
  FileJson,
  FileImage,
  File,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  Clock,
  X,
  Replace,
  CaseSensitive,
  RefreshCw,
  LucideIcon
} from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { FileNode } from '../../types'
import { useResizable } from '../../hooks/useResizable'
import { useUIStore } from '../../store/useUIStore'
import { transition } from '../../lib/motion'
import { ActivityFeed } from '../activity/ActivityFeed'
import { GitDashboard } from '../git/GitDashboard'
import { TaskTracker } from '../tasks/TaskTracker'

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'html':
    case 'css':
      return <FileCode size={13} className="text-blue-400/80" />
    case 'json':
      return <FileJson size={13} className="text-yellow-400/80" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
    case 'ico':
    case 'icns':
      return <FileImage size={13} className="text-green-400/80" />
    case 'md':
    case 'txt':
    case 'log':
      return <FileText size={13} className="text-zinc-400/80" />
    default:
      return <File size={13} className="text-zinc-500/80" />
  }
}

function parentDir(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  parts.pop()
  return parts.join('/')
}

// ── File context menu ────────────────────────────────────────────────────────

const MenuItem = memo(function MenuItem({
  Icon,
  label,
  color,
  onClick
}: {
  Icon: LucideIcon
  label: string
  color?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-body transition-colors text-left hover:bg-[#111111]"
      style={{ color: color ?? 'var(--color-text-secondary)' }}
    >
      <Icon size={13} style={{ color: color ?? 'var(--color-text-muted)' }} />
      {label}
    </button>
  )
})

interface FileContextMenuProps {
  x: number
  y: number
  node: FileNode
  onClose: () => void
  onRefresh: () => Promise<void>
}

const FileContextMenu = ({ x, y, node, onClose, onRefresh }: FileContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const { openFile, markFileDeleted } = useFileStore()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const menuWidth = 200
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x
  const adjustedY = Math.min(y, window.innerHeight - 220)

  const handleNewFile = async () => {
    onClose()
    const dir = node.isDirectory ? node.path : parentDir(node.path)
    const name = await useUIStore.getState().showPrompt('New file name:')
    if (!name?.trim()) return
    const newPath = `${dir}/${name.trim()}`
    const result = await window.api.createFile(newPath)
    if (result.ok) {
      await onRefresh()
      const content = await window.api.readFile(newPath)
      if (content !== null) openFile(newPath, name.trim(), content)
    } else {
      useUIStore.getState().addToast(result.error ?? 'Failed to create file', 'error')
    }
  }

  const handleNewFolder = async () => {
    onClose()
    const dir = node.isDirectory ? node.path : parentDir(node.path)
    const name = await useUIStore.getState().showPrompt('New folder name:')
    if (!name?.trim()) return
    const newPath = `${dir}/${name.trim()}`
    const result = await window.api.createDir(newPath)
    if (result.ok) {
      await onRefresh()
    } else {
      useUIStore.getState().addToast(result.error ?? 'Failed to create folder', 'error')
    }
  }

  const handleRename = async () => {
    onClose()
    const currentName = node.path.replace(/\\/g, '/').split('/').pop() ?? ''
    const newName = await useUIStore.getState().showPrompt('Rename to:', currentName)
    if (!newName?.trim() || newName.trim() === currentName) return
    const dir = parentDir(node.path)
    const newPath = `${dir}/${newName.trim()}`
    const result = await window.api.rename(node.path, newPath)
    if (result.ok) {
      if (!node.isDirectory) markFileDeleted(node.path)
      await onRefresh()
    } else {
      useUIStore.getState().addToast(result.error ?? 'Failed to rename', 'error')
    }
  }

  const handleDelete = async () => {
    onClose()
    const label = node.isDirectory ? 'folder and all its contents' : 'file'
    const confirmed = await useUIStore.getState().showConfirm(`Delete ${label} "${node.name}"?`)
    if (!confirmed) return
    const result = await window.api.deleteItem(node.path)
    if (result.ok) {
      if (!node.isDirectory) markFileDeleted(node.path)
      await onRefresh()
    } else {
      useUIStore.getState().addToast(result.error ?? 'Failed to delete', 'error')
    }
  }

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.97, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={transition.tooltip}
      className="fixed z-[9999] rounded-none overflow-hidden shadow-none border-[#222222]"
      style={{
        left: adjustedX,
        top: adjustedY,
        width: menuWidth,
        backgroundColor: '#0a0a0a',
        border: '1px solid #222222',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}
    >
      <div
        className="px-3 py-1.5 border-b"
        style={{
          borderColor: '#222222',
          backgroundColor: 'var(--color-surface-3)'
        }}
      >
        <p className="text-label truncate" style={{ color: 'var(--color-text-muted)' }}>
          {node.name}
        </p>
      </div>
      <div className="py-1">
        <MenuItem Icon={FilePlus} label="New File" onClick={handleNewFile} />
        <MenuItem Icon={FolderPlus} label="New Folder" onClick={handleNewFolder} />
        <div className="mx-3 my-1 h-px" style={{ backgroundColor: '#222222' }} />
        <MenuItem Icon={Pencil} label="Rename" onClick={handleRename} />
        <MenuItem Icon={Trash2} label="Delete" color="#f87171" onClick={handleDelete} />
      </div>
    </motion.div>
  )
}

// ── File tree node ────────────────────────────────────────────────────────────

interface FileTreeNodeProps {
  node: FileNode
  depth?: number
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
}

const FileTreeNode = memo(function FileTreeNode({
  node,
  depth = 0,
  onContextMenu
}: FileTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { openFile, activeFile } = useFileStore()
  const isSelected = activeFile === node.path

  const handleClick = useCallback(async () => {
    if (node.isDirectory) {
      setIsOpen((prev) => !prev)
    } else {
      const content = await window.api.readFile(node.path)
      if (content !== null) {
        openFile(node.path, node.name, content)
      }
    }
  }, [node.isDirectory, node.path, node.name, openFile])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onContextMenu(e, node)
    },
    [onContextMenu, node]
  )

  const indent = Math.min(depth * 10, 60) + 8

  return (
    <div>
      <div
        className={`flex items-center py-[6px] mx-2 mb-[2px] rounded-none cursor-pointer select-none transition-colors duration-150 group ${
          isSelected
            ? 'bg-white/[0.04] text-zinc-200'
            : 'text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300'
        }`}
        style={{ paddingLeft: `${indent}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div
          className={`flex items-center gap-2 mr-2 opacity-80 shrink-0 ${isSelected ? 'scale-105' : ''}`}
        >
          {node.isDirectory ? (
            <>
              <span
                className={`text-zinc-600 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
              >
                <ChevronRight size={12} strokeWidth={2} />
              </span>
              <span className={`shrink-0 ${isOpen ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <Folder size={14} strokeWidth={1.5} />
              </span>
            </>
          ) : (
            <>
              <span className="w-[12px] shrink-0"></span>
              <span className="shrink-0 scale-90">{getFileIcon(node.name)}</span>
            </>
          )}
        </div>
        <span className="truncate text-[13px] font-medium tracking-wide leading-tight mt-px">
          {node.name}
        </span>
      </div>
      {node.isDirectory && isOpen && node.children && (
        <div className="relative">
          <div className="absolute left-[22px] top-0 bottom-0 w-px bg-white/[0.02]" />
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
})

// ── Sidebar ───────────────────────────────────────────────────────────────────

export const Sidebar = () => {
  const {
    fileTree,
    setWorkspaceDir,
    setFileTree,
    workspaceDir,
    openFile,
    setActiveSearchQuery,
    recentFiles,
    removeFromRecentFiles,
    clearRecentFiles
  } = useFileStore()
  const { sidebarWidth, setSidebarWidth, activeView } = useUIStore()
  const { width, startResizing, isResizing } = useResizable(sidebarWidth, 160, 600, setSidebarWidth)

  const [searchQuery, setSearchQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [searchResults, setSearchResults] = useState<
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
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [isReplacing, setIsReplacing] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(
    null
  )

  const refreshTree = useCallback(async () => {
    if (!workspaceDir) return
    const tree = await window.api.readDirectory(workspaceDir)
    setFileTree(tree)
  }, [workspaceDir, setFileTree])

  useEffect(() => {
    if (!searchQuery || !workspaceDir) {
      setSearchResults([])
      return
    }

    let cancelled = false

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await window.api.searchWithContext(searchQuery, workspaceDir, caseSensitive)
        if (!cancelled) setSearchResults(results || [])
      } catch (err) {
        if (!cancelled) console.error(err)
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery, workspaceDir, caseSensitive])

  const handleReplaceAll = async () => {
    if (!workspaceDir || !searchQuery || !replaceQuery || searchResults.length === 0) return

    setIsReplacing(true)
    try {
      const uniquePaths = [...new Set(searchResults.map((r) => r.path))]
      const replacements = uniquePaths.map((path) => ({
        path,
        search: searchQuery,
        replace: replaceQuery,
        caseSensitive
      }))

      const result = await window.api.replaceInFiles(replacements)
      if (result.ok) {
        setSearchQuery('')
        setReplaceQuery('')
        setSearchResults([])
      }
    } catch (err) {
      console.error('Replace failed:', err)
    } finally {
      setIsReplacing(false)
    }
  }

  const handleOpenFolder = async () => {
    const dirPath = await window.api.openDirectory()
    if (dirPath) {
      setWorkspaceDir(dirPath)
      const tree = await window.api.readDirectory(dirPath)
      setFileTree(tree)
    }
  }

  const handleNodeContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  return (
    <div
      className="h-full flex shrink-0 relative border-r"
      style={{
        width: `${width}px`,
        backgroundColor: '#050505',
        borderColor: '#222222'
      }}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className="h-12 px-4 flex items-center justify-between border-b shrink-0 bg-[#050505]"
          style={{ borderColor: '#222222' }}
        >
          <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">
            {activeView === 'explorer'
              ? 'Explorer'
              : activeView === 'search'
                ? 'Search'
                : activeView === 'tasks'
                  ? 'Tasks'
                  : activeView === 'git'
                    ? 'Source Control'
                    : activeView === 'activity'
                      ? 'Activity'
                      : 'Search'}
          </span>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeView === 'activity' ? (
            <ActivityFeed />
          ) : activeView === 'tasks' ? (
            <TaskTracker />
          ) : activeView === 'git' ? (
            <GitDashboard />
          ) : activeView === 'explorer' ? (
            fileTree.length > 0 ? (
              <div
                className="flex-1 overflow-y-auto hide-scrollbar pt-1 pb-4"
                onContextMenu={(e) => {
                  // Right-click on empty space → context menu for workspace root
                  if (e.target === e.currentTarget && workspaceDir) {
                    e.preventDefault()
                    const rootNode: FileNode = {
                      path: workspaceDir,
                      name: workspaceDir.split('/').pop() ?? 'workspace',
                      isDirectory: true
                    }
                    setContextMenu({ x: e.clientX, y: e.clientY, node: rootNode })
                  }
                }}
              >
                {fileTree.map((node) => (
                  <FileTreeNode key={node.path} node={node} onContextMenu={handleNodeContextMenu} />
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
                {/* Recent Files Section */}
                {recentFiles.length > 0 && (
                  <div className="border-b border-white/[0.04]">
                    <div className="flex items-center justify-between px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-zinc-500" />
                        <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">
                          Recent Files
                        </span>
                      </div>
                      <button
                        onClick={clearRecentFiles}
                        className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                        title="Clear recent files"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="pb-2">
                      {recentFiles.slice(0, 10).map((file) => (
                        <div
                          key={file.path}
                          className="flex items-center group px-4 py-1.5 cursor-pointer text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300 transition-colors"
                          onClick={async () => {
                            const content = await window.api.readFile(file.path)
                            if (content !== null) {
                              openFile(file.path, file.name, content)
                            }
                          }}
                        >
                          <span className="shrink-0 mr-2 scale-90">{getFileIcon(file.name)}</span>
                          <span className="truncate text-[13px] font-medium flex-1">
                            {file.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFromRecentFiles(file.path)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/[0.06] rounded transition-opacity"
                            title="Remove from recent"
                          >
                            <X size={12} className="text-zinc-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Open Folder Section */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="p-6 text-center flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-none flex items-center justify-center mb-1 bg-white/[0.03] border border-white/[0.05] shadow-inner">
                      <FolderOpen size={24} strokeWidth={1.4} className="text-zinc-500" />
                    </div>
                    <p className="text-[13px] text-zinc-500 font-medium tracking-wide">
                      No workspace open
                    </p>
                    <button
                      onClick={handleOpenFolder}
                      className="mt-2 px-4 py-2 rounded-none bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-[13px] text-zinc-300 font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      Open Folder
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="p-3 flex flex-col flex-1 overflow-hidden">
              {/* Search input */}
              <div className="relative shrink-0 mb-2">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  size={14}
                  strokeWidth={2}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in files…"
                  className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-none text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.12] transition-colors py-2"
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>

              {/* Replace input */}
              <div className="relative shrink-0 mb-2">
                <Replace
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  size={14}
                  strokeWidth={2}
                />
                <input
                  type="text"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="Replace with…"
                  className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-none text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.12] transition-colors py-2"
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>

              {/* Options row */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCaseSensitive(!caseSensitive)}
                  className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-none transition-colors ${
                    caseSensitive
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-zinc-500 hover:text-zinc-400 border border-transparent'
                  }`}
                  title="Match case"
                >
                  <CaseSensitive size={14} />
                  <span>Aa</span>
                </button>

                {searchResults.length > 0 && replaceQuery && (
                  <button
                    onClick={handleReplaceAll}
                    disabled={isReplacing}
                    className="flex items-center gap-1.5 px-2 py-1 text-[11px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-none hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                  >
                    {isReplacing ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Replace size={12} />
                    )}
                    <span>Replace All ({searchResults.length})</span>
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto hide-scrollbar text-sm">
                {isSearching ? (
                  <div className="text-[12px] font-medium tracking-wide text-center mt-6 animate-pulse text-zinc-500">
                    Searching…
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-0.5">
                    {searchResults.slice(0, 100).map((res, idx) => (
                      <div
                        key={`${res.path}:${res.line}:${res.column}:${idx}`}
                        onClick={async () => {
                          setActiveSearchQuery(searchQuery)
                          const content = await window.api.readFile(res.path)
                          if (content !== null) {
                            openFile(res.path, res.name, content)
                          }
                        }}
                        className="px-2 py-1.5 rounded-none cursor-pointer group text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="shrink-0 opacity-70">{getFileIcon(res.name)}</span>
                          <span className="truncate text-[12px] font-medium text-zinc-300">
                            {res.relativePath}
                          </span>
                          <span className="text-[10px] text-zinc-600">:{res.line}</span>
                        </div>
                        <div className="pl-5 text-[11px] text-zinc-500 truncate font-mono">
                          {res.lineContent.slice(0, 100)}
                        </div>
                      </div>
                    ))}
                    {searchResults.length > 100 && (
                      <div className="text-[11px] text-zinc-600 text-center py-2">
                        +{searchResults.length - 100} more results
                      </div>
                    )}
                  </div>
                ) : searchQuery ? (
                  <div className="text-[12px] font-medium tracking-wide text-center mt-6 text-zinc-500">
                    No results found
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className={`absolute right-0 top-0 bottom-0 z-10 cursor-col-resize transition-colors ${isResizing ? '' : 'hover:bg-[var(--color-accent-glow-strong)]'}`}
        style={{
          width: '3px',
          borderRadius: '2px',
          backgroundColor: isResizing ? 'var(--color-accent)' : 'transparent'
        }}
        onMouseDown={startResizing}
      />

      {/* File context menu */}
      <AnimatePresence>
        {contextMenu && (
          <FileContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={contextMenu.node}
            onClose={() => setContextMenu(null)}
            onRefresh={refreshTree}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
