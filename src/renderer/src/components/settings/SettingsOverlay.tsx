import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Type,
  WrapText,
  Disc,
  KeyRound,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Check,
  ExternalLink,
  Palette
} from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useSettingsStore, AIProviderType } from '../../store/useSettingsStore'
import {
  useThemeStore,
  applyTheme,
  PRESET_THEMES,
  type ThemePreset
} from '../../store/useThemeStore'
import { transition } from '../../lib/motion'

const PROVIDERS: { id: AIProviderType; label: string; color: string }[] = [
  { id: 'gemini', label: 'Gemini', color: '#4285F4' },
  { id: 'openai', label: 'OpenAI', color: '#10a37f' },
  { id: 'anthropic', label: 'Claude', color: '#d97757' },
  { id: 'groq', label: 'Groq', color: '#f55036' },
  { id: 'ollama', label: 'Ollama', color: '#888' }
]

const MODELS: Record<AIProviderType, string[]> = {
  gemini: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-3-pro-preview',
    'gemini-3-flash-preview'
  ],
  openai: ['gpt-5', 'gpt-5-mini', 'o3-pro', 'o3', 'o4-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o'],
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  groq: [
    'openai/gpt-oss-120b',
    'qwen/qwen3-32b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ],
  ollama: [
    'qwen3:32b',
    'qwen3:30b-a3b',
    'llama4:scout',
    'gemma3:27b',
    'gemma3:12b',
    'phi4',
    'qwen3:8b'
  ]
}

const PasswordInput = ({
  value,
  onChange,
  placeholder,
  disabled = false
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) => {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="input-field w-full pr-10"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 btn-ghost p-0 disabled:opacity-50"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className="relative inline-flex h-6 w-11 items-center rounded-none transition-colors duration-200 focus:outline-none"
    style={{ backgroundColor: value ? 'var(--color-accent)' : 'var(--color-surface-5)' }}
  >
    <motion.span
      layout
      className="inline-block h-4 w-4 rounded-none bg-white"
      animate={{ x: value ? 22 : 4 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    />
  </button>
)

const THEME_LABELS: Record<ThemePreset, string> = {
  default: 'Default',
  midnight: 'Midnight',
  forest: 'Forest',
  ocean: 'Ocean',
  sunset: 'Sunset',
  custom: 'Custom'
}

const ThemeSelector = () => {
  const { activePreset, setPreset } = useThemeStore()

  const handlePresetChange = (preset: ThemePreset) => {
    setPreset(preset)
    const colors =
      preset === 'custom' ? useThemeStore.getState().customColors : PRESET_THEMES[preset]
    applyTheme(colors)
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-body font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          Color Preset
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PRESET_THEMES) as ThemePreset[])
            .filter((p) => p !== 'custom')
            .map((preset) => {
              const colors = PRESET_THEMES[preset]
              const isActive = activePreset === preset
              return (
                <button
                  key={preset}
                  onClick={() => handlePresetChange(preset)}
                  className="flex flex-col items-center gap-2 p-3 rounded-none transition-all"
                  style={{
                    backgroundColor: isActive ? 'var(--color-surface-5)' : 'transparent',
                    border: isActive
                      ? '1px solid var(--color-accent)'
                      : '1px solid var(--color-border-subtle)'
                  }}
                >
                  <div className="flex gap-1">
                    <div
                      className="w-4 h-4 rounded-none"
                      style={{ backgroundColor: colors.surface2 }}
                    />
                    <div
                      className="w-4 h-4 rounded-none"
                      style={{ backgroundColor: colors.accent }}
                    />
                    <div
                      className="w-4 h-4 rounded-none"
                      style={{ backgroundColor: colors.textPrimary }}
                    />
                  </div>
                  <span
                    className="text-caption"
                    style={{
                      color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)'
                    }}
                  >
                    {THEME_LABELS[preset]}
                  </span>
                </button>
              )
            })}
        </div>
      </div>
    </div>
  )
}

