import { create } from 'zustand'

function parseDollarAmount(costValue: string): number {
  const m = costValue.match(/[\d]+\.[\d]+|[\d]+/)
  return m ? parseFloat(m[0]) : 0
}

interface CostState {
  totalCost: number
  budgetLimit: number | null
  autoPauseOnLimit: boolean
  warnedAt80: boolean
  limitTriggered: boolean
  byTerminalId: Record<string, number>
  addCost: (costValue: string) => void
  addTerminalCost: (terminalId: string, costValue: string) => void
  resetCost: () => void
  setBudgetLimit: (value: number | null) => void
  setAutoPauseOnLimit: (value: boolean) => void
  setLimitTriggered: (value: boolean) => void
}

export const useCostStore = create<CostState>((set) => ({
  totalCost: 0,
  budgetLimit: null,
  autoPauseOnLimit: false,
  warnedAt80: false,
  limitTriggered: false,
  byTerminalId: {},
  addCost: (costValue) => {
    const amount = parseDollarAmount(costValue)
    if (amount > 0) {
      set((state) => {
        const totalCost = +(state.totalCost + amount).toFixed(6)
        const warnedAt80 =
          state.warnedAt80 ||
          (state.budgetLimit !== null &&
            state.budgetLimit > 0 &&
            totalCost >= state.budgetLimit * 0.8)
        return { totalCost, warnedAt80 }
      })
    }
  },
  addTerminalCost: (terminalId, costValue) => {
    const amount = parseDollarAmount(costValue)
    if (amount > 0) {
      set((state) => {
        const nextTerminalCost = +((state.byTerminalId[terminalId] ?? 0) + amount).toFixed(6)
        const totalCost = +(state.totalCost + amount).toFixed(6)
        const warnedAt80 =
          state.warnedAt80 ||
          (state.budgetLimit !== null &&
            state.budgetLimit > 0 &&
            totalCost >= state.budgetLimit * 0.8)
        return {
          totalCost,
          warnedAt80,
          byTerminalId: {
            ...state.byTerminalId,
            [terminalId]: nextTerminalCost
          }
        }
      })
    }
  },
  resetCost: () =>
    set({ totalCost: 0, byTerminalId: {}, warnedAt80: false, limitTriggered: false }),
  setBudgetLimit: (value) => set({ budgetLimit: value, warnedAt80: false, limitTriggered: false }),
  setAutoPauseOnLimit: (value) => set({ autoPauseOnLimit: value }),
  setLimitTriggered: (value) => set({ limitTriggered: value })
}))
