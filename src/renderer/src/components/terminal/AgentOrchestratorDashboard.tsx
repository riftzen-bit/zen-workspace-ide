import { useMemo, useState } from 'react'
import { useTerminalStore } from '../../store/useTerminalStore'
import { useActivityStore } from '../../store/useActivityStore'
import { useCostStore } from '../../store/useCostStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useUIStore } from '../../store/useUIStore'

type AgentCard = {
  workspaceId: string
  workspaceName: string
  terminalId: string
  cliType: string
  status: 'idle' | 'working' | 'waiting' | 'error' | 'done' | 'paused'
  latestMessage: string
  lastActivityAt: number | null
  cost: number
}

function buildCommandPreview(input: string): string {
  const singleLine = input.replace(/\s+/g, ' ').trim()
  return singleLine.length > 80 ? `${singleLine.slice(0, 80)}...` : singleLine
}

function resolveStatus(
  paused: boolean,
  latestEvent: ReturnType<typeof useActivityStore.getState>['events'][number] | undefined
): AgentCard['status'] {
  if (paused) return 'paused'
  if (!latestEvent) return 'idle'
  if (latestEvent.agentStatus) return latestEvent.agentStatus
  if (latestEvent.type === 'error') return 'error'
  if (latestEvent.type === 'permission') return 'waiting'
  if (latestEvent.type === 'task_done') return 'done'
  return 'working'
}

