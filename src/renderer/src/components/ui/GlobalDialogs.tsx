import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../store/useUIStore'

const PromptDialog = ({
  title,
  defaultValue,
  onSubmit,
  onCancel
}: {
  title: string
  defaultValue: string
  onSubmit: (val: string) => void
  onCancel: () => void
}) => {
  const [val, setVal] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus and select the text when opened
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="bg-surface-3 border border-surface-border rounded-none p-5 shadow-2xl w-96 flex flex-col gap-4"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-body font-medium">{title}</p>
      <input
        ref={inputRef}
        className="w-full bg-surface-1 border border-surface-border rounded-none px-3 py-2 text-body outline-none focus:border-accent"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(val)
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className="flex justify-end gap-2 mt-1">
        <button
          className="px-4 py-1.5 rounded-none hover:bg-surface-4 text-body text-sm transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="px-4 py-1.5 rounded-none bg-accent hover:opacity-90 text-white font-medium text-sm transition-opacity"
          onClick={() => onSubmit(val)}
        >
          OK
        </button>
      </div>
    </div>
  )
}

const ConfirmDialog = ({
  title,
  onSubmit,
  onCancel
}: {
  title: string
  onSubmit: () => void
  onCancel: () => void
}) => {
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      btnRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="bg-surface-3 border border-surface-border rounded-none p-5 shadow-2xl w-96 flex flex-col gap-4"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-body font-medium">{title}</p>
      <div className="flex justify-end gap-2 mt-2">
        <button
          className="px-4 py-1.5 rounded-none hover:bg-surface-4 text-body text-sm transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          ref={btnRef}
          className="px-4 py-1.5 rounded-none bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors"
          onClick={onSubmit}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export const GlobalDialogs = () => {
  const { promptState, closePrompt, confirmState, closeConfirm } = useUIStore()

  if (!promptState.isOpen && !confirmState.isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => {
        if (promptState.isOpen) closePrompt(null)
        if (confirmState.isOpen) closeConfirm(false)
      }}
    >
      {promptState.isOpen && (
        <PromptDialog
          title={promptState.title}
          defaultValue={promptState.defaultValue}
          onSubmit={(val) => closePrompt(val)}
          onCancel={() => closePrompt(null)}
        />
      )}

      {confirmState.isOpen && (
        <ConfirmDialog
          title={confirmState.title}
          onSubmit={() => closeConfirm(true)}
          onCancel={() => closeConfirm(false)}
        />
      )}
    </div>
  )
}

