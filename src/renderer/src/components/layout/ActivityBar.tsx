import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore } from '../../store/useUIStore'
import { transition } from '../../lib/motion'
import {
  Folder,
  FolderKanban,
  Search,
  TerminalSquare,
  Settings,
  Disc,
  Terminal,
  type LucideIcon
} from 'lucide-react'

type ActivityView = 'explorer' | 'search' | 'settings' | 'terminal' | 'projects'

const TOOLTIPS: Partial<Record<ActivityView | 'chat' | 'vibe', string>> = {
  projects: 'Projects',
  explorer: 'Explorer',
  search: 'Search',
  terminal: 'Terminal',
  settings: 'Settings',
  chat: 'Assistant',
  vibe: 'Vibe Player'
}

const IconWrapper = ({
  view,
  tooltip,
  Icon,
  onClick,
  isActiveOverride,
  activeView,
  setActiveView
}: {
  view?: ActivityView
  tooltip: string
  Icon: LucideIcon
  onClick?: () => void
  isActiveOverride?: boolean
  activeView: string
  setActiveView: (v: ActivityView) => void
}) => {
  const [hovered, setHovered] = useState(false)
  const isActive = isActiveOverride !== undefined ? isActiveOverride : view === activeView

  return (
    <div className="relative flex items-center">
      {/* Active indicator — thin 2px left line */}
      {isActive && (
        <motion.div
          layoutId="activity-indicator"
          className="absolute -left-[12px] w-[2px] h-4 rounded-r-full"
          style={{ backgroundColor: 'var(--color-accent)' }}
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
        className="relative w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors duration-100"
        style={{
          backgroundColor: isActive ? 'var(--color-surface-4)' : undefined,
          color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)'
        }}
      >
        <Icon
          size={18}
          strokeWidth={isActive ? 2 : 1.7}
          style={{
            transition: 'color 130ms, opacity 130ms',
            opacity: hovered && !isActive ? 0.85 : 1,
            color: hovered && !isActive ? 'var(--color-text-secondary)' : undefined
          }}
        />
        {/* Hover bg via pseudo-element via style tag */}
        {hovered && !isActive && (
          <span
            className="absolute inset-0 rounded-xl"
            style={{ backgroundColor: 'var(--color-surface-4)', opacity: 0.7 }}
          />
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
            className="absolute left-[calc(100%+10px)] z-50 pointer-events-none whitespace-nowrap"
          >
            <div
              className="text-mono px-2.5 py-1 rounded-lg"
              style={{
                backgroundColor: 'var(--color-surface-6)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-default)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                fontSize: '11.5px'
              }}
            >
              {tooltip}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const ActivityBar = () => {
  const { activeView, setActiveView, toggleVibePlayer, isVibePlayerOpen, isChatOpen, toggleChat } =
    useUIStore()

  return (
    <div
      className="w-14 h-full rounded-2xl flex flex-col justify-between shrink-0 py-4 items-center overflow-visible"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)'
      }}
    >
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
          view="terminal"
          tooltip={TOOLTIPS.terminal!}
          Icon={Terminal}
          activeView={activeView}
          setActiveView={setActiveView}
        />
      </div>

      <div className="flex flex-col w-full items-center gap-1.5 px-[10px]">
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
