import { createClient } from './supabase'
import type { Championship, Fighter, Gym, HallOfFameEntry } from '@/types'

export async function fetchHallOfFame(gymId: string): Promise<HallOfFameEntry[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('hall_of_fame')
    .select('*')
    .eq('gym_id', gymId)
    .order('retired_at_week', { ascending: false })
  return (data ?? []) as HallOfFameEntry[]
}

export async function recordRetirements(
  gym: Gym,
  retiredFighters: Fighter[],
  championships: Championship[]
) {
  if (retiredFighters.length === 0) return

  const championFighterIds = new Set(
    championships.map((c) => c.champion_fighter_id).filter(Boolean)
  )

  const rows = retiredFighters.map((f) => ({
    gym_id: gym.id,
    fighter_id: f.id,
    name: f.name,
    nickname: f.nickname,
    avatar_url: f.avatar_url,
    weight_class: f.weight_class,
    specialty: f.specialty,
    personality: f.personality,
    age_at_retirement: f.age,
    record: f.record,
    attrs: f.attrs,
    was_champion: championFighterIds.has(f.id),
    retired_at_week: gym.season_week,
  }))

  const supabase = createClient()
  await supabase.from('hall_of_fame').insert(rows)
}