export const AgentOrchestratorDashboard = () => {
  const { workspaces, setActiveWorkspace } = useTerminalStore()
  const { events, addEvent } = useActivityStore()
  const { byTerminalId, totalCost } = useCostStore()
  const { agentBudgetLimit } = useSettingsStore()
  const { addToast, setActiveView } = useUIStore()
  const [selectedTerminalIds, setSelectedTerminalIds] = useState<string[]>([])
  const [broadcastInput, setBroadcastInput] = useState('')

  const agentCards = useMemo(() => {
    return workspaces.flatMap((workspace) =>
      workspace.terminals.map((terminal) => {
        const latestEvent = events.find((event) => event.terminalId === terminal.id)
        const latestStatusEvent = events.find(
          (event) => event.terminalId === terminal.id && event.type !== 'command'
        )
        return {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          terminalId: terminal.id,
          cliType: terminal.cliType,
          status: resolveStatus(workspace.status === 'paused', latestStatusEvent),
          latestMessage: latestEvent?.message ?? 'Awaiting data',
          lastActivityAt: latestEvent?.timestamp ?? null,
          cost: byTerminalId[terminal.id] ?? 0
        } satisfies AgentCard
      })
    )
  }, [byTerminalId, events, workspaces])

  const selectedAgents = useMemo(() => {
    return selectedTerminalIds.length > 0
      ? agentCards.filter((card) => selectedTerminalIds.includes(card.terminalId))
      : agentCards
  }, [agentCards, selectedTerminalIds])
  const workingCount = agentCards.filter((agent) =>
    ['working', 'waiting'].includes(agent.status)
  ).length
  const selectedCost = selectedAgents.reduce((total, agent) => total + agent.cost, 0)
  const busyAgentIds = agentCards
    .filter((agent) => ['working', 'waiting'].includes(agent.status))
    .map((agent) => agent.terminalId)

  const timelineEvents = useMemo(() => {
    const targetIds = new Set(selectedAgents.map((agent) => agent.terminalId))
    return events.filter((event) => targetIds.has(event.terminalId)).slice(0, 40)
  }, [events, selectedAgents])

  const toggleSelection = (terminalId: string) => {
    setSelectedTerminalIds((current) =>
      current.includes(terminalId)
        ? current.filter((id) => id !== terminalId)
        : [...current, terminalId]
    )
  }

  const handleBroadcast = async () => {
    if (!broadcastInput.trim()) return
    const normalizedInput = broadcastInput.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const payload = normalizedInput.endsWith('\n')
      ? normalizedInput.slice(0, -1).replace(/\n/g, '\r') + '\r'
      : normalizedInput.replace(/\n/g, '\r') + '\r'
    const targets = selectedAgents.map((agent) => agent.terminalId)
    if (targets.length === 0) {
      addToast('No target selected', 'warning')
      return
    }
    const result = await window.api.terminal.broadcast(targets, payload).catch(() => ({
      dispatched: [],
      unavailable: targets.map((id) => ({ id, reason: 'broadcast-failed' }))
    }))

    if (result.dispatched.length === 0) {
      addToast('No active terminals found. Open the workspace to start the nodes.', 'warning')
      return
    }

    const commandPreview = buildCommandPreview(normalizedInput)
    result.dispatched.forEach((terminalId) => {
      addEvent({
        id: `manual-${terminalId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        terminalId,
        type: 'command',
        message: `Broadcast dispatched: ${commandPreview}`,
        timestamp: Date.now()
      })
    })

    if (result.dispatched.length === targets.length) {
      addToast(
        `Executed on ${result.dispatched.length} node${result.dispatched.length === 1 ? '' : 's'}`,
        'success'
      )
    } else {
      addToast(
        `Executed on ${result.dispatched.length}/${targets.length} nodes. Some terminals are offline.`,
        'warning'
      )
    }

    setBroadcastInput('')
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-800 p-px gap-px font-mono text-[10px] uppercase overflow-hidden">
      {/* Top Ribbon (Horizontal Header & Stats) */}
      <div className="flex flex-col md:flex-row gap-px shrink-0">
        <div className="bg-[#000000] p-4 flex-1 flex flex-col justify-center">
          <h1 className="text-[14px] text-zinc-100 tracking-widest mb-1">Agent Orchestrator</h1>
          <p className="text-zinc-600 text-[9px]">Global node coordination matrix</p>
        </div>
        <div className="bg-[#000000] p-4 flex flex-col justify-center min-w-[120px]">
          <span className="text-zinc-600 mb-1 tracking-widest">Active</span>
          <span className="text-zinc-200 text-[16px]">{agentCards.length}</span>
        </div>
        <div className="bg-[#000000] p-4 flex flex-col justify-center min-w-[120px]">
          <span className="text-zinc-600 mb-1 tracking-widest">Busy</span>
          <span className="text-zinc-200 text-[16px]">{workingCount}</span>
        </div>
        <div className="bg-[#000000] p-4 flex flex-col justify-center min-w-[140px]">
          <span className="text-zinc-600 mb-1 tracking-widest">Sess. Cost</span>
          <div className="flex items-baseline gap-1">
            <span className="text-zinc-200 text-[16px]">{totalCost.toFixed(4)}</span>
            {agentBudgetLimit !== null && (
              <span className="text-zinc-600 text-[9px]">/ {agentBudgetLimit.toFixed(2)}</span>
            )}
          </div>
        </div>
        <div className="bg-[#000000] p-4 flex flex-col justify-center min-w-[140px]">
          <span className="text-zinc-600 mb-1 tracking-widest">Target Cost</span>
          <span className="text-zinc-200 text-[16px]">{selectedCost.toFixed(4)}</span>
        </div>
      </div>

      {/* Main Workspace Split */}
      <div className="flex flex-col lg:flex-row flex-1 gap-px min-h-0">
        {/* Left Pane: Broadcast & Timeline */}
        <div className="flex flex-col w-full lg:w-[340px] xl:w-[400px] gap-px shrink-0 min-h-0">
          {/* Broadcast Input Box */}
          <div className="bg-[#000000] p-4 flex flex-col shrink-0">
            <div className="flex justify-between text-zinc-500 mb-3 tracking-widest">
              <span>Broadcast</span>
              <span>Sel: {selectedAgents.length}</span>
            </div>
            <textarea
              value={broadcastInput}
              onChange={(e) => setBroadcastInput(e.target.value)}
              rows={3}
              placeholder="Input instruction..."
              className="w-full bg-[#050505] border border-zinc-800 text-zinc-300 p-3 focus:outline-none focus:border-zinc-500 resize-none normal-case font-mono mb-3"
            />
            <div className="flex gap-px bg-zinc-800">
              <button
                onClick={() => setSelectedTerminalIds([])}
                className="flex-1 bg-[#000000] hover:bg-zinc-900 text-zinc-400 py-2 transition-colors"
              >
                All
              </button>
              <button
                onClick={() => setSelectedTerminalIds(busyAgentIds)}
                className="flex-1 bg-[#000000] hover:bg-zinc-900 text-zinc-400 py-2 transition-colors"
              >
                Busy
              </button>
              <button
                onClick={handleBroadcast}
                className="flex-[2] bg-zinc-200 text-[#000000] hover:bg-white font-bold py-2 transition-colors"
              >
                Execute
              </button>
            </div>
          </div>

          {/* Timeline Scrollable Pane */}
          <div className="bg-[#000000] flex-1 overflow-y-auto flex flex-col p-4 relative">
            <div className="sticky top-0 bg-[#000000] pb-3 text-zinc-500 tracking-widest z-10">
              Event Log
            </div>
            {timelineEvents.length === 0 ? (
              <div className="m-auto text-zinc-700">No events found</div>
            ) : (
              <div className="flex flex-col gap-4">
                {timelineEvents.map((event) => (
                  <div key={event.id} className="flex flex-col gap-1 border-l border-zinc-800 pl-3">
                    <div className="flex justify-between items-start">
                      <span className="text-zinc-400 border border-zinc-800 px-1 py-0.5 leading-none">
                        {event.type}
                      </span>
                      <span className="text-zinc-600">
                        {new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}
                      </span>
                    </div>
                    <span className="text-zinc-300 normal-case break-words leading-relaxed mt-1">
                      {event.message}
                    </span>
                    {event.costValue && (
                      <span className="text-zinc-500 mt-1">{event.costValue}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Dense Agent Table */}
        <div className="bg-[#000000] flex-1 flex flex-col min-h-0 relative">
          {/* Table Header */}
          <div className="grid grid-cols-[30px_minmax(0,1.5fr)_minmax(0,1fr)_70px] gap-4 p-3 border-b border-zinc-800 text-zinc-500 tracking-widest sticky top-0 bg-[#000000] z-10 shrink-0">
            <div className="text-center">#</div>
            <div>Node</div>
            <div>Latest output</div>
            <div className="text-right">Cost</div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto">
            {agentCards.map((agent) => {
              const isSelected = selectedTerminalIds.includes(agent.terminalId)
              return (
                <div
                  key={agent.terminalId}
                  onClick={() => toggleSelection(agent.terminalId)}
                  className={`grid grid-cols-[30px_minmax(0,1.5fr)_minmax(0,1fr)_70px] gap-4 p-3 border-b border-zinc-900 cursor-pointer transition-colors group ${isSelected ? 'bg-zinc-900/40' : 'hover:bg-zinc-950'}`}
                >
                  {/* Select Checkbox */}
                  <div className="flex items-start justify-center pt-0.5">
                    <div
                      className={`w-2.5 h-2.5 border transition-colors ${isSelected ? 'bg-zinc-200 border-zinc-200' : 'border-zinc-700 group-hover:border-zinc-500'}`}
                    />
                  </div>

                  {/* Node Info */}
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-200 font-bold truncate tracking-wider">
                        {agent.workspaceName}
                      </span>
                      <span className="text-zinc-600 text-[9px] border border-zinc-800 px-1 hidden sm:inline-block shrink-0">
                        {agent.cliType}
                      </span>
                      <span
                        className={`text-[9px] px-1 shrink-0 ${agent.status === 'working' ? 'bg-zinc-200 text-black' : agent.status === 'error' ? 'bg-zinc-800 text-white' : 'text-zinc-500 border border-zinc-800'}`}
                      >
                        {agent.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600">
                      <span className="shrink-0">{agent.terminalId.substring(0, 8)}</span>
                      <span className="shrink-0">|</span>
                      <span className="shrink-0">
                        {agent.lastActivityAt
                          ? new Date(agent.lastActivityAt).toLocaleTimeString([], { hour12: false })
                          : '--:--'}
                      </span>
                    </div>
                  </div>

                  {/* Output Log */}
                  <div className="min-w-0 flex items-start">
                    <span className="text-zinc-400 normal-case line-clamp-2 leading-relaxed">
                      {agent.latestMessage}
                    </span>
                  </div>

                  {/* Cost & Action */}
                  <div className="flex flex-col items-end justify-between">
                    <span className="text-zinc-300">{agent.cost.toFixed(4)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveWorkspace(agent.workspaceId)
                        setActiveView('terminal')
                      }}
                      className="text-zinc-600 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-all text-[9px] border border-zinc-800 px-1"
                    >
                      OPEN
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
