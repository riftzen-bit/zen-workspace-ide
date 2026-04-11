import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentOrchestratorDashboard } from '../../../../src/renderer/src/components/terminal/AgentOrchestratorDashboard'
import { useActivityStore } from '../../../../src/renderer/src/store/useActivityStore'
import { useCostStore } from '../../../../src/renderer/src/store/useCostStore'
import { useSettingsStore } from '../../../../src/renderer/src/store/useSettingsStore'
import { useTerminalStore } from '../../../../src/renderer/src/store/useTerminalStore'
import { useUIStore } from '../../../../src/renderer/src/store/useUIStore'

vi.mock('../../../../src/renderer/src/store/electronZustandStorage', () => ({
  electronZustandStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('AgentOrchestratorDashboard', () => {
  const addToast = vi.fn()
  const broadcast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    Object.defineProperty(window, 'api', {
      value: {
        terminal: {
          broadcast
        }
      },
      writable: true
    })

    useTerminalStore.setState({
      workspaces: [
        {
          id: 'ws-1',
          name: 'Workspace 1',
          layout: 2,
          cliType: 'Terminal',
          status: 'active',
          createdAt: Date.now(),
          terminals: [
            { id: 'term-1', command: 'Terminal', cliType: 'Terminal' },
            { id: 'term-2', command: 'Terminal', cliType: 'Terminal' }
          ]
        }
      ],
      activeWorkspaceId: null,
      isModalOpen: false,
      setModalOpen: vi.fn(),
      createWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      setActiveWorkspace: vi.fn(),
      renameWorkspace: vi.fn(),
      pauseWorkspace: vi.fn(),
      resumeWorkspace: vi.fn(),
      reorderWorkspaces: vi.fn()
    })

    useActivityStore.setState({ events: [], unreadCount: 0 })

    useCostStore.setState({
      totalCost: 0,
      budgetLimit: null,
      autoPauseOnLimit: false,
      warnedAt80: false,
      limitTriggered: false,
      byTerminalId: {}
    })

    useSettingsStore.setState({
      ...useSettingsStore.getState(),
      agentBudgetLimit: null
    })

    useUIStore.setState({
      ...useUIStore.getState(),
      addToast,
      setActiveView: vi.fn()
    })
  })

  it('warns when no live terminals are available', async () => {
    broadcast.mockResolvedValue({
      dispatched: [],
      unavailable: [
        { id: 'term-1', reason: 'not-found' },
        { id: 'term-2', reason: 'not-found' }
      ]
    })

    render(<AgentOrchestratorDashboard />)

    fireEvent.change(screen.getByPlaceholderText('Input instruction...'), {
      target: { value: 'echo "analyzing request"' }
    })
    fireEvent.click(screen.getByText('Execute'))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        'No active terminals found. Open the workspace to start the nodes.',
        'warning'
      )
    })
    expect(useActivityStore.getState().events).toHaveLength(0)
  })

  it('shows partial success feedback when some terminals are offline', async () => {
    broadcast.mockResolvedValue({
      dispatched: ['term-1'],
      unavailable: [{ id: 'term-2', reason: 'not-ready' }]
    })

    render(<AgentOrchestratorDashboard />)

    fireEvent.change(screen.getByPlaceholderText('Input instruction...'), {
      target: { value: 'echo "analyzing request"' }
    })
    fireEvent.click(screen.getByText('Execute'))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(
        'Executed on 1/2 nodes. Some terminals are offline.',
        'warning'
      )
    })
    expect(broadcast).toHaveBeenCalledWith(['term-1', 'term-2'], 'echo "analyzing request"\r')
    expect(
      screen.getAllByText('Broadcast dispatched: echo "analyzing request"').length
    ).toBeGreaterThan(0)
  })

  it('shows success feedback when all terminals are live', async () => {
    broadcast.mockResolvedValue({
      dispatched: ['term-1', 'term-2'],
      unavailable: []
    })

    render(<AgentOrchestratorDashboard />)

    fireEvent.change(screen.getByPlaceholderText('Input instruction...'), {
      target: { value: 'echo "analyzing request"' }
    })
    fireEvent.click(screen.getByText('Execute'))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith('Executed on 2 nodes', 'success')
    })
    expect(useActivityStore.getState().events).toHaveLength(2)
    expect(
      useActivityStore.getState().events.every((event) => event.type === 'command')
    ).toBe(true)
  })
})
