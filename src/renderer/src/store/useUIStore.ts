import { create } from 'zustand'

type ActivityView = 'explorer' | 'search' | 'settings' | 'terminal'

interface UIState {
  activeView: ActivityView
  sidebarWidth: number
  chatWidth: number
  isVibePlayerOpen: boolean
  isChatOpen: boolean
  isSidebarOpen: boolean

  setActiveView: (view: ActivityView) => void
  setSidebarWidth: (width: number) => void
  setChatWidth: (width: number) => void
  toggleVibePlayer: () => void
  setVibePlayerOpen: (isOpen: boolean) => void
  toggleChat: () => void
  setChatOpen: (isOpen: boolean) => void
  toggleSidebar: () => void
  setSidebarOpen: (isOpen: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'explorer',
  sidebarWidth: 250,
  chatWidth: 350,
  isVibePlayerOpen: false,
  isChatOpen: true,
  isSidebarOpen: true,

  setActiveView: (view) => set({ activeView: view }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setChatWidth: (width) => set({ chatWidth: width }),
  toggleVibePlayer: () => set((state) => ({ isVibePlayerOpen: !state.isVibePlayerOpen })),
  setVibePlayerOpen: (isOpen) => set({ isVibePlayerOpen: isOpen }),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen })
}))
