import { motion, AnimatePresence } from 'framer-motion'
import { X, KeyRound, Type, WrapText, PlayCircle } from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { transition } from '../../lib/motion'

export const SettingsOverlay = () => {
  const { activeView, setActiveView } = useUIStore()
  const {
    geminiApiKey,
    setGeminiApiKey,
    autoPlayVibe,
    setAutoPlayVibe,
    fontSize,
    setFontSize,
    wordWrap,
    setWordWrap
  } = useSettingsStore()

  return (
    <AnimatePresence>
      {activeView === 'settings' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition.fade}
          className="absolute inset-0 z-50 flex items-center justify-center p-8"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveView('explorer')
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={transition.overlay}
            className="w-full max-w-xl flex flex-col overflow-hidden rounded-2xl"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-default)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)'
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{
                borderColor: 'var(--color-border-subtle)',
                backgroundColor: 'var(--color-surface-1)'
              }}
            >
              <h2 className="text-subhead" style={{ color: 'var(--color-text-primary)' }}>
                Workspace Settings
              </h2>
              <button onClick={() => setActiveView('explorer')} className="btn-ghost">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 max-h-[70vh] hide-scrollbar">
              {/* AI Settings — amber left tint */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3
                    className="text-label flex items-center gap-2"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    <KeyRound size={12} /> AI Assistant
                  </h3>
                  <div
                    className="flex-1 h-px"
                    style={{ backgroundColor: 'var(--color-border-subtle)' }}
                  />
                </div>

                <div
                  className="rounded-xl p-5 flex flex-col gap-3 border-l-2"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border-subtle)',
                    borderLeftColor: 'var(--color-accent)',
                    borderLeftWidth: '2px'
                  }}
                >
                  <label
                    className="text-body font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Google Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy…"
                    className="input-field w-full"
                  />
                  <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                    Stored locally via Electron Store.
                  </p>
                </div>
              </section>

              {/* Editor Settings — secondary tint */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3
                    className="text-label flex items-center gap-2"
                    style={{ color: 'var(--color-secondary)' }}
                  >
                    <Type size={12} /> Editor
                  </h3>
                  <div
                    className="flex-1 h-px"
                    style={{ backgroundColor: 'var(--color-border-subtle)' }}
                  />
                </div>

                <div
                  className="rounded-xl p-5 grid grid-cols-2 gap-8"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border-subtle)',
                    borderLeftColor: 'var(--color-secondary)',
                    borderLeftWidth: '2px'
                  }}
                >
                  <div className="space-y-3">
                    <label
                      className="text-body font-medium block"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Font Size ({fontSize}px)
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="24"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                      style={{
                        accentColor: 'var(--color-accent)',
                        backgroundColor: 'var(--color-surface-5)'
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <label
                      className="text-body font-medium flex items-center gap-2"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <WrapText size={14} /> Word Wrap
                    </label>
                    <button
                      onClick={() => setWordWrap(!wordWrap)}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none"
                      style={{
                        backgroundColor: wordWrap ? 'var(--color-accent)' : 'var(--color-surface-5)'
                      }}
                    >
                      <motion.span
                        layout
                        className="inline-block h-4 w-4 rounded-full bg-white"
                        animate={{ x: wordWrap ? 22 : 4 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                </div>
              </section>

              {/* Vibe Settings — muted zinc tint */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3
                    className="text-label flex items-center gap-2"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <PlayCircle size={12} /> Vibe Player
                  </h3>
                  <div
                    className="flex-1 h-px"
                    style={{ backgroundColor: 'var(--color-border-subtle)' }}
                  />
                </div>

                <div
                  className="rounded-xl p-5"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border-subtle)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4
                        className="text-body font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Autoplay Music
                      </h4>
                      <p className="text-caption mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Start Lo-Fi stream when the app launches.
                      </p>
                    </div>
                    <button
                      onClick={() => setAutoPlayVibe(!autoPlayVibe)}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none"
                      style={{
                        backgroundColor: autoPlayVibe
                          ? 'var(--color-accent)'
                          : 'var(--color-surface-5)'
                      }}
                    >
                      <motion.span
                        layout
                        className="inline-block h-4 w-4 rounded-full bg-white"
                        animate={{ x: autoPlayVibe ? 22 : 4 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
