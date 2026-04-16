import { useState, useEffect, useRef } from 'react'
import { DiffEditor, useMonaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { FileText, X } from 'lucide-react'
import { CodeReviewPanel } from './CodeReviewPanel'
import { useEditorTheme } from '../../lib/useEditorTheme'

export const GitDiffEditor = () => {
  const { workspaceDir } = useFileStore()
  const { activeDiffFile, setActiveDiffFile } = useUIStore()
  const {
    fontSize,
    wordWrap,
    editorFontFamily,
    editorLineHeight,
    editorLigaturesEnabled,
    editorRenderWhitespace
  } = useSettingsStore()
  const monaco = useMonaco()
  const editorThemeName = useEditorTheme(monaco)

  const [original, setOriginal] = useState('')
  const [modified, setModified] = useState('')
  const [loading, setLoading] = useState(false)
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    return () => {
      try {
        // Reset models before unmount to prevent Monaco dispose ordering races.
        diffEditorRef.current?.setModel(null)
      } catch {
        // ignore cleanup errors
      }
      diffEditorRef.current = null
    }
  }, [])

  useEffect(() => {
    const loadDiff = async () => {
      if (!workspaceDir || !activeDiffFile) {
        setOriginal('')
        setModified('')
        setLoading(false)
        return
      }

      const seq = ++requestSeqRef.current
      setLoading(true)
      try {
        const { original: orig, modified: mod } = await window.api.git.fileDiffContent(
          workspaceDir,
          activeDiffFile.file,
          activeDiffFile.staged
        )
        if (seq === requestSeqRef.current) {
          setOriginal(orig || '')
          setModified(mod || '')
        }
      } catch (err) {
        if (seq === requestSeqRef.current) {
          console.error('Failed to load diff content', err)
        }
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false)
        }
      }
    }
    loadDiff()
  }, [workspaceDir, activeDiffFile])

  const handleReloadDiff = () => {
    if (!workspaceDir || !activeDiffFile) return
    setLoading(true)
    window.api.git
      .fileDiffContent(workspaceDir, activeDiffFile.file, activeDiffFile.staged)
      .then(({ original: orig, modified: mod }) => {
        setOriginal(orig || '')
        setModified(mod || '')
      })
      .catch((err) => {
        console.error('Failed to reload diff content', err)
      })
      .finally(() => setLoading(false))
  }

  if (!activeDiffFile) return null

  // Determine file language for syntax highlighting based on extension
  const ext = activeDiffFile.file.split('.').pop()?.toLowerCase() || ''
  let language = 'plaintext'
  if (['ts', 'tsx'].includes(ext)) language = 'typescript'
  else if (['js', 'jsx'].includes(ext)) language = 'javascript'
  else if (['json'].includes(ext)) language = 'json'
  else if (['html', 'css', 'scss', 'less'].includes(ext)) language = ext
  else if (['md'].includes(ext)) language = 'markdown'
  else if (['py'].includes(ext)) language = 'python'

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0c0c0e]">
      {/* Diff Header */}
      <div
        className="h-10 flex items-center justify-between px-4 border-b shrink-0"
        style={{
          borderColor: 'var(--color-border-subtle)',
          backgroundColor: 'var(--color-surface-2)'
        }}
      >
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-zinc-400" />
          <span className="text-body font-medium text-zinc-300">
            {activeDiffFile.file.split('/').pop()}
            <span className="text-zinc-500 font-normal ml-2">
              ({activeDiffFile.staged ? 'Index ↔ HEAD' : 'Working Tree ↔ Index'})
            </span>
          </span>
          <span className="text-caption text-zinc-500 ml-1 truncate max-w-[300px]">
            {activeDiffFile.file}
          </span>
        </div>
        <button
          onClick={() => setActiveDiffFile(null)}
          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Diff Content */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 relative min-w-0">
          <DiffEditor
            key={`${activeDiffFile.file}:${activeDiffFile.staged ? 'staged' : 'unstaged'}`}
            original={original}
            modified={modified}
            language={language}
            theme={editorThemeName}
            onMount={(diffEditor) => {
              diffEditorRef.current = diffEditor
            }}
            options={{
              readOnly: true,
              renderSideBySide: true,
              automaticLayout: true,
              fontSize,
              lineHeight: editorLineHeight,
              wordWrap: wordWrap ? 'on' : 'off',
              minimap: { enabled: false },
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              fontFamily: `'${editorFontFamily}', 'JetBrains Mono', 'Fira Code', monospace`,
              fontLigatures: editorLigaturesEnabled,
              renderWhitespace: editorRenderWhitespace,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              formatOnPaste: true,
              formatOnType: true
            }}
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0c0c0e]/50 backdrop-blur-sm z-10">
              <span className="text-caption text-zinc-500 animate-pulse">Loading diff...</span>
            </div>
          )}
        </div>
        <CodeReviewPanel
          filePath={activeDiffFile.file}
          staged={activeDiffFile.staged}
          original={original}
          modified={modified}
          modifiedEditor={diffEditorRef.current?.getModifiedEditor() ?? null}
          monaco={monaco}
          onAppliedChange={handleReloadDiff}
        />
      </div>
    </div>
  )
}
