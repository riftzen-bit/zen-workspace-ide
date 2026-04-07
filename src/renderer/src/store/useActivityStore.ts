import { create } from 'zustand'

export type ActivityEventType =
  | 'file_write'
  | 'file_create'
  | 'file_delete'
  | 'error'
  | 'cost'
  | 'task_done'
  | 'permission'

export interface ActivityEvent {
  id: string
  terminalId: string
  type: ActivityEventType
  message: string
  filePath?: string
  costValue?: string
  timestamp: number
}

const MAX_EVENTS = 200

interface ActivityState {
  events: ActivityEvent[]
  unreadCount: number
  addEvent: (event: ActivityEvent) => void
  clearEvents: () => void
  markAllRead: () => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  unreadCount: 0,

  addEvent: (event) =>
    set((state) => {
      const newEvents = [event, ...state.events].slice(0, MAX_EVENTS)
      return { events: newEvents, unreadCount: state.unreadCount + 1 }
    }),

  clearEvents: () => set({ events: [], unreadCount: 0 }),

  markAllRead: () => set({ unreadCount: 0 })
}))
