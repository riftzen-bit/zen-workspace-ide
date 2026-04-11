import { useEffect, useMemo, useState } from 'react'
import type { editor } from 'monaco-editor'
import {
  AlertTriangle,
  BadgeInfo,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Wand2,
  Sparkles
} from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import type { ReviewFinding } from '../../types'
import { resolveAIRequestConfig, hasUsableAICredentials } from '../../lib/aiCredentials'
import { joinPath } from '../../lib/pathUtils'

interface CodeReviewPanelProps {
  filePath: string
  staged: boolean
  original: string
  modified: string
  modifiedEditor: editor.IStandaloneCodeEditor | null
  monaco: typeof import('monaco-editor') | null
  onAppliedChange: () => void
}

const SEVERITY_META: Record<
  ReviewFinding['severity'],
  {
    label: string
    color: string
    borderColor: string
    Icon: typeof ShieldAlert
    decorationClass: string
  }
> = {
  critical: {
    label: 'Critical',
    color: '#f87171',
    borderColor: 'rgba(248,113,113,0.24)',
    Icon: ShieldAlert,
    decorationClass: 'review-decoration-critical'
  },
  warning: {
    label: 'Warning',
    color: '#fbbf24',
    borderColor: 'rgba(251,191,36,0.22)',
    Icon: AlertTriangle,
    decorationClass: 'review-decoration-warning'
  },
  info: {
    label: 'Info',
    color: '#60a5fa',
    borderColor: 'rgba(96,165,250,0.22)',
    Icon: BadgeInfo,
    decorationClass: 'review-decoration-info'
  },
  suggestion: {
    label: 'Suggestion',
    color: '#34d399',
    borderColor: 'rgba(52,211,153,0.22)',
    Icon: Sparkles,
    decorationClass: 'review-decoration-suggestion'
  }
}

function replaceLineRange(
  content: string,
  lineStart: number,
  lineEnd: number,
  replacement: string
): string {
  const lines = content.split(/\r?\n/)
  const replacementLines = replacement.replace(/\r\n/g, '\n').split('\n')
  lines.splice(lineStart - 1, Math.max(1, lineEnd - lineStart + 1), ...replacementLines)
  return lines.join('\n')
}

