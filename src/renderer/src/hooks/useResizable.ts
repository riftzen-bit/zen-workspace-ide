import { useState, useCallback, useEffect } from 'react'

export const useResizable = (
  initialWidth: number,
  minWidth: number = 200,
  maxWidth: number = 800,
  onResize?: (width: number) => void,
  direction: 'left' | 'right' = 'left'
) => {
  const [width, setWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)

  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        let newWidth
        if (direction === 'left') {
          // Assume resizing from the right edge of a left-aligned panel
          newWidth = Math.max(minWidth, Math.min(e.clientX, maxWidth))
        } else {
          // Assume resizing from the left edge of a right-aligned panel
          newWidth = Math.max(minWidth, Math.min(window.innerWidth - e.clientX, maxWidth))
        }
        setWidth(newWidth)
        if (onResize) onResize(newWidth)
      }
    },
    [isResizing, minWidth, maxWidth, onResize, direction]
  )

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
    } else {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }

    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  return { width, startResizing, isResizing }
}
