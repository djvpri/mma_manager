import { createClient } from './supabase'

export interface FriendGym {
  gym_id: string
  name: string
  city: string
  reputation: number
  season_week: number
  friend_code: string
  wins: number
  losses: number
}

export async function fetchFriendGyms(): Promise<FriendGym[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_friend_gyms')
  if (error || !data) return []
  return data as FriendGym[]
}

export async function addGymFriend(code: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('add_gym_friend', { p_friend_code: code })
  return { error: error?.message ?? null }
}

export function buildWhatsAppInviteUrl(gymName: string, friendCode: string): string {
  const message =
    `Ayo main MMA Manager bareng! 🥋 Aku jadi promotor "${gymName}".\n\n` +
    `Tambahkan aku sebagai teman pakai kode gym: ${friendCode}`
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
