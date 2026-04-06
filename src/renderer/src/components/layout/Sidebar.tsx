import { useState, useEffect } from 'react'
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

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'html':
    case 'css':
      return <FileCode size={14} className="text-blue-400" />
    case 'json':
      return <FileJson size={14} className="text-yellow-400" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
    case 'ico':
    case 'icns':
      return <FileImage size={14} className="text-green-400" />
    case 'md':
    case 'txt':
    case 'log':
      return <FileText size={14} className="text-zinc-400" />
    default:
      return <File size={14} className="text-zinc-500" />
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

  return (
    <div className="px-2">
      <div
        className={`flex items-center py-2 px-3 mb-1 rounded-xl cursor-pointer select-none transition-all duration-200
          ${
            isSelected
              ? 'bg-amber-500/10 text-amber-400 shadow-sm border border-amber-500/10'
              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
          }
        `}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        onClick={handleClick}
      >
        <div className="flex items-center gap-1.5 mr-2 opacity-80">
          {node.isDirectory ? (
            <>
              <span className="text-zinc-500 shrink-0">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span className="text-amber-400/80 shrink-0">
                {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
              </span>
            </>
          ) : (
            <>
              <span className="w-[14px] shrink-0"></span>
              <span className="shrink-0">{getFileIcon(node.name)}</span>
            </>
          )}
        </div>
        <span className="truncate text-[13px] font-medium">{node.name}</span>
      </div>
      {node.isDirectory && isOpen && node.children && (
        <div className="relative">
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export const Sidebar = () => {
  const { fileTree, setWorkspaceDir, setFileTree, workspaceDir, openFile, setActiveSearchQuery } =
    useFileStore()
  const { sidebarWidth, setSidebarWidth, activeView } = useUIStore()
  const { width, startResizing, isResizing } = useResizable(sidebarWidth, 220, 600, setSidebarWidth)

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

  if (activeView === 'settings') return null

  return (
    <div
      className="h-full flex shrink-0 relative bg-[#141415] border-r border-white/5"
      style={{ width: `${width}px` }}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-widest flex justify-between items-center bg-transparent">
          <span>{activeView === 'explorer' ? 'Explorer' : 'Search'}</span>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar pb-4">
          {activeView === 'explorer' ? (
            fileTree.length > 0 ? (
              <div className="pt-1">
                {fileTree.map((node) => (
                  <FileTreeNode key={node.path} node={node} />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center flex flex-col items-center gap-4 mt-10">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-2">
                  <FolderOpen size={32} className="text-zinc-600" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-zinc-500 font-medium">Workspace is empty</p>
                <button
                  onClick={handleOpenFolder}
                  className="bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-900/20 py-2 px-5 text-sm font-medium rounded-xl transition-all"
                >
                  Open Folder
                </button>
              </div>
            )
          ) : (
            <div className="p-3 flex flex-col h-full">
              <div className="relative group shrink-0 mb-4">
                <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in files..."
                  className="w-full bg-[#1e1e20] text-sm text-zinc-200 pl-9 pr-3 py-2 rounded-xl focus:outline-none border border-white/5 focus:border-amber-500/50 transition-all placeholder:text-zinc-500 shadow-inner"
                />
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar text-sm">
                {isSearching ? (
                  <div className="text-zinc-500 text-center mt-6 text-xs animate-pulse">
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.map((res, idx) => (
                      <div
                        key={idx}
                        onClick={async () => {
                          setActiveSearchQuery(searchQuery)
                          const content = await window.api.readFile(res.path)
                          if (content !== null) openFile(res.path, res.name, content)
                        }}
                        className="p-2 cursor-pointer rounded-lg hover:bg-white/5 text-zinc-300 transition-colors flex items-center gap-2.5 group border border-transparent hover:border-white/5"
                      >
                        <div className="shrink-0 opacity-80 group-hover:opacity-100 group-hover:text-amber-500 transition-all">
                          {getFileIcon(res.name)}
                        </div>
                        <span className="truncate text-[13px] font-medium">{res.name}</span>
                      </div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="text-zinc-600 text-center mt-6 text-xs">No results found</div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resizer handle */}
      <div
        className={`w-1 cursor-col-resize absolute right-0 top-0 bottom-0 z-10 transition-colors
          ${isResizing ? 'bg-indigo-500/50' : 'bg-transparent hover:bg-white/10'}
        `}
        onMouseDown={startResizing}
      />
    </div>
  )
}
