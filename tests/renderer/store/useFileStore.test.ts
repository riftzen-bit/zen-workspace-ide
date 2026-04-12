import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'

vi.mock('../../../src/renderer/src/store/electronZustandStorage', () => ({
  electronZustandStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
  }
}))

import { useFileStore } from '../../../src/renderer/src/store/useFileStore'

describe('useFileStore', () => {
  beforeEach(() => {
    useFileStore.setState({
      workspaceDir: null,
      fileTree: [],
      openFiles: [],
      activeFile: null,
      activeSearchQuery: null,
      pendingLocation: null,
      editorSelection: '',
      fileContents: {},
      isSaving: false,
      recentFiles: []
    })
  })

  describe('basic file operations', () => {
    it('setWorkspaceDir updates workspace directory', () => {
      act(() => {
        useFileStore.getState().setWorkspaceDir('/path/to/workspace')
      })
      expect(useFileStore.getState().workspaceDir).toBe('/path/to/workspace')
    })

    it('openFile adds file to openFiles and sets activeFile', () => {
      act(() => {
        useFileStore.getState().openFile('/test/file.ts', 'file.ts', 'content')
      })
      const state = useFileStore.getState()
      expect(state.openFiles).toHaveLength(1)
      expect(state.openFiles[0].path).toBe('/test/file.ts')
      expect(state.activeFile).toBe('/test/file.ts')
      expect(state.fileContents['/test/file.ts']).toBe('content')
    })

    it('openFile does not duplicate already open files', () => {
      act(() => {
        useFileStore.getState().openFile('/test/file.ts', 'file.ts', 'content')
        useFileStore.getState().openFile('/test/file.ts', 'file.ts', 'new content')
      })
      const state = useFileStore.getState()
      expect(state.openFiles).toHaveLength(1)
      expect(state.fileContents['/test/file.ts']).toBe('content') // original preserved
    })

    it('closeFile removes file and updates activeFile', () => {
      act(() => {
        useFileStore.getState().openFile('/test/file1.ts', 'file1.ts', 'content1')
        useFileStore.getState().openFile('/test/file2.ts', 'file2.ts', 'content2')
        useFileStore.getState().closeFile('/test/file2.ts')
      })
      const state = useFileStore.getState()
      expect(state.openFiles).toHaveLength(1)
      expect(state.activeFile).toBe('/test/file1.ts')
      expect(state.fileContents['/test/file2.ts']).toBeUndefined()
    })

    it('updateFileContent updates content for a file', () => {
      act(() => {
        useFileStore.getState().openFile('/test/file.ts', 'file.ts', 'original')
        useFileStore.getState().updateFileContent('/test/file.ts', 'updated')
      })
      expect(useFileStore.getState().fileContents['/test/file.ts']).toBe('updated')
    })
  })

  describe('recentFiles functionality', () => {
    it('openFile adds file to recentFiles', () => {
      act(() => {
        useFileStore.getState().openFile('/test/file.ts', 'file.ts', 'content')
      })
      const { recentFiles } = useFileStore.getState()
      expect(recentFiles).toHaveLength(1)
      expect(recentFiles[0].path).toBe('/test/file.ts')
      expect(recentFiles[0].name).toBe('file.ts')
      expect(typeof recentFiles[0].lastOpened).toBe('number')
    })

    it('openFile moves existing file to top of recentFiles', () => {
      act(() => {
        useFileStore.getState().openFile('/test/file1.ts', 'file1.ts', 'content1')
        useFileStore.getState().openFile('/test/file2.ts', 'file2.ts', 'content2')
        useFileStore.getState().openFile('/test/file1.ts', 'file1.ts', 'content1')
      })
      const { recentFiles } = useFileStore.getState()
      expect(recentFiles).toHaveLength(2)
      expect(recentFiles[0].path).toBe('/test/file1.ts')
      expect(recentFiles[1].path).toBe('/test/file2.ts')
    })

    it('recentFiles maintains max 20 entries', () => {
      act(() => {
        for (let i = 0; i < 25; i++) {
          useFileStore.getState().openFile(`/test/file${i}.ts`, `file${i}.ts`, `content${i}`)
        }
      })
      const { recentFiles } = useFileStore.getState()
      expect(recentFiles).toHaveLength(20)
      expect(recentFiles[0].path).toBe('/test/file24.ts') // most recent
      expect(recentFiles[19].path).toBe('/test/file5.ts') // oldest kept
    })

    it('clearRecentFiles empties the list', () => {
      act(() => {
        useFileStore.getState().openFile('/test/file1.ts', 'file1.ts', 'content1')
        useFileStore.getState().openFile('/test/file2.ts', 'file2.ts', 'content2')
        useFileStore.getState().clearRecentFiles()
      })
      expect(useFileStore.getState().recentFiles).toHaveLength(0)
    })

    it('removeFromRecentFiles removes specific file', () => {
      act(() => {
        useFileStore.getState().openFile('/test/file1.ts', 'file1.ts', 'content1')
        useFileStore.getState().openFile('/test/file2.ts', 'file2.ts', 'content2')
        useFileStore.getState().openFile('/test/file3.ts', 'file3.ts', 'content3')
        useFileStore.getState().removeFromRecentFiles('/test/file2.ts')
      })
      const { recentFiles } = useFileStore.getState()
      expect(recentFiles).toHaveLength(2)
      expect(recentFiles.find((f) => f.path === '/test/file2.ts')).toBeUndefined()
    })
  })

  describe('pendingLocation', () => {
    it('setPendingLocation sets path, line, and column', () => {
      act(() => {
        useFileStore.getState().setPendingLocation('/test/file.ts', 10, 5)
      })
      const { pendingLocation, activeFile } = useFileStore.getState()
      expect(pendingLocation).toEqual({ path: '/test/file.ts', line: 10, column: 5 })
      expect(activeFile).toBe('/test/file.ts')
    })

    it('setPendingLocation defaults column to 1', () => {
      act(() => {
        useFileStore.getState().setPendingLocation('/test/file.ts', 10)
      })
      expect(useFileStore.getState().pendingLocation?.column).toBe(1)
    })

    it('clearPendingLocation resets to null', () => {
      act(() => {
        useFileStore.getState().setPendingLocation('/test/file.ts', 10)
        useFileStore.getState().clearPendingLocation()
      })
      expect(useFileStore.getState().pendingLocation).toBeNull()
    })
  })

  describe('resetForProjectSwitch', () => {
    it('resets file-related state but preserves workspaceDir and recentFiles', () => {
      act(() => {
        useFileStore.getState().setWorkspaceDir('/workspace')
        useFileStore.getState().openFile('/test/file.ts', 'file.ts', 'content')
        useFileStore.getState().setEditorSelection('selected text')
        useFileStore.getState().resetForProjectSwitch()
      })
      const state = useFileStore.getState()
      expect(state.fileTree).toEqual([])
      expect(state.openFiles).toEqual([])
      expect(state.activeFile).toBeNull()
      expect(state.fileContents).toEqual({})
      expect(state.editorSelection).toBe('')
      expect(state.recentFiles).toHaveLength(1) // preserved
      expect(state.workspaceDir).toBe('/workspace') // preserved
    })
  })

  describe('markFileDeleted', () => {
    it('removes file from openFiles and fileContents', () => {
      act(() => {
        useFileStore.getState().openFile('/test/file1.ts', 'file1.ts', 'content1')
        useFileStore.getState().openFile('/test/file2.ts', 'file2.ts', 'content2')
        useFileStore.getState().markFileDeleted('/test/file2.ts')
      })
      const state = useFileStore.getState()
      expect(state.openFiles).toHaveLength(1)
      expect(state.fileContents['/test/file2.ts']).toBeUndefined()
      expect(state.activeFile).toBe('/test/file1.ts')
    })
  })

  describe('reloadFileFromDisk', () => {
    it('updates file content without affecting other state', () => {
      act(() => {
        useFileStore.getState().openFile('/test/file.ts', 'file.ts', 'original')
        useFileStore.getState().reloadFileFromDisk('/test/file.ts', 'reloaded from disk')
      })
      expect(useFileStore.getState().fileContents['/test/file.ts']).toBe('reloaded from disk')
    })
  })
})
