import { X, KeyRound, Type, WrapText, PlayCircle } from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useSettingsStore } from '../../store/useSettingsStore'

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

  if (activeView !== 'settings') return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#141415] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/50">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Workspace Settings
          </h2>
          <button
            onClick={() => setActiveView('explorer')}
            className="p-2 -mr-2 rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-10 max-h-[70vh] hide-scrollbar">
          {/* AI Settings */}
          <section className="flex flex-col gap-4">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <KeyRound size={14} /> AI Assistant
            </h3>

            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 flex flex-col gap-3">
              <label className="block text-sm font-medium text-zinc-300">
                Google Gemini API Key
              </label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-[#0a0a0b] border border-white/10 text-sm text-zinc-200 px-4 py-2.5 rounded-lg focus:outline-none focus:border-amber-500/50 shadow-inner transition-all placeholder:text-zinc-600"
              />
              <p className="text-xs text-zinc-500">
                Securely stored on your local machine via Electron Store backend.
              </p>
            </div>
          </section>

          {/* Editor Settings */}
          <section className="flex flex-col gap-4">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <Type size={14} /> Editor Preferences
            </h3>

            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6 grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-zinc-300">
                  Font Size ({fontSize}px)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="flex-1 accent-amber-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <WrapText size={16} /> Word Wrap
                </label>
                <button
                  onClick={() => setWordWrap(!wordWrap)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    wordWrap ? 'bg-amber-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      wordWrap ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Media Settings */}
          <section className="flex flex-col gap-4">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <PlayCircle size={14} /> Vibe Player
            </h3>

            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-zinc-300">Autoplay Music</h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Automatically start Lo-Fi music stream when the app launches.
                  </p>
                </div>
                <button
                  onClick={() => setAutoPlayVibe(!autoPlayVibe)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    autoPlayVibe ? 'bg-amber-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoPlayVibe ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
