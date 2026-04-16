import { create } from 'zustand'
import { useZenStore } from './useZenStore'

export type ActivityView =
  | 'explorer'
  | 'search'
  | 'find'
  | 'tasks'
  | 'settings'
  | 'terminal'
  | 'orchestrator'
  | 'projects'
  | 'activity'
  | 'git'
  | 'focus'
  | 'bookmarks'
  | 'notes'

export type SidebarGroup = 'files' | 'work' | 'agents' | 'insights'

export const GROUP_TABS: Record<SidebarGroup, readonly ActivityView[]> = {
  files: ['explorer', 'find', 'bookmarks'],
  work: ['git', 'tasks', 'notes', 'activity'],
  agents: ['projects', 'terminal', 'orchestrator'],
  insights: ['focus']
}

export const GROUP_OF: Record<ActivityView, SidebarGroup | null> = {
  explorer: 'files',
  find: 'files',
  search: 'files',
  bookmarks: 'files',
  git: 'work',
  tasks: 'work',
  notes: 'work',
  activity: 'work',
  projects: 'agents',
  terminal: 'agents',
  orchestrator: 'agents',
  focus: 'insights',
  settings: null
}

export const SIDEBAR_GROUPS: readonly SidebarGroup[] = ['files', 'work']
export const MAIN_VIEW_GROUPS: readonly SidebarGroup[] = ['agents', 'insights']

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'zen-upbeat' | 'zen-chill'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ZenSnapshot {
  isSidebarOpen: boolean
  isChatOpen: boolean
  isVibePlayerOpen: boolean
}

interface PromptState {
  isOpen: boolean
  title: string
  defaultValue: string
  resolve: ((value: string | null) => void) | null
}

interface ConfirmState {
  isOpen: boolean
  title: string
  resolve: ((value: boolean) => void) | null
}

interface UIState {
  activeView: ActivityView
  activeGroup: SidebarGroup
  sidebarWidth: number
  chatWidth: number
  isVibePlayerOpen: boolean
  isChatOpen: boolean
  isSidebarOpen: boolean

  // Dialogs
  promptState: PromptState
  showPrompt: (title: string, defaultValue?: string) => Promise<string | null>
  closePrompt: (value: string | null) => void

  confirmState: ConfirmState
  showConfirm: (title: string) => Promise<boolean>
  closeConfirm: (value: boolean) => void

  // Git Diff state
  activeDiffFile: { file: string; staged: boolean } | null
  setActiveDiffFile: (file: { file: string; staged: boolean } | null) => void

  // Toast system
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
  isNotificationsMuted: boolean
  toggleNotificationsMuted: () => void

  // Zen Mode
  isZenMode: boolean
  zenSnapshot: ZenSnapshot | null
  enterZenMode: () => void
  exitZenMode: () => void

  // Split Editor
  isSplitEditor: boolean
  splitDirection: 'horizontal' | 'vertical'
  secondaryActiveFile: string | null
  toggleSplitEditor: () => void
  setSplitDirection: (direction: 'horizontal' | 'vertical') => void
  setSecondaryActiveFile: (path: string | null) => void

  // Music Generator
  isMusicGeneratorOpen: boolean
  setMusicGeneratorOpen: (open: boolean) => void

  // Command Palette
  isCommandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void

  // Prompt Library
  isPromptLibraryOpen: boolean
  setPromptLibraryOpen: (open: boolean) => void

  // Snippet Library
  isSnippetLibraryOpen: boolean
  setSnippetLibraryOpen: (open: boolean) => void

  // Keybindings
  isKeybindingsOpen: boolean
  setKeybindingsOpen: (open: boolean) => void

  // Editor cursor position (for status bar)
  cursorLine: number
  cursorCol: number
  setCursorPosition: (line: number, col: number) => void

  setActiveView: (view: ActivityView) => void
  setActiveGroup: (group: SidebarGroup) => void
  cycleGroupTab: (direction: 1 | -1) => void
  setSidebarWidth: (width: number) => void
  setChatWidth: (width: number) => void
  toggleVibePlayer: () => void
  setVibePlayerOpen: (isOpen: boolean) => void
  toggleChat: () => void
  setChatOpen: (isOpen: boolean) => void
  toggleSidebar: () => void
  setSidebarOpen: (isOpen: boolean) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  activeView: 'explorer',
  activeGroup: 'files',
  sidebarWidth: 250,
  chatWidth: 350,
  isVibePlayerOpen: false,
  isChatOpen: true,
  isSidebarOpen: true,

  // Git Diff State
  activeDiffFile: null,
  setActiveDiffFile: (file) => set({ activeDiffFile: file }),

