import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileEdit,
  FilePlus,
  FileX,
  AlertCircle,
  DollarSign,
  CheckCircle2,
  ShieldQuestion,
  Trash2,
  FolderOpen,
  LucideIcon
} from 'lucide-react'
import { useActivityStore, ActivityEvent, ActivityEventType } from '../../store/useActivityStore'
import { useTerminalStore } from '../../store/useTerminalStore'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { transition } from '../../lib/motion'

const EVENT_CONFIG: Record<ActivityEventType, { label: string; color: string; Icon: LucideIcon }> =
  {
    file_write: { label: 'Wrote', color: 'var(--color-accent)', Icon: FileEdit },
    file_create: { label: 'Created', color: '#34d399', Icon: FilePlus },
    file_delete: { label: 'Deleted', color: '#f87171', Icon: FileX },
    error: { label: 'Error', color: '#f87171', Icon: AlertCircle },
    cost: { label: 'Cost', color: '#a78bfa', Icon: DollarSign },
    task_done: { label: 'Done', color: '#34d399', Icon: CheckCircle2 },
    permission: { label: 'Waiting', color: '#fbbf24', Icon: ShieldQuestion }
  }

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function getWorkspaceName(terminalId: string): string {
  const { workspaces } = useTerminalStore.getState()
  for (const ws of workspaces) {
    if (ws.terminals.some((t) => t.id === terminalId)) return ws.name
  }
  return 'Terminal'
}

const ActivityItem = ({ event }: { event: ActivityEvent }) => {
  const config = EVENT_CONFIG[event.type as ActivityEventType]
  if (!config) return null
  const { Icon, color, label } = config

  const workspaceName = getWorkspaceName(event.terminalId)
  const displayMessage = event.filePath
    ? event.filePath.split('/').pop() || event.filePath
    : event.message.replace(/^[✓✔✗✘]\s+/u, '')

  const handleClick = async () => {
    if (event.filePath) {
      const content = await window.api.readFile(event.filePath)
      if (content !== null) {
        const name = event.filePath.split('/').pop() || event.filePath
        useFileStore.getState().openFile(event.filePath, name, content)
        useUIStore.getState().setActiveView('explorer')
      }
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={transition.micro}
      onClick={event.filePath ? handleClick : undefined}
      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${event.filePath ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: 'var(--color-surface-3)',
        borderColor: 'var(--color-border-subtle)'
      }}
      onMouseEnter={
        event.filePath
          ? (e) => {
              ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-hover)'
              ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-surface-4)'
            }
          : undefined
      }
      onMouseLeave={
        event.filePath
          ? (e) => {
              ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-subtle)'
              ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-surface-3)'
            }
          : undefined
      }
    >
      <div className="shrink-0 mt-0.5">
        <Icon size={13} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-label font-semibold" style={{ color }}>
            {label}
          </span>
          <span className="text-label" style={{ color: 'var(--color-text-muted)' }}>
            {workspaceName}
          </span>
        </div>
        <p
          className="text-caption truncate"
          style={{ color: 'var(--color-text-secondary)' }}
          title={event.filePath || event.message}
        >
          {displayMessage}
        </p>
        {event.costValue && (
          <p className="text-label mt-0.5" style={{ color: '#a78bfa' }}>
            {event.costValue}
          </p>
        )}
      </div>
      <span
        className="text-label shrink-0"
        style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}
      >
        {formatTime(event.timestamp)}
      </span>
    </motion.div>
  )
}

export const ActivityFeed = () => {
  const { events, unreadCount, clearEvents, markAllRead } = useActivityStore()

  // Mark as read when panel is open
  useEffect(() => {
    if (unreadCount > 0) markAllRead()
  }, [unreadCount, markAllRead])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="h-11 px-4 flex items-center justify-between border-b shrink-0"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <span className="text-label" style={{ color: 'var(--color-text-muted)' }}>
          Activity
        </span>
        {events.length > 0 && (
          <button onClick={clearEvents} className="btn-ghost p-1" title="Clear all">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-2 flex flex-col gap-1.5">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 mt-16 opacity-50">
            <FolderOpen size={24} strokeWidth={1.4} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-caption text-center" style={{ color: 'var(--color-text-muted)' }}>
              Agent activity will appear here
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((event) => (
              <ActivityItem key={event.id} event={event} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
