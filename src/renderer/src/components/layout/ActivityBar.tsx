import { useUIStore } from '../../store/useUIStore'
import { Folder, Search, TerminalSquare, Settings, Disc, Terminal } from 'lucide-react'

const IconWrapper = ({
  view,
  Icon,
  onClick,
  isActiveOverride,
  activeView,
  setActiveView
}: {
  view?: string
  Icon: any
  onClick?: () => void
  isActiveOverride?: boolean
  activeView: string
  setActiveView: (v: any) => void
}) => {
  const isActive = isActiveOverride !== undefined ? isActiveOverride : view === activeView
  return (
    <button
      onClick={(): void => {
        if (onClick) onClick()
        else if (view) setActiveView(view as any)
      }}
      className={`relative w-12 h-12 rounded-[14px] flex items-center justify-center transition-all duration-300 cursor-pointer group
        ${
          isActive
            ? 'bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.1)]'
            : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
        }
      `}
    >
      <Icon size={22} strokeWidth={1.5} className="group-active:scale-95 transition-transform" />
    </button>
  )
}

export const ActivityBar = () => {
  const { activeView, setActiveView, toggleVibePlayer, isVibePlayerOpen, isChatOpen, toggleChat } =
    useUIStore()

  return (
    <div className="w-16 h-full bg-[#0a0a0b] border border-white/5 rounded-2xl shadow-xl flex flex-col justify-between shrink-0 py-4 items-center">
      <div className="flex flex-col w-full items-center gap-3">
        <IconWrapper
          view="explorer"
          Icon={Folder}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          view="search"
          Icon={Search}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          view="terminal"
          Icon={Terminal}
          activeView={activeView}
          setActiveView={setActiveView}
        />
      </div>

      <div className="flex flex-col w-full items-center gap-3">
        <IconWrapper
          Icon={TerminalSquare}
          onClick={toggleChat}
          isActiveOverride={isChatOpen}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <IconWrapper
          Icon={Disc}
          onClick={toggleVibePlayer}
          isActiveOverride={isVibePlayerOpen}
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <div className="w-6 h-px bg-white/5 my-1 rounded-full" />
        <IconWrapper
          view="settings"
          Icon={Settings}
          activeView={activeView}
          setActiveView={setActiveView}
        />
      </div>
    </div>
  )
}
