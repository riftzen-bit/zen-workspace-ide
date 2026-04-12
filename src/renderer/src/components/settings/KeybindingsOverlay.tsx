import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard, RotateCcw, Check, AlertCircle } from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'
import { useKeybindingsStore, Keybinding } from '../../store/useKeybindingsStore'
import { formatKeybinding, eventToKeybinding } from '../../lib/keybindingUtils'
import { transition } from '../../lib/motion'

interface KeybindingRowProps {
  binding: Keybinding
  isRecording: boolean
  onStartRecord: () => void
  onStopRecord: (newKeys: string | null) => void
  conflict: string | null
}

const KeybindingRow = ({
  binding,
  isRecording,
  onStartRecord,
  onStopRecord,
  conflict
}: KeybindingRowProps) => {
  const [recordedKeys, setRecordedKeys] = useState<string | null>(null)
  const recordedKeysRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isRecording) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const keys = eventToKeybinding(e)
      if (keys) {
        setRecordedKeys(keys)
        recordedKeysRef.current = keys
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault()
      if (recordedKeysRef.current) {
        onStopRecord(recordedKeysRef.current)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      setRecordedKeys(null)
    }
  }, [isRecording, onStopRecord])

  return (
    <div
      className="flex items-center justify-between py-3 px-4"
      style={{
        backgroundColor: isRecording ? 'var(--color-surface-4)' : 'transparent',
        borderBottom: '1px solid var(--color-border-subtle)'
      }}
    >
      <div className="flex-1">
        <p className="text-body" style={{ color: 'var(--color-text-secondary)' }}>
          {binding.description}
        </p>
        {conflict && (
          <p className="text-caption mt-1 flex items-center gap-1" style={{ color: '#f59e0b' }}>
            <AlertCircle size={12} />
            Conflicts with: {conflict}
          </p>
        )}
      </div>
      <button
        onClick={() => (isRecording ? onStopRecord(null) : onStartRecord())}
        className="px-3 py-1.5 rounded-none text-caption font-mono min-w-[120px] text-center transition-colors"
        style={{
          backgroundColor: isRecording ? 'var(--color-accent)' : 'var(--color-surface-5)',
          color: isRecording ? 'white' : 'var(--color-text-secondary)',
          border: isRecording ? 'none' : '1px solid var(--color-border-subtle)'
        }}
      >
        {isRecording
          ? recordedKeys
            ? formatKeybinding(recordedKeys)
            : 'Press keys...'
          : formatKeybinding(binding.keys)}
      </button>
    </div>
  )
}

export const KeybindingsOverlay = () => {
  const { isKeybindingsOpen, setKeybindingsOpen } = useUIStore()
  const { keybindings, setKeybinding, resetToDefaults } = useKeybindingsStore()
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const handleClose = useCallback(() => {
    setRecordingId(null)
    setKeybindingsOpen(false)
  }, [setKeybindingsOpen])

  useEffect(() => {
    if (!isKeybindingsOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !recordingId) {
        e.preventDefault()
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isKeybindingsOpen, recordingId, handleClose])

  const findConflict = (id: string, keys: string): string | null => {
    const normalizedKeys = formatKeybinding(keys)
    for (const [otherId, binding] of Object.entries(keybindings)) {
      if (otherId !== id && formatKeybinding(binding.keys) === normalizedKeys) {
        return binding.description
      }
    }
    return null
  }

  const handleStopRecord = (id: string, newKeys: string | null) => {
    if (newKeys) {
      setKeybinding(id, newKeys)
    }
    setRecordingId(null)
  }

  const handleReset = () => {
    resetToDefaults()
    setShowResetConfirm(false)
  }

  const groupedBindings = Object.values(keybindings).reduce(
    (acc, binding) => {
      if (!acc[binding.category]) acc[binding.category] = []
      acc[binding.category].push(binding)
      return acc
    },
    {} as Record<string, Keybinding[]>
  )

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    editor: 'Editor',
    terminal: 'Terminal',
    general: 'General'
  }

  return (
    <AnimatePresence>
      {isKeybindingsOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition.overlay}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !recordingId) handleClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={transition.overlay}
            className="relative w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-subtle)'
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
            >
              <div className="flex items-center gap-3">
                <Keyboard size={20} style={{ color: 'var(--color-accent)' }} />
                <h2
                  className="text-heading font-medium"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="btn-ghost p-1.5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-2">
              {Object.entries(groupedBindings).map(([category, bindings]) => (
                <div key={category} className="mb-4">
                  <p
                    className="text-caption font-medium uppercase tracking-wider px-5 py-2"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {categoryLabels[category] || category}
                  </p>
                  {bindings.map((binding) => (
                    <KeybindingRow
                      key={binding.id}
                      binding={binding}
                      isRecording={recordingId === binding.id}
                      onStartRecord={() => setRecordingId(binding.id)}
                      onStopRecord={(keys) => handleStopRecord(binding.id, keys)}
                      conflict={findConflict(binding.id, binding.keys)}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderTop: '1px solid var(--color-border-subtle)' }}
            >
              {showResetConfirm ? (
                <div className="flex items-center gap-3">
                  <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                    Reset all shortcuts?
                  </span>
                  <button
                    onClick={handleReset}
                    className="btn-ghost px-3 py-1.5 text-caption flex items-center gap-1.5"
                    style={{ color: '#ef4444' }}
                  >
                    <Check size={14} />
                    Yes
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="btn-ghost px-3 py-1.5 text-caption"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="btn-ghost px-3 py-1.5 text-caption flex items-center gap-1.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <RotateCcw size={14} />
                  Reset to Defaults
                </button>
              )}
              <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                Click a shortcut to change it
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
