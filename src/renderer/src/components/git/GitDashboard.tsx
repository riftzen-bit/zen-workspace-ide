import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { GitBranch, Sparkles, Check, RefreshCw } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { useSettingsStore } from '../../store/useSettingsStore'

export const GitDashboard = () => {
  const { workspaceDir } = useFileStore()
  const { addToast } = useUIStore()
  const {
    activeProvider,
    modelPerProvider,
    ollamaUrl,
    geminiApiKey,
    openaiApiKey,
    anthropicApiKey,
    groqApiKey,
    geminiOAuthActive
  } = useSettingsStore()

  const provider = activeProvider
  const model = modelPerProvider[provider]

  let apiKey = ''
  if (provider === 'gemini') apiKey = geminiApiKey
  if (provider === 'openai') apiKey = openaiApiKey
  if (provider === 'anthropic') apiKey = anthropicApiKey
  if (provider === 'groq') apiKey = groqApiKey

  const useGeminiOAuth = geminiOAuthActive

  const [branch, setBranch] = useState<string | null>(null)
  const [status, setStatus] = useState<{ staged: boolean; unstaged: boolean }>({
    staged: false,
    unstaged: false
  })
  const [message, setMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  const loadGitState = useCallback(async () => {
    if (!workspaceDir) return
    const b = await window.api.git.branch(workspaceDir)
    setBranch(b)
    if (b) {
      const s = await window.api.git.status(workspaceDir)
      setStatus(s)
    }
  }, [workspaceDir])

  useEffect(() => {
    loadGitState()
    const interval = setInterval(loadGitState, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [loadGitState])

  const handleGenerate = async () => {
    if (!workspaceDir) return

    // Refresh status to be absolutely sure
    const s = await window.api.git.status(workspaceDir)
    setStatus(s)

    if (!s.staged && !s.unstaged) {
      addToast('No changes to commit.', 'info')
      return
    }

    const diff = await window.api.git.diff(workspaceDir, s.staged)
    if (!diff) {
      addToast('Could not retrieve diff or diff is empty.', 'warning')
      return
    }

    if (!provider || !model) {
      addToast('Please select an AI provider and model in Settings.', 'warning')
      return
    }

    setIsGenerating(true)
    setMessage('')

    const prompt = `You are an expert developer. Write a highly concise, conventional commit message for the following git diff. Output ONLY the commit message (no markdown code blocks, no intro, no explanation). If there are multiple changes, provide a concise header line and a bulleted list below it.\n\nDiff:\n${diff.slice(0, 15000)}`

    let generatedText = ''

    const unsubscribe = window.api.ai.onChunk((chunk) => {
      if (chunk.type === 'text' && chunk.text) {
        generatedText += chunk.text
        setMessage(generatedText)
      } else if (chunk.type === 'error') {
        addToast(chunk.error ?? 'Generation failed', 'error')
        setIsGenerating(false)
      } else if (chunk.type === 'done') {
        setIsGenerating(false)
      }
    })

    try {
      await window.api.ai.chat({
        provider,
        model,
        apiKey,
        ollamaUrl,
        useGeminiOAuth,
        messages: [{ role: 'user', content: prompt }]
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      addToast(msg, 'error')
      setIsGenerating(false)
    } finally {
      // Small delay before unregistering listener just in case
      setTimeout(unsubscribe, 500)
    }
  }

  const handleCommit = async () => {
    if (!workspaceDir || !message.trim()) return
    setIsCommitting(true)

    // If nothing is staged, commit will automatically "add all"
    const addAll = !status.staged

    const result = await window.api.git.commit(workspaceDir, message.trim(), addAll)
    if (result.success) {
      addToast('Changes committed successfully.', 'success')
      setMessage('')
      await loadGitState()
    } else {
      addToast(result.error ?? 'Failed to commit', 'error')
    }

    setIsCommitting(false)
  }

  if (!workspaceDir || !branch) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center opacity-50">
        <GitBranch
          size={32}
          strokeWidth={1.2}
          style={{ color: 'var(--color-text-muted)' }}
          className="mb-4"
        />
        <p className="text-caption text-zinc-400">No active git repository</p>
      </div>
    )
  }

  const hasChanges = status.staged || status.unstaged

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Branch Info */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          borderColor: 'var(--color-border-subtle)'
        }}
      >
        <GitBranch size={16} className="text-sky-400" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <p className="text-caption text-zinc-500 mb-0.5">Current Branch</p>
          <p className="text-body font-semibold text-zinc-200 truncate">{branch}</p>
        </div>
        <button
          onClick={loadGitState}
          className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Changes Status */}
      <div className="flex items-center gap-2 px-1">
        <div className={`w-2 h-2 rounded-full ${hasChanges ? 'bg-amber-400' : 'bg-green-400'}`} />
        <p className="text-caption text-zinc-400">
          {hasChanges
            ? status.staged
              ? 'Staged changes ready'
              : 'Unstaged changes'
            : 'Working tree clean'}
        </p>
      </div>

      {/* AI Generate Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleGenerate}
        disabled={!hasChanges || isGenerating || isCommitting}
        className="relative group w-full py-2.5 rounded-lg flex items-center justify-center gap-2 overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background:
            'linear-gradient(135deg, rgba(212,160,23,0.15) 0%, rgba(212,160,23,0.05) 100%)',
          border: '1px solid rgba(212,160,23,0.3)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 via-amber-400/10 to-amber-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
        {isGenerating ? (
          <>
            <RefreshCw size={15} className="animate-spin text-amber-400" />
            <span className="text-[13px] font-bold text-amber-400 tracking-wide uppercase">
              Analyzing Diff...
            </span>
          </>
        ) : (
          <>
            <Sparkles size={15} className="text-amber-400" />
            <span className="text-[13px] font-bold text-amber-400 tracking-wide uppercase">
              AI Auto-Commit
            </span>
          </>
        )}
      </motion.button>

      {/* Message Input */}
      <div className="flex-1 flex flex-col gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message..."
          className="flex-1 w-full bg-transparent border rounded-lg p-3 text-[13px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          style={{
            borderColor: 'var(--color-border-subtle)',
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text-primary)'
          }}
        />

        <button
          onClick={handleCommit}
          disabled={!message.trim() || isCommitting || isGenerating}
          className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: message.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)',
            color: message.trim() ? '#000' : 'var(--color-text-muted)',
            fontWeight: '600',
            fontSize: '13px'
          }}
        >
          {isCommitting ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
          COMMIT {status.staged ? '' : 'ALL'}
        </button>
      </div>
    </div>
  )
}
