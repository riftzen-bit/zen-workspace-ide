import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  GitBranch,
  Wand2,
  Check,
  RefreshCw,
  Plus,
  Minus,
  Archive,
  ChevronDown,
  ChevronRight,
  Trash2,
  Download,
  History,
  GitCommit
} from 'lucide-react'
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
  const [stashes, setStashes] = useState<Array<{ index: string; message: string; date: string }>>(
    []
  )
  const [isStashExpanded, setIsStashExpanded] = useState(false)
  const [stashMessage, setStashMessage] = useState('')
  const [isStashing, setIsStashing] = useState(false)
  const [branchList, setBranchList] = useState<
    Array<{ name: string; isCurrent: boolean; isRemote: boolean; lastCommit: string }>
  >([])
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false)
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false)
  const [commitLog, setCommitLog] = useState<
    Array<{
      hash: string
      shortHash: string
      author: string
      email: string
      timestamp: number
      subject: string
    }>
  >([])
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const loadSeqRef = useRef(0)
  const cancelledRef = useRef(false)
  const generateSeqRef = useRef(0)
  const generateUnsubRef = useRef<(() => void) | null>(null)

  const loadGitState = useCallback(async () => {
    if (!workspaceDir) return
    const mySeq = ++loadSeqRef.current
    try {
      const b = await window.api.git.branch(workspaceDir)
      if (cancelledRef.current || mySeq !== loadSeqRef.current) return
      setBranch(b)
      if (!b) return
      const files = await window.api.git.statusFiles(workspaceDir)
      if (cancelledRef.current || mySeq !== loadSeqRef.current) return
      setStagedFiles(files.staged)
      setUnstagedFiles(files.unstaged)
      const stashList = await window.api.git.stashList(workspaceDir)
      if (cancelledRef.current || mySeq !== loadSeqRef.current) return
      setStashes(stashList)
      const branches = await window.api.git.branchList(workspaceDir)
      if (cancelledRef.current || mySeq !== loadSeqRef.current) return
      setBranchList(branches)
      const log = await window.api.git.log(workspaceDir, 50)
      if (cancelledRef.current || mySeq !== loadSeqRef.current) return
      setCommitLog(log)
    } catch {
      // IPC errors swallowed; next interval tick retries
    }
  }, [workspaceDir])

  useEffect(() => {
    cancelledRef.current = false
    const timer = setTimeout(() => void loadGitState(), 0)
    const interval = setInterval(() => void loadGitState(), 5000)
    return () => {
      cancelledRef.current = true
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [loadGitState])

  const handleStashSave = async () => {
    if (!workspaceDir) return
    setIsStashing(true)
    try {
      const result = await window.api.git.stashSave(workspaceDir, stashMessage)
      if (result.success) {
        addToast('Changes stashed successfully', 'success')
        setStashMessage('')
        await loadGitState()
      } else {
        addToast(result.error || 'Failed to stash', 'error')
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to stash', 'error')
    } finally {
      setIsStashing(false)
    }
  }

  const handleStashPop = async (index: string) => {
    if (!workspaceDir) return
    try {
      const result = await window.api.git.stashPop(workspaceDir, index)
      if (result.success) {
        addToast('Stash popped successfully', 'success')
        await loadGitState()
      } else {
        addToast(result.error || 'Failed to pop stash', 'error')
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to pop stash', 'error')
    }
  }

  const handleStashApply = async (index: string) => {
    if (!workspaceDir) return
    try {
      const result = await window.api.git.stashApply(workspaceDir, index)
      if (result.success) {
        addToast('Stash applied successfully', 'success')
        await loadGitState()
      } else {
        addToast(result.error || 'Failed to apply stash', 'error')
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to apply stash', 'error')
    }
  }

  const handleStashDrop = async (index: string) => {
    if (!workspaceDir) return
    try {
      const result = await window.api.git.stashDrop(workspaceDir, index)
      if (result.success) {
        addToast('Stash dropped', 'info')
        await loadGitState()
      } else {
        addToast(result.error || 'Failed to drop stash', 'error')
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to drop stash', 'error')
    }
  }

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

    // Tear down any prior in-flight generation so chunks from an aborted
    // request don't bleed into the new one on rapid re-clicks.
    if (generateUnsubRef.current) {
      generateUnsubRef.current()
      generateUnsubRef.current = null
    }
    const mySeq = ++generateSeqRef.current

    const prompt = `You are an expert developer. Write a highly concise, conventional commit message for the following git diff. Output ONLY the commit message (no markdown code blocks, no intro, no explanation). If there are multiple changes, provide a concise header line and a bulleted list below it.\n\nDiff:\n${diff.slice(0, 15000)}`

    let generatedText = ''

    const unsubscribe = window.api.ai.onChunk((chunk) => {
      if (mySeq !== generateSeqRef.current) return
      if (chunk.type === 'text' && chunk.text) {
        generatedText += chunk.text
        setMessage(generatedText)
      } else if (chunk.type === 'error') {
        addToast(chunk.error ?? 'Generation failed', 'error')
        setIsGenerating(false)
        unsubscribe()
        if (generateUnsubRef.current === unsubscribe) generateUnsubRef.current = null
      } else if (chunk.type === 'done') {
        setIsGenerating(false)
        unsubscribe()
        if (generateUnsubRef.current === unsubscribe) generateUnsubRef.current = null
      }
    })
    generateUnsubRef.current = unsubscribe

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
      unsubscribe()
      if (generateUnsubRef.current === unsubscribe) generateUnsubRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (generateUnsubRef.current) {
        generateUnsubRef.current()
        generateUnsubRef.current = null
      }
    }
  }, [])

  const handleCheckout = async (targetBranch: string) => {
    if (!workspaceDir || targetBranch === branch) {
      setIsBranchMenuOpen(false)
      return
    }
    if (unstagedFiles.length > 0 || stagedFiles.length > 0) {
      addToast('Commit or stash changes before switching branches', 'warning')
      setIsBranchMenuOpen(false)
      return
    }
    setIsCheckingOut(true)
    try {
      const result = await window.api.git.checkout(workspaceDir, targetBranch)
      if (result.success) {
        addToast(`Switched to ${targetBranch}`, 'success')
        await loadGitState()
      } else {
        addToast(result.error || 'Checkout failed', 'error')
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Checkout failed', 'error')
    } finally {
      setIsCheckingOut(false)
      setIsBranchMenuOpen(false)
    }
  }

  const handleCommit = async () => {
    if (!workspaceDir || !message.trim()) return
    setIsCommitting(true)

    const addAll = stagedFiles.length === 0

    try {
      const result = await window.api.git.commit(workspaceDir, message.trim(), addAll)
      if (result.success) {
        addToast('Changes committed successfully.', 'success')
        setMessage('')
        setActiveDiffFile(null)
        await loadGitState()
      } else {
        addToast(result.error ?? 'Failed to commit', 'error')
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to commit', 'error')
    } finally {
      setIsCommitting(false)
    }
  }

  const handleStage = async (file: string) => {
    if (!workspaceDir) return
    try {
      await window.api.git.add(workspaceDir, file)
      await loadGitState()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to stage', 'error')
    }
  }

  const handleUnstage = async (file: string) => {
    if (!workspaceDir) return
    try {
      await window.api.git.unstage(workspaceDir, file)
      await loadGitState()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to unstage', 'error')
    }
  }

  const handleStageAll = async () => {
    if (!workspaceDir) return
    try {
      await window.api.git.add(workspaceDir, '.')
      await loadGitState()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to stage all', 'error')
    }
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
        className="relative flex items-center justify-between px-4 h-12 border-b shrink-0 bg-[#0A0A0A]/50 backdrop-blur-sm"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <button
          onClick={() => setIsBranchMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
          title="Switch branch"
        >
          <GitBranch size={14} className="text-sky-500" strokeWidth={2} />
          <p className="text-[12px] font-semibold tracking-wide text-zinc-300 truncate">{branch}</p>
          <ChevronDown size={12} className="text-zinc-500" />
        </button>
        <button
          onClick={loadGitState}
          className="p-1.5 rounded-none hover:bg-white/[0.04] text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
        {isBranchMenuOpen && (
          <div
            className="absolute top-full left-4 mt-1 w-64 max-h-80 overflow-y-auto bg-[#0A0A0A] border z-20 shadow-lg"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            {branchList.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-zinc-600">No branches</div>
            ) : (
              branchList.map((b) => (
                <button
                  key={b.name}
                  onClick={() => handleCheckout(b.name)}
                  disabled={isCheckingOut}
                  className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-white/[0.04] transition-colors disabled:opacity-50 ${
                    b.isCurrent ? 'text-sky-400' : 'text-zinc-300'
                  }`}
                  title={b.name}
                >
                  <GitBranch size={11} className={b.isRemote ? 'text-zinc-500' : 'text-sky-500'} />
                  <span className="truncate flex-1">{b.name}</span>
                  {b.isCurrent && <Check size={11} />}
                </button>
              ))
            )}
          </div>
        )}
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

          {/* Stash Section */}
          <div className="flex flex-col gap-1 mt-2">
            <button
              onClick={() => setIsStashExpanded(!isStashExpanded)}
              className="flex items-center gap-2 px-1 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider hover:text-zinc-300 transition-colors"
            >
              {isStashExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Archive size={12} />
              <span>Stashes</span>
              {stashes.length > 0 && (
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 rounded">
                  {stashes.length}
                </span>
              )}
            </button>

            {isStashExpanded && (
              <div className="flex flex-col gap-2 pl-2">
                {/* Stash input */}
                {hasChanges && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={stashMessage}
                      onChange={(e) => setStashMessage(e.target.value)}
                      placeholder="Stash message (optional)"
                      className="flex-1 bg-transparent border rounded-none px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      style={{
                        borderColor: 'var(--color-border-subtle)',
                        backgroundColor: 'var(--color-surface-2)'
                      }}
                    />
                    <button
                      onClick={handleStashSave}
                      disabled={isStashing}
                      className="px-2 py-1 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                    >
                      {isStashing ? <RefreshCw size={10} className="animate-spin" /> : 'Stash'}
                    </button>
                  </div>
                )}

                {/* Stash list */}
                {stashes.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {stashes.map((stash) => (
                      <div
                        key={stash.index}
                        className="group flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-none transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-zinc-300 truncate">
                            {stash.message || stash.index}
                          </div>
                          <div className="text-[9px] text-zinc-600">{stash.index}</div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleStashApply(stash.index)}
                            className="p-1 hover:bg-white/10 text-zinc-400 hover:text-green-400 transition-colors"
                            title="Apply stash"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            onClick={() => handleStashPop(stash.index)}
                            className="p-1 hover:bg-white/10 text-zinc-400 hover:text-amber-400 transition-colors"
                            title="Pop stash"
                          >
                            <Archive size={12} />
                          </button>
                          <button
                            onClick={() => handleStashDrop(stash.index)}
                            className="p-1 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                            title="Drop stash"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-600 px-2 py-1">No stashes</div>
                )}
              </div>
            )}
          </div>

          {/* Commit History Section */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="flex items-center gap-2 px-1 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider hover:text-zinc-300 transition-colors"
            >
              {isHistoryExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <History size={12} />
              <span>History</span>
              {commitLog.length > 0 && (
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 rounded">
                  {commitLog.length}
                </span>
              )}
            </button>

            {isHistoryExpanded && (
              <div className="flex flex-col gap-1 pl-2">
                {commitLog.length > 0 ? (
                  commitLog.map((c) => (
                    <div
                      key={c.hash}
                      className="flex items-start gap-2 px-2 py-1.5 hover:bg-white/5 rounded-none transition-colors"
                      title={`${c.author} <${c.email}>\n${new Date(c.timestamp).toLocaleString()}`}
                    >
                      <GitCommit size={11} className="text-zinc-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-zinc-300 truncate">{c.subject}</div>
                        <div className="text-[9px] text-zinc-600 flex items-center gap-2">
                          <span className="font-mono">{c.shortHash}</span>
                          <span className="truncate">{c.author}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-zinc-600 px-2 py-1">No commits</div>
                )}
              </div>
            )}
          </div>
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
