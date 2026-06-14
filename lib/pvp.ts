import { createClient } from './supabase'
import type { GamePlan, CornerAdvice, RoundResult } from '@/types'

export type PvpStatus = 'waiting' | 'pending' | 'gameplan' | 'active' | 'finished' | 'declined' | 'cancelled'

export interface PvpMatch {
  id: string
  challenger_gym_id: string
  opponent_gym_id: string | null
  challenger_gym_name: string
  opponent_gym_name: string | null
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

export async function fetchPvpMatch(matchId: string): Promise<PvpMatch | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('pvp_get_match', { p_match_id: matchId })
  if (error || !data || data.length === 0) return null
  return data[0] as PvpMatch
}

/** Subscribe ke perubahan realtime pada 1 baris pvp_matches. Mengembalikan
 *  fungsi unsubscribe. Payload realtime hanya kolom mentah tabel (tanpa
 *  nama gym/fighter dari JOIN) — merge dengan state yang sudah ada di caller. */
export function subscribeToPvpMatch(matchId: string, onUpdate: (raw: Record<string, unknown>) => void): () => void {
  const supabase = createClient()
  const channel = supabase
    .channel(`pvp_match_${matchId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'pvp_matches', filter: `id=eq.${matchId}` },
      (payload) => onUpdate(payload.new as Record<string, unknown>)
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function submitPvpCorner(matchId: string, corner: CornerAdvice): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('pvp_submit_corner', {
    p_match_id: matchId,
    p_corner: corner,
  })
  return { error: error?.message ?? null }
}

/** Panggil Edge Function pvp-resolve-round. Idempotent — aman dipanggil dari
 *  kedua sisi, panggilan kedua akan no-op (skipped). */
export async function resolvePvpRound(matchId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.functions.invoke('pvp-resolve-round', {
    body: { match_id: matchId },
  })
  return { error: error?.message ?? null }
}

export async function cancelPvpChallenge(matchId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('pvp_cancel_challenge', { p_match_id: matchId })
  return { error: error?.message ?? null }
}

// ── Room publik (lobby, siapa saja bisa join) ─────────────────────────────

export interface OpenRoom {
  id: string
  challenger_gym_id: string
  challenger_gym_name: string
  challenger_fighter_id: string
  challenger_fighter_name: string
  challenger_weight_class: string
  created_at: string
}

export async function createPvpRoom(fighterId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('pvp_create_room', { p_fighter_id: fighterId })
  return { error: error?.message ?? null }
}

export async function fetchOpenRooms(): Promise<OpenRoom[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('pvp_list_open_rooms')
  if (error || !data) return []
  return data as OpenRoom[]
}

export async function joinPvpRoom(matchId: string, fighterId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('pvp_join_room', { p_match_id: matchId, p_fighter_id: fighterId })
  return { error: error?.message ?? null }
}
