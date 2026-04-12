import { memo, useState, useCallback } from 'react'
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
  CheckSquare,
  BarChart3,
  LayoutDashboard,
  Bookmark,
  type LucideIcon
} from 'lucide-react'

type ActivityView =
  | 'explorer'
  | 'search'
  | 'tasks'
  | 'settings'
  | 'terminal'
  | 'orchestrator'
  | 'projects'
  | 'activity'
  | 'git'
  | 'focus'
  | 'bookmarks'

const TOOLTIPS: Partial<Record<ActivityView | 'chat' | 'vibe' | 'zen' | 'palette', string>> = {
  projects: 'Projects',
  explorer: 'Explorer',
  search: 'Search',
  tasks: 'Tasks',
  git: 'Source Control',
  terminal: 'Terminal',
  orchestrator: 'Orchestrator',
  activity: 'Agent Activity',
  bookmarks: 'Bookmarks',
  focus: 'Focus Analytics',
  settings: 'Settings',
  chat: 'Assistant',
  vibe: 'Vibe Player',
  zen: 'Zen Mode  Ctrl+Shift+Z',
  palette: 'Command Palette  Ctrl+K'
}

const IconWrapper = memo(function IconWrapper({
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
}) {
  const [hovered, setHovered] = useState(false)
  const isActive = isActiveOverride !== undefined ? isActiveOverride : view === activeView

  const handleMouseEnter = useCallback(() => setHovered(true), [])
  const handleMouseLeave = useCallback(() => setHovered(false), [])
  const handleClick = useCallback((): void => {
    if (onClick) onClick()
    else if (view) setActiveView(view)
  }, [onClick, view, setActiveView])

  return (
    <div className="relative flex items-center w-full group">
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`relative w-full h-[52px] flex items-center justify-center cursor-pointer transition-none outline-none ${
          isActive
            ? 'bg-[#111111] text-[#eeeeee] border-l-[2px] border-l-[#eeeeee]'
            : 'text-[#666666] border-l-[2px] border-l-transparent hover:bg-[#111111] hover:text-[#cccccc]'
        }`}
      >
        <Icon
          size={20}
          strokeWidth={1}
          className={`transition-transform duration-100 ${!isActive ? 'group-hover:scale-110' : ''}`}
        />
        {badge != null && badge > 0 && (
          <span className="absolute top-2 right-2 min-w-[14px] h-[14px] flex items-center justify-center text-[9px] font-mono bg-[#eeeeee] text-[#050505] px-1">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={transition.tooltip}
            className="absolute left-[calc(100%+8px)] z-50 pointer-events-none whitespace-nowrap"
          >
            <div className="px-3 py-1.5 bg-[#050505] border border-[#222222] shadow-2xl text-[#cccccc] text-[11px] font-mono tracking-wide uppercase">
              {tooltip}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

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
    <div className="w-[52px] h-full flex flex-col justify-between shrink-0 py-0 items-center bg-[#050505] border-r border-[#222222] shadow-none">
      <div className="flex flex-col w-full items-center">
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
          view="tasks"
          tooltip={TOOLTIPS.tasks!}
          Icon={CheckSquare}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          view="terminal"
          tooltip={TOOLTIPS.terminal!}
          Icon={TerminalSquare}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          view="orchestrator"
          tooltip={TOOLTIPS.orchestrator!}
          Icon={LayoutDashboard}
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
        <IconWrapper
          view="bookmarks"
          tooltip={TOOLTIPS.bookmarks!}
          Icon={Bookmark}
          activeView={activeView}
          setActiveView={setActiveView}
        />
      </div>

      <div className="flex flex-col w-full items-center">
        <IconWrapper
          tooltip={TOOLTIPS.palette!}
          Icon={Command}
          activeView={activeView}
          setActiveView={setActiveView}
          onClick={() => setCommandPaletteOpen(true)}
        />
        <IconWrapper
          tooltip={TOOLTIPS.zen!}
          Icon={Maximize2}
          activeView={activeView}
          setActiveView={setActiveView}
          onClick={enterZenMode}
          isActiveOverride={isZenMode}
        />
        <IconWrapper
          tooltip={TOOLTIPS.chat!}
          Icon={Terminal}
          activeView={activeView}
          setActiveView={setActiveView}
          onClick={toggleChat}
          isActiveOverride={isChatOpen}
        />
        <IconWrapper
          tooltip={TOOLTIPS.vibe!}
          Icon={Disc}
          activeView={activeView}
          setActiveView={setActiveView}
          onClick={toggleVibePlayer}
          isActiveOverride={isVibePlayerOpen}
        />
        <IconWrapper
          view="focus"
          tooltip={TOOLTIPS.focus!}
          Icon={BarChart3}
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
