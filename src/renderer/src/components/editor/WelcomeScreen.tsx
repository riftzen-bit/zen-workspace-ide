import { motion } from 'framer-motion'
import { Code2, FolderOpen, FilePlus, Terminal, MessageSquare, Folder } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { useProjectStore } from '../../store/useProjectStore'
import { transition, ease } from '../../lib/motion'

const isMac = navigator.platform.toLowerCase().includes('mac')
const mod = isMac ? '⌘' : 'Ctrl'

const getGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const getRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

const RecentProjects = () => {
  const projects = useProjectStore((s) => s.projects)
  const { setWorkspaceDir, setFileTree } = useFileStore()
  const { setActiveView, setSidebarOpen } = useUIStore()

  const recent = [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 8)
  if (recent.length === 0) return null

  const handleOpen = async (id: string, path: string) => {
    useProjectStore.getState().setActiveProject(id)
    setWorkspaceDir(path)
    const tree = await window.api.readDirectory(path)
    setFileTree(tree)
    setSidebarOpen(true)
    setActiveView('explorer')
  }

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.4, ease: ease.gentle }}
    >
      <div className="flex items-center gap-3 mb-3">
        <p className="text-label shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          Recent
        </p>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {recent.map((project) => (
          <button
            key={project.id}
            onClick={() => handleOpen(project.id, project.path)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-subtle)'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--color-border-default)'
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'var(--color-surface-3)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--color-border-subtle)'
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'var(--color-surface-2)'
            }}
          >
            <Folder
              size={12}
              strokeWidth={1.5}
              className="shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors"
            />
            <div className="flex-1 min-w-0">
              <p className="text-caption text-zinc-400 group-hover:text-zinc-200 transition-colors truncate font-medium leading-relaxed">
                {project.name}
              </p>
              <p className="text-label" style={{ color: 'var(--color-text-muted)' }}>
                {getRelativeTime(project.lastOpenedAt)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  )
}

