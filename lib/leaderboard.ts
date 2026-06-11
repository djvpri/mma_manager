import { createClient } from './supabase'
import type { Fighter, Gym } from '@/types'

export async function syncLeaderboard(gym: Gym, fighters: Fighter[]) {
  const active = fighters.filter((f) => f.status !== 'retired')
  const totalWins = active.reduce((sum, f) => sum + f.record.w, 0)

  const topFighters = [...active]
    .sort((a, b) => b.record.w - a.record.w || b.record.l - a.record.l)
    .slice(0, 3)
    .map((f) => ({
      name: f.name,
      record: `${f.record.w}-${f.record.l}`,
      specialty: f.specialty,
      wins: f.record.w,
    }))

  const supabase = createClient()
  await supabase.from('leaderboard').upsert(
    {
      gym_id: gym.id,
      gym_name: gym.name,
      player_name: gym.name,
      reputation: gym.reputation,
      total_wins: totalWins,
      top_fighters: topFighters,
    },
    { onConflict: 'gym_id' }
  )
}
