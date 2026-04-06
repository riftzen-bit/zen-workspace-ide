import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, CloudRain, Disc, X } from 'lucide-react'
import { useMediaStore } from '../../store/useMediaStore'
import { useUIStore } from '../../store/useUIStore'
import { transition } from '../../lib/motion'

const VIBES = {
  lofi: { id: 'jfKfPfyJRdk', name: 'Lofi', icon: Disc },
  rain: { id: 'mPZkdNFkNps', name: 'Rain', icon: CloudRain }
}

export const VibePlayer = () => {
  const { isVibePlayerOpen, setVibePlayerOpen } = useUIStore()
  const { currentVibe, customVibe, isPlaying, volume, setCurrentVibe, setIsPlaying, setVolume } =
    useMediaStore()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const postCommand = (func: string, args: unknown[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        'https://www.youtube.com'
      )
    }
  }

  const togglePlay = () => {
    if (!currentVibe) {
      setCurrentVibe('lofi')
      setIsPlaying(true)
      return
    }
    const next = !isPlaying
    setIsPlaying(next)
    postCommand(next ? 'playVideo' : 'pauseVideo')
  }

  const getVideoId = () => {
    if (currentVibe === 'lofi') return VIBES.lofi.id
    if (currentVibe === 'rain') return VIBES.rain.id
    if (currentVibe === 'custom' && customVibe) return customVibe.id
    return null
  }

  const getVideoName = () => {
    if (currentVibe === 'custom' && customVibe) return customVibe.name
    if (currentVibe && currentVibe !== 'custom') return VIBES[currentVibe].name
    return 'Select Vibe'
  }

  return (
    <>
      {/* Hidden YouTube iframe */}
      <div className="fixed top-0 left-0 w-[200px] h-[200px] opacity-0 pointer-events-none -z-50 overflow-hidden">
        {currentVibe && (
          <iframe
            ref={iframeRef}
            width="200"
            height="200"
            src={`https://www.youtube.com/embed/${getVideoId()}?autoplay=${
              isPlaying ? 1 : 0
            }&origin=${window.location.origin}&enablejsapi=1&controls=0&loop=1&playlist=${getVideoId()}`}
            allow="autoplay"
            title="YouTube Video Player"
            onLoad={() => {
              setTimeout(() => {
                postCommand('setVolume', [volume])
                if (isPlaying) postCommand('playVideo')
              }, 1500)
            }}
          />
        )}
      </div>

      {/* Floating pill */}
      <AnimatePresence>
        {isVibePlayerOpen && (
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={transition.bounce}
            className="fixed bottom-8 left-1/2 z-50 flex items-center px-3 py-2.5 gap-2.5"
            style={{
              x: '-50%',
              backgroundColor: 'rgba(12, 12, 15, 0.97)',
              backdropFilter: 'blur(20px) saturate(140%)',
              borderRadius: '9999px',
              border: '1px solid var(--color-border-default)',
              boxShadow: '0 12px 36px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)'
            }}
          >
            {/* Play/Pause — spring physics */}
            <motion.button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: '#0a0a0c'
              }}
              whileTap={transition.bounce}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  'var(--color-accent-bright)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  'var(--color-accent)'
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isPlaying ? 'pause' : 'play'}
                  initial={{ scale: 0.65, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.65, rotate: 12, opacity: 0 }}
                  transition={transition.micro}
                >
                  {isPlaying ? (
                    <Pause size={17} fill="currentColor" />
                  ) : (
                    <Play size={17} fill="currentColor" className="ml-0.5" />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.button>

            {/* Track info + volume */}
            <div className="flex flex-col mx-2 justify-center w-28">
              <span
                className="text-body font-semibold truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {getVideoName()}
              </span>
              <div className="flex items-center gap-2 group relative h-3 mt-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setVolume(v)
                    postCommand('setVolume', [v])
                  }}
                  className="absolute inset-0 w-full h-1 my-auto appearance-none cursor-pointer focus:outline-none slider-thumb z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${volume}%, rgba(255,255,255,0.08) ${volume}%, rgba(255,255,255,0.08) 100%)`,
                    borderRadius: '10px'
                  }}
                />
                <div
                  className="absolute inset-0 w-full h-1 my-auto rounded-full overflow-hidden group-hover:opacity-0 transition-opacity"
                  style={{ backgroundColor: 'var(--color-surface-5)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${volume}%`, backgroundColor: 'var(--color-accent)' }}
                  />
                </div>
              </div>
            </div>

            {/* Vibe selector */}
            <div
              className="flex items-center gap-0.5 rounded-full p-1"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border-subtle)'
              }}
            >
              {(Object.keys(VIBES) as Array<keyof typeof VIBES>).map((key) => {
                const Vibe = VIBES[key]
                const Icon = Vibe.icon
                const isActive = currentVibe === key
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setCurrentVibe(key as 'lofi' | 'rain')
                      setIsPlaying(true)
                      setTimeout(() => postCommand('playVideo'), 100)
                    }}
                    className="p-2 rounded-full transition-colors"
                    style={{
                      backgroundColor: isActive ? 'var(--color-accent-glow)' : 'transparent',
                      color: isActive ? 'var(--color-accent-bright)' : 'var(--color-text-muted)',
                      border: isActive
                        ? '1px solid var(--color-border-accent)'
                        : '1px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        ;(e.currentTarget as HTMLButtonElement).style.color =
                          'var(--color-text-secondary)'
                        ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                          'var(--color-surface-4)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        ;(e.currentTarget as HTMLButtonElement).style.color =
                          'var(--color-text-muted)'
                        ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                          'transparent'
                      }
                    }}
                  >
                    <Icon size={14} strokeWidth={1.8} />
                  </button>
                )
              })}
            </div>

            <div
              className="w-px h-6 mx-0.5"
              style={{ backgroundColor: 'var(--color-border-subtle)' }}
            />

            {/* Close */}
            <button onClick={() => setVibePlayerOpen(false)} className="btn-ghost rounded-full p-2">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
