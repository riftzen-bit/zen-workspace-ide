import { describe, it, expect } from 'vitest'
import {
  parseKeybinding,
  matchesKeybinding,
  formatKeybinding,
  eventToKeybinding
} from '../../../src/renderer/src/lib/keybindingUtils'

describe('keybindingUtils', () => {
  describe('parseKeybinding', () => {
    it('parses simple key', () => {
      const result = parseKeybinding('k')
      expect(result).toEqual({
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
        key: 'k'
      })
    })

    it('parses Ctrl+key', () => {
      const result = parseKeybinding('Ctrl+K')
      expect(result).toEqual({
        ctrl: true,
        shift: false,
        alt: false,
        meta: false,
        key: 'k'
      })
    })

    it('parses Ctrl+Shift+key', () => {
      const result = parseKeybinding('Ctrl+Shift+Z')
      expect(result).toEqual({
        ctrl: true,
        shift: true,
        alt: false,
        meta: false,
        key: 'z'
      })
    })

    it('parses Cmd as meta', () => {
      const result = parseKeybinding('Cmd+B')
      expect(result.meta).toBe(true)
      expect(result.key).toBe('b')
    })

    it('handles case insensitivity', () => {
      const result = parseKeybinding('CTRL+SHIFT+k')
      expect(result.ctrl).toBe(true)
      expect(result.shift).toBe(true)
      expect(result.key).toBe('k')
    })
  })

  describe('matchesKeybinding', () => {
    const createEvent = (key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent => {
      return {
        key,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ...modifiers
      } as KeyboardEvent
    }

    it('matches simple key', () => {
      const event = createEvent('Escape')
      expect(matchesKeybinding(event, 'Escape')).toBe(true)
    })

    it('matches Ctrl+key with ctrlKey', () => {
      const event = createEvent('k', { ctrlKey: true })
      expect(matchesKeybinding(event, 'Ctrl+K')).toBe(true)
    })

    it('matches Ctrl+key with metaKey (Mac)', () => {
      const event = createEvent('k', { metaKey: true })
      expect(matchesKeybinding(event, 'Ctrl+K')).toBe(true)
    })

    it('matches Ctrl+Shift+key', () => {
      const event = createEvent('z', { ctrlKey: true, shiftKey: true })
      expect(matchesKeybinding(event, 'Ctrl+Shift+Z')).toBe(true)
    })

    it('does not match when modifier missing', () => {
      const event = createEvent('k')
      expect(matchesKeybinding(event, 'Ctrl+K')).toBe(false)
    })

    it('does not match when extra modifier present', () => {
      const event = createEvent('k', { ctrlKey: true, shiftKey: true })
      expect(matchesKeybinding(event, 'Ctrl+K')).toBe(false)
    })

    it('does not match wrong key', () => {
      const event = createEvent('b', { ctrlKey: true })
      expect(matchesKeybinding(event, 'Ctrl+K')).toBe(false)
    })
  })

  describe('formatKeybinding', () => {
    it('formats simple key', () => {
      expect(formatKeybinding('escape')).toBe('Escape')
    })

    it('formats Ctrl+key', () => {
      expect(formatKeybinding('ctrl+k')).toBe('Ctrl+K')
    })

    it('formats Ctrl+Shift+key', () => {
      expect(formatKeybinding('ctrl+shift+z')).toBe('Ctrl+Shift+Z')
    })

    it('normalizes Cmd to Ctrl', () => {
      expect(formatKeybinding('cmd+b')).toBe('Ctrl+B')
    })
  })

  describe('eventToKeybinding', () => {
    const createEvent = (key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent => {
      return {
        key,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ...modifiers
      } as KeyboardEvent
    }

    it('returns null for modifier-only keypress', () => {
      const event = createEvent('Control', { ctrlKey: true })
      expect(eventToKeybinding(event)).toBe(null)
    })

    it('converts Ctrl+key event', () => {
      const event = createEvent('k', { ctrlKey: true })
      expect(eventToKeybinding(event)).toBe('Ctrl+K')
    })

    it('converts Ctrl+Shift+key event', () => {
      const event = createEvent('z', { ctrlKey: true, shiftKey: true })
      expect(eventToKeybinding(event)).toBe('Ctrl+Shift+Z')
    })

    it('converts simple key event', () => {
      const event = createEvent('Escape')
      expect(eventToKeybinding(event)).toBe('Escape')
    })

    it('converts space key', () => {
      const event = createEvent(' ')
      expect(eventToKeybinding(event)).toBe('Space')
    })
  })
})
