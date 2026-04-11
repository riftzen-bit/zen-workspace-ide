import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Sparkles, Plus, X, Trash2, Wand2 } from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useSnippetStore } from '../../store/useSnippetStore'
import type { CodeSnippet } from '../../types'
import { extractSnippetPlaceholders, resolveSnippetBody } from '../../lib/snippets'
import { resolveAIRequestConfig, hasUsableAICredentials } from '../../lib/aiCredentials'
import { useFileStore } from '../../store/useFileStore'
import { transition } from '../../lib/motion'

const BUILTIN_SNIPPETS: CodeSnippet[] = [
  {
    id: 'builtin-react-hook',
    label: 'React Data Hook',
    category: 'React',
    description: 'Fetch data with loading and error states.',
    body:
      "import { useEffect, useState } from 'react'\n\nexport function use${resourceName}() {\n  const [data, setData] = useState<${resourceType} | null>(null)\n  const [loading, setLoading] = useState(true)\n  const [error, setError] = useState<string | null>(null)\n\n  useEffect(() => {\n    let cancelled = false\n\n    async function load() {\n      try {\n        setLoading(true)\n        setError(null)\n        const result = await ${fetchCall}\n        if (!cancelled) {\n          setData(result)\n        }\n      } catch (err) {\n        if (!cancelled) {\n          setError(err instanceof Error ? err.message : 'Unknown error')\n        }\n      } finally {\n        if (!cancelled) {\n          setLoading(false)\n        }\n      }\n    }\n\n    void load()\n    return () => {\n      cancelled = true\n    }\n  }, [])\n\n  return { data, loading, error }\n}\n",
    placeholders: ['resourceName', 'resourceType', 'fetchCall'],
    builtin: true,
    createdAt: 0
  },
  {
    id: 'builtin-vitest',
    label: 'Vitest Suite',
    category: 'Testing',
    description: 'A focused unit test file starter.',
    body:
      "import { describe, it, expect } from 'vitest'\nimport { ${symbolName} } from '${importPath}'\n\ndescribe('${symbolName}', () => {\n  it('behaves as expected', () => {\n    const result = ${symbolName}(${callArgs})\n    expect(result).toEqual(${expectedValue})\n  })\n})\n",
    placeholders: ['symbolName', 'importPath', 'callArgs', 'expectedValue'],
    builtin: true,
    createdAt: 0
  }
]

function mergeSnippetCollections(customSnippets: CodeSnippet[]): CodeSnippet[] {
  return [...BUILTIN_SNIPPETS, ...customSnippets]
}

