import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  FileText,
  Search,
  FileCode,
  FileJson,
  FileImage,
  File
} from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { FileNode } from '../../types'
import { useResizable } from '../../hooks/useResizable'
import { useUIStore } from '../../store/useUIStore'
import { transition } from '../../lib/motion'

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

const FileTreeNode = ({ node, depth = 0 }: { node: FileNode; depth?: number }) => {
  const [isOpen, setIsOpen] = useState(false)
  const { openFile, activeFile } = useFileStore()
  const isSelected = activeFile === node.path

  const handleClick = async () => {
    if (node.isDirectory) {
      setIsOpen(!isOpen)
    } else {
      const content = await window.api.readFile(node.path)
      if (content !== null) {
        openFile(node.path, node.name, content)
      }
    }
  }

  const indent = Math.min(depth * 10, 60) + 8

  return (
    <div>
      <div
        className="flex items-center py-[5px] mx-1.5 mb-px rounded-md cursor-pointer select-none transition-colors duration-100 relative"
        style={{
          paddingLeft: `${indent}px`,
          backgroundColor: isSelected ? 'var(--color-surface-4)' : undefined,
          color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-surface-4)'
            ;(e.currentTarget as HTMLDivElement).style.color = 'var(--color-text-secondary)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            ;(e.currentTarget as HTMLDivElement).style.backgroundColor = ''
            ;(e.currentTarget as HTMLDivElement).style.color = 'var(--color-text-tertiary)'
          }
        }}
        onClick={handleClick}
      >
        {/* Selected: 2px accent left border */}
        {isSelected && (
          <div
            className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r-full"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />
        )}
        <div className="flex items-center gap-1 mr-1.5 opacity-80 shrink-0">
          {node.isDirectory ? (
            <>
              <span className="text-zinc-600 shrink-0">
                {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </span>
              <span
                className="shrink-0"
                style={{ color: isSelected ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
              >
                {isOpen ? <FolderOpen size={13} /> : <Folder size={13} />}
              </span>
            </>
          ) : (
            <>
              <span className="w-[11px] shrink-0"></span>
              <span className="shrink-0">{getFileIcon(node.name)}</span>
            </>
          )}
        </div>
        <span className="truncate text-body text-[12.5px] leading-tight">{node.name}</span>
      </div>
      <AnimatePresence>
        {node.isDirectory && isOpen && node.children && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16, ease: transition.panel.ease }}
            className="relative overflow-hidden"
          >
            {node.children.map((child, i) => (
              <motion.div
                key={child.path}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02, duration: 0.12 }}
              >
                <FileTreeNode node={child} depth={depth + 1} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const Sidebar = () => {
  const { fileTree, setWorkspaceDir, setFileTree, workspaceDir, openFile, setActiveSearchQuery } =
    useFileStore()
  const { sidebarWidth, setSidebarWidth, activeView } = useUIStore()
  const { width, startResizing, isResizing } = useResizable(sidebarWidth, 160, 600, setSidebarWidth)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ path: string; name: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (!searchQuery || !workspaceDir) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await window.api.searchFiles(searchQuery, workspaceDir)
        setSearchResults(results || [])
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, workspaceDir])

  const handleOpenFolder = async () => {
    const dirPath = await window.api.openDirectory()
    if (dirPath) {
      setWorkspaceDir(dirPath)
      const tree = await window.api.readDirectory(dirPath)
      setFileTree(tree)
    }
  }

  return (
    <div
      className="h-full flex shrink-0 relative border-r"
      style={{
        width: `${width}px`,
        backgroundColor: 'var(--color-surface-2)',
        borderColor: 'var(--color-border-subtle)'
      }}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header — static label, no breathing dot */}
        <div
          className="h-11 px-4 flex items-center border-b shrink-0"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <span className="text-label" style={{ color: 'var(--color-text-muted)' }}>
            {activeView === 'explorer' ? 'Explorer' : 'Search'}
          </span>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeView === 'explorer' ? (
            fileTree.length > 0 ? (
              <div className="flex-1 overflow-y-auto hide-scrollbar pt-1 pb-4">
                {fileTree.map((node) => (
                  <FileTreeNode key={node.path} node={node} />
                ))}
              </div>
            ) : (
              /* Empty state — no pulsing icon */
              <div className="flex-1 overflow-y-auto hide-scrollbar">
                <div className="p-6 text-center flex flex-col items-center gap-4 mt-10">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
                    style={{
                      backgroundColor: 'var(--color-surface-3)',
                      border: '1px solid var(--color-border-subtle)'
                    }}
                  >
                    <FolderOpen
                      size={24}
                      strokeWidth={1.4}
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                  </div>
                  <p className="text-body" style={{ color: 'var(--color-text-tertiary)' }}>
                    No workspace open
                  </p>
                  <button onClick={handleOpenFolder} className="btn-primary">
                    Open Folder
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="p-3 flex flex-col flex-1 overflow-hidden">
              <div className="relative shrink-0 mb-3">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  size={14}
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in files…"
                  className="input-field w-full"
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar text-sm">
                {isSearching ? (
                  <div
                    className="text-caption text-center mt-6 animate-pulse"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Searching…
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-0.5">
                    {searchResults.map((res, idx) => (
                      <div
                        key={idx}
                        onClick={async () => {
                          setActiveSearchQuery(searchQuery)
                          const content = await window.api.readFile(res.path)
                          if (content !== null) openFile(res.path, res.name, content)
                        }}
                        className="surface-interactive p-2 rounded-lg flex items-center gap-2.5 group"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <div className="shrink-0 opacity-80">{getFileIcon(res.name)}</div>
                        <span className="truncate text-body">{res.name}</span>
                      </div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div
                    className="text-caption text-center mt-6"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
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
        className="absolute right-0 top-0 bottom-0 z-10 cursor-col-resize transition-colors"
        style={{
          width: '3px',
          borderRadius: '2px',
          backgroundColor: isResizing ? 'var(--color-accent)' : 'transparent'
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            ;(e.currentTarget as HTMLDivElement).style.backgroundColor =
              'var(--color-accent-glow-strong)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
          }
        }}
        onMouseDown={startResizing}
      />
    </div>
  )
}
