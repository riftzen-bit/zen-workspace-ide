import { motion } from 'framer-motion'
import { FolderOpen, FilePlus, Terminal, MessageSquare, ChevronRight, Folder } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'
import { useUIStore } from '../../store/useUIStore'
import { useProjectStore } from '../../store/useProjectStore'
import { WeatherTimeWidget } from '../ui/WeatherTimeWidget'

const isMac = navigator.platform.toLowerCase().includes('mac')
const mod = isMac ? '⌘' : 'Ctrl'

const getGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

interface MenuButtonProps {
  icon: any
  title: string
  subtitle: string
  shortcut?: string
  onClick: () => void
  isLast?: boolean
}

function MenuButton({ icon: Icon, title, subtitle, shortcut, onClick, isLast }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center justify-between w-full p-4 hover:bg-white/[0.02] transition-all text-left outline-none focus-visible:bg-white/[0.03] ${
        !isLast ? 'border-b border-white/[0.04]' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.03] text-zinc-400 group-hover:text-zinc-200 transition-colors border border-white/[0.02] shadow-sm">
          <Icon size={16} strokeWidth={1.5} />
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-zinc-200 transition-colors group-hover:text-white">
            {title}
          </span>
          <span className="text-[12px] text-zinc-500 mt-0.5">{subtitle}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {shortcut && (
          <span className="text-[10px] font-mono text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]">
            {shortcut}
          </span>
        )}
        <ChevronRight
          size={14}
          strokeWidth={1.5}
          className="text-zinc-600 group-hover:text-zinc-400 transition-all group-hover:translate-x-0.5 duration-300"
        />
      </div>
    </button>
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
    <div className="h-full w-full relative flex flex-col items-center justify-center overflow-hidden bg-transparent text-zinc-200">
      <WeatherTimeWidget />

      {/* Ultra-minimalist Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        {/* Top radial glow simulating a subtle spotlight */}
        <div
          className="absolute top-[-20%] w-[800px] h-[600px] opacity-30 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%)'
          }}
        />
        {/* Noise overlay for premium texture */}
        <div
          className="absolute inset-0 opacity-[0.015] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")"
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full px-6 max-w-[420px]">
        {/* Header */}
        <motion.div
          className="flex flex-col items-center mb-10 text-center"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 flex items-center justify-center mb-6 shadow-lg shadow-black/50">
            <Terminal size={20} className="text-zinc-200" strokeWidth={1.5} />
          </div>

          <h2 className="text-[12px] font-medium text-zinc-500 tracking-widest uppercase mb-2">
            {greeting}
          </h2>
          <h1 className="text-[28px] font-semibold tracking-tight text-white leading-tight">
            Zen Workspace
          </h1>
          <p className="text-[14px] text-zinc-400 mt-2">Your distraction-free command center</p>
        </motion.div>

        {/* Command Menu */}
        <motion.div
          className="w-full flex flex-col bg-[#0A0A0A] rounded-2xl border border-white/[0.06] shadow-2xl shadow-black/50 overflow-hidden"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <MenuButton
            icon={FolderOpen}
            title="Open Folder"
            subtitle="Select a workspace directory"
            onClick={handleOpenFolder}
          />
          <MenuButton
            icon={FilePlus}
            title="Browse Files"
            subtitle="Explore your project tree"
            shortcut={`${mod} B`}
            onClick={() => {
              setSidebarOpen(true)
              setActiveView('explorer')
            }}
          />
          <MenuButton
            icon={Terminal}
            title="Open Terminal"
            subtitle="Start a local shell session"
            onClick={() => setActiveView('terminal')}
          />
          <MenuButton
            icon={MessageSquare}
            title="AI Assistant"
            subtitle="Chat with your coding partner"
            shortcut={`${mod} I`}
            onClick={() => setChatOpen(true)}
            isLast
          />
        </motion.div>

        {/* Footer Path */}
        {workspaceDir && (
          <motion.div
            className="flex items-center justify-center gap-2 mt-8 text-zinc-500 bg-white/[0.02] border border-white/[0.04] px-3 py-1.5 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Folder size={12} strokeWidth={1.5} />
            <span className="text-[11px] font-mono tracking-tight truncate max-w-[280px]">
              {workspaceDir}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  )
}
