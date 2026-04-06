import { useRef, useEffect } from 'react'
import { Play, Pause, CloudRain, Disc, X } from 'lucide-react'
import { useMediaStore } from '../../store/useMediaStore'
import { useUIStore } from '../../store/useUIStore'

const VIBES = {
  lofi: {
    id: 'jfKfPfyJRdk',
    name: 'Lofi',
    icon: Disc
  },
  rain: {
    id: 'mPZkdNFkNps',
    name: 'Rain',
    icon: CloudRain
  }
}

export const VibePlayer = () => {
  const { isVibePlayerOpen, setVibePlayerOpen } = useUIStore()
  const { currentVibe, customVibe, isPlaying, volume, setCurrentVibe, setIsPlaying, setVolume } =
    useMediaStore()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const postCommand = (func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      )
    }
  }

  useEffect(() => {
    postCommand(isPlaying ? 'playVideo' : 'pauseVideo')
  }, [isPlaying, currentVibe])

  useEffect(() => {
    postCommand('setVolume', [volume])
  }, [volume])

  const togglePlay = () => {
    if (!currentVibe) {
      setCurrentVibe('lofi')
      setIsPlaying(true)
      return
    }
    setIsPlaying(!isPlaying)
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
              // Delay initial commands slightly to ensure iframe's internal JS is ready
              setTimeout(() => {
                postCommand('setVolume', [volume])
                if (isPlaying) postCommand('playVideo')
              }, 1500)
            }}
          />
        )}
      </div>

      {isVibePlayerOpen && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center bg-[#0a0a0b]/95 backdrop-blur-xl rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-white/10 px-3 py-3 gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-amber-950 hover:from-amber-300 hover:to-amber-500 transition-all shadow-[0_0_15px_rgba(251,191,36,0.3)] shrink-0 active:scale-95"
          >
            {isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" className="ml-1" />
            )}
          </button>

          <div className="flex flex-col mx-3 justify-center w-36">
            <span className="text-[13px] font-bold text-zinc-100 mb-1.5 truncate tracking-wide">
              {getVideoName()}
            </span>
            <div className="flex items-center gap-2 group relative h-3">
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="absolute inset-0 w-full h-1 my-auto appearance-none cursor-pointer focus:outline-none slider-thumb z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${volume}%, rgba(255,255,255,0.1) ${volume}%, rgba(255,255,255,0.1) 100%)`,
                  borderRadius: '10px'
                }}
              />
              <div className="absolute inset-0 w-full h-1.5 my-auto bg-white/10 rounded-full overflow-hidden group-hover:opacity-0 transition-opacity">
                <div className="h-full bg-amber-500/80" style={{ width: `${volume}%` }} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-black/40 rounded-full p-1.5 border border-white/5">
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
                  }}
                  className={`p-2.5 rounded-full transition-all
                    ${isActive ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/10'}
                  `}
                >
                  <Icon size={16} strokeWidth={2} />
                </button>
              )
            })}
          </div>

          <div className="w-px h-8 bg-white/10 mx-2"></div>

          <button
            onClick={() => setVibePlayerOpen(false)}
            className="p-2.5 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-all mr-1 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  )
}
