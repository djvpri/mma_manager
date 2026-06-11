import type { EventTier, Gym, MmaEvent } from '@/types'
import { createClient } from './supabase'

export interface EventTierConfig {
  label: string
  purseMult: number
  reputationMult: number
  attrOffset: number
  attrSpread: number
  recordRange: { wMin: number; wMax: number; lMin: number; lMax: number }
}

export const EVENT_TIER_CONFIG: Record<EventTier, EventTierConfig> = {
  local: {
    label: 'Lokal',
    purseMult: 0.6,
    reputationMult: 0.6,
    attrOffset: -8,
    attrSpread: 10,
    recordRange: { wMin: 1, wMax: 10, lMin: 2, lMax: 10 },
  },
  regional: {
    label: 'Regional',
    purseMult: 1,
    reputationMult: 1,
    attrOffset: 0,
    attrSpread: 12,
    recordRange: { wMin: 3, wMax: 18, lMin: 0, lMax: 8 },
  },
  national: {
    label: 'Nasional',
    purseMult: 1.8,
    reputationMult: 1.6,
    attrOffset: 8,
    attrSpread: 14,
    recordRange: { wMin: 10, wMax: 25, lMin: 0, lMax: 5 },
  },
}

export const EVENT_TIER_BADGE_CLASS: Record<EventTier, string> = {
  local: 'border-gray-500/30 bg-gray-500/15 text-gray-300',
  regional: 'border-octagon-teal/30 bg-octagon-teal/15 text-octagon-teal',
  national: 'border-octagon-amber/30 bg-octagon-amber/15 text-octagon-amber',
}

const EVENT_SERIES: Record<EventTier, string[]> = {
  local: ['Garuda Fight Night', 'Kandang Singa Fight Club', 'Arena Tarung Kota', 'Nusantara Local Series'],
  regional: ['Archipelago Combat League', 'Borneo Warrior Series', 'Java Fighting Championship', 'Sunda Battle Series'],
  national: ['Indonesia Championship Series', 'Garuda National Cup', 'Nusantara Grand Prix', 'Merah Putih Fight Series'],
}

const TIER_WEIGHTS: [EventTier, number][] = [
  ['local', 0.5],
  ['regional', 0.35],
  ['national', 0.15],
]

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function pickTier(): EventTier {
  const roll = Math.random()
  let cumulative = 0
  for (const [tier, weight] of TIER_WEIGHTS) {
    cumulative += weight
    if (roll < cumulative) return tier
  }
  return 'local'
}

function generateEventName(tier: EventTier): string {
  return `${pick(EVENT_SERIES[tier])} Vol. ${randInt(1, 99)}`
}

/** Bulan in-game = 4 minggu. Minggu 1-4 = bulan 1, 5-8 = bulan 2, dst. */
export function getMonthRange(seasonWeek: number): { start: number; end: number } {
  const start = Math.floor((seasonWeek - 1) / 4) * 4 + 1
  return { start, end: start + 3 }
}

export function getEventsForMonth(events: MmaEvent[], seasonWeek: number): MmaEvent[] {
  const { start, end } = getMonthRange(seasonWeek)
  return events.filter((e) => e.week >= start && e.week <= end).sort((a, b) => a.week - b.week)
}

export function hasEventsForMonth(events: MmaEvent[], seasonWeek: number): boolean {
  const { start, end } = getMonthRange(seasonWeek)
  return events.some((e) => e.week >= start && e.week <= end)
}

export function generateMonthEvents(seasonWeek: number): MmaEvent[] {
  const { start, end } = getMonthRange(seasonWeek)
  const availableWeeks: number[] = []
  for (let w = Math.max(start, seasonWeek); w <= end; w++) availableWeeks.push(w)

  const count = Math.min(availableWeeks.length, randInt(2, 3))
  const weeks = shuffle(availableWeeks).slice(0, count).sort((a, b) => a - b)

  return weeks.map((week) => {
    const tier = pickTier()
    return {
      id: crypto.randomUUID(),
      name: generateEventName(tier),
      tier,
      week,
      fighter_ids: [],
    }
  })
}

/** Generate event bulan berjalan jika belum ada, dan simpan ke gym.events. */
export async function ensureEventsForCurrentMonth(gym: Gym): Promise<Gym> {
  if (hasEventsForMonth(gym.events, gym.season_week)) return gym

  const events = [...gym.events, ...generateMonthEvents(gym.season_week)]
  const supabase = createClient()
  const { data, error } = await supabase.from('gyms').update({ events }).eq('id', gym.id).select().single()

  if (error || !data) return gym
  return data as Gym
}
