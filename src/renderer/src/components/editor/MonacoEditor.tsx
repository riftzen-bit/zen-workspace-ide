import { useRef, useEffect } from 'react'
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useFileStore } from '../../store/useFileStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useUIStore } from '../../store/useUIStore'
import { useZenStore } from '../../store/useZenStore'
import { X } from 'lucide-react'
import { WelcomeScreen } from './WelcomeScreen'
import { useSnippetStore } from '../../store/useSnippetStore'
import { extractSnippetPlaceholders } from '../../lib/snippets'
import { resolveAIRequestConfig, hasUsableAICredentials } from '../../lib/aiCredentials'

export const MonacoEditor = () => {
  const {
    activeFile,
    activeSearchQuery,
    pendingLocation,
    openFiles,
    fileContents,
    updateFileContent,
    closeFile,
    setActiveFile,
    setIsSaving,
    clearPendingLocation,
    setEditorSelection
  } = useFileStore()
  const { fontSize, wordWrap, inlineCompletionEnabled } = useSettingsStore()
  const monaco = useMonaco()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const keystrokesRef = useRef<number[]>([])

  useEffect(() => {
    if (!monaco) return

    monaco.editor.defineTheme('modern-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [{ token: '', background: '000000' }],
      colors: {
        'editor.background': '#000000',
        'editor.lineHighlightBackground': '#ffffff06',
        'editorLineNumber.foreground': '#3f3f46',
        'editorIndentGuide.background': '#ffffff08',
        'editorSuggestWidget.background': '#0A0A0A',
        'editorSuggestWidget.border': '#ffffff0d'
      }
    })
    monaco.editor.setTheme('modern-dark')
    ;(monaco.languages.typescript as any).typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    })
    ;(monaco.languages.typescript as any).javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    })

    const disposable = monaco.editor.onDidChangeMarkers(() => {
      const markers = monaco.editor.getModelMarkers({})
      const errors = markers.filter((m) => m.severity === monaco.MarkerSeverity.Error)
      useZenStore.getState().setErrorCount(errors.length)
    })

    return () => disposable.dispose()
  }, [monaco])

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, async () => {
      if (activeFile) {
        setIsSaving(true)
        const content = editor.getValue()
        try {
          await window.api.saveFile(activeFile, content)
          const fileName = activeFile.split('/').pop() || activeFile
          useUIStore.getState().addToast(`Saved ${fileName}`, 'success')
        } catch {
          useUIStore.getState().addToast('Failed to save file', 'error')
        } finally {
          setIsSaving(false)
        }
      }
    })

    editor.onDidChangeCursorPosition((e) => {
      useUIStore.getState().setCursorPosition(e.position.lineNumber, e.position.column)
    })

    editor.onDidChangeCursorSelection(() => {
      setEditorSelection(editor.getModel()?.getValueInRange(editor.getSelection()!) ?? '')
    })

    editor.onKeyDown(() => {
      const now = Date.now()
      keystrokesRef.current.push(now)
      keystrokesRef.current = keystrokesRef.current.filter((time) => now - time <= 60000)
      const wpm = Math.round(keystrokesRef.current.length / 5)
      useZenStore.getState().setWpm(wpm)
      if (activeFile) {
        useZenStore.getState().recordFileTouch(activeFile)
      }
    })

    editor.addAction({
      id: 'zen-create-snippet',
      label: 'Create Snippet from Selection',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: async () => {
        const selection = editor.getModel()?.getValueInRange(editor.getSelection()!)
        if (!selection?.trim()) {
          useUIStore.getState().addToast('Select code before creating a snippet.', 'warning')
          return
        }

        const label = await useUIStore.getState().showPrompt('Snippet name:')
        if (!label?.trim()) return

        useSnippetStore.getState().addSnippet({
          id: `snippet-${Date.now()}`,
          label: label.trim(),
          category: 'Custom',
          description: 'Saved from editor selection',
          body: selection,
          placeholders: extractSnippetPlaceholders(selection),
          createdAt: Date.now()
        })
        useUIStore.getState().addToast(`Saved snippet "${label.trim()}"`, 'success')
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
      const previousContent = fileContents[activeFile] ?? ''
      const lineDelta = Math.max(0, value.split('\n').length - previousContent.split('\n').length)
      updateFileContent(activeFile, value)
      if (lineDelta > 0) {
        useZenStore.getState().recordLineChange(lineDelta)
      }
      useZenStore.getState().recordFileTouch(activeFile)
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

  useEffect(() => {
    if (!editorRef.current || !monaco || !activeFile || !pendingLocation) return
    if (pendingLocation.path !== activeFile) return

    const range = new monaco.Range(
      pendingLocation.line,
      pendingLocation.column,
      pendingLocation.line,
      pendingLocation.column
    )
    editorRef.current.setSelection(range)
    editorRef.current.revealLineInCenter(pendingLocation.line)
    editorRef.current.focus()
    clearPendingLocation()
  }, [activeFile, clearPendingLocation, monaco, pendingLocation])

  useEffect(() => {
    if (!monaco || !inlineCompletionEnabled) return

    const aiConfig = resolveAIRequestConfig()
    if (!hasUsableAICredentials(aiConfig)) return

    const provider = {
      provideInlineCompletions: async (
        model: editor.ITextModel,
        position: { lineNumber: number; column: number },
        _context: unknown,
        token: { isCancellationRequested: boolean }
      ) => {
        if (!activeFile) return { items: [] }

        const beforeText = model.getValueInRange(
          new monaco.Range(
            Math.max(1, position.lineNumber - 30),
            1,
            position.lineNumber,
            position.column
          )
        )
        const afterText = model.getValueInRange(
          new monaco.Range(
            position.lineNumber,
            position.column,
            Math.min(model.getLineCount(), position.lineNumber + 20),
            model.getLineMaxColumn(Math.min(model.getLineCount(), position.lineNumber + 20))
          )
        )

        if (beforeText.trim().length < 5) {
          return { items: [] }
        }

        const result = await window.api.ai.complete({
          provider: aiConfig.provider,
          model: aiConfig.model,
          workspaceDir: useFileStore.getState().workspaceDir ?? undefined,
          apiKey: aiConfig.apiKey,
          ollamaUrl: aiConfig.ollamaUrl,
          useGeminiOAuth: aiConfig.useGeminiOAuth,
          systemPrompt:
            'You are an inline code completion engine. Return only the code that should be inserted at the cursor. Do not repeat surrounding context. Do not use markdown fences.',
          prompt:
            `Complete the code at the cursor.\n` +
            `File: ${activeFile}\n` +
            `Language: ${model.getLanguageId()}\n\n` +
            `Before cursor:\n${beforeText}\n\n` +
            `After cursor:\n${afterText}`
        })

        if (token.isCancellationRequested || result.error || !result.text.trim()) {
          return { items: [] }
        }

        const insertText = result.text
          .replace(/^```[a-zA-Z0-9_-]*\s*/g, '')
          .replace(/```$/g, '')
          .trimEnd()

        if (!insertText) {
          return { items: [] }
        }
        return {
          items: [
            {
              insertText,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              )
            }
          ]
        }
      },
      disposeInlineCompletions: () => {}
    }

    const languages = ['typescript', 'javascript', 'json', 'markdown', 'python', 'html', 'css']
    const disposables = languages.map((language) =>
      monaco.languages.registerInlineCompletionsProvider(language, provider)
    )
    return () => {
      disposables.forEach((disposable) => disposable.dispose())
    }
  }, [activeFile, inlineCompletionEnabled, monaco])

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
              className="flex items-center min-w-[120px] max-w-[200px] h-[36px] px-4 cursor-pointer group rounded-none transition-colors relative"
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

