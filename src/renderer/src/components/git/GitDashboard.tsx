import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { GitBranch, Wand2, Check, RefreshCw, Plus, Minus } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { useSettingsStore } from '../../store/useSettingsStore'

export const GitDashboard = () => {
  const { workspaceDir } = useFileStore()
  const { addToast, activeDiffFile, setActiveDiffFile } = useUIStore()
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
  if (provider === 'gemini') apiKey = geminiOAuthActive ? '' : geminiApiKey
  if (provider === 'openai') apiKey = openaiApiKey
  if (provider === 'anthropic') apiKey = anthropicApiKey
  if (provider === 'groq') apiKey = groqApiKey

  const useGeminiOAuth = provider === 'gemini' && geminiOAuthActive

  const [branch, setBranch] = useState<string | null>(null)
  const [stagedFiles, setStagedFiles] = useState<{ file: string; status: string }[]>([])
  const [unstagedFiles, setUnstagedFiles] = useState<{ file: string; status: string }[]>([])
  const [message, setMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  const loadGitState = useCallback(async () => {
    if (!workspaceDir) return
    const b = await window.api.git.branch(workspaceDir)
    setBranch(b)
    if (b) {
      const files = await window.api.git.statusFiles(workspaceDir)
      setStagedFiles(files.staged)
      setUnstagedFiles(files.unstaged)
    }
  }, [workspaceDir])

  useEffect(() => {
    loadGitState()
    const interval = setInterval(loadGitState, 5000)
    return () => clearInterval(interval)
  }, [loadGitState])

  const handleGenerate = async () => {
    if (!workspaceDir) return

    const files = await window.api.git.statusFiles(workspaceDir)
    setStagedFiles(files.staged)
    setUnstagedFiles(files.unstaged)

    if (files.staged.length === 0 && files.unstaged.length === 0) {
      addToast('No changes to commit.', 'info')
      return
    }

    const diff = await window.api.git.diff(workspaceDir, files.staged.length > 0)
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
      setTimeout(unsubscribe, 500)
    }
  }

  const handleCommit = async () => {
    if (!workspaceDir || !message.trim()) return
    setIsCommitting(true)

    const addAll = stagedFiles.length === 0

    const result = await window.api.git.commit(workspaceDir, message.trim(), addAll)
    if (result.success) {
      addToast('Changes committed successfully.', 'success')
      setMessage('')
      setActiveDiffFile(null)
      await loadGitState()
    } else {
      addToast(result.error ?? 'Failed to commit', 'error')
    }

    setIsCommitting(false)
  }

  const handleStage = async (file: string) => {
    if (!workspaceDir) return
    await window.api.git.add(workspaceDir, file)
    await loadGitState()
  }

  const handleUnstage = async (file: string) => {
    if (!workspaceDir) return
    await window.api.git.unstage(workspaceDir, file)
    await loadGitState()
  }

  const handleStageAll = async () => {
    if (!workspaceDir) return
    await window.api.git.add(workspaceDir, '.')
    await loadGitState()
  }

  const getStatusColor = (status: string) => {
    if (['M', 'A'].includes(status)) return 'text-green-400'
    if (['D'].includes(status)) return 'text-red-400'
    if (['U', '?'].includes(status)) return 'text-sky-400'
    return 'text-zinc-400'
  }

  if (!workspaceDir || !branch) {
    return (
      <div className="flex flex-col h-full bg-[#050505]">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50 pb-20">
          <div className="w-12 h-12 rounded-none bg-white/[0.02] border border-white/[0.04] shadow-inner flex items-center justify-center mb-1">
            <GitBranch size={20} strokeWidth={1.5} className="text-zinc-500" />
          </div>
          <p className="text-[13px] font-medium tracking-wide text-zinc-500 text-center">
            No active git repository
          </p>
        </div>
      </div>
    )
  }

  const hasChanges = stagedFiles.length > 0 || unstagedFiles.length > 0

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden">
      {/* Branch Info */}
      <div
        className="flex items-center justify-between px-4 h-12 border-b shrink-0 bg-[#0A0A0A]/50 backdrop-blur-sm"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch size={14} className="text-sky-500" strokeWidth={2} />
          <p className="text-[12px] font-semibold tracking-wide text-zinc-300 truncate">{branch}</p>
        </div>
        <button
          onClick={loadGitState}
          className="p-1.5 rounded-none hover:bg-white/[0.04] text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="flex flex-col h-full p-3 gap-3 overflow-hidden">
        {/* File Lists */}
        <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-4">
          {/* Staged Files */}
          {stagedFiles.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between px-1 mb-1">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Staged Changes
                </p>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 rounded">
                  {stagedFiles.length}
                </span>
              </div>
              {stagedFiles.map(({ file, status }) => (
                <div
                  key={`staged-${file}`}
                  onClick={() => setActiveDiffFile({ file, staged: true })}
                  className={`group flex items-center justify-between px-2 py-1.5 rounded-none cursor-pointer transition-colors ${activeDiffFile?.file === file && activeDiffFile?.staged ? 'bg-amber-400/10 border-amber-400/20' : 'hover:bg-white/5 border-transparent'} border`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[10px] font-mono font-bold w-3 text-center ${getStatusColor(status)}`}
                    >
                      {status}
                    </span>
                    <span className="text-body text-zinc-300 truncate" title={file}>
                      {file.split('/').pop()}
                    </span>
                    <span className="text-[10px] text-zinc-600 truncate">
                      {file.split('/').slice(0, -1).join('/')}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnstage(file)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all text-zinc-400"
                    title="Unstage change"
                  >
                    <Minus size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Unstaged Files */}
          {unstagedFiles.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between px-1 mb-1">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Changes
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStageAll}
                    className="text-[10px] text-amber-500 hover:text-amber-400 font-medium"
                  >
                    Stage All
                  </button>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 rounded">
                    {unstagedFiles.length}
                  </span>
                </div>
              </div>
              {unstagedFiles.map(({ file, status }) => (
                <div
                  key={`unstaged-${file}`}
                  onClick={() => setActiveDiffFile({ file, staged: false })}
                  className={`group flex items-center justify-between px-2 py-1.5 rounded-none cursor-pointer transition-colors ${activeDiffFile?.file === file && !activeDiffFile?.staged ? 'bg-amber-400/10 border-amber-400/20' : 'hover:bg-white/5 border-transparent'} border`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[10px] font-mono font-bold w-3 text-center ${getStatusColor(status)}`}
                    >
                      {status}
                    </span>
                    <span className="text-body text-zinc-300 truncate" title={file}>
                      {file.split('/').pop()}
                    </span>
                    <span className="text-[10px] text-zinc-600 truncate">
                      {file.split('/').slice(0, -1).join('/')}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStage(file)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all text-zinc-400"
                    title="Stage change"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!hasChanges && (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 pb-10">
              <Check size={24} className="mb-2" />
              <p className="text-caption">Working tree is clean</p>
            </div>
          )}
        </div>

        {/* Commit Box */}
        <div
          className="shrink-0 flex flex-col gap-2 mt-2 pt-2 border-t"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerate}
            disabled={!hasChanges || isGenerating || isCommitting}
            className="relative group w-full py-2 rounded-none flex items-center justify-center gap-2 overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:
                'linear-gradient(135deg, rgba(212,160,23,0.15) 0%, rgba(212,160,23,0.05) 100%)',
              border: '1px solid rgba(212,160,23,0.3)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 via-amber-400/10 to-amber-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
            {isGenerating ? (
              <>
                <RefreshCw size={13} className="animate-spin text-amber-400" />
                <span className="text-[12px] font-bold text-amber-400 tracking-wide uppercase">
                  Analyzing...
                </span>
              </>
            ) : (
              <>
                <Wand2 size={13} className="text-amber-400" />
                <span className="text-[12px] font-bold text-amber-400 tracking-wide uppercase">
                  AI Message
                </span>
              </>
            )}
          </motion.button>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message..."
            className="w-full h-24 bg-transparent border rounded-none p-2.5 text-[12.5px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            style={{
              borderColor: 'var(--color-border-subtle)',
              backgroundColor: 'var(--color-surface-2)',
              color: 'var(--color-text-primary)'
            }}
          />

          <button
            onClick={handleCommit}
            disabled={!message.trim() || isCommitting || isGenerating}
            className="w-full py-2 rounded-none flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: message.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)',
              color: message.trim() ? '#000' : 'var(--color-text-muted)',
              fontWeight: '600',
              fontSize: '12px'
            }}
          >
            {isCommitting ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            COMMIT {stagedFiles.length === 0 ? 'ALL' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
