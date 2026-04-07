// Strip ANSI escape codes from terminal output
/* eslint-disable no-control-regex */
const ANSI_REGEX =
  /\x1B\[[0-9;]*[A-Za-z]|\x1B\][^\x07]*\x07|\x1B[PX^_][^\x1B]*\x1B\\|\x1B[^@-Z\\-_]/g
/* eslint-enable no-control-regex */

export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '')
}

export type ActivityEventType =
  | 'file_write'
  | 'file_create'
  | 'file_delete'
  | 'error'
  | 'cost'
  | 'task_done'
  | 'permission'

export interface ActivityEvent {
  id: string
  terminalId: string
  type: ActivityEventType
  message: string
  filePath?: string // For file events
  costValue?: string // For cost events
  timestamp: number
}

// File path extraction — capture absolute paths
const PATH_PATTERN = /(?:^|\s)(\/[^\s'")\]>]+)/

function extractPath(line: string): string | undefined {
  const m = line.match(PATH_PATTERN)
  if (m) {
    // Clean trailing punctuation
    return m[1].replace(/[.,;:!?]+$/, '')
  }
  return undefined
}

// Cost extraction — e.g. "$0.0023" or "Total cost: 0.005"
// Requires decimal amount with 2+ decimal places to avoid matching $HOME, $42, etc.
function extractCost(line: string): string | undefined {
  const m = line.match(/(?:^|[\s(=])\$(\d+\.\d{2,})|\bTotal\s+cost[:\s]+[\d.$]+/i)
  return m?.[0]?.trim()
}

interface ParseResult {
  type: ActivityEventType
  message: string
  filePath?: string
  costValue?: string
}

// Returns null if no significant event detected in this line
export function parseLine(line: string): ParseResult | null {
  const clean = stripAnsi(line).trim()
  if (!clean) return null

  const lower = clean.toLowerCase()

  // --- File operations ---
  // Claude CLI: "Wrote to /path", "Updated /path", "Created /path"
  // Codex: "writing /path", "saved /path"
  if (/\b(wrote to|writing to|saved|created file|new file)\b/i.test(clean)) {
    const fp = extractPath(clean)
    return { type: 'file_write', message: clean.slice(0, 120), filePath: fp }
  }
  if (/\b(updated|modified)\b.*\//i.test(clean) && clean.includes('/')) {
    const fp = extractPath(clean)
    return { type: 'file_write', message: clean.slice(0, 120), filePath: fp }
  }
  if (/\b(created|creating)\b.*(file|directory|dir|folder)/i.test(clean)) {
    const fp = extractPath(clean)
    return { type: 'file_create', message: clean.slice(0, 120), filePath: fp }
  }
  if (/\b(deleted|removed|deleting|removing)\b.*\//i.test(clean)) {
    const fp = extractPath(clean)
    return { type: 'file_delete', message: clean.slice(0, 120), filePath: fp }
  }

  // --- Task completion ---
  if (/\b(task complete|all done|all tasks|finished|completed successfully)\b/i.test(clean)) {
    return { type: 'task_done', message: clean.slice(0, 120) }
  }
  // Checkmark completions (Claude CLI output)
  if (/^[✓✔]\s+/u.test(clean) && clean.length < 100) {
    return { type: 'task_done', message: clean.slice(0, 120) }
  }

  // --- Permission / confirmation requests ---
  if (/\b(proceed\?|do you want to|would you like|allow\?|yes\/no|confirm|y\/n)\b/i.test(lower)) {
    return { type: 'permission', message: clean.slice(0, 120) }
  }

  // --- Cost / usage ---
  if (
    /\b(total cost|session cost|tokens? used|api usage)\b/i.test(lower) ||
    /(?:^|[\s(=])\$\d+\.\d{2,}/.test(clean)
  ) {
    const costValue = extractCost(clean)
    return { type: 'cost', message: clean.slice(0, 120), costValue }
  }

  // --- Errors (conservative — avoid false positives) ---
  if (/^(error:|fatal:|npm err!|[✗✘]\s)/iu.test(clean)) {
    return { type: 'error', message: clean.slice(0, 120) }
  }
  if (/\b(FAILED|BUILD FAILED|compilation error)\b/.test(clean)) {
    return { type: 'error', message: clean.slice(0, 120) }
  }

  return null
}

// Per-terminal line buffers (accumulate partial lines until newline)
const lineBuffers: Record<string, string> = {}

let eventCounter = 0

function nextId(): string {
  return `act-${Date.now()}-${++eventCounter}`
}

// Process a chunk of terminal output for a given terminal ID
// Returns array of ActivityEvents detected in this chunk
export function processChunk(terminalId: string, data: string): ActivityEvent[] {
  const events: ActivityEvent[] = []

  // Accumulate into line buffer
  lineBuffers[terminalId] = (lineBuffers[terminalId] ?? '') + data

  // Split on newlines, keeping partial last line in buffer
  const parts = lineBuffers[terminalId].split(/\r?\n/)
  lineBuffers[terminalId] = parts.pop() ?? ''

  for (const line of parts) {
    const result = parseLine(line)
    if (result) {
      events.push({
        id: nextId(),
        terminalId,
        ...result,
        timestamp: Date.now()
      })
    }
  }

  return events
}

export function clearBuffer(terminalId: string): void {
  delete lineBuffers[terminalId]
}
