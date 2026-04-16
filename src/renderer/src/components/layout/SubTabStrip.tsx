import { memo, useEffect, useRef } from 'react'
import { type LucideIcon } from 'lucide-react'
import { ActivityView } from '../../store/useUIStore'
import { HorizontalScroller } from './HorizontalScroller'

export interface SubTab {
  id: ActivityView
  label: string
  icon: LucideIcon
  badge?: number
}

interface SubTabStripProps {
  tabs: readonly SubTab[]
  activeTab: ActivityView
  onSelect: (tab: ActivityView) => void
}

export const SubTabStrip = memo(function SubTabStrip({
  tabs,
  activeTab,
  onSelect
}: SubTabStripProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const scroller = container.querySelector<HTMLDivElement>('.hide-scrollbar')
    if (!scroller) return
    const activeEl = scroller.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`)
    if (!activeEl) return
    const left = activeEl.offsetLeft
    const right = left + activeEl.offsetWidth
    const viewLeft = scroller.scrollLeft
    const viewRight = viewLeft + scroller.clientWidth
    if (left < viewLeft) {
      scroller.scrollTo({ left: left - 8, behavior: 'smooth' })
    } else if (right > viewRight) {
      scroller.scrollTo({ left: right - scroller.clientWidth + 8, behavior: 'smooth' })
    }
  }, [activeTab])

  return (
    <div
      ref={containerRef}
      className="flex items-stretch h-9 shrink-0 border-b bg-[#050505]"
      style={{ borderColor: '#222222' }}
    >
      <HorizontalScroller className="h-full flex-1" step={120} buttonBorderColor="#222222">
        {tabs.map((t) => {
          const active = activeTab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              data-tab-id={t.id}
              onClick={() => onSelect(t.id)}
              className={`relative flex items-center gap-1.5 px-3 h-full text-[11px] font-medium tracking-wider uppercase transition-colors shrink-0 ${
                active
                  ? 'text-zinc-100 bg-[#0f0f0f]'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
              }`}
              title={t.label}
            >
              <Icon size={13} strokeWidth={1.5} />
              <span>{t.label}</span>
              {t.badge != null && t.badge > 0 && (
                <span className="ml-1 min-w-[14px] h-[14px] px-1 flex items-center justify-center text-[9px] font-mono bg-[#eeeeee] text-[#050505]">
                  {t.badge > 99 ? '99+' : t.badge}
                </span>
              )}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-100"
                  aria-hidden
                />
              )}
            </button>
          )
        })}
      </HorizontalScroller>
    </div>
  )
})