export const WelcomeScreen = () => {
  const { workspaceDir, setWorkspaceDir, setFileTree } = useFileStore()
  const { setActiveView, setSidebarOpen, setChatOpen } = useUIStore()

  const handleOpenFolder = async () => {
    const dirPath = await window.api.openDirectory()
    if (dirPath) {
      useProjectStore.getState().addProject(dirPath)
      setWorkspaceDir(dirPath)
      const tree = await window.api.readDirectory(dirPath)
      setFileTree(tree)
    }
  }

  const greeting = getGreeting()

  return (
    <div className="h-full w-full relative flex flex-col items-center justify-center overflow-hidden bg-transparent">
      {/* Dot-grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }}
      />

      {/* Animated gradient blobs */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,160,23,0.065) 0%, transparent 65%)',
          top: '5%',
          left: '-5%',
          filter: 'blur(50px)'
        }}
        animate={{ x: [0, 30, -15, 0], y: [0, -25, 12, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute pointer-events-none"
        style={{
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,154,146,0.05) 0%, transparent 65%)',
          bottom: '5%',
          right: '-5%',
          filter: 'blur(50px)'
        }}
        animate={{ x: [0, -20, 10, 0], y: [0, 18, -8, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      {/* Main content */}
      <div
        className="relative z-10 flex flex-col items-center gap-8 w-full px-6"
        style={{ maxWidth: '520px' }}
      >
        {/* Hero: greeting + branding */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: ease.gentle }}
        >
          {/* Logo with animated glow ring */}
          <div className="relative group cursor-default">
            <motion.div
              className="absolute inset-0 rounded-[22px]"
              animate={{
                boxShadow: [
                  '0 0 0 0px rgba(212,160,23,0.22)',
                  '0 0 0 7px rgba(212,160,23,0)',
                  '0 0 0 0px rgba(212,160,23,0)'
                ]
              }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            />
            <div
              className="w-[72px] h-[72px] rounded-[18px] flex items-center justify-center border transition-all duration-500 ease-out group-hover:-translate-y-1"
              style={{
                background:
                  'linear-gradient(170deg, var(--color-surface-5) 0%, var(--color-surface-3) 100%)',
                borderColor: 'var(--color-border-default)',
                boxShadow:
                  '0 8px 32px -8px rgba(0,0,0,0.7), 0 0 40px -10px rgba(212,160,23,0.1), inset 0 1px 1px rgba(255,255,255,0.07)'
              }}
            >
              <Code2
                size={32}
                className="text-zinc-500 transition-colors duration-500 group-hover:text-amber-400"
                strokeWidth={1.4}
              />
            </div>
          </div>

          {/* Greeting + gradient title */}
          <div className="text-center">
            <p className="text-caption mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              {greeting}
            </p>
            <h1
              className="font-bold tracking-tight"
              style={{
                fontSize: '34px',
                lineHeight: 1.1,
                background: 'linear-gradient(135deg, #f0c040 0%, #d4a017 45%, #e4e4e7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              Zen Workspace
            </h1>
            <p className="text-caption mt-2" style={{ color: 'var(--color-text-muted)' }}>
              Your distraction-free command center
            </p>
          </div>
        </motion.div>

        {/* Bento action grid */}
        <motion.div
          className="grid gap-2.5 w-full"
          style={{ gridTemplateColumns: '1fr 1fr' }}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: transition.stagger } }}
        >
          {/* Open Folder — primary hero card, spans 2 cols */}
          <motion.button
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: ease.gentle }}
            onClick={handleOpenFolder}
            className="group relative p-5 rounded-xl border text-left transition-all duration-300 cursor-pointer"
            style={{
              gridColumn: 'span 2',
              background:
                'linear-gradient(145deg, rgba(212,160,23,0.07) 0%, rgba(212,160,23,0.02) 100%)',
              borderColor: 'rgba(212,160,23,0.18)',
              boxShadow: '0 2px 16px -4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,160,23,0.38)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 4px 24px -4px rgba(212,160,23,0.12), 0 2px 16px -4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,160,23,0.18)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 2px 16px -4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: 'rgba(212,160,23,0.12)' }}
                >
                  <FolderOpen
                    size={20}
                    strokeWidth={1.5}
                    style={{ color: 'var(--color-accent)' }}
                  />
                </div>
                <div>
                  <p className="text-subhead text-zinc-100 group-hover:text-white transition-colors font-semibold">
                    Open Folder
                  </p>
                  <p className="text-caption mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Open a workspace directory
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 group-hover:translate-x-[-2px]"
                style={{
                  backgroundColor: 'rgba(212,160,23,0.1)',
                  border: '1px solid rgba(212,160,23,0.2)',
                  color: 'var(--color-accent)'
                }}
              >
                <span className="text-label font-semibold" style={{ color: 'var(--color-accent)' }}>
                  Browse
                </span>
                <FolderOpen size={13} strokeWidth={2} style={{ color: 'var(--color-accent)' }} />
              </div>
            </div>
          </motion.button>

          {/* Browse Files */}
          <motion.button
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: ease.gentle }}
            onClick={() => {
              setSidebarOpen(true)
              setActiveView('explorer')
            }}
            className="group relative p-4 rounded-xl border border-white/[0.06] text-left transition-all duration-300 cursor-pointer hover:border-sky-500/25 hover:bg-sky-500/[0.04]"
            style={{
              background:
                'linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)',
              boxShadow: '0 2px 8px -2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)'
            }}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] group-hover:bg-sky-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <FilePlus
                  size={16}
                  strokeWidth={1.5}
                  className="text-zinc-500 group-hover:text-sky-400 transition-colors duration-200"
                />
              </div>
              <span
                className="text-mono px-1.5 py-0.5 rounded-md"
                style={{
                  fontSize: '10px',
                  backgroundColor: 'var(--color-surface-3)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border-subtle)'
                }}
              >
                {mod}+B
              </span>
            </div>
            <p className="text-body font-semibold text-zinc-300 group-hover:text-zinc-100 transition-colors duration-200">
              Browse Files
            </p>
            <p className="text-caption text-zinc-600 mt-0.5">Explore your project</p>
          </motion.button>

          {/* Terminal */}
          <motion.button
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: ease.gentle }}
            onClick={() => setActiveView('terminal')}
            className="group relative p-4 rounded-xl border border-white/[0.06] text-left transition-all duration-300 cursor-pointer hover:border-violet-500/25 hover:bg-violet-500/[0.04]"
            style={{
              background:
                'linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)',
              boxShadow: '0 2px 8px -2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)'
            }}
          >
            <div className="mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] group-hover:bg-violet-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <Terminal
                  size={16}
                  strokeWidth={1.5}
                  className="text-zinc-500 group-hover:text-violet-400 transition-colors duration-200"
                />
              </div>
            </div>
            <p className="text-body font-semibold text-zinc-300 group-hover:text-zinc-100 transition-colors duration-200">
              Open Terminal
            </p>
            <p className="text-caption text-zinc-600 mt-0.5">Start a session</p>
          </motion.button>

          {/* AI Assistant — sage accent, spans 2 cols */}
          <motion.button
            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: ease.gentle }}
            onClick={() => setChatOpen(true)}
            className="group relative p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer"
            style={{
              gridColumn: 'span 2',
              background:
                'linear-gradient(145deg, rgba(124,154,146,0.06) 0%, rgba(124,154,146,0.02) 100%)',
              borderColor: 'rgba(124,154,146,0.16)',
              boxShadow: '0 2px 8px -2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124,154,146,0.32)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124,154,146,0.16)'
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: 'rgba(124,154,146,0.1)' }}
              >
                <MessageSquare
                  size={16}
                  strokeWidth={1.5}
                  style={{ color: 'var(--color-secondary)' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-zinc-300 group-hover:text-zinc-100 transition-colors">
                  AI Assistant
                </p>
                <p className="text-caption text-zinc-600">Chat with your AI coding partner</p>
              </div>
              <span
                className="text-mono px-1.5 py-0.5 rounded-md shrink-0"
                style={{
                  fontSize: '10px',
                  backgroundColor: 'rgba(124,154,146,0.08)',
                  color: 'rgba(124,154,146,0.55)',
                  border: '1px solid rgba(124,154,146,0.14)'
                }}
              >
                {mod}+I
              </span>
            </div>
          </motion.button>
        </motion.div>

        {/* Recent Projects */}
        <RecentProjects />

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
              className="text-mono truncate max-w-xs"
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
