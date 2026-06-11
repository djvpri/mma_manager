import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Fighter, Gym, GamePlan, CornerAdvice, RoundResult } from '@/types'

interface FightState {
  fighter: Fighter | null
  opponent: {
    name: string
    attrs: Fighter['attrs']
    record: Fighter['record']
    specialty: string
    color: string
  } | null
  phase: 'pregame' | 'gameplan' | 'fighting' | 'corner' | 'result'
  currentRound: number
  gamePlan: GamePlan | null
  cornerAdvice: CornerAdvice
  roundResults: RoundResult[]
  myHP: number
  oppHP: number
  aiCornerText: string
  aiNarration: string
  aiLoading: boolean
  resultSaved: boolean
  fightSummary: {
    purse: number
    reputationChange: number
    newRecord: Fighter['record']
    injury: { name: string; weeks: number } | null
  } | null
}

interface GameStore {
  gym: Gym | null
  fighters: Fighter[]
  fight: FightState
  activeNav: string

  setGym: (gym: Gym) => void
  setFighters: (fighters: Fighter[]) => void
  updateFighter: (id: string, updates: Partial<Fighter>) => void
  removeFighter: (id: string) => void
  resetGame: () => void
  setActiveNav: (nav: string) => void

  // fight actions
  setFightFighter: (f: Fighter) => void
  setOpponent: (opponent: FightState['opponent']) => void
  setFightPhase: (phase: FightState['phase']) => void
  setGamePlan: (plan: GamePlan) => void
  setCornerAdvice: (advice: CornerAdvice) => void
  addRoundResult: (result: RoundResult) => void
  setMyHP: (hp: number) => void
  setOppHP: (hp: number) => void
  setAiCornerText: (text: string) => void
  setAiNarration: (text: string) => void
  setAiLoading: (loading: boolean) => void
  setFightResultSummary: (
    purse: number,
    reputationChange: number,
    newRecord: Fighter['record'],
    injury: { name: string; weeks: number } | null
  ) => void
  advanceRound: () => void
  resetFight: () => void
}

const defaultFight: FightState = {
  fighter: null,
  opponent: null,
  phase: 'pregame',
  currentRound: 1,
  gamePlan: null,
  cornerAdvice: 'patient',
  roundResults: [],
  myHP: 100,
  oppHP: 100,
  aiCornerText: '',
  aiNarration: '',
  aiLoading: false,
  resultSaved: false,
  fightSummary: null,
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      gym: null,
      fighters: [],
      fight: defaultFight,
      activeNav: 'roster',

      setGym: (gym) => set({ gym }),
      setFighters: (fighters) => set({ fighters }),
      updateFighter: (id, updates) =>
        set((s) => ({
          fighters: s.fighters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        })),
      removeFighter: (id) =>
        set((s) => ({
          fighters: s.fighters.filter((f) => f.id !== id),
        })),
      resetGame: () => set({ gym: null, fighters: [], fight: defaultFight, activeNav: 'roster' }),
      setActiveNav: (nav) => set({ activeNav: nav }),

      setFightFighter: (f) =>
        set((s) => ({ fight: { ...s.fight, fighter: f } })),
      setOpponent: (opponent) =>
        set((s) => ({ fight: { ...s.fight, opponent } })),
      setFightPhase: (phase) =>
        set((s) => ({ fight: { ...s.fight, phase } })),
      setGamePlan: (plan) =>
        set((s) => ({ fight: { ...s.fight, gamePlan: plan } })),
      setCornerAdvice: (advice) =>
        set((s) => ({ fight: { ...s.fight, cornerAdvice: advice } })),
      addRoundResult: (result) =>
        set((s) => ({ fight: { ...s.fight, roundResults: [...s.fight.roundResults, result] } })),
      setMyHP: (hp) => set((s) => ({ fight: { ...s.fight, myHP: hp } })),
      setOppHP: (hp) => set((s) => ({ fight: { ...s.fight, oppHP: hp } })),
      setAiCornerText: (text) =>
        set((s) => ({ fight: { ...s.fight, aiCornerText: text } })),
      setAiNarration: (text) =>
        set((s) => ({ fight: { ...s.fight, aiNarration: text } })),
      setAiLoading: (loading) =>
        set((s) => ({ fight: { ...s.fight, aiLoading: loading } })),
      setFightResultSummary: (purse, reputationChange, newRecord, injury) =>
        set((s) => ({
          fight: { ...s.fight, resultSaved: true, fightSummary: { purse, reputationChange, newRecord, injury } },
        })),
      advanceRound: () =>
        set((s) => ({ fight: { ...s.fight, currentRound: s.fight.currentRound + 1, aiNarration: '' } })),
      resetFight: () =>
        set((s) => ({ fight: { ...defaultFight, fighter: s.fight.fighter } })),
    }),
    {
      name: 'mma-manager-game',
      partialize: (s) => ({ gym: s.gym, fighters: s.fighters }),
    }
  )
)
