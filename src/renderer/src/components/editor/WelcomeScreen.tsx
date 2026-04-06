import { motion } from 'framer-motion'
import { Code2, FolderOpen, FilePlus, Terminal, MessageSquare, Folder } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { transition } from '../../lib/motion'

const isMac = navigator.platform.toLowerCase().includes('mac')
const mod = isMac ? '⌘' : 'Ctrl'

const shortcuts = [
  { keys: `${mod}+B`, label: 'Toggle Sidebar' },
  { keys: `${mod}+I`, label: 'Toggle Chat' },
  { keys: `${mod}+S`, label: 'Save File' }
]

// Per-card accent tints so they're visually distinct
const cardTints = [
  {
    hover: 'hover:border-amber-500/20 hover:bg-amber-500/[0.03]',
    iconHover: 'group-hover:text-amber-400',
    iconBg: 'group-hover:bg-amber-500/10'
  },
  {
    hover: 'hover:border-sky-500/20 hover:bg-sky-500/[0.03]',
    iconHover: 'group-hover:text-sky-400',
    iconBg: 'group-hover:bg-sky-500/10'
  },
  {
    hover: 'hover:border-violet-500/20 hover:bg-violet-500/[0.03]',
    iconHover: 'group-hover:text-violet-400',
    iconBg: 'group-hover:bg-violet-500/10'
  },
  {
    hover: 'hover:border-emerald-500/20 hover:bg-emerald-500/[0.03]',
    iconHover: 'group-hover:text-emerald-400',
    iconBg: 'group-hover:bg-emerald-500/10'
  }
]

interface QuickAction {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  label: string
  description: string
  onClick: () => void
}

export const WelcomeScreen = () => {
  const { workspaceDir, setWorkspaceDir, setFileTree } = useFileStore()
  const { setActiveView, setSidebarOpen, setChatOpen } = useUIStore()

  const handleOpenFolder = async () => {
    const dirPath = await window.api.openDirectory()
    if (dirPath) {
      setWorkspaceDir(dirPath)
      const tree = await window.api.readDirectory(dirPath)
      setFileTree(tree)
    }
  }

  const actions: QuickAction[] = [
    {
      icon: FolderOpen,
      label: 'Open Folder',
      description: 'Open a workspace',
      onClick: handleOpenFolder
    },
    {
      icon: FilePlus,
      label: 'Browse Files',
      description: 'Explore your project',
      onClick: () => {
        setSidebarOpen(true)
        setActiveView('explorer')
      }
    },
    {
      icon: Terminal,
      label: 'Open Terminal',
      description: 'Start a session',
      onClick: () => setActiveView('terminal')
    },
    {
      icon: MessageSquare,
      label: 'AI Assistant',
      description: 'Chat with Gemini',
      onClick: () => setChatOpen(true)
    }
  ]

  return (
    <div className="h-full w-full relative flex flex-col items-center justify-center overflow-hidden bg-transparent">
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-10 max-w-lg w-full px-6">
        {/* Branding header */}
        <motion.div
          className="flex flex-col items-center gap-5"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="relative group cursor-default">
            <div
              className="w-[72px] h-[72px] rounded-[18px] flex items-center justify-center border transition-all duration-500 ease-out group-hover:-translate-y-1"
              style={{
                background:
                  'linear-gradient(170deg, var(--color-surface-5) 0%, var(--color-surface-3) 100%)',
                borderColor: 'var(--color-border-default)',
                boxShadow: '0 8px 32px -8px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.07)'
              }}
            >
              <Code2
                size={32}
                className="text-zinc-500 transition-colors duration-500 group-hover:text-amber-400"
                strokeWidth={1.4}
              />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-display" style={{ color: 'var(--color-text-primary)' }}>
              Zen Workspace
            </h1>
            <p className="text-caption mt-2" style={{ color: 'var(--color-text-muted)' }}>
              Your distraction-free command center
            </p>
          </div>
        </motion.div>

        {/* Quick action cards — 2-col grid, not all equal emphasis */}
        <motion.div
          className="grid grid-cols-2 gap-2.5 w-full"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: transition.stagger } }}
        >
          {actions.map((action, idx) => {
            const tint = cardTints[idx % cardTints.length]
            return (
              <motion.button
                key={action.label}
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                onClick={action.onClick}
                className={`group relative p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] ${tint.hover} transition-all duration-250 cursor-pointer text-left`}
              >
                <div
                  className={`w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center mb-3 transition-colors duration-250 ${tint.iconBg}`}
                >
                  <action.icon
                    size={16}
                    strokeWidth={1.6}
                    className={`text-zinc-500 transition-colors duration-250 ${tint.iconHover}`}
                  />
                </div>
                <p className="text-body font-semibold text-zinc-300 group-hover:text-zinc-100 transition-colors duration-250">
                  {action.label}
                </p>
                <p className="text-caption text-zinc-600 mt-0.5">{action.description}</p>
              </motion.button>
            )
          })}
        </motion.div>

        {/* Keyboard shortcuts */}
        <motion.div
          className="flex items-center justify-center gap-5 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center gap-2">
              <span
                className="text-mono px-2 py-0.5 rounded-md border"
                style={{
                  backgroundColor: 'var(--color-surface-3)',
                  borderColor: 'var(--color-border-subtle)',
                  color: 'var(--color-text-tertiary)'
                }}
              >
                {s.keys}
              </span>
              <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                {s.label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Workspace path */}
        {workspaceDir && (
          <motion.div
            className="flex items-center gap-2 justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Folder size={11} className="text-zinc-600 shrink-0" strokeWidth={1.5} />
            <span
              className="text-mono truncate max-w-sm"
              style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}
            >
              {workspaceDir}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  )
}
