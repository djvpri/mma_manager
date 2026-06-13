// lib/scouting.ts
// Sistem scouting: kalkulasi rating bintang, kapasitas & durasi misi.
import { createClient } from '@/lib/supabase'
import { getCategoryAverages } from '@/lib/attrs'
import type { Fighter, Staff } from '@/types'

export const SCOUT_SPECIALTY = 'Scouting'

export interface ScoutMission {
  id: string
  gym_id: string
  fighter_id: string
  weeks_total: number
  weeks_remaining: number
  status: 'in_progress' | 'completed'
}

/** Jumlah misi paralel = jumlah Talent Scout yang direkrut */
export function scoutCapacity(staff: Staff[]): number {
  return staff.filter((s) => s.is_hired && s.specialty === SCOUT_SPECIALTY).length
}

/** Durasi misi (minggu) — scout rating tinggi = lebih cepat. Tanpa scout: 4 minggu. */
export function scoutDuration(staff: Staff[]): number {
  const scouts = staff.filter((s) => s.is_hired && s.specialty === SCOUT_SPECIALTY)
  if (scouts.length === 0) return 4
  const best = Math.max(...scouts.map((s) => s.rating))
  return Math.max(1, 5 - best)
}

function starsFromScore(score: number): number {
  if (score >= 85) return 5
  if (score >= 70) return 4
  if (score >= 55) return 3
  if (score >= 40) return 2
  return 1
}

/** Skor kemampuan rata-rata seluruh kategori atribut (0-100) */
export function overallScore(fighter: Fighter): number {
  const cats = getCategoryAverages(fighter.attrs)
  return Math.round(cats.reduce((s, c) => s + c.value, 0) / cats.length)
}

export function abilityStars(fighter: Fighter): number {
  return starsFromScore(overallScore(fighter))
}

export function potentialStars(fighter: Fighter): number {
  return starsFromScore(fighter.potential)
}

export function starString(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

export async function fetchScoutMissions(gymId: string): Promise<ScoutMission[]> {
  const supabase = createClient()
  const { data } = await supabase.from('scout_missions').select('*').eq('gym_id', gymId)
  return (data ?? []) as ScoutMission[]
}

export async function startScoutMission(
  gymId: string,
  fighterId: string,
  weeksTotal: number
): Promise<{ mission: ScoutMission | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('scout_missions')
    .insert({ gym_id: gymId, fighter_id: fighterId, weeks_total: weeksTotal, weeks_remaining: weeksTotal })
    .select()
    .single()
  return { mission: error ? null : (data as ScoutMission), error: error?.message ?? null }
}
