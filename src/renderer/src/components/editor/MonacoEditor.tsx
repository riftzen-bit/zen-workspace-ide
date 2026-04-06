import { useRef, useEffect } from 'react'
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useFileStore } from '../../store/useFileStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { X } from 'lucide-react'
import { WelcomeScreen } from './WelcomeScreen'

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
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('modern-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [{ token: '', background: '050506' }],
        colors: {
          'editor.background': '#050506',
          'editor.lineHighlightBackground': '#ffffff08',
          'editorLineNumber.foreground': '#3f3f46',
          'editorIndentGuide.background': '#ffffff08',
          'editorSuggestWidget.background': '#111114',
          'editorSuggestWidget.border': '#ffffff0d'
        }
      })
      monaco.editor.setTheme('modern-dark')
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

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, async () => {
      if (activeFile) {
        setIsSaving(true)
        const content = editor.getValue()
        await window.api.saveFile(activeFile, content)
        setIsSaving(false)
      }
    })

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
    return <WelcomeScreen />
  }

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* File Tabs */}
      <div
        className="flex overflow-x-auto hide-scrollbar shrink-0 border-b px-2 pt-2 gap-1"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        {openFiles.map((file) => {
          const isActive = activeFile === file.path
          return (
            <div
              key={file.path}
              onClick={() => setActiveFile(file.path)}
              className="flex items-center min-w-[120px] max-w-[200px] h-[36px] px-4 cursor-pointer group rounded-t-lg transition-colors relative"
              style={{
                backgroundColor: isActive ? 'var(--color-surface-3)' : 'transparent',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLDivElement).style.color = 'var(--color-text-secondary)'
                  ;(e.currentTarget as HTMLDivElement).style.backgroundColor =
                    'var(--color-surface-3)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLDivElement).style.color = 'var(--color-text-muted)'
                  ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
                }
              }}
            >
              <span className="truncate text-body flex-1">{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeFile(file.path)
                }}
                className="ml-3 p-1 rounded transition-colors"
                style={{
                  opacity: isActive ? 1 : 0,
                  color: 'var(--color-text-muted)'
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--color-surface-5)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = ''
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'
                }}
              >
                <X size={13} />
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
