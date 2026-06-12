import { createClient } from './supabase'
import { getAvailableSponsors, MAX_ACTIVE_CONTRACTS, type SponsorBrandTemplate } from './sponsor-contracts'
import { formatCurrency } from './format'
import {
  ensureEventsForUpcomingWeeks,
  getBestAvailableSlot,
  registerFighterToEvent,
  PROMOTION_CONFIG,
} from './generate-events'
import type { Fighter, Gym, SponsorContract } from '@/types'

/** Asisten Manajer otomatis cari & tanda tangan sponsor 1x per minggu, jika ada slot kosong. */
export async function runAssistantManagerSponsor(gym: Gym): Promise<{ gym: Gym; message: string | null }> {
  if (!gym.assistant_manager_id) return { gym, message: null }
  if (gym.last_sponsor_week === gym.season_week) return { gym, message: null }

  const supabase = createClient()
  const [{ data: contractsData }, { data: staffData }] = await Promise.all([
    supabase.from('sponsor_contracts').select('*').eq('gym_id', gym.id).eq('status', 'active'),
    supabase.from('staff').select('name, rating').eq('id', gym.assistant_manager_id).single(),
  ])
  const activeContracts = (contractsData ?? []) as SponsorContract[]
  const managerName = staffData?.name ?? 'Asisten Manajer'
  const rating = staffData?.rating ?? 3

  // Tandai sudah "cari sponsor" minggu ini, sama seperti pencarian manual.
  const { data: updatedGymData } = await supabase
    .from('gyms')
    .update({ last_sponsor_week: gym.season_week })
    .eq('id', gym.id)
    .select()
    .single()
  const updatedGym = (updatedGymData ?? gym) as Gym

  if (activeContracts.length >= MAX_ACTIVE_CONTRACTS) return { gym: updatedGym, message: null }

  const offers = getAvailableSponsors(gym.reputation, activeContracts)
  if (offers.length === 0) return { gym: updatedGym, message: null }

  // Staf dengan rating tinggi lebih jeli memilih penawaran bernilai tertinggi.
  const sorted = [...offers].sort((a, b) => b.weekly_income - a.weekly_income)
  const considered = rating >= 4 ? sorted.slice(0, 1) : rating >= 2 ? sorted.slice(0, 2) : sorted
  const chosen: SponsorBrandTemplate = considered[Math.floor(Math.random() * considered.length)]

  const { error } = await supabase.from('sponsor_contracts').insert({
    gym_id: gym.id,
    brand_name: chosen.name,
    category: chosen.category,
    weekly_income: chosen.weekly_income,
    win_bonus: chosen.win_bonus,
    duration_weeks: chosen.duration_weeks,
    weeks_remaining: chosen.duration_weeks,
    satisfaction: 70,
    status: 'active',
  })
  if (error) return { gym: updatedGym, message: null }

  return {
    gym: updatedGym,
    message: `🤝 Asisten Manajer ${managerName} menandatangani kontrak sponsor dengan ${chosen.name} (${formatCurrency(chosen.weekly_income)}/minggu).`,
  }
}

/** Asisten Manajer otomatis daftarkan fighter yang siap tanding ke event yang cocok. */
export async function runAssistantManagerEventRegistration(
  gym: Gym,
  fighters: Fighter[]
): Promise<{ gym: Gym; messages: string[] }> {
  if (!gym.assistant_manager_id) return { gym, messages: [] }

  const messages: string[] = []
  let currentGym = await ensureEventsForUpcomingWeeks(gym)
  const seasonWeek = currentGym.season_week

  const activeFighters = fighters.filter((f) => f.status !== 'retired' && f.status !== 'injured')

  for (const fighter of activeFighters) {
    if (fighter.next_fight_week !== null && fighter.next_fight_week > seasonWeek) continue

    const validEvents = currentGym.events.filter((e) => Array.isArray(e.slots) && e.promotion)
    const registeredFighterIds = new Set(
      validEvents.flatMap((e) => e.slots.map((s) => s.fighter_id).filter(Boolean)) as string[]
    )
    if (registeredFighterIds.has(fighter.id)) continue

    const upcomingEvents = validEvents.filter((e) => e.week >= seasonWeek && e.week <= seasonWeek + 3)
    const candidateEvent = upcomingEvents
      .filter((e) => e.weight_class === fighter.weight_class)
      .filter((e) => {
        const promoCfg = PROMOTION_CONFIG[e.promotion] ?? PROMOTION_CONFIG.lokal
        if (fighter.record.w < promoCfg.minWins) return false
        return getBestAvailableSlot(e, fighter.record.w) !== null
      })
      .sort((a, b) => a.week - b.week)[0]

    if (!candidateEvent) continue

    const updated = await registerFighterToEvent(currentGym, candidateEvent.id, fighter)
    if (updated) {
      currentGym = updated
      messages.push(`📅 Asisten Manajer mendaftarkan ${fighter.name} ke ${candidateEvent.name} (Minggu ke-${candidateEvent.week}).`)
    }
  }

  return { gym: currentGym, messages }
}
