import { useRef, useEffect, useCallback } from 'react'
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useFileStore } from '../../store/useFileStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useUIStore } from '../../store/useUIStore'
import { useZenStore } from '../../store/useZenStore'
import { X } from 'lucide-react'
import { WelcomeScreen } from './WelcomeScreen'
import { HorizontalScroller } from '../layout/HorizontalScroller'
import { useSnippetStore } from '../../store/useSnippetStore'
import { extractSnippetPlaceholders } from '../../lib/snippets'
import { resolveAIRequestConfig, hasUsableAICredentials } from '../../lib/aiCredentials'
import { useEditorTheme } from '../../lib/useEditorTheme'

export const MonacoEditor = () => {
  const {
    activeFile,
    activeSearchQuery,
    pendingLocation,
    openFiles,
    fileContents,
    savedContents,
    updateFileContent,
    closeFile,
    setActiveFile,
    setIsSaving,
    clearPendingLocation,
    setEditorSelection
  } = useFileStore()
  const {
    fontSize,
    wordWrap,
    inlineCompletionEnabled,
    autoSaveEnabled,
    autoSaveInterval,
    editorFontFamily,
    editorLineHeight,
    editorCursorStyle,
    editorMinimapEnabled,
    editorLigaturesEnabled,
    editorRenderWhitespace
  } = useSettingsStore()
  const monaco = useMonaco()
  const editorThemeName = useEditorTheme(monaco)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const keystrokesRef = useRef<number[]>([])
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!monaco) return
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
      const currentFile = useFileStore.getState().activeFile
      if (currentFile) {
        setIsSaving(true)
        const content = editor.getValue()
        try {
          await window.api.saveFile(currentFile, content)
          useFileStore.getState().markFileSaved(currentFile, content)
          const fileName = currentFile.split(/[\\/]/).pop() || currentFile
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
      const currentFile = useFileStore.getState().activeFile
      if (currentFile) {
        useZenStore.getState().recordFileTouch(currentFile)
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

  // Auto-save: debounced save after content changes
  const autoSave = useCallback(
    (filePath: string) => {
      if (!autoSaveEnabled) return
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(async () => {
        const content = useFileStore.getState().fileContents[filePath]
        if (content === undefined) return
        try {
          await window.api.saveFile(filePath, content)
          useFileStore.getState().markFileSaved(filePath, content)
        } catch {
          // silent — manual save still works
        }
      }, autoSaveInterval)
    },
    [autoSaveEnabled, autoSaveInterval]
  )

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && activeFile) {
      const previousContent = fileContents[activeFile] ?? ''
      const lineDelta = Math.max(0, value.split('\n').length - previousContent.split('\n').length)
      updateFileContent(activeFile, value)
      if (lineDelta > 0) {
        useZenStore.getState().recordLineChange(lineDelta)
      }
      useZenStore.getState().recordFileTouch(activeFile)
      autoSave(activeFile)
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

    const provider = {
      provideInlineCompletions: async (
        model: editor.ITextModel,
        position: { lineNumber: number; column: number },
        _context: unknown,
        token: { isCancellationRequested: boolean }
      ) => {
        try {
          const currentFile = useFileStore.getState().activeFile
          if (!currentFile) return { items: [] }

          const aiConfig = resolveAIRequestConfig()
          if (!hasUsableAICredentials(aiConfig)) return { items: [] }

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
              `File: ${currentFile}\n` +
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
        } catch {
          return { items: [] }
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
  }, [inlineCompletionEnabled, monaco])

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
      <HorizontalScroller
        className="shrink-0 border-b"
        scrollerClassName="px-2 pt-2 gap-1"
        style={{ borderColor: 'var(--color-border-subtle)' }}
        step={180}
      >
        {openFiles.map((file) => {
          const isActive = activeFile === file.path
          const buffer = fileContents[file.path]
          const baseline = savedContents[file.path]
          const isDirty = buffer !== undefined && baseline !== undefined && buffer !== baseline
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
              {isDirty && (
                <span
                  className="ml-2 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                  title="Unsaved changes"
                />
              )}
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
      </HorizontalScroller>

      {/* Editor Area */}
      <div className="flex-1 relative bg-transparent">
        {activeFile && (
          <Editor
            height="100%"
            language={getLanguage(activeFile)}
            value={fileContents[activeFile] || ''}
            theme={editorThemeName}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: editorMinimapEnabled },
              fontSize: fontSize || 13,
              fontFamily: `'${editorFontFamily}', 'JetBrains Mono', 'Fira Code', Consolas, monospace`,
              fontLigatures: editorLigaturesEnabled,
              wordWrap: wordWrap ? 'on' : 'off',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              lineHeight: editorLineHeight,
              cursorStyle: editorCursorStyle,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              renderLineHighlight: 'all',
              renderWhitespace: editorRenderWhitespace
            }}
          />
        )}
      </div>
    </div>
  )
}
