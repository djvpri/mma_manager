import type { Fighter, FighterAttrs } from '@/types'
import { ATTR_NAME_LABELS } from './attrs'

export interface WeeklyReport {
  week: number
  balanceChange: number
  agedUp: boolean
  retirements: { name: string; reason: string }[]
  healed: string[]
  growth: { name: string; attr: string; from: number; to: number }[]
  contractWarnings: string[]
  birthdays: string[]
}

export function buildWeeklyReport(
  prev: Fighter[],
  next: Fighter[],
  prevBalance: number,
  newBalance: number,
  newWeek: number
): WeeklyReport {
  const prevById = new Map(prev.map((f) => [f.id, f]))
  const retirements: WeeklyReport['retirements'] = []
  const healed: string[] = []
  const growth: WeeklyReport['growth'] = []
  const contractWarnings: string[] = []
  const birthdays: string[] = []

  for (const f of next) {
    const p = prevById.get(f.id)
    if (!p) continue

    if (p.status !== 'retired' && f.status === 'retired') {
      const reason = f.age >= 38 ? 'usia veteran' : 'kontrak habis'
      retirements.push({ name: f.name, reason })
      continue
    }

    if (newWeek % 52 === f.birth_week % 52) {
      birthdays.push(f.name)
    }

    if (p.status === 'injured' && f.status === 'training') {
      healed.push(f.name)
    }

    for (const key of Object.keys(ATTR_NAME_LABELS) as (keyof FighterAttrs)[]) {
      if (f.attrs[key] > p.attrs[key]) {
        growth.push({ name: f.name, attr: ATTR_NAME_LABELS[key], from: p.attrs[key], to: f.attrs[key] })
      }
    }

    if (f.status !== 'retired' && f.contract_fights_left <= 1) {
      contractWarnings.push(f.name)
    }
  }

  return {
    week: newWeek,
    balanceChange: newBalance - prevBalance,
    agedUp: newWeek % 12 === 0,
    retirements,
    healed,
    growth,
    contractWarnings,
    birthdays,
  }
}
