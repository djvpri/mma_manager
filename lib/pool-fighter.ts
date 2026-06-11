import type { Fighter } from '@/types'
import type { RecruitCandidate } from './generate-recruits'
import { ALL_ATTR_KEYS } from './attrs'

export function poolFighterToCandidate(fighter: Fighter): RecruitCandidate {
  const avgAttr = ALL_ATTR_KEYS.reduce((sum, key) => sum + fighter.attrs[key], 0) / ALL_ATTR_KEYS.length
  const salary_monthly = Math.round((2_000_000 + fighter.potential * 25_000) / 100_000) * 100_000
  const cost = Math.round((avgAttr * 5 + fighter.potential) * 100_000 / 500_000) * 500_000
  return {
    id:           fighter.id,
    name:         fighter.name,
    nickname:     fighter.nickname,
    age:          fighter.age,
    hometown:     fighter.hometown,
    weight_class: fighter.weight_class,
    specialty:    fighter.specialty,
    personality:  fighter.personality,
    attrs:        fighter.attrs,
    record:       fighter.record,
    potential:    fighter.potential,
    avatar_seed:  fighter.avatar_seed,
    salary_monthly,
    cost,
  }
}

export function scoutFee(fighter: Fighter): number {
  if (fighter.age <= 22) return 500_000
  if (fighter.age <= 27) return 1_000_000
  if (fighter.age <= 32) return 2_000_000
  return 1_500_000
}

export function requiredReputation(fighter: Fighter): number {
  const avg = ALL_ATTR_KEYS.reduce((sum, key) => sum + fighter.attrs[key], 0) / ALL_ATTR_KEYS.length
  if (avg >= 76) return 50
  if (avg >= 61) return 25
  return 0
}
