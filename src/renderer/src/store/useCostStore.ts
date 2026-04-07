import { create } from 'zustand'

function parseDollarAmount(costValue: string): number {
  const m = costValue.match(/[\d]+\.[\d]+|[\d]+/)
  return m ? parseFloat(m[0]) : 0
}

interface CostState {
  totalCost: number
  addCost: (costValue: string) => void
  resetCost: () => void
}

export const useCostStore = create<CostState>((set) => ({
  totalCost: 0,
  addCost: (costValue) => {
    const amount = parseDollarAmount(costValue)
    if (amount > 0) {
      set((state) => ({ totalCost: +(state.totalCost + amount).toFixed(6) }))
    }
  },
  resetCost: () => set({ totalCost: 0 })
}))
