import { useState, useEffect } from 'react'
import { DiffEditor, useMonaco } from '@monaco-editor/react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { FileText, X } from 'lucide-react'

export const GitDiffEditor = () => {
  const { workspaceDir } = useFileStore()
  const { activeDiffFile, setActiveDiffFile } = useUIStore()
  const { fontSize, wordWrap } = useSettingsStore()
  const monaco = useMonaco()

  const [original, setOriginal] = useState('')
  const [modified, setModified] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!monaco) return
    monaco.editor.defineTheme('zen-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [{ background: '0c0c0e', token: '' }],
      colors: {
        'editor.background': '#0c0c0e',
        'editor.lineHighlightBackground': '#18181b',
        'editorLineNumber.foreground': '#52525b',
        'editorIndentGuide.background': '#27272a',
        'diffEditor.insertedTextBackground': '#10b9811a',
        'diffEditor.removedTextBackground': '#ef44441a'
      }
    })
    monaco.editor.setTheme('zen-dark')
  }, [monaco])

  useEffect(() => {
    const loadDiff = async () => {
      if (!workspaceDir || !activeDiffFile) return
      setLoading(true)
      try {
        const { original: orig, modified: mod } = await window.api.git.fileDiffContent(
          workspaceDir,
          activeDiffFile.file,
          activeDiffFile.staged
        )
        setOriginal(orig || '')
        setModified(mod || '')
      } catch (err) {
        console.error('Failed to load diff content', err)
      } finally {
        setLoading(false)
      }
    }
    loadDiff()
  }, [workspaceDir, activeDiffFile])

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
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-caption text-zinc-500 animate-pulse">Loading diff...</span>
          </div>
        ) : (
          <DiffEditor
            original={original}
            modified={modified}
            language={language}
            theme="zen-dark"
            options={{
              readOnly: true,
              renderSideBySide: true,
              fontSize,
              wordWrap: wordWrap ? 'on' : 'off',
              minimap: { enabled: false },
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontLigatures: true,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              formatOnPaste: true,
              formatOnType: true
            }}
          />
        )}
      </div>
    </div>
  )
}