export const SettingsOverlay = () => {
  const { activeView, setActiveView } = useUIStore()
  const settings = useSettingsStore()
  const {
    activeProvider,
    setActiveProvider,
    geminiApiKey,
    setGeminiApiKey,
    openaiApiKey,
    setOpenaiApiKey,
    anthropicApiKey,
    setAnthropicApiKey,
    groqApiKey,
    setGroqApiKey,
    ollamaUrl,
    setOllamaUrl,
    geminiOAuthActive,
    geminiOAuthEmail,
    setGeminiOAuthActive,
    modelPerProvider,
    setModelForProvider,
    autoPlayVibe,
    setAutoPlayVibe,
    fontSize,
    setFontSize,
    wordWrap,
    setWordWrap,
    smartContextEnabled,
    setSmartContextEnabled,
    inlineCompletionEnabled,
    setInlineCompletionEnabled,
    adaptiveAmbientEnabled,
    setAdaptiveAmbientEnabled,
    agentBudgetLimit,
    setAgentBudgetLimit,
    autoPauseAgentBudget,
    setAutoPauseAgentBudget,
    restoreSessionOnStartup,
    setRestoreSessionOnStartup
  } = settings

  const [selectedTab, setSelectedTab] = useState<AIProviderType>(activeProvider)
  const [geminiOAuthLoading, setGeminiOAuthLoading] = useState(false)
  const [geminiOAuthError, setGeminiOAuthError] = useState('')
  const [setupGuideOpening, setSetupGuideOpening] = useState(false)

  useEffect(() => {
    if (selectedTab !== 'gemini') return
    let cancelled = false

    const syncGeminiOAuthState = async () => {
      try {
        const status = await window.api.oauth.geminiStatus()
        if (cancelled) return
        setGeminiOAuthActive(status.active, status.email)
      } catch {
        // ignore
      }
    }

    void syncGeminiOAuthState()

    return () => {
      cancelled = true
    }
  }, [selectedTab, setGeminiOAuthActive])

  // Listen for credential updates from the setup guide
  useEffect(() => {
    const cleanup = window.api.oauth.onKeysUpdated(() => {
      void settings.loadSecureKeys().then(async () => {
        try {
          const status = await window.api.oauth.geminiStatus()
          setGeminiOAuthActive(status.active, status.email)
          if (!status.active) setGeminiOAuthError('')
        } catch {
          setGeminiOAuthActive(false)
        }
      })
    })
    return cleanup
  }, [settings, setGeminiOAuthActive])

  const handleGeminiOAuthLogin = async () => {
    if (geminiOAuthLoading) return
    setGeminiOAuthLoading(true)
    setGeminiOAuthError('')
    try {
      const result = await window.api.oauth.geminiStart()
      if (result.success) {
        setGeminiOAuthActive(true, result.email)
      } else {
        setGeminiOAuthError(result.error ?? 'OAuth failed')
      }
    } catch {
      setGeminiOAuthError('OAuth failed')
    } finally {
      setGeminiOAuthLoading(false)
    }
  }

  const handleGeminiOAuthLogout = async () => {
    await window.api.oauth.geminiLogout()
    setGeminiOAuthActive(false)
    setGeminiOAuthError('')
  }

  const handleOpenSetupGuide = async () => {
    if (setupGuideOpening) return
    setSetupGuideOpening(true)
    try {
      await window.api.oauth.openSetupGuide()
    } catch {
      // ignore
    } finally {
      setTimeout(() => setSetupGuideOpening(false), 1000)
    }
  }

  const hasOAuthCredentials = settings.googleClientId.length > 0

  const renderProviderConfig = () => {
    switch (selectedTab) {
      case 'gemini':
        return (
          <div className="flex flex-col gap-4">
            {/* Setup Guide button */}
            <div
              className="rounded-none p-4 flex items-center justify-between"
              style={{
                backgroundColor: 'var(--color-surface-3)',
                border: '1px solid var(--color-border-subtle)',
                borderLeftColor: '#4285F4',
                borderLeftWidth: '2px'
              }}
            >
              <div>
                <p
                  className="text-body font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Setup Guide
                </p>
                <p className="text-caption mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Get your own API key or OAuth credentials from Google
                </p>
              </div>
              <button
                onClick={handleOpenSetupGuide}
                disabled={setupGuideOpening}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-none text-label font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: '#2563eb',
                  border: '1px solid #3b82f6',
                  color: '#fff'
                }}
              >
                <ExternalLink size={13} />
                {setupGuideOpening ? 'Opening...' : 'Open Guide'}
              </button>
            </div>

            {/* Sign in with Google (OAuth) */}
            {hasOAuthCredentials && (
              <div
                className="rounded-none p-4 flex flex-col gap-3"
                style={{
                  backgroundColor: 'var(--color-surface-3)',
                  border: '1px solid var(--color-border-subtle)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className="text-body font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Sign in with Google
                    </p>
                    {geminiOAuthActive && geminiOAuthEmail && (
                      <p
                        className="text-caption mt-0.5"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {geminiOAuthEmail}
                      </p>
                    )}
                  </div>
                  {geminiOAuthActive ? (
                    <button
                      onClick={handleGeminiOAuthLogout}
                      className="btn-ghost flex items-center gap-1.5 text-label"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <LogOut size={13} /> Sign out
                    </button>
                  ) : (
                    <button
                      onClick={handleGeminiOAuthLogin}
                      disabled={geminiOAuthLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-none text-label font-medium transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--color-surface-4)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-secondary)'
                      }}
                    >
                      <LogIn size={13} />
                      {geminiOAuthLoading ? 'Signing in...' : 'Sign in with Google'}
                    </button>
                  )}
                </div>
                {geminiOAuthActive && (
                  <div
                    className="flex items-center gap-1.5 text-caption"
                    style={{ color: 'var(--color-secondary)' }}
                  >
                    <Check size={11} /> Connected to Gemini API
                  </div>
                )}
                {geminiOAuthError && (
                  <p className="text-caption" style={{ color: '#ef4444' }}>
                    {geminiOAuthError}
                  </p>
                )}
                <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                  Uses your own OAuth credentials. No shared quotas.
                </p>
              </div>
            )}

            {/* API key input */}
            <div
              className="rounded-none p-4 flex flex-col gap-3"
              style={{
                backgroundColor: 'var(--color-surface-3)',
                border: '1px solid var(--color-border-subtle)',
                opacity: geminiOAuthActive ? 0.5 : 1,
                pointerEvents: geminiOAuthActive ? 'none' : 'auto'
              }}
            >
              <p className="text-body font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {hasOAuthCredentials ? 'Or use an API Key' : 'API Key'}
              </p>
              <PasswordInput
                value={geminiApiKey}
                onChange={setGeminiApiKey}
                placeholder="AIzaSy..."
                disabled={geminiOAuthActive}
              />
              <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                Get key at{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                  style={{ color: 'var(--color-secondary)' }}
                  onClick={(e) => {
                    e.preventDefault()
                    window.open('https://aistudio.google.com/apikey')
                  }}
                >
                  aistudio.google.com
                </a>{' '}
                or use the Setup Guide above.
              </p>
            </div>
          </div>
        )

      case 'openai':
        return (
          <div
            className="rounded-none p-4 flex flex-col gap-3"
            style={{
              backgroundColor: 'var(--color-surface-3)',
              border: '1px solid var(--color-border-subtle)'
            }}
          >
            <p className="text-body font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              API Key
            </p>
            <PasswordInput value={openaiApiKey} onChange={setOpenaiApiKey} placeholder="sk-..." />
            <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
              Get key at platform.openai.com
            </p>
          </div>
        )

      case 'anthropic':
        return (
          <div
            className="rounded-none p-4 flex flex-col gap-3"
            style={{
              backgroundColor: 'var(--color-surface-3)',
              border: '1px solid var(--color-border-subtle)'
            }}
          >
            <p className="text-body font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              API Key
            </p>
            <PasswordInput
              value={anthropicApiKey}
              onChange={setAnthropicApiKey}
              placeholder="sk-ant-..."
            />
            <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
              Get key at console.anthropic.com
            </p>
          </div>
        )

      case 'groq':
        return (
          <div
            className="rounded-none p-4 flex flex-col gap-3"
            style={{
              backgroundColor: 'var(--color-surface-3)',
              border: '1px solid var(--color-border-subtle)'
            }}
          >
            <p className="text-body font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              API Key
            </p>
            <PasswordInput value={groqApiKey} onChange={setGroqApiKey} placeholder="gsk_..." />
            <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
              Get key at console.groq.com -- free tier available
            </p>
          </div>
        )

      case 'ollama':
        return (
          <div
            className="rounded-none p-4 flex flex-col gap-3"
            style={{
              backgroundColor: 'var(--color-surface-3)',
              border: '1px solid var(--color-border-subtle)'
            }}
          >
            <p className="text-body font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Ollama URL
            </p>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="input-field w-full"
            />
            <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
              Runs locally -- no API key needed. Install at ollama.com
            </p>
          </div>
        )
    }
  }

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
            className="w-full max-w-xl flex flex-col overflow-hidden rounded-none bg-[#0A0A0A] border border-white/[0.06] shadow-2xl shadow-black/80"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04] bg-white/[0.01]">
              <h2 className="text-[14px] font-medium tracking-wide text-zinc-200">
                Workspace Settings
              </h2>
              <button
                onClick={() => setActiveView('explorer')}
                className="btn-ghost rounded-none p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 max-h-[75vh] hide-scrollbar">
              {/* AI Provider section */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 flex items-center gap-2">
                    <KeyRound size={13} /> AI Provider
                  </h3>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>

                {/* Provider selector tabs */}
                <div className="flex gap-2 flex-wrap">
                  {PROVIDERS.map((p) => {
                    const isActive = activeProvider === p.id
                    const isSelected = selectedTab === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedTab(p.id)
                          setActiveProvider(p.id)
                        }}
                        className={`px-3.5 py-1.5 rounded-none text-[12px] font-medium tracking-wide transition-all duration-200 flex items-center gap-2 ${
                          isSelected
                            ? 'bg-white/[0.06] border-white/[0.12] text-white shadow-sm'
                            : 'bg-white/[0.02] border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                        } border`}
                      >
                        {isActive && (
                          <span
                            className="w-1.5 h-1.5 rounded-none shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                            style={{ backgroundColor: p.color }}
                          />
                        )}
                        {p.label}
                      </button>
                    )
                  })}
                </div>

                {/* Provider config */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedTab}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                  >
                    {renderProviderConfig()}
                  </motion.div>
                </AnimatePresence>

                {/* Model selector */}
                <div
                  className="rounded-none p-4 flex items-center justify-between gap-4"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border-subtle)'
                  }}
                >
                  <p
                    className="text-body font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Model
                  </p>
                  <select
                    value={modelPerProvider[selectedTab]}
                    onChange={(e) => setModelForProvider(selectedTab, e.target.value)}
                    className="text-body rounded-none px-3 py-1.5 focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-surface-4)',
                      border: '1px solid var(--color-border-default)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    {MODELS[selectedTab].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              {/* AI Assistance */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 flex items-center gap-2">
                    <KeyRound size={13} /> AI Assistance
                  </h3>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>

                <div
                  className="rounded-none p-5 flex flex-col gap-4"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border-subtle)'
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4
                        className="text-body font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Smart Context
                      </h4>
                      <p className="text-caption mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Automatically attach imported files, companion tests, and config files to
                        chat prompts.
                      </p>
                    </div>
                    <Toggle value={smartContextEnabled} onChange={setSmartContextEnabled} />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4
                        className="text-body font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Inline Completion
                      </h4>
                      <p className="text-caption mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Show ghost-text AI suggestions directly inside the editor.
                      </p>
                    </div>
                    <Toggle value={inlineCompletionEnabled} onChange={setInlineCompletionEnabled} />
                  </div>
                </div>
              </section>

              {/* Agent Safety */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 flex items-center gap-2">
                    <KeyRound size={13} /> Agent Safety
                  </h3>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>

                <div
                  className="rounded-none p-5 flex flex-col gap-4"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border-subtle)'
                  }}
                >
                  <div className="space-y-2">
                    <label
                      className="text-body font-medium block"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Session Budget (USD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={agentBudgetLimit ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.trim()
                        setAgentBudgetLimit(raw ? Math.max(0, Number(raw)) : null)
                      }}
                      placeholder="Leave empty for no limit"
                      className="input-field w-full"
                    />
                    <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                      Zen Workspace IDE warns at 80% of the budget and raises a critical alert at
                      100%.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4
                        className="text-body font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Auto-pause Workspaces
                      </h4>
                      <p className="text-caption mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Pause running terminal workspaces when the budget is exceeded. On
                        unsupported platforms, the app will show a blocking alert instead.
                      </p>
                    </div>
                    <Toggle value={autoPauseAgentBudget} onChange={setAutoPauseAgentBudget} />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4
                        className="text-body font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Restore Session on Startup
                      </h4>
                      <p className="text-caption mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Automatically restore the last active terminal workspace when the app
                        starts.
                      </p>
                    </div>
                    <Toggle value={restoreSessionOnStartup} onChange={setRestoreSessionOnStartup} />
                  </div>
                </div>
              </section>

              {/* Editor Settings */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 flex items-center gap-2">
                    <Type size={13} /> Editor
                  </h3>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>

                <div
                  className="rounded-none p-5 grid grid-cols-2 gap-8"
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
                      className="w-full h-1.5 rounded-none appearance-none cursor-pointer"
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
                    <Toggle value={wordWrap} onChange={setWordWrap} />
                  </div>
                </div>
              </section>

              {/* Theme */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 flex items-center gap-2">
                    <Palette size={13} /> Theme
                  </h3>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>

                <div
                  className="rounded-none p-5"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border-subtle)'
                  }}
                >
                  <ThemeSelector />
                </div>
              </section>

              {/* Vibe Player */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 flex items-center gap-2">
                    <Disc size={13} /> Vibe Player
                  </h3>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>

                <div
                  className="rounded-none p-5"
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
                    <Toggle value={autoPlayVibe} onChange={setAutoPlayVibe} />
                  </div>

                  <div className="flex items-center justify-between mt-5">
                    <div>
                      <h4
                        className="text-body font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Adaptive Ambient
                      </h4>
                      <p className="text-caption mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Automatically shift between calm and active ambient modes based on your
                        typing activity.
                      </p>
                    </div>
                    <Toggle value={adaptiveAmbientEnabled} onChange={setAdaptiveAmbientEnabled} />
                  </div>
                </div>
              </section>

              {/* Backup & Restore */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 flex items-center gap-2">
                    <KeyRound size={13} /> Backup & Restore
                  </h3>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>

                <div
                  className="rounded-none p-5"
                  style={{
                    backgroundColor: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border-subtle)'
                  }}
                >
                  <p className="text-caption mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    Export your settings, workspaces, prompts, and snippets to a JSON file. API keys
                    are not included for security.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        const result = await window.api.store.exportSettings()
                        if (result.success) {
                          useUIStore
                            .getState()
                            .addToast('Settings exported successfully', 'success')
                        } else if (result.error !== 'Cancelled') {
                          useUIStore.getState().addToast(`Export failed: ${result.error}`, 'error')
                        }
                      }}
                      className="btn-ghost px-4 py-2 text-body"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Export Settings
                    </button>
                    <button
                      onClick={async () => {
                        const result = await window.api.store.importSettings()
                        if (result.success) {
                          useUIStore
                            .getState()
                            .addToast(
                              `Imported ${result.importedCount} setting groups. Restart app to apply.`,
                              'success'
                            )
                        } else if (result.error !== 'Cancelled') {
                          useUIStore.getState().addToast(`Import failed: ${result.error}`, 'error')
                        }
                      }}
                      className="btn-ghost px-4 py-2 text-body"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Import Settings
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
