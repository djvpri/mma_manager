import { createClient } from './supabase'
import type { GamePlan, CornerAdvice, RoundResult } from '@/types'

export type PvpStatus = 'pending' | 'gameplan' | 'active' | 'finished' | 'declined' | 'cancelled'

export interface PvpMatch {
  id: string
  challenger_gym_id: string
  opponent_gym_id: string
  challenger_gym_name: string
  opponent_gym_name: string
  challenger_fighter_id: string
  opponent_fighter_id: string | null
  challenger_fighter_name: string | null
  opponent_fighter_name: string | null
  status: PvpStatus
  current_round: number
  challenger_game_plan: GamePlan | null
  opponent_game_plan: GamePlan | null
  challenger_corner: CornerAdvice | null
  opponent_corner: CornerAdvice | null
  round_results: RoundResult[]
  challenger_hp: number
  opponent_hp: number
  challenger_stamina: number
  opponent_stamina: number
  challenger_mental: number
  opponent_mental: number
  winner_gym_id: string | null
  finish_method: string | null
  created_at: string
  updated_at: string
  my_side: 'challenger' | 'opponent'
}

export async function fetchMyPvpMatches(): Promise<PvpMatch[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('pvp_my_matches')
  if (error || !data) return []
  return data as PvpMatch[]
}

export async function createPvpChallenge(friendCode: string, fighterId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('pvp_create_challenge', {
    p_friend_code: friendCode,
    p_fighter_id: fighterId,
  })
  return { error: error?.message ?? null }
}

export async function respondPvpChallenge(matchId: string, fighterId: string | null, accept: boolean): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('pvp_respond_challenge', {
    p_match_id: matchId,
    p_fighter_id: fighterId,
    p_accept: accept,
  })
  return { error: error?.message ?? null }
}

export async function setPvpGamePlan(matchId: string, gamePlan: GamePlan): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('pvp_set_gameplan', {
    p_match_id: matchId,
    p_game_plan: gamePlan,
  })
  return { error: error?.message ?? null }
}

export async function cancelPvpChallenge(matchId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('pvp_cancel_challenge', { p_match_id: matchId })
  return { error: error?.message ?? null }
}