export const SnippetLibrary = () => {
  const { isSnippetLibraryOpen, setSnippetLibraryOpen, addToast } = useUIStore()
  const { customSnippets, addSnippet, removeSnippet } = useSnippetStore()
  const { activeFile, updateFileContent } = useFileStore()
  const [query, setQuery] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newBody, setNewBody] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const snippets = useMemo(() => mergeSnippetCollections(customSnippets), [customSnippets])
  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase()
    if (!lower) return snippets
    return snippets.filter(
      (snippet) =>
        snippet.label.toLowerCase().includes(lower) ||
        snippet.category.toLowerCase().includes(lower) ||
        snippet.description.toLowerCase().includes(lower)
    )
  }, [query, snippets])

  if (!isSnippetLibraryOpen) return null

  const handleSaveSnippet = () => {
    if (!newLabel.trim() || !newBody.trim()) return
    addSnippet({
      id: `snippet-${Date.now()}`,
      label: newLabel.trim(),
      category: 'Custom',
      description: newDescription.trim() || 'Custom snippet',
      body: newBody,
      placeholders: extractSnippetPlaceholders(newBody),
      createdAt: Date.now()
    })
    setNewLabel('')
    setNewDescription('')
    setNewBody('')
    setIsAdding(false)
  }

  const handleInsertSnippet = async (snippet: CodeSnippet) => {
    if (!activeFile) {
      addToast('Open a file before inserting a snippet.', 'warning')
      return
    }

    const values: Record<string, string> = {}
    for (const placeholder of snippet.placeholders) {
      const value = await useUIStore.getState().showPrompt(`Value for ${placeholder}:`, placeholder)
      if (value === null) return
      values[placeholder] = value
    }

    const resolved = resolveSnippetBody(snippet, values)
    const { fileContents } = useFileStore.getState()
    const existing = fileContents[activeFile] ?? (await window.api.readFile(activeFile)) ?? ''
    const nextContent = existing.endsWith('\n') ? `${existing}${resolved}` : `${existing}\n${resolved}`
    updateFileContent(activeFile, nextContent)
    setSnippetLibraryOpen(false)
    addToast(`Inserted ${snippet.label}`, 'success')
  }

  const handleGenerateSnippet = async () => {
    const prompt = await useUIStore
      .getState()
      .showPrompt('Describe the snippet you want to generate:', 'Create a reusable React hook')
    if (!prompt?.trim()) return

    const aiConfig = resolveAIRequestConfig()
    if (!hasUsableAICredentials(aiConfig)) {
      addToast('Configure AI credentials in Settings first.', 'warning')
      return
    }

    setIsGenerating(true)
    try {
      const result = await window.api.ai.complete({
        provider: aiConfig.provider,
        model: aiConfig.model,
        workspaceDir: useFileStore.getState().workspaceDir ?? undefined,
        apiKey: aiConfig.apiKey,
        ollamaUrl: aiConfig.ollamaUrl,
        useGeminiOAuth: aiConfig.useGeminiOAuth,
        systemPrompt:
          'Generate a reusable code snippet. Return JSON only with keys label, description, category, and body. Use ${placeholderName} for inputs that should be customized.',
        prompt
      })

      if (result.error) {
        throw new Error(result.error)
      }

      const payloadMatch = result.text.match(/\{[\s\S]*\}$/)
      const payload = payloadMatch ? JSON.parse(payloadMatch[0]) : null
      if (!payload || typeof payload.body !== 'string' || typeof payload.label !== 'string') {
        throw new Error('The AI returned an invalid snippet format.')
      }

      const body = payload.body.trimEnd() + '\n'
      addSnippet({
        id: `snippet-${Date.now()}`,
        label: payload.label.trim(),
        category: typeof payload.category === 'string' ? payload.category.trim() || 'Custom' : 'Custom',
        description:
          typeof payload.description === 'string' ? payload.description.trim() || 'AI generated snippet' : 'AI generated snippet',
        body,
        placeholders: extractSnippetPlaceholders(body),
        createdAt: Date.now()
      })
      addToast(`Generated ${payload.label}`, 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to generate snippet', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition.fade}
        className="fixed inset-0 z-[9998] flex items-start justify-center pt-[10vh]"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSnippetLibraryOpen(false)
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -8 }}
          transition={transition.overlay}
          className="w-full max-w-3xl flex flex-col overflow-hidden rounded-none"
          style={{
            backgroundColor: 'var(--color-surface-3)',
            border: '1px solid var(--color-border-default)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
            maxHeight: '78vh'
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
            style={{
              borderColor: 'var(--color-border-subtle)',
              backgroundColor: 'var(--color-surface-2)'
            }}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles size={15} style={{ color: 'var(--color-accent-bright)' }} />
              <span className="text-body font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Snippet Library
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleGenerateSnippet} className="btn-ghost px-3 py-1.5 text-body" disabled={isGenerating}>
                <span className="inline-flex items-center gap-1.5">
                  <Wand2 size={13} />
                  {isGenerating ? 'Generating...' : 'Generate'}
                </span>
              </button>
              <button onClick={() => setIsAdding((current) => !current)} className="btn-ghost px-3 py-1.5 text-body">
                <span className="inline-flex items-center gap-1.5">
                  <Plus size={13} />
                  Add
                </span>
              </button>
              <button onClick={() => setSnippetLibraryOpen(false)} className="btn-ghost p-1.5">
                <X size={15} />
              </button>
            </div>
          </div>

          <div
            className="px-4 py-2.5 border-b shrink-0"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2"
                size={13}
                style={{ color: 'var(--color-text-muted)' }}
              />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search snippets..."
                className="input-field w-full"
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          {isAdding && (
            <div
              className="p-4 border-b flex flex-col gap-2 shrink-0"
              style={{
                borderColor: 'var(--color-border-subtle)',
                backgroundColor: 'var(--color-surface-2)'
              }}
            >
              <input
                type="text"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="Snippet name"
                className="input-field w-full"
              />
              <input
                type="text"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Description"
                className="input-field w-full"
              />
              <textarea
                value={newBody}
                onChange={(event) => setNewBody(event.target.value)}
                placeholder="Snippet body. Use ${placeholderName} for variables."
                className="input-field w-full resize-none"
                rows={6}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsAdding(false)} className="btn-ghost px-3 py-1.5 text-body">
                  Cancel
                </button>
                <button onClick={handleSaveSnippet} className="btn-primary">
                  Save Snippet
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto hide-scrollbar p-4 grid grid-cols-1 gap-3">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center text-zinc-500 text-body py-12">
                No snippets found.
              </div>
            ) : (
              filtered.map((snippet) => (
                <div
                  key={snippet.id}
                  className="rounded-none border p-4"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    borderColor: 'var(--color-border-subtle)'
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-zinc-200">{snippet.label}</span>
                        <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                          {snippet.category}
                        </span>
                      </div>
                      <p className="text-[12px] text-zinc-500 mt-1">{snippet.description}</p>
                    </div>
                    {!snippet.builtin && (
                      <button
                        onClick={() => removeSnippet(snippet.id)}
                        className="btn-ghost-danger p-1.5"
                        title="Delete snippet"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <pre className="mt-3 text-[11px] text-zinc-400 whitespace-pre-wrap overflow-hidden rounded-none border border-white/[0.04] bg-black/20 p-3">
                    {snippet.body}
                  </pre>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                      {snippet.placeholders.length > 0
                        ? `${snippet.placeholders.length} placeholder${snippet.placeholders.length === 1 ? '' : 's'}`
                        : 'Ready to insert'}
                    </span>
                    <button onClick={() => handleInsertSnippet(snippet)} className="btn-primary">
                      Insert
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
