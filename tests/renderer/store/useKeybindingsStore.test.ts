import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useKeybindingsStore } from '../../../src/renderer/src/store/useKeybindingsStore'

// Mock electron API
vi.mock('../../../src/renderer/src/store/electronZustandStorage', () => ({
  electronZustandStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('useKeybindingsStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useKeybindingsStore.setState({
      keybindings: {
        'command-palette': {
          id: 'command-palette',
          keys: 'Ctrl+K',
          action: 'openCommandPalette',
          description: 'Open Command Palette',
          category: 'navigation'
        },
        'toggle-sidebar': {
          id: 'toggle-sidebar',
          keys: 'Ctrl+B',
          action: 'toggleSidebar',
          description: 'Toggle Sidebar',
          category: 'navigation'
        },
        'toggle-chat': {
          id: 'toggle-chat',
          keys: 'Ctrl+I',
          action: 'toggleChat',
          description: 'Toggle AI Chat Panel',
          category: 'navigation'
        },
        'toggle-zen-mode': {
          id: 'toggle-zen-mode',
          keys: 'Ctrl+Shift+Z',
          action: 'toggleZenMode',
          description: 'Toggle Zen Focus Mode',
          category: 'general'
        },
        'exit-zen-mode': {
          id: 'exit-zen-mode',
          keys: 'Escape',
          action: 'exitZenMode',
          description: 'Exit Zen Mode',
          category: 'general'
        }
      }
    })
  })

  describe('getKeybinding', () => {
    it('returns keybinding by id', () => {
      const { getKeybinding } = useKeybindingsStore.getState()
      const binding = getKeybinding('command-palette')
      expect(binding).toBeDefined()
      expect(binding?.keys).toBe('Ctrl+K')
      expect(binding?.action).toBe('openCommandPalette')
    })

    it('returns undefined for non-existent id', () => {
      const { getKeybinding } = useKeybindingsStore.getState()
      const binding = getKeybinding('non-existent')
      expect(binding).toBeUndefined()
    })
  })

  describe('setKeybinding', () => {
    it('updates keybinding keys', () => {
      const { setKeybinding } = useKeybindingsStore.getState()
      setKeybinding('command-palette', 'Ctrl+P')

      const binding = useKeybindingsStore.getState().getKeybinding('command-palette')
      expect(binding?.keys).toBe('Ctrl+P')
    })

    it('preserves other keybinding properties', () => {
      const { setKeybinding } = useKeybindingsStore.getState()
      setKeybinding('toggle-sidebar', 'Ctrl+\\')

      const binding = useKeybindingsStore.getState().getKeybinding('toggle-sidebar')
      expect(binding?.keys).toBe('Ctrl+\\')
      expect(binding?.description).toBe('Toggle Sidebar')
      expect(binding?.action).toBe('toggleSidebar')
      expect(binding?.category).toBe('navigation')
    })

    it('does nothing for non-existent id', () => {
      const { setKeybinding, keybindings } = useKeybindingsStore.getState()
      const before = { ...keybindings }
      setKeybinding('non-existent', 'Ctrl+X')

      const after = useKeybindingsStore.getState().keybindings
      expect(Object.keys(after)).toEqual(Object.keys(before))
    })
  })

  describe('resetToDefaults', () => {
    it('resets all keybindings to defaults', () => {
      const { setKeybinding, resetToDefaults } = useKeybindingsStore.getState()

      // Change some keybindings
      setKeybinding('command-palette', 'Ctrl+P')
      setKeybinding('toggle-sidebar', 'Ctrl+\\')

      // Verify changes
      expect(useKeybindingsStore.getState().getKeybinding('command-palette')?.keys).toBe('Ctrl+P')

      // Reset
      resetToDefaults()

      // Verify defaults restored
      expect(useKeybindingsStore.getState().getKeybinding('command-palette')?.keys).toBe('Ctrl+K')
      expect(useKeybindingsStore.getState().getKeybinding('toggle-sidebar')?.keys).toBe('Ctrl+B')
    })
  })

  describe('default keybindings', () => {
    it('has all expected default keybindings', () => {
      const { keybindings } = useKeybindingsStore.getState()
      expect(keybindings['command-palette']).toBeDefined()
      expect(keybindings['toggle-sidebar']).toBeDefined()
      expect(keybindings['toggle-chat']).toBeDefined()
      expect(keybindings['toggle-zen-mode']).toBeDefined()
      expect(keybindings['exit-zen-mode']).toBeDefined()
    })

    it('has correct default keys', () => {
      const { keybindings } = useKeybindingsStore.getState()
      expect(keybindings['command-palette'].keys).toBe('Ctrl+K')
      expect(keybindings['toggle-sidebar'].keys).toBe('Ctrl+B')
      expect(keybindings['toggle-chat'].keys).toBe('Ctrl+I')
      expect(keybindings['toggle-zen-mode'].keys).toBe('Ctrl+Shift+Z')
      expect(keybindings['exit-zen-mode'].keys).toBe('Escape')
    })
  })
})
