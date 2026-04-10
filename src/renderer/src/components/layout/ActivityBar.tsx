import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore } from '../../store/useUIStore'
import { useActivityStore } from '../../store/useActivityStore'
import { transition } from '../../lib/motion'
import {
  Folder,
  FolderKanban,
  Search,
  TerminalSquare,
  Settings,
  Disc,
  Terminal,
  Maximize2,
  Command,
  Activity,
  GitBranch,
  type LucideIcon
} from 'lucide-react'

type ActivityView =
  | 'explorer'
  | 'search'
  | 'settings'
  | 'terminal'
  | 'projects'
  | 'activity'
  | 'git'

const TOOLTIPS: Partial<Record<ActivityView | 'chat' | 'vibe' | 'zen' | 'palette', string>> = {
  projects: 'Projects',
  explorer: 'Explorer',
  search: 'Search',
  git: 'Source Control',
  terminal: 'Terminal',
  activity: 'Agent Activity',
  settings: 'Settings',
  chat: 'Assistant',
  vibe: 'Vibe Player',
  zen: 'Zen Mode  Ctrl+Shift+Z',
  palette: 'Command Palette  Ctrl+K'
}

const IconWrapper = ({
  view,
  tooltip,
  Icon,
  onClick,
  isActiveOverride,
  activeView,
  setActiveView,
  badge
}: {
  view?: ActivityView
  tooltip: string
  Icon: LucideIcon
  onClick?: () => void
  isActiveOverride?: boolean
  activeView: string
  setActiveView: (v: ActivityView) => void
  badge?: number
}) => {
  const [hovered, setHovered] = useState(false)
  const isActive = isActiveOverride !== undefined ? isActiveOverride : view === activeView

  return (
    <div className="relative flex items-center">
      {/* Active indicator — thin 2px left line */}
      {isActive && (
        <motion.div
          layoutId="activity-indicator"
          className="absolute -left-[12px] w-[2px] h-5 rounded-r-full bg-[#EAB308] shadow-[0_0_8px_rgba(234,179,8,0.5)]"
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
        />
      )}

      <button
        onClick={(): void => {
          if (onClick) onClick()
          else if (view) setActiveView(view)
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative w-9 h-9 rounded-[10px] flex items-center justify-center cursor-pointer transition-all duration-200 ${
          isActive
            ? 'bg-white/[0.06] text-white shadow-sm border border-white/[0.04]'
            : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
        }`}
      >
        <Icon
          size={18}
          strokeWidth={isActive ? 2 : 1.5}
          className={`transition-all duration-200 ${hovered && !isActive ? 'scale-110' : ''}`}
        />
        {/* Unread badge */}
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[9px] font-bold bg-[#EAB308] text-black px-1 shadow-[0_0_8px_rgba(234,179,8,0.5)]">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {/* Tooltip — snappy easing */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={transition.tooltip}
            className="absolute left-[calc(100%+14px)] z-50 pointer-events-none whitespace-nowrap"
          >
            <div className="px-2.5 py-1.5 rounded-lg bg-[#0A0A0A] border border-white/[0.06] shadow-xl text-zinc-300 text-[11.5px] font-medium tracking-wide">
              {tooltip}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const ActivityBar = () => {
  const {
    activeView,
    setActiveView,
    toggleVibePlayer,
    isVibePlayerOpen,
    isChatOpen,
    toggleChat,
    isZenMode,
    enterZenMode,
    setCommandPaletteOpen
  } = useUIStore()
  const { unreadCount } = useActivityStore()

  return (
    <div className="w-[52px] h-full rounded-2xl flex flex-col justify-between shrink-0 py-4 items-center bg-[#050505] border border-white/[0.06] shadow-xl shadow-black/50">
      <div className="flex flex-col w-full items-center gap-1.5 px-[10px]">
        <IconWrapper
          view="projects"
          tooltip={TOOLTIPS.projects!}
          Icon={FolderKanban}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          view="explorer"
          tooltip={TOOLTIPS.explorer!}
          Icon={Folder}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          view="search"
          tooltip={TOOLTIPS.search!}
          Icon={Search}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          view="git"
          tooltip={TOOLTIPS.git!}
          Icon={GitBranch}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          view="terminal"
          tooltip={TOOLTIPS.terminal!}
          Icon={Terminal}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          view="activity"
          tooltip={TOOLTIPS.activity!}
          Icon={Activity}
          activeView={activeView}
          setActiveView={setActiveView}
          badge={unreadCount}
        />
      </div>

      <div className="flex flex-col w-full items-center gap-1.5 px-[10px]">
        <IconWrapper
          tooltip={TOOLTIPS.palette!}
          Icon={Command}
          onClick={() => setCommandPaletteOpen(true)}
          isActiveOverride={false}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          tooltip={TOOLTIPS.chat!}
          Icon={TerminalSquare}
          onClick={toggleChat}
          isActiveOverride={isChatOpen}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          tooltip={TOOLTIPS.vibe!}
          Icon={Disc}
          onClick={toggleVibePlayer}
          isActiveOverride={isVibePlayerOpen}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <div
          className="w-6 h-px my-1 rounded-full"
          style={{ backgroundColor: 'var(--color-border-subtle)' }}
        />
        <IconWrapper
          tooltip={TOOLTIPS.zen!}
          Icon={Maximize2}
          onClick={() => enterZenMode()}
          isActiveOverride={isZenMode}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          view="settings"
          tooltip={TOOLTIPS.settings!}
          Icon={Settings}
          activeView={activeView}
          setActiveView={setActiveView}
        />
      </div>
    </div>
  )
}