export const CodeReviewPanel = ({
  filePath,
  staged,
  original,
  modified,
  modifiedEditor,
  monaco,
  onAppliedChange
}: CodeReviewPanelProps) => {
  const { workspaceDir, activeFile, updateFileContent, openFiles } = useFileStore()
  const { addToast } = useUIStore()
  const [findings, setFindings] = useState<ReviewFinding[]>([])
  const [summary, setSummary] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const [applyingFindingId, setApplyingFindingId] = useState<string | null>(null)

  const aiConfig = resolveAIRequestConfig()
  const canReview = hasUsableAICredentials(aiConfig)

  useEffect(() => {
    if (!monaco || !modifiedEditor) return

    const decorations = findings.map((finding) => {
      const meta = SEVERITY_META[finding.severity]
      return {
        range: new monaco.Range(finding.lineStart, 1, finding.lineEnd, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: meta.decorationClass,
          className: meta.decorationClass,
          overviewRuler: {
            color: meta.color,
            position: monaco.editor.OverviewRulerLane.Right
          },
          hoverMessage: { value: `**${finding.title}**\n\n${finding.summary}` }
        }
      }
    })

    const collection = modifiedEditor.createDecorationsCollection(decorations)
    return () => {
      collection.clear()
    }
  }, [findings, modifiedEditor, monaco])

  const groupedCounts = useMemo(() => {
    return findings.reduce<Record<ReviewFinding['severity'], number>>(
      (acc, finding) => {
        acc[finding.severity] += 1
        return acc
      },
      { critical: 0, warning: 0, info: 0, suggestion: 0 }
    )
  }, [findings])

  const focusFinding = (finding: ReviewFinding) => {
    if (!modifiedEditor || !monaco) return
    const range = new monaco.Range(finding.lineStart, 1, finding.lineEnd, 1)
    modifiedEditor.revealLineInCenter(finding.lineStart)
    modifiedEditor.setSelection(range)
    modifiedEditor.focus()
  }

  const handleRunReview = async () => {
    if (!workspaceDir) {
      addToast('Open a workspace before running AI review.', 'warning')
      return
    }
    if (!canReview) {
      addToast('Configure your AI provider credentials in Settings first.', 'warning')
      return
    }

    setIsReviewing(true)
    try {
      const result = await window.api.ai.review({
        provider: aiConfig.provider,
        model: aiConfig.model,
        workspaceDir,
        apiKey: aiConfig.apiKey,
        ollamaUrl: aiConfig.ollamaUrl,
        useGeminiOAuth: aiConfig.useGeminiOAuth,
        filePath,
        original,
        modified
      })
      setFindings(result.findings)
      setSummary(result.summary)
      addToast(
        result.findings.length > 0
          ? `Review finished with ${result.findings.length} finding${result.findings.length === 1 ? '' : 's'}`
          : 'Review finished with no findings',
        result.findings.length > 0 ? 'info' : 'success'
      )
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Review failed', 'error')
    } finally {
      setIsReviewing(false)
    }
  }

  const handleApplyFinding = async (finding: ReviewFinding) => {
    if (staged) {
      addToast('Apply suggestion works only for working tree diffs.', 'warning')
      return
    }
    if (!workspaceDir || !finding.replacement) return

    const absolutePath = joinPath(workspaceDir, filePath)
    setApplyingFindingId(finding.id)
    try {
      const latestContent = await window.api.readFile(absolutePath)
      if (latestContent === null) {
        throw new Error('Unable to load the latest file contents.')
      }

      const nextContent = replaceLineRange(
        latestContent,
        finding.lineStart,
        finding.lineEnd,
        finding.replacement
      )
      const saved = await window.api.saveFile(absolutePath, nextContent)
      if (!saved) {
        throw new Error('Failed to save the suggested change.')
      }

      if (openFiles.some((item) => item.path === absolutePath || item.path === filePath)) {
        updateFileContent(activeFile === absolutePath ? absolutePath : absolutePath, nextContent)
      }

      setFindings((current) =>
        current.map((item) =>
          item.id === finding.id
            ? { ...item, canApply: false, suggestion: 'Applied to file.' }
            : item
        )
      )
      onAppliedChange()
      addToast(`Applied suggestion for ${finding.title}`, 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to apply suggestion', 'error')
    } finally {
      setApplyingFindingId(null)
    }
  }

  return (
    <div
      className="w-[340px] shrink-0 border-l flex flex-col bg-[#0A0A0A]"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      <div
        className="px-4 py-3 border-b flex items-center justify-between gap-3"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div>
          <p className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">
            AI Review
          </p>
          <p className="text-[12px] text-zinc-400 mt-1">
            {staged ? 'Index vs HEAD review' : 'Working tree review'}
          </p>
        </div>
        <button
          onClick={handleRunReview}
          disabled={isReviewing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-none text-[12px] font-medium transition-colors"
          style={{
            backgroundColor: canReview ? 'var(--color-accent-glow)' : 'var(--color-surface-4)',
            color: canReview ? 'var(--color-accent-bright)' : 'var(--color-text-muted)',
            border: `1px solid ${canReview ? 'var(--color-border-accent)' : 'var(--color-border-subtle)'}`
          }}
        >
          {isReviewing ? <RefreshCw size={13} className="animate-spin" /> : <Wand2 size={13} />}
          {isReviewing ? 'Reviewing' : findings.length > 0 ? 'Re-run' : 'Run Review'}
        </button>
      </div>

      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <div className="grid grid-cols-2 gap-2">
          {(['critical', 'warning', 'info', 'suggestion'] as const).map((severity) => {
            const meta = SEVERITY_META[severity]
            return (
              <div
                key={severity}
                className="rounded-none px-3 py-2 border"
                style={{
                  borderColor: meta.borderColor,
                  backgroundColor: 'var(--color-surface-3)'
                }}
              >
                <div className="flex items-center gap-2">
                  <meta.Icon size={13} style={{ color: meta.color }} />
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className="text-[18px] font-semibold mt-2 text-zinc-200">
                  {groupedCounts[severity]}
                </p>
              </div>
            )
          })}
        </div>
        <p className="text-[12px] text-zinc-400 mt-3 leading-relaxed">
          {summary || 'Run a review to surface security issues, code smells, and concrete fixes.'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-3 flex flex-col gap-2">
        {findings.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-5">
            <CheckCircle2 size={24} className="text-zinc-600 mb-3" />
            <p className="text-[13px] text-zinc-500">
              {isReviewing ? 'Review in progress...' : 'No findings yet.'}
            </p>
          </div>
        ) : (
          findings.map((finding) => {
            const meta = SEVERITY_META[finding.severity]
            const applying = applyingFindingId === finding.id
            return (
              <div
                key={finding.id}
                className="rounded-none border p-3"
                style={{
                  borderColor: meta.borderColor,
                  backgroundColor: 'var(--color-surface-3)'
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <meta.Icon size={13} style={{ color: meta.color }} />
                      <span
                        className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        L{finding.lineStart}
                        {finding.lineEnd !== finding.lineStart ? `-${finding.lineEnd}` : ''}
                      </span>
                    </div>
                    <p className="text-[13px] text-zinc-200 font-medium mt-2">{finding.title}</p>
                  </div>
                  <button
                    onClick={() => focusFinding(finding)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
                  >
                    Jump
                  </button>
                </div>
                <p className="text-[12px] text-zinc-400 mt-2 leading-relaxed">{finding.summary}</p>
                {finding.suggestion && (
                  <p className="text-[12px] text-zinc-500 mt-2 leading-relaxed">
                    {finding.suggestion}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 mt-3">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                    {finding.canApply && !staged
                      ? 'Quick fix available'
                      : staged
                        ? 'Read-only diff'
                        : 'Review only'}
                  </span>
                  <button
                    onClick={() => handleApplyFinding(finding)}
                    disabled={!finding.canApply || staged || applying}
                    className="px-2.5 py-1.5 rounded-none text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: 'var(--color-accent-glow)',
                      color: 'var(--color-accent-bright)',
                      border: '1px solid var(--color-border-accent)'
                    }}
                  >
                    {applying ? 'Applying...' : 'Apply Suggestion'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
