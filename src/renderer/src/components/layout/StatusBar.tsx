import { useEffect, useState } from 'react'
import { GitBranch, Zap, DollarSign } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { useTerminalStore } from '../../store/useTerminalStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useChatStore } from '../../store/useChatStore'
import { useCostStore } from '../../store/useCostStore'

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript JSX',
  js: 'JavaScript',
  jsx: 'JavaScript JSX',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  md: 'Markdown',
  py: 'Python',
  rs: 'Rust',
  go: 'Go',
  sh: 'Shell',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  txt: 'Plain Text'
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_MAP[ext] || ext.toUpperCase() || 'Plain Text'
}

const PROVIDER_LABEL: Record<string, string> = {
  gemini: 'Gemini',
  openai: 'GPT',
  anthropic: 'Claude',
  groq: 'Groq',
  ollama: 'Ollama'
}

const DOT_COLORS = ['var(--color-accent)', '#34d399', '#f472b6', '#fb923c', '#a78bfa', '#60a5fa']

const Sep = () => (
  <span className="opacity-20 select-none" style={{ color: 'var(--color-text-muted)' }}>
    |
  </span>
)

export const StatusBar = () => {
  const { activeFile, workspaceDir } = useFileStore()
  const { cursorLine, cursorCol } = useUIStore()
  const { workspaces } = useTerminalStore()
  const { activeProvider, modelPerProvider } = useSettingsStore()
  const { isStreaming } = useChatStore()
  const { totalCost, budgetLimit, warnedAt80, limitTriggered, resetCost } = useCostStore()
  const [gitBranch, setGitBranch] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceDir) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGitBranch(null)
      return
    }
    window.api.git.branch(workspaceDir).then(setGitBranch)
  }, [workspaceDir])

  const activeWorkspaces = workspaces.filter((ws) => ws.status !== 'paused')
  const language = activeFile ? getLanguage(activeFile) : null
  const model = modelPerProvider[activeProvider] ?? ''
  const providerLabel = PROVIDER_LABEL[activeProvider] ?? activeProvider
  const costColor = limitTriggered ? '#f87171' : warnedAt80 ? '#fbbf24' : '#a78bfa'
  const formattedCost =
    budgetLimit !== null && budgetLimit > 0
      ? `${totalCost.toFixed(4)} / ${budgetLimit.toFixed(2)}`
      : totalCost.toFixed(4)

  return (
    <div
      className="h-6 flex items-center justify-between px-4 shrink-0 select-none"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        borderTop: '1px solid var(--color-border-subtle)',
        fontSize: '11px',
        color: 'var(--color-text-muted)'
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        {gitBranch && (
          <span className="flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
            <GitBranch size={10} />
            {gitBranch}
          </span>
        )}
        {gitBranch && language && <Sep />}
        {language && <span style={{ color: 'var(--color-text-tertiary)' }}>{language}</span>}
      </div>

      {/* Center — streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-1.5" style={{ color: 'var(--color-secondary)' }}>
          <Zap size={10} />
          <span>Generating…</span>
        </div>
      )}

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Active workspace dots */}
        {activeWorkspaces.length > 0 && (
          <div className="flex items-center gap-1">
            {activeWorkspaces.slice(0, 6).map((ws, i) => (
              <span
                key={ws.id}
                className="w-1.5 h-1.5 rounded-none"
                style={{ backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }}
                title={ws.name}
              />
            ))}
            {activeWorkspaces.length > 6 && (
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                +{activeWorkspaces.length - 6}
              </span>
            )}
          </div>
        )}

        {activeWorkspaces.length > 0 && <Sep />}

        {/* AI provider + model */}
        <span style={{ color: 'var(--color-text-tertiary)' }}>
          {providerLabel}
          {model ? ` · ${model.split('-').slice(0, 2).join('-')}` : ''}
        </span>

        {activeFile && <Sep />}

        {/* Cursor position */}
        {activeFile && (
          <span style={{ color: 'var(--color-text-tertiary)' }}>
            {cursorLine}:{cursorCol}
          </span>
        )}

        {totalCost > 0 && <Sep />}

        {/* Session cost */}
        {totalCost > 0 && (
          <button
            onClick={resetCost}
            className="flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ color: costColor }}
            title={
              budgetLimit !== null && budgetLimit > 0
                ? 'Session cost vs budget (click to reset)'
                : 'Session cost (click to reset)'
            }
          >
            <DollarSign size={9} />
            <span>{formattedCost}</span>
          </button>
        )}
      </div>
    </div>
  )
}

