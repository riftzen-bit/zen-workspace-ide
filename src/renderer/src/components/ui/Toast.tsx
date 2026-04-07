import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useUIStore, type Toast as ToastItem } from '../../store/useUIStore'
import { transition } from '../../lib/motion'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle
}

const colors = {
  success: 'var(--color-secondary)',
  error: '#ef4444',
  info: 'var(--color-accent)',
  warning: '#f59e0b'
}

const ToastItem = ({ toast }: { toast: ToastItem }) => {
  const { removeToast } = useUIStore()
  const Icon = icons[toast.type]
  const color = colors[toast.type]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.94 }}
      transition={transition.overlay}
      className="flex items-center gap-3 px-4 py-3 rounded-xl min-w-[240px] max-w-[340px] cursor-pointer"
      style={{
        backgroundColor: 'var(--color-surface-4)',
        border: '1px solid var(--color-border-default)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        borderLeftColor: color,
        borderLeftWidth: '2px'
      }}
      onClick={() => removeToast(toast.id)}
    >
      <Icon size={15} style={{ color, flexShrink: 0 }} />
      <span
        className="text-body flex-1 leading-snug"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {toast.message}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          removeToast(toast.id)
        }}
        className="p-0.5 rounded transition-colors shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <X size={12} />
      </button>
    </motion.div>
  )
}

export const ToastContainer = () => {
  const { toasts } = useUIStore()

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
