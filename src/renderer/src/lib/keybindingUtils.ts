/**
 * Keybinding utilities for parsing and matching keyboard shortcuts
 */

export interface ParsedKeybinding {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

/**
 * Parse a keybinding string like "Ctrl+Shift+K" into components
 */
export function parseKeybinding(binding: string): ParsedKeybinding {
  const parts = binding
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
  const result: ParsedKeybinding = {
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
    key: ''
  }

  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'control':
        result.ctrl = true
        break
      case 'shift':
        result.shift = true
        break
      case 'alt':
        result.alt = true
        break
      case 'meta':
      case 'cmd':
      case 'command':
        result.meta = true
        break
      default:
        result.key = part
    }
  }

  return result
}

/**
 * Check if a KeyboardEvent matches a keybinding string
 * Handles cross-platform Ctrl/Cmd modifier
 */
export function matchesKeybinding(event: KeyboardEvent, binding: string): boolean {
  const parsed = parseKeybinding(binding)
  const eventKey = event.key.toLowerCase()

  // Cross-platform: treat Ctrl and Meta as equivalent for shortcuts
  const ctrlOrMeta = event.ctrlKey || event.metaKey
  const needsCtrlOrMeta = parsed.ctrl || parsed.meta

  if (needsCtrlOrMeta && !ctrlOrMeta) return false
  if (!needsCtrlOrMeta && ctrlOrMeta) return false

  if (parsed.shift !== event.shiftKey) return false
  if (parsed.alt !== event.altKey) return false

  // Handle special keys
  if (parsed.key === 'escape' || parsed.key === 'esc') {
    return eventKey === 'escape'
  }

  return eventKey === parsed.key
}

/**
 * Format a keybinding for display (normalize to consistent format)
 */
export function formatKeybinding(binding: string): string {
  const parsed = parseKeybinding(binding)
  const parts: string[] = []

  if (parsed.ctrl || parsed.meta) parts.push('Ctrl')
  if (parsed.shift) parts.push('Shift')
  if (parsed.alt) parts.push('Alt')

  if (parsed.key) {
    // Capitalize first letter of key
    parts.push(parsed.key.charAt(0).toUpperCase() + parsed.key.slice(1))
  }

  return parts.join('+')
}

/**
 * Convert a KeyboardEvent to a keybinding string (for recording)
 */
export function eventToKeybinding(event: KeyboardEvent): string | null {
  // Ignore modifier-only keypresses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
    return null
  }

  const parts: string[] = []

  if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')

  // Get the key name
  let key = event.key.toLowerCase()

  // Handle special keys
  if (key === ' ') key = 'space'
  if (key === 'escape') key = 'Escape'

  parts.push(key.charAt(0).toUpperCase() + key.slice(1))

  return parts.join('+')
}
