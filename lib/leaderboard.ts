import { createClient } from './supabase'
import type { Fighter, Gym } from '@/types'

// player_name disamakan dengan gym_name karena belum ada profil manager terpisah
export async function syncLeaderboard(gym: Gym, fighters: Fighter[]) {
  const totalWins = fighters.reduce((sum, f) => sum + f.record.w, 0)
  const supabase = createClient()
  await supabase.from('leaderboard').upsert(
    {
      gym_id: gym.id,
      gym_name: gym.name,
      player_name: gym.name,
      reputation: gym.reputation,
      total_wins: totalWins,
    },
    { onConflict: 'gym_id' }
  )
}
