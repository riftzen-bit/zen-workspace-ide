import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface HorizontalScrollerProps {
  children: ReactNode
  className?: string
  scrollerClassName?: string
  step?: number
  style?: CSSProperties
  buttonBorderColor?: string
}

export const HorizontalScroller = memo(function HorizontalScroller({
  children,
  className = '',
  scrollerClassName = '',
  step = 160,
  style,
  buttonBorderColor = 'var(--color-border-subtle)'
}: HorizontalScrollerProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateAffordance = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft < maxScroll - 1)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateAffordance()
    const onScroll = () => updateAffordance()
    el.addEventListener('scroll', onScroll, { passive: true })
    const observer = new ResizeObserver(updateAffordance)
    observer.observe(el)
    for (const child of Array.from(el.children)) {
      observer.observe(child)
    }
    const mutation = new MutationObserver(() => {
      updateAffordance()
      for (const child of Array.from(el.children)) {
        observer.observe(child)
      }
    })
    mutation.observe(el, { childList: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      observer.disconnect()
      mutation.disconnect()
    }
  }, [updateAffordance])

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className={`relative flex items-stretch min-w-0 ${className}`} style={style}>
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scrollBy(-step)}
        disabled={!canScrollLeft}
        className={`shrink-0 w-7 flex items-center justify-center border-r transition-colors ${
          canScrollLeft
            ? 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] cursor-pointer'
            : 'text-zinc-700 cursor-default'
        }`}
        style={{ borderColor: buttonBorderColor }}
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
      </button>
      <div
        ref={scrollerRef}
        className={`flex items-center flex-1 min-w-0 overflow-x-auto hide-scrollbar ${scrollerClassName}`}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scrollBy(step)}
        disabled={!canScrollRight}
        className={`shrink-0 w-7 flex items-center justify-center border-l transition-colors ${
          canScrollRight
            ? 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] cursor-pointer'
            : 'text-zinc-700 cursor-default'
        }`}
        style={{ borderColor: buttonBorderColor }}
      >
        <ChevronRight size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
})
