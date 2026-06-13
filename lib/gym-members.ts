// lib/gym-members.ts
// Sistem member gym — kalkulasi target & update fee
import { createClient } from '@/lib/supabase'
import type { Gym } from '@/types'

export const STANDARD_FEE = 350_000
export const FEE_OPTIONS = [250_000, 300_000, 350_000, 400_000, 500_000, 650_000]

/** Total level semua ruangan gym */
export function totalRoomLevels(gym: Gym): number {
  return Object.values(gym.rooms).reduce((s, r) => s + (r?.level ?? 0), 0)
}

/** Multiplier elastisitas harga: fee mahal → target member turun */
export function feeMultiplier(fee: number): number {
  return Math.max(0.5, Math.min(1.5, STANDARD_FEE / fee))
}

/**
 * Target member — HARUS sama dengan rumus di migration 047 (process_gym_members):
 * GREATEST(20, ROUND((40 + reputasi*3 + roomLevels*8 + recentWins*15) * feeMult))
 */
export function calcTargetMembers(gym: Gym, recentWins: number): number {
  const base = 40 + gym.reputation * 3 + totalRoomLevels(gym) * 8 + recentWins * 15
  return Math.max(20, Math.round(base * feeMultiplier(gym.member_fee)))
}

/** Pemasukan member per minggu */
export function weeklyMemberIncome(gym: Gym): number {
  return Math.floor((gym.member_count * gym.member_fee) / 4)
}

/** Jumlah kemenangan fighter dalam 28 hari terakhir */
export async function fetchRecentWins(gymId: string): Promise<number> {
  const supabase = createClient()
  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('fight_results')
    .select('id', { count: 'exact', head: true })
    .eq('gym_id', gymId)
    .eq('overall_winner', 'my')
    .gt('created_at', since)
  return count ?? 0
}

/** Update iuran member */
export async function updateMemberFee(gymId: string, fee: number): Promise<string | null> {
  const supabase = createClient()
  const { error } = await supabase.from('gyms').update({ member_fee: fee }).eq('id', gymId)
  return error ? error.message : null
}
