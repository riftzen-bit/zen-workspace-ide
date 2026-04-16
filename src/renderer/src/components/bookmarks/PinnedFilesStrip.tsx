import { memo, useCallback } from 'react'
import { Pin, X } from 'lucide-react'
import { useFileStore } from '../../store/useFileStore'

export const PinnedFilesStrip = memo(function PinnedFilesStrip() {
  const { pinnedFiles, removePinnedFile, openFile } = useFileStore()

  const handleOpen = useCallback(
    async (path: string, name: string) => {
      const content = await window.api.readFile(path)
      if (content !== null) openFile(path, name, content)
    },
    [openFile]
  )

  if (pinnedFiles.length === 0) return null

  return (
    <div className="shrink-0 border-b" style={{ borderColor: '#222222' }}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-widest uppercase text-zinc-600">
        <Pin size={11} />
        <span>Pinned</span>
        <span className="ml-auto text-zinc-700">{pinnedFiles.length}</span>
      </div>
      <div className="px-2 pb-2 space-y-0.5">
        {pinnedFiles.map((f) => (
          <div
            key={f.path}
            className="group flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-white/[0.03] transition-colors"
            onClick={() => handleOpen(f.path, f.name)}
            title={f.path}
          >
            <Pin size={11} className="text-amber-400/80 shrink-0" />
            <span className="flex-1 min-w-0 truncate text-[12px] text-zinc-300">{f.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                removePinnedFile(f.path)
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-200 transition-opacity"
              title="Unpin"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
})
