import { useRef, useEffect, useCallback } from 'react'
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useFileStore } from '../../store/useFileStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useUIStore } from '../../store/useUIStore'
import { SplitSquareHorizontal, SplitSquareVertical, X } from 'lucide-react'
import { useEditorTheme } from '../../lib/useEditorTheme'

interface EditorPaneProps {
  filePath: string | null
  isPrimary: boolean
}

const EditorPane = ({ filePath, isPrimary }: EditorPaneProps) => {
  const { fileContents, updateFileContent, setIsSaving, openFiles, setActiveFile, closeFile } =
    useFileStore()
  const {
    fontSize,
    wordWrap,
    editorFontFamily,
    editorLineHeight,
    editorCursorStyle,
    editorMinimapEnabled,
    editorLigaturesEnabled,
    editorRenderWhitespace
  } = useSettingsStore()
  const { setSecondaryActiveFile } = useUIStore()
  const monaco = useMonaco()
  const editorThemeName = useEditorTheme(monaco)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const content = filePath ? (fileContents[filePath] ?? '') : ''

  const filePathRef = useRef(filePath)
  useEffect(() => {
    filePathRef.current = filePath
  }, [filePath])

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, async () => {
      const currentFile = filePathRef.current
      if (currentFile) {
        setIsSaving(true)
        const currentContent = editor.getValue()
        try {
          await window.api.saveFile(currentFile, currentContent)
          useFileStore.getState().markFileSaved(currentFile, currentContent)
          useUIStore.getState().addToast(`Saved ${currentFile.split(/[\\/]/).pop()}`, 'success')
        } catch {
          useUIStore.getState().addToast('Failed to save file', 'error')
        } finally {
          setIsSaving(false)
        }
      }
    })
  }

  const handleContentChange = useCallback(
    (value: string | undefined) => {
      if (filePath && value !== undefined) {
        updateFileContent(filePath, value)
      }
    },
    [filePath, updateFileContent]
  )

  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase()
    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      html: 'html',
      css: 'css',
      scss: 'scss',
      md: 'markdown',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      yml: 'yaml',
      yaml: 'yaml'
    }
    return map[ext || ''] || 'plaintext'
  }

  if (!filePath) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#000000] text-zinc-500">
        <div className="text-center">
          <p className="text-[13px]">No file selected</p>
          <p className="text-[11px] mt-1 text-zinc-600">
            Select a file from the explorer or open files tabs
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar for this pane */}
      <div className="h-8 flex items-center gap-1 px-2 border-b border-white/[0.04] bg-[#0A0A0A]">
        {openFiles.map((file) => {
          const isActive = file.path === filePath
          return (
            <button
              key={file.path}
              onClick={() => {
                if (isPrimary) {
                  setActiveFile(file.path)
                } else {
                  setSecondaryActiveFile(file.path)
                }
              }}
              className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-none transition-colors ${
                isActive
                  ? 'bg-white/[0.06] text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
              }`}
            >
              <span className="truncate max-w-[120px]">{file.name}</span>
              <X
                size={12}
                className="opacity-0 group-hover:opacity-100 hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation()
                  closeFile(file.path)
                }}
              />
            </button>
          )
        })}
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          theme={editorThemeName}
          language={getLanguage(filePath)}
          value={content}
          onChange={handleContentChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize,
            fontFamily: `'${editorFontFamily}', 'JetBrains Mono', 'Fira Code', Consolas, monospace`,
            fontLigatures: editorLigaturesEnabled,
            lineHeight: editorLineHeight,
            cursorStyle: editorCursorStyle,
            wordWrap: wordWrap ? 'on' : 'off',
            minimap: { enabled: editorMinimapEnabled },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderWhitespace: editorRenderWhitespace,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: 'on',
            automaticLayout: true
          }}
        />
      </div>
    </div>
  )
}

export const SplitEditor = () => {
  const { activeFile, openFiles } = useFileStore()
  const {
    isSplitEditor,
    splitDirection,
    secondaryActiveFile,
    toggleSplitEditor,
    setSplitDirection,
    setSecondaryActiveFile
  } = useUIStore()

  // Auto-set secondary file if split is enabled but no secondary file
  useEffect(() => {
    if (isSplitEditor && !secondaryActiveFile && openFiles.length > 1) {
      const otherFile = openFiles.find((f) => f.path !== activeFile)
      if (otherFile) {
        setSecondaryActiveFile(otherFile.path)
      }
    }
  }, [isSplitEditor, secondaryActiveFile, openFiles, activeFile, setSecondaryActiveFile])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#000000]">
      {/* Split controls */}
      <div className="h-8 flex items-center justify-end gap-1 px-2 border-b border-white/[0.04] bg-[#050505]">
        <button
          onClick={() => setSplitDirection('vertical')}
          className={`p-1.5 rounded-none transition-colors ${
            isSplitEditor && splitDirection === 'vertical'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
          }`}
          title="Split vertical"
        >
          <SplitSquareVertical size={14} />
        </button>
        <button
          onClick={() => setSplitDirection('horizontal')}
          className={`p-1.5 rounded-none transition-colors ${
            isSplitEditor && splitDirection === 'horizontal'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
          }`}
          title="Split horizontal"
        >
          <SplitSquareHorizontal size={14} />
        </button>
        <div className="w-px h-4 bg-white/[0.06] mx-1" />
        <button
          onClick={toggleSplitEditor}
          className={`px-2 py-1 text-[10px] font-medium rounded-none transition-colors ${
            isSplitEditor
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-zinc-500 hover:text-zinc-300 border border-white/[0.06] hover:bg-white/[0.04]'
          }`}
        >
          {isSplitEditor ? 'Close Split' : 'Split'}
        </button>
      </div>

      {/* Editor area */}
      <div
        className={`flex-1 flex ${splitDirection === 'horizontal' ? 'flex-col' : 'flex-row'} overflow-hidden`}
      >
        <EditorPane filePath={activeFile} isPrimary={true} />
        {isSplitEditor && (
          <>
            <div
              className={`${splitDirection === 'horizontal' ? 'h-px w-full' : 'w-px h-full'} bg-white/[0.08]`}
            />
            <EditorPane filePath={secondaryActiveFile} isPrimary={false} />
          </>
        )}
      </div>
    </div>
  )
}
