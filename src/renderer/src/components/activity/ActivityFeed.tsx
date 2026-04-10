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
  Folder,
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
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Header */}
      <div
        className="h-12 px-4 flex items-center justify-between border-b shrink-0 bg-[#0A0A0A]/50 backdrop-blur-sm"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">
          Activity
        </span>
        {events.length > 0 && (
          <button
            onClick={clearEvents}
            className="btn-ghost p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
            title="Clear all"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-3 flex flex-col gap-2">
        {events.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50 pb-20">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.04] shadow-inner flex items-center justify-center mb-1">
              <Folder size={20} strokeWidth={1.2} className="text-zinc-500" />
            </div>
            <p className="text-[13px] font-medium tracking-wide text-zinc-500 text-center">
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
