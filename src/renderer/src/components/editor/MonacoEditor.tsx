import { useRef, useEffect } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'
import { useFileStore } from '../../store/useFileStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { X, Code2 } from 'lucide-react'

export const MonacoEditor = () => {
  const {
    activeFile,
    activeSearchQuery,
    openFiles,
    fileContents,
    updateFileContent,
    closeFile,
    setActiveFile,
    setIsSaving
  } = useFileStore()
  const { fontSize, wordWrap } = useSettingsStore()
  const monaco = useMonaco()
  const editorRef = useRef<any>(null)

  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('modern-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: '', background: '0a0a0b' } // Match AppLayout inner container background
        ],
        colors: {
          'editor.background': '#0a0a0b',
          'editor.lineHighlightBackground': '#ffffff0a', // very subtle highlight
          'editorLineNumber.foreground': '#52525b', // zinc-600
          'editorIndentGuide.background': '#ffffff0a',
          'editorSuggestWidget.background': '#141415',
          'editorSuggestWidget.border': '#ffffff10'
        }
      })
      monaco.editor.setTheme('modern-dark')

      // Disable semantic validation to prevent red squiggly lines for external modules
      ;(monaco.languages.typescript as any).typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false
      })
      ;(monaco.languages.typescript as any).javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false
      })
    }
  }, [monaco])

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, async () => {
      if (activeFile) {
        setIsSaving(true)
        const content = editor.getValue()
        await window.api.saveFile(activeFile, content)
        setIsSaving(false)
      }
    })

    // Trigger search highlight on first mount if there's a pending query
    if (activeSearchQuery) {
      const model = editor.getModel()
      if (model) {
        const matches = model.findMatches(activeSearchQuery, false, false, false, null, true)
        if (matches && matches.length > 0) {
          editor.setSelection(matches[0].range)
          editor.revealLineInCenter(matches[0].range.startLineNumber)
        }
      }
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && activeFile) {
      updateFileContent(activeFile, value)
    }
  }

  useEffect(() => {
    if (editorRef.current && activeSearchQuery) {
      const model = editorRef.current.getModel()
      if (model) {
        const matches = model.findMatches(activeSearchQuery, false, false, false, null, true)
        if (matches && matches.length > 0) {
          editorRef.current.setSelection(matches[0].range)
          editorRef.current.revealLineInCenter(matches[0].range.startLineNumber)
        }
      }
    }
  }, [activeSearchQuery, activeFile])

  // Get language from extension
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
      md: 'markdown'
    }
    return map[ext || ''] || 'plaintext'
  }

  if (openFiles.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-transparent">
        <div className="relative mb-6 group cursor-default">
          {/* Ambient Glow */}
          <div className="absolute -inset-2 bg-amber-500/10 blur-2xl rounded-full transition-opacity duration-700 opacity-0 group-hover:opacity-100" />

          {/* 3D Extruded Block */}
          <div
            className="relative w-20 h-20 rounded-[1.25rem] bg-gradient-to-b from-[#252528] to-[#1a1a1c] flex items-center justify-center 
            shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15),inset_0_-4px_8px_rgba(0,0,0,0.4)] 
            border border-white/5 transition-all duration-500 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-4px_8px_rgba(0,0,0,0.5)]"
          >
            <Code2
              size={36}
              className="text-zinc-500 transition-colors duration-500 group-hover:text-amber-400 drop-shadow-lg"
              strokeWidth={1.5}
            />
          </div>
        </div>
        <p className="text-[13px] font-medium text-zinc-500/80 tracking-wide">
          Select a file from the explorer to start coding
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Modern File Tabs */}
      <div className="flex bg-transparent overflow-x-auto hide-scrollbar shrink-0 border-b border-white/5 px-2 pt-2 gap-1">
        {openFiles.map((file) => {
          const isActive = activeFile === file.path
          return (
            <div
              key={file.path}
              onClick={() => setActiveFile(file.path)}
              className={`
                flex items-center min-w-[120px] max-w-[200px] h-[40px] px-4 cursor-pointer group rounded-t-xl transition-all border border-transparent border-b-0
                ${
                  isActive
                    ? 'bg-[#141415] text-zinc-200 border-white/5 shadow-[0_-4px_10px_rgba(0,0,0,0.2)]'
                    : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
                }
              `}
            >
              <span className="truncate text-[13px] font-medium flex-1">{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeFile(file.path)
                }}
                className={`ml-3 hover:bg-white/10 hover:text-white rounded-md p-1 transition-all
                  ${isActive ? 'opacity-100 text-zinc-400' : 'opacity-0 group-hover:opacity-100 text-zinc-500'}
                `}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative bg-transparent">
        {activeFile && (
          <Editor
            height="100%"
            language={getLanguage(activeFile)}
            value={fileContents[activeFile] || ''}
            theme="modern-dark"
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: fontSize || 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              wordWrap: wordWrap ? 'on' : 'off',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              lineHeight: 22,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              renderLineHighlight: 'all'
            }}
          />
        )}
      </div>
    </div>
  )
}
