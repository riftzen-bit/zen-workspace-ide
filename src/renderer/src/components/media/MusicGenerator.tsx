import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Music2,
  Wand2,
  Loader2,
  Download,
  Play,
  Pause,
  Trash2,
  ChevronDown,
  Eye,
  EyeOff
} from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useMusicStore, GeneratedTrack } from '../../store/useMusicStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useMediaStore } from '../../store/useMediaStore'
import { transition } from '../../lib/motion'

type LyriaModel = 'lyria-3-clip-preview' | 'lyria-3-pro-preview'

export const MusicGenerator = () => {
  const { isMusicGeneratorOpen, setMusicGeneratorOpen, addToast } = useUIStore()
  const {
    isGenerating,
    generationError,
    currentTrack,
    isLyriaPlaying,
    lyriaVolume,
    trackHistory,
    pendingPrompt,
    vibe,
    setIsGenerating,
    setGenerationError,
    setCurrentTrack,
    setIsLyriaPlaying,
    setLyriaVolume,
    clearCurrentTrack,
    removeFromHistory,
    setPendingPrompt,
    setVibe
  } = useMusicStore()
  const { lyriaApiKey, setLyriaApiKey } = useSettingsStore()
  const { setIsPlaying: pauseYoutube } = useMediaStore()

  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<LyriaModel>('lyria-3-clip-preview')
  const [instrumental, setInstrumental] = useState(false)
  const [customLyrics, setCustomLyrics] = useState('')
  const [showLyrics, setShowLyrics] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const audioRef = useRef<HTMLAudioElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Apply pending prompt from AI chat
  useEffect(() => {
    if (!pendingPrompt || !isMusicGeneratorOpen) return
    const id = requestAnimationFrame(() => {
      setPrompt(pendingPrompt)
      setPendingPrompt(null)
    })
    return () => cancelAnimationFrame(id)
  }, [pendingPrompt, isMusicGeneratorOpen, setPendingPrompt])

  // Sync audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = lyriaVolume / 100
    }
  }, [lyriaVolume])

  // Pause YouTube when Lyria plays
  useEffect(() => {
    if (isLyriaPlaying) {
      pauseYoutube(false)
    }
  }, [isLyriaPlaying, pauseYoutube])

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startTimer = () => {
    setElapsed(0)
    clearTimer()
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
  }

  const handleGenerate = () => {
    if (!prompt.trim() || isGenerating) return
    const useOAuth = useSettingsStore.getState().geminiOAuthActive
    if (!useOAuth && !lyriaApiKey.trim()) {
      setGenerationError(
        'Enter your Gemini API key above or connect via Gemini OAuth to generate music.'
      )
      return
    }

    setGenerationError(null)
    setIsGenerating(true)
    startTimer()

    const stylePrefix = vibe === 'focus' ? 'Deep Focus (ambient/lo-fi), ' : 'Upbeat, '
    const finalPrompt = `${stylePrefix}${prompt.trim()}`

    if (unsubRef.current) unsubRef.current()
    unsubRef.current = window.api.music.onProgress((chunk) => {
      if (chunk.type === 'complete' && chunk.audioBase64) {
        clearTimer()
        setIsGenerating(false)
        const track: GeneratedTrack = {
          id: Math.random().toString(36).slice(2),
          prompt: finalPrompt,
          model,
          lyrics: chunk.lyrics ?? null,
          audioBase64: chunk.audioBase64,
          mimeType: chunk.mimeType ?? 'audio/mp3',
          blobUrl: null,
          createdAt: Date.now()
        }
        setCurrentTrack(track)
        if (unsubRef.current) {
          unsubRef.current()
          unsubRef.current = null
        }
      } else if (chunk.type === 'error') {
        clearTimer()
        setIsGenerating(false)
        setGenerationError(chunk.error ?? 'Unknown error')
        if (unsubRef.current) {
          unsubRef.current()
          unsubRef.current = null
        }
      }
    })

    window.api.music.generate({
      model,
      prompt: finalPrompt,
      lyrics: customLyrics.trim() || undefined,
      instrumental,
      apiKey: lyriaApiKey.trim(),
      useGeminiOAuth: useOAuth
    })
  }

  const handleAbort = () => {
    window.api.music.abort()
    clearTimer()
    setIsGenerating(false)
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }
  }

  const handlePlayPause = () => {
    if (!audioRef.current || !currentTrack?.blobUrl) return
    if (isLyriaPlaying) {
      audioRef.current.pause()
      setIsLyriaPlaying(false)
    } else {
      audioRef.current.play().catch(() => setGenerationError('Playback failed'))
      setIsLyriaPlaying(true)
    }
  }

  const handleSave = async () => {
    if (!currentTrack) return
    const slug = currentTrack.prompt
      .slice(0, 30)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
    const res = await window.api.music.save(currentTrack.audioBase64, currentTrack.mimeType, slug)
    if (res.ok) {
      addToast('Music saved!', 'success')
    } else {
      addToast(res.error ?? 'Save failed', 'error')
    }
  }

  const loadHistoryTrack = (track: GeneratedTrack) => {
    setCurrentTrack({ ...track, blobUrl: null })
    setShowHistory(false)
  }

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const modelHint = model === 'lyria-3-clip-preview' ? '~15–30s' : '~2–3 min'

  return (
    <AnimatePresence>
      {isMusicGeneratorOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => !isGenerating && setMusicGeneratorOpen(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={transition.panel}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-lg rounded-none flex flex-col pointer-events-auto"
              style={{
                backgroundColor: 'var(--color-surface-1)',
                border: '1px solid var(--color-border-default)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
                maxHeight: '90vh',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-none flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-accent-glow)' }}
                  >
                    <Music2 size={15} style={{ color: 'var(--color-accent-bright)' }} />
                  </div>
                  <div>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Lyria Music Generator
                    </span>
                    <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Powered by Google Lyria 3
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => !isGenerating && setMusicGeneratorOpen(false)}
                  className="btn-ghost rounded-none p-1.5"
                  disabled={isGenerating}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* API Key — dedicated, separate from chat */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Gemini API Key
                    </label>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Free at{' '}
                      <span style={{ color: 'var(--color-accent-bright)' }}>
                        aistudio.google.com/apikey
                      </span>
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={lyriaApiKey}
                      onChange={(e) => setLyriaApiKey(e.target.value)}
                      placeholder="AIza..."
                      disabled={isGenerating}
                      className="w-full rounded-none px-3 py-2.5 text-sm outline-none pr-9"
                      style={{
                        backgroundColor: 'var(--color-surface-3)',
                        border: '1px solid var(--color-border-subtle)',
                        color: 'var(--color-text-primary)',
                        fontFamily: 'monospace'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border-accent)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
                      }}
                    />
                    <button
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 btn-ghost rounded p-0.5"
                    >
                      {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                {/* Prompt */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Describe the music
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Upbeat lo-fi hip hop with guitar and soft drums, chill coding vibe..."
                    disabled={isGenerating}
                    rows={3}
                    className="w-full resize-none rounded-none px-3 py-2.5 text-sm outline-none transition-colors"
                    style={{
                      backgroundColor: 'var(--color-surface-3)',
                      border: '1px solid var(--color-border-subtle)',
                      color: 'var(--color-text-primary)',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border-accent)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
                    }}
                  />
                </div>

                {/* Vibe toggle */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Vibe
                  </label>
                  <div
                    className="flex gap-1 p-1 rounded-none"
                    style={{ backgroundColor: 'var(--color-surface-3)' }}
                  >
                    {(
                      [
                        ['focus', 'Deep Focus', 'ambient/lo-fi'],
                        ['upbeat', 'Upbeat', 'energetic']
                      ] as const
                    ).map(([value, label, hint]) => (
                      <button
                        key={value}
                        onClick={() => setVibe(value)}
                        disabled={isGenerating}
                        className="flex-1 py-1.5 rounded-none text-xs font-medium transition-all"
                        style={{
                          backgroundColor:
                            vibe === value ? 'var(--color-accent-glow)' : 'transparent',
                          color:
                            vibe === value
                              ? 'var(--color-accent-bright)'
                              : 'var(--color-text-muted)',
                          border:
                            vibe === value
                              ? '1px solid var(--color-border-accent)'
                              : '1px solid transparent'
                        }}
                      >
                        {label} <span style={{ opacity: 0.7 }}>({hint})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model toggle */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Model
                  </label>
                  <div
                    className="flex gap-1 p-1 rounded-none"
                    style={{ backgroundColor: 'var(--color-surface-3)' }}
                  >
                    {(
                      [
                        ['lyria-3-clip-preview', 'Clip', '30s'],
                        ['lyria-3-pro-preview', 'Pro', '~3 min']
                      ] as [LyriaModel, string, string][]
                    ).map(([value, label, hint]) => (
                      <button
                        key={value}
                        onClick={() => setModel(value)}
                        disabled={isGenerating}
                        className="flex-1 py-1.5 rounded-none text-xs font-medium transition-all"
                        style={{
                          backgroundColor:
                            model === value ? 'var(--color-accent-glow)' : 'transparent',
                          color:
                            model === value
                              ? 'var(--color-accent-bright)'
                              : 'var(--color-text-muted)',
                          border:
                            model === value
                              ? '1px solid var(--color-border-accent)'
                              : '1px solid transparent'
                        }}
                      >
                        {label} <span style={{ opacity: 0.7 }}>({hint})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options row */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => !isGenerating && setInstrumental((v) => !v)}
                      className="w-9 h-5 rounded-none relative transition-colors"
                      style={{
                        backgroundColor: instrumental
                          ? 'var(--color-accent)'
                          : 'var(--color-surface-5)'
                      }}
                    >
                      <div
                        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-none transition-transform"
                        style={{
                          backgroundColor: '#fff',
                          transform: instrumental ? 'translateX(16px)' : 'translateX(0)'
                        }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Instrumental only
                    </span>
                  </label>

                  <button
                    onClick={() => setShowLyrics((v) => !v)}
                    className="flex items-center gap-1 text-xs rounded-none px-2 py-1 transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-secondary)'
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-muted)'
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    Custom lyrics
                    <ChevronDown
                      size={12}
                      style={{
                        transform: showLyrics ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s'
                      }}
                    />
                  </button>
                </div>

                {/* Custom lyrics */}
                <AnimatePresence>
                  {showLyrics && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="space-y-1.5">
                        <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          Custom lyrics — use [Verse], [Chorus], [Bridge], [Outro] tags
                        </label>
                        <textarea
                          value={customLyrics}
                          onChange={(e) => setCustomLyrics(e.target.value)}
                          placeholder={`[Verse]\nYour lyrics here...\n\n[Chorus]\nHook goes here...`}
                          disabled={isGenerating}
                          rows={5}
                          className="w-full resize-none rounded-none px-3 py-2.5 text-sm outline-none transition-colors font-mono"
                          style={{
                            backgroundColor: 'var(--color-surface-3)',
                            border: '1px solid var(--color-border-subtle)',
                            color: 'var(--color-text-primary)'
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                {generationError && (
                  <div
                    className="rounded-none px-4 py-3 text-sm"
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171'
                    }}
                  >
                    {generationError}
                  </div>
                )}

                {/* Generating state */}
                {isGenerating && (
                  <div
                    className="rounded-none px-4 py-4 flex flex-col items-center gap-2"
                    style={{
                      backgroundColor: 'var(--color-surface-3)',
                      border: '1px solid var(--color-border-subtle)'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader2 size={16} style={{ color: 'var(--color-accent-bright)' }} />
                      </motion.div>
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Composing... {formatElapsed(elapsed)}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {modelHint} estimated
                    </span>
                  </div>
                )}

                {/* Result */}
                {currentTrack && !isGenerating && (
                  <div
                    className="rounded-none overflow-hidden"
                    style={{ border: '1px solid var(--color-border-subtle)' }}
                  >
                    <div
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ backgroundColor: 'var(--color-surface-3)' }}
                    >
                      <button
                        onClick={handlePlayPause}
                        className="w-9 h-9 rounded-none flex items-center justify-center shrink-0 transition-colors"
                        style={{ backgroundColor: 'var(--color-accent)', color: '#0a0a0c' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-accent-bright)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-accent)'
                        }}
                      >
                        {isLyriaPlaying ? (
                          <Pause size={14} fill="currentColor" />
                        ) : (
                          <Play size={14} fill="currentColor" className="ml-0.5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-medium truncate"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {currentTrack.prompt.slice(0, 50)}
                          {currentTrack.prompt.length > 50 ? '…' : ''}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {currentTrack.model === 'lyria-3-clip-preview' ? 'Clip (30s)' : 'Pro'} ·{' '}
                          {new Date(currentTrack.createdAt).toLocaleTimeString()}
                        </p>
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={lyriaVolume}
                        onChange={(e) => setLyriaVolume(Number(e.target.value))}
                        className="w-16 h-1 appearance-none cursor-pointer rounded-none"
                        style={{
                          background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${lyriaVolume}%, rgba(255,255,255,0.1) ${lyriaVolume}%, rgba(255,255,255,0.1) 100%)`
                        }}
                      />

                      <button
                        onClick={handleSave}
                        className="btn-ghost rounded-none p-1.5"
                        title="Save to disk"
                      >
                        <Download size={14} />
                      </button>
                    </div>

                    {currentTrack.blobUrl && (
                      <audio
                        ref={audioRef}
                        src={currentTrack.blobUrl}
                        onEnded={() => setIsLyriaPlaying(false)}
                        onError={() => setGenerationError('Playback error')}
                      />
                    )}

                    {currentTrack.lyrics && (
                      <div
                        className="px-4 py-3 max-h-40 overflow-y-auto"
                        style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                      >
                        <p
                          className="text-xs font-medium mb-2"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          Lyrics
                        </p>
                        <pre
                          className="text-xs whitespace-pre-wrap leading-relaxed"
                          style={{ color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}
                        >
                          {currentTrack.lyrics}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* History */}
                {trackHistory.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowHistory((v) => !v)}
                      className="flex items-center gap-1.5 text-xs w-full text-left py-1"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <ChevronDown
                        size={12}
                        style={{
                          transform: showHistory ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s'
                        }}
                      />
                      Recent tracks ({trackHistory.length})
                    </button>

                    <AnimatePresence>
                      {showHistory && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="space-y-1 mt-2">
                            {trackHistory.map((track) => (
                              <div
                                key={track.id}
                                className="flex items-center gap-2 rounded-none px-3 py-2 group"
                                style={{ backgroundColor: 'var(--color-surface-3)' }}
                              >
                                <button
                                  onClick={() => loadHistoryTrack(track)}
                                  className="flex-1 text-left min-w-0"
                                >
                                  <p
                                    className="text-xs truncate"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                  >
                                    {track.prompt.slice(0, 45)}
                                    {track.prompt.length > 45 ? '…' : ''}
                                  </p>
                                  <p
                                    className="text-xs mt-0.5"
                                    style={{ color: 'var(--color-text-muted)' }}
                                  >
                                    {track.model === 'lyria-3-clip-preview' ? 'Clip' : 'Pro'}
                                  </p>
                                </button>
                                <button
                                  onClick={() => removeFromHistory(track.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost rounded p-1"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className="px-5 py-4 shrink-0 flex items-center gap-3"
                style={{ borderTop: '1px solid var(--color-border-subtle)' }}
              >
                {isGenerating ? (
                  <button
                    onClick={handleAbort}
                    className="flex-1 py-2.5 rounded-none text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239,68,68,0.3)'
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  <>
                    {currentTrack && (
                      <button
                        onClick={clearCurrentTrack}
                        className="btn-ghost px-3 py-2.5 rounded-none text-sm"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={handleGenerate}
                      disabled={
                        !prompt.trim() ||
                        (!useSettingsStore.getState().geminiOAuthActive && !lyriaApiKey.trim())
                      }
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-none text-sm font-medium transition-all"
                      style={{
                        backgroundColor:
                          prompt.trim() &&
                          (useSettingsStore.getState().geminiOAuthActive || lyriaApiKey.trim())
                            ? 'var(--color-accent)'
                            : 'var(--color-surface-4)',
                        color:
                          prompt.trim() &&
                          (useSettingsStore.getState().geminiOAuthActive || lyriaApiKey.trim())
                            ? '#0a0a0c'
                            : 'var(--color-text-muted)',
                        cursor:
                          prompt.trim() &&
                          (useSettingsStore.getState().geminiOAuthActive || lyriaApiKey.trim())
                            ? 'pointer'
                            : 'not-allowed'
                      }}
                    >
                      <Wand2 size={14} />
                      Generate
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

