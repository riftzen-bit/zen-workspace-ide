import { StateStorage } from 'zustand/middleware'

export const electronZustandStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const value = await window.api.store.get(name)
      return value ? JSON.stringify(value) : null
    } catch (err) {
      console.error('Failed to get from store:', err)
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await window.api.store.set(name, JSON.parse(value))
    } catch (err) {
      console.error('Failed to set to store:', err)
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await window.api.store.delete(name)
    } catch (err) {
      console.error('Failed to remove from store:', err)
    }
  }
}
