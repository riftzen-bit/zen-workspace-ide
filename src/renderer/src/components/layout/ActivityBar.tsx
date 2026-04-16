import { memo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore, SidebarGroup } from '../../store/useUIStore'
import { useActivityStore } from '../../store/useActivityStore'
import { transition } from '../../lib/motion'
import {
  FolderKanban,
  Settings,
  Disc,
  Terminal,
  Maximize2,
  Command,
  Files,
  Hammer,
  Bot,
  LineChart,
  type LucideIcon
} from 'lucide-react'

interface GroupDef {
  id: SidebarGroup
  label: string
  icon: LucideIcon
}

const GROUP_DEFS: readonly GroupDef[] = [
  { id: 'files', label: 'Files', icon: Files },
  { id: 'work', label: 'Work', icon: Hammer },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'insights', label: 'Insights', icon: LineChart }
]

const UTILITY_TOOLTIPS = {
  palette: 'Command Palette  Ctrl+K',
  zen: 'Zen Mode  Ctrl+Shift+Z',
  chat: 'Assistant  Ctrl+I',
  vibe: 'Vibe Player',
  settings: 'Settings'
}

const IconButton = memo(function IconButton({
  tooltip,
  Icon,
  onClick,
  isActive,
  badge
}: {
  tooltip: string
  Icon: LucideIcon
  onClick: () => void
  isActive: boolean
  badge?: number
}) {
  const [hovered, setHovered] = useState(false)

  const handleMouseEnter = useCallback(() => setHovered(true), [])
  const handleMouseLeave = useCallback(() => setHovered(false), [])

  return (
    <div className="relative flex items-center w-full group">
      <button
        onClick={onClick}
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
    activeGroup,
    setActiveGroup,
    activeView,
    setActiveView,
    toggleVibePlayer,
    isVibePlayerOpen,
    isChatOpen,
    toggleChat,
    isZenMode,
    enterZenMode,
    exitZenMode,
    setCommandPaletteOpen,
    isSidebarOpen,
    toggleSidebar
  } = useUIStore()
  const { unreadCount } = useActivityStore()

  const groupBadge = (id: SidebarGroup): number | undefined => {
    if (id === 'work') return unreadCount
    return undefined
  }

  const handleGroupClick = (id: SidebarGroup) => {
    if (activeGroup === id && isSidebarOpen && (id === 'files' || id === 'work')) {
      toggleSidebar()
      return
    }
    setActiveGroup(id)
    if (!isSidebarOpen && (id === 'files' || id === 'work')) {
      toggleSidebar()
    }
  }

  const isSettingsActive = activeView === 'settings'

  return (
    <div className="w-[52px] h-full flex flex-col justify-between shrink-0 py-0 items-center bg-[#050505] border-r border-[#222222] shadow-none">
      <div className="flex flex-col w-full items-center">
        {GROUP_DEFS.map((g) => (
          <IconButton
            key={g.id}
            tooltip={g.label}
            Icon={g.icon}
            onClick={() => handleGroupClick(g.id)}
            isActive={activeGroup === g.id && !isSettingsActive}
            badge={groupBadge(g.id)}
          />
        ))}
      </div>

      <div className="flex flex-col w-full items-center">
        <IconButton
          tooltip={UTILITY_TOOLTIPS.palette}
          Icon={Command}
          onClick={() => setCommandPaletteOpen(true)}
          isActive={false}
        />
        <IconButton
          tooltip={UTILITY_TOOLTIPS.zen}
          Icon={Maximize2}
          onClick={isZenMode ? exitZenMode : enterZenMode}
          isActive={isZenMode}
        />
        <IconButton
          tooltip={UTILITY_TOOLTIPS.chat}
          Icon={Terminal}
          onClick={toggleChat}
          isActive={isChatOpen}
        />
        <IconButton
          tooltip={UTILITY_TOOLTIPS.vibe}
          Icon={Disc}
          onClick={toggleVibePlayer}
          isActive={isVibePlayerOpen}
        />
        <IconButton
          tooltip="Projects Shortcut"
          Icon={FolderKanban}
          onClick={() => setActiveView('projects')}
          isActive={activeView === 'projects'}
        />
        <IconButton
          tooltip={UTILITY_TOOLTIPS.settings}
          Icon={Settings}
          onClick={() => setActiveView('settings')}
          isActive={isSettingsActive}
        />
      </div>
    </div>
  )
}