  promptState: { isOpen: false, title: '', defaultValue: '', resolve: null },
  showPrompt: (title, defaultValue = '') =>
    new Promise<string | null>((resolve) =>
      set({ promptState: { isOpen: true, title, defaultValue, resolve } })
    ),
  closePrompt: (value) =>
    set((state) => {
      state.promptState.resolve?.(value)
      return { promptState: { isOpen: false, title: '', defaultValue: '', resolve: null } }
    }),

  confirmState: { isOpen: false, title: '', resolve: null },
  showConfirm: (title) =>
    new Promise<boolean>((resolve) => set({ confirmState: { isOpen: true, title, resolve } })),
  closeConfirm: (value) =>
    set((state) => {
      state.confirmState.resolve?.(value)
      return { confirmState: { isOpen: false, title: '', resolve: null } }
    }),

  // Toast system
  toasts: [],
  isNotificationsMuted: false,
  toggleNotificationsMuted: () =>
    set((state) => ({ isNotificationsMuted: !state.isNotificationsMuted })),
  addToast: (message, type = 'info') => {
    if (get().isNotificationsMuted && type !== 'error' && type !== 'warning') {
      return
    }
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => get().removeToast(id), 3000)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  // Zen Mode
  isZenMode: false,
  zenSnapshot: null,
  enterZenMode: () => {
    const { isSidebarOpen, isChatOpen, isVibePlayerOpen } = get()
    set({
      isZenMode: true,
      zenSnapshot: { isSidebarOpen, isChatOpen, isVibePlayerOpen },
      isSidebarOpen: false,
      isChatOpen: false,
      isVibePlayerOpen: false,
      isNotificationsMuted: true
    })
    useZenStore.getState().setZenMode(true)
  },
  exitZenMode: () => {
    const { zenSnapshot } = get()
    set({
      isZenMode: false,
      isSidebarOpen: zenSnapshot?.isSidebarOpen ?? true,
      isChatOpen: zenSnapshot?.isChatOpen ?? true,
      isVibePlayerOpen: zenSnapshot?.isVibePlayerOpen ?? false,
      isNotificationsMuted: false,
      zenSnapshot: null
    })
    useZenStore.getState().setZenMode(false)
  },

  // Split Editor
  isSplitEditor: false,
  splitDirection: 'vertical',
  secondaryActiveFile: null,
  toggleSplitEditor: () =>
    set((state) => ({
      isSplitEditor: !state.isSplitEditor,
      secondaryActiveFile: state.isSplitEditor ? null : state.secondaryActiveFile
    })),
  setSplitDirection: (direction) => set({ splitDirection: direction }),
  setSecondaryActiveFile: (path) => set({ secondaryActiveFile: path }),

  // Music Generator
  isMusicGeneratorOpen: false,
  setMusicGeneratorOpen: (open) => set({ isMusicGeneratorOpen: open }),

  // Command Palette
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

  // Prompt Library
  isPromptLibraryOpen: false,
  setPromptLibraryOpen: (open) => set({ isPromptLibraryOpen: open }),

  // Snippet Library
  isSnippetLibraryOpen: false,
  setSnippetLibraryOpen: (open) => set({ isSnippetLibraryOpen: open }),

  // Keybindings
  isKeybindingsOpen: false,
  setKeybindingsOpen: (open) => set({ isKeybindingsOpen: open }),

  // Editor cursor position
  cursorLine: 1,
  cursorCol: 1,
  setCursorPosition: (line, col) => set({ cursorLine: line, cursorCol: col }),

  setActiveView: (view) => {
    const group = GROUP_OF[view]
    set({ activeView: view, activeGroup: group ?? get().activeGroup })
  },
  setActiveGroup: (group) => {
    const tabs = GROUP_TABS[group]
    const current = get().activeView
    const next = (tabs as readonly ActivityView[]).includes(current) ? current : tabs[0]
    set({ activeGroup: group, activeView: next })
  },
  cycleGroupTab: (direction) => {
    const { activeGroup, activeView } = get()
    const tabs = GROUP_TABS[activeGroup]
    if (tabs.length <= 1) return
    const idx = tabs.indexOf(activeView)
    const base = idx < 0 ? 0 : idx
    const nextIdx = (base + direction + tabs.length) % tabs.length
    set({ activeView: tabs[nextIdx] })
  },
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setChatWidth: (width) => set({ chatWidth: width }),
  toggleVibePlayer: () => set((state) => ({ isVibePlayerOpen: !state.isVibePlayerOpen })),
  setVibePlayerOpen: (isOpen) => set({ isVibePlayerOpen: isOpen }),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen })
}))
