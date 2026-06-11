import { createClient } from './supabase'
import type { Fighter, Gym, MmaEvent, EventSlot } from '@/types'

export type TitleFightResult = 'won' | 'defended' | 'lost' | null

export function isTitleFight(event: MmaEvent | null, slot: EventSlot | null): boolean {
  return event?.promotion === 'championship' && slot?.type === 'main'
}

// Update tabel championships setelah title fight selesai.
// Return 'won' (rebut gelar), 'defended' (pertahankan gelar), 'lost' (gelar lepas), atau null (tidak ada perubahan).
export async function resolveTitleFight(fighter: Fighter, gym: Gym, won: boolean): Promise<TitleFightResult> {
  const supabase = createClient()

  const { data: belt } = await supabase
    .from('championships')
    .select('champion_fighter_id, title_defenses')
    .eq('weight_class', fighter.weight_class)
    .single()

  if (!belt) return null

  const isCurrentChampion = belt.champion_fighter_id === fighter.id

  if (won) {
    if (isCurrentChampion) {
      await supabase
        .from('championships')
        .update({ title_defenses: belt.title_defenses + 1, updated_at: new Date().toISOString() })
        .eq('weight_class', fighter.weight_class)
      return 'defended'
    }

    await supabase
      .from('championships')
      .update({
        champion_fighter_id: fighter.id,
        champion_gym_id: gym.id,
        champion_gym_name: gym.name,
        champion_name: fighter.name,
        title_defenses: 0,
        won_at_week: gym.season_week,
        updated_at: new Date().toISOString(),
      })
      .eq('weight_class', fighter.weight_class)
    return 'won'
  }

  if (isCurrentChampion) {
    await supabase
      .from('championships')
      .update({
        champion_fighter_id: null,
        champion_gym_id: null,
        champion_gym_name: null,
        champion_name: null,
        title_defenses: 0,
        won_at_week: null,
        updated_at: new Date().toISOString(),
      })
      .eq('weight_class', fighter.weight_class)
    return 'lost'
  }

  return null
}
