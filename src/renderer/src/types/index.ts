export type FileNode = {
  path: string
  name: string
  isDirectory: boolean
  children?: FileNode[]
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt?: number
  parentId?: string | null
  contextFiles?: Array<{
    path: string
    label: string
    reason: string
  }>
}

export type ReviewSeverity = 'critical' | 'warning' | 'info' | 'suggestion'

export type AgentStatus = 'idle' | 'working' | 'waiting' | 'error' | 'done' | 'paused'

export interface ReviewFinding {
  id: string
  severity: ReviewSeverity
  title: string
  summary: string
  lineStart: number
  lineEnd: number
  suggestion?: string
  replacement?: string
  canApply: boolean
}

export interface ContextFile {
  path: string
  label: string
  reason: string
  content: string
}

export type TodoTag = 'TODO' | 'FIXME' | 'HACK'

export interface WorkspaceTodo {
  id: string
  path: string
  relativePath: string
  name: string
  line: number
  column: number
  tag: TodoTag
  text: string
}

export interface FocusSample {
  timestamp: number
  wpm: number
}

export interface DailyFocusStats {
  date: string
  activeSeconds: number
  focusSessions: number
  maxWpm: number
  totalWpm: number
  sampleCount: number
  filesTouched: string[]
  linesChanged: number
}

export interface CodeSnippet {
  id: string
  label: string
  category: string
  description: string
  body: string
  placeholders: string[]
  builtin?: boolean
  createdAt: number
}
