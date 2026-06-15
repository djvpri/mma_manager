import { createClient } from './supabase'
import { getAvailableSponsors, MAX_ACTIVE_CONTRACTS, type SponsorBrandTemplate } from './sponsor-contracts'
import { formatCurrency } from './format'
import {
  ensureEventsForUpcomingWeeks,
  getBestAvailableSlot,
  registerFighterToEvent,
  PROMOTION_CONFIG,
} from './generate-events'
import {
  scoutCapacity,
  scoutDuration,
  abilityStars,
  potentialStars,
  startScoutMission,
  type ScoutMission,
} from './scouting'
import { ALL_ATTR_KEYS, ATTR_NAME_LABELS } from './attrs'
import { poolFighterToCandidate, requiredReputation } from './pool-fighter'
import { FEE_OPTIONS, calcTargetMembers, fetchRecentWins } from './gym-members'
import { resolveHype } from './press-conference'
import type { Fighter, FighterAttrs, Gym, MmaEvent, SponsorContract, Staff, WeightClass } from '@/types'

/** Asisten Manajer otomatis cari & tanda tangan sponsor 1x per minggu, jika ada slot kosong. */
export async function runAssistantManagerSponsor(gym: Gym): Promise<{ gym: Gym; message: string | null }> {
  if (!gym.assistant_manager_id) return { gym, message: null }
  if (gym.assistant_tasks?.sponsor === false) return { gym, message: null }
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
  if (gym.assistant_tasks?.event_registration === false) return { gym, messages: [] }

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
        return getBestAvailableSlot(e, fighter.record.w, fighter.title_shot_pending) !== null
      })
      .sort((a, b) => a.week - b.week)[0]

    if (!candidateEvent) continue

    const updated = await registerFighterToEvent(currentGym, candidateEvent.id, fighter)
    if (updated) {
      currentGym = updated
      const registeredEvent = currentGym.events.find((e) => e.id === candidateEvent.id)
      const registeredSlot = registeredEvent?.slots.find((s) => s.fighter_id === fighter.id)
      const opponentName = registeredSlot?.opponent?.name ?? registeredSlot?.opponents?.[0]?.name
      const lawanText = opponentName ? ` vs ${opponentName}` : ''
      messages.push(`📅 Asisten Manajer mendaftarkan ${fighter.name} ke ${candidateEvent.name} (Minggu ke-${candidateEvent.week})${lawanText}.`)
    }
  }

  return { gym: currentGym, messages }
}

/**
 * Asisten Manajer otomatis mulai misi scouting untuk prospek terbaik yang belum
 * di-scout, jika ada slot Talent Scout kosong. Rating staf Asisten Manajer
 * menentukan ketajaman pilihan: rating tinggi -> pilih prospek terbaik secara
 * konsisten, rating rendah -> pilihan lebih acak dari kandidat teratas.
 */
export async function runAssistantManagerScouting(gym: Gym): Promise<{ message: string | null }> {
  if (!gym.assistant_manager_id) return { message: null }
  if (gym.assistant_tasks?.scouting !== true) return { message: null }

  const supabase = createClient()
  const [{ data: poolData }, { data: missionData }, { data: staffData }, { data: managerData }] = await Promise.all([
    supabase.from('fighters').select('*').is('gym_id', null).eq('status', 'prospect'),
    supabase.from('scout_missions').select('*').eq('gym_id', gym.id),
    supabase.from('staff').select('*').eq('gym_id', gym.id).eq('is_hired', true),
    supabase.from('staff').select('rating').eq('id', gym.assistant_manager_id).single(),
  ])

  const pool     = (poolData ?? []) as Fighter[]
  const missions = (missionData ?? []) as ScoutMission[]
  const staff    = (staffData ?? []) as Staff[]
  const managerRating = managerData?.rating ?? 3

  const capacity = scoutCapacity(staff)
  const active   = missions.filter((m) => m.status === 'in_progress').length
  if (capacity === 0 || active >= capacity) return { message: null }

  const scoutedIds = new Set(missions.map((m) => m.fighter_id))
  const candidates = pool.filter((f) => !scoutedIds.has(f.id))
  if (candidates.length === 0) return { message: null }

  const ranked = [...candidates].sort(
    (a, b) => (abilityStars(b) + potentialStars(b)) - (abilityStars(a) + potentialStars(a))
  )

  const pickFrom = managerRating >= 4 ? ranked.slice(0, 1)
    : managerRating >= 2 ? ranked.slice(0, 3)
    : ranked
  const chosen = pickFrom[Math.floor(Math.random() * pickFrom.length)]

  const duration = scoutDuration(staff)
  const { mission, error } = await startScoutMission(gym.id, chosen.id, duration)
  if (error || !mission) return { message: null }

  return {
    message: `🔎 Asisten Manajer memulai scouting untuk ${chosen.name} "${chosen.nickname}" (${duration} minggu).`,
  }
}

/**
 * Asisten Manajer otomatis menetapkan fokus latihan untuk fighter yang belum
 * punya training_focus — pilih atribut dengan selisih terbesar di bawah
 * potensi (paling lemah relatif terhadap potensi, paling banyak ruang berkembang).
 */
export async function runAssistantManagerTrainingFocus(
  gym: Gym
): Promise<{ messages: string[]; updates: { id: string; training_focus: keyof FighterAttrs }[] }> {
  if (!gym.assistant_manager_id) return { messages: [], updates: [] }
  if (gym.assistant_tasks?.training_focus !== true) return { messages: [], updates: [] }

  const supabase = createClient()
  const { data } = await supabase
    .from('fighters')
    .select('id, name, attrs, potential')
    .eq('gym_id', gym.id)
    .eq('status', 'training')
    .is('training_focus', null)

  const fighters = (data ?? []) as Pick<Fighter, 'id' | 'name' | 'attrs' | 'potential'>[]
  if (fighters.length === 0) return { messages: [], updates: [] }

  const messages: string[] = []
  const updates: { id: string; training_focus: keyof FighterAttrs }[] = []

  for (const f of fighters) {
    let bestKey: keyof FighterAttrs | null = null
    let bestGap = -Infinity
    for (const key of ALL_ATTR_KEYS) {
      const gap = f.potential - f.attrs[key]
      if (gap > bestGap) { bestGap = gap; bestKey = key }
    }
    if (!bestKey || bestGap <= 0) continue

    const { error } = await supabase.from('fighters').update({ training_focus: bestKey }).eq('id', f.id)
    if (!error) {
      updates.push({ id: f.id, training_focus: bestKey })
      messages.push(`🎯 Asisten Manajer mengatur fokus latihan ${f.name}: ${ATTR_NAME_LABELS[bestKey]}.`)
    }
  }

  return { messages, updates }
}

/**
 * Asisten Manajer otomatis perpanjang kontrak fighter berprestasi (rekor menang
 * >= kalah) yang sisa kontraknya hampir habis (<=1), sebelum mereka berisiko
 * pensiun random di advance_week(). Gaji naik 8% sebagai bagian negosiasi baru.
 */
export async function runAssistantManagerContractRenewal(
  gym: Gym
): Promise<{ messages: string[]; expenseDelta: number }> {
  if (!gym.assistant_manager_id) return { messages: [], expenseDelta: 0 }
  if (gym.assistant_tasks?.contract_renewal !== true) return { messages: [], expenseDelta: 0 }

  const supabase = createClient()
  const { data } = await supabase
    .from('fighters')
    .select('id, name, record, salary_monthly, contract_fights_left')
    .eq('gym_id', gym.id)
    .in('status', ['training', 'active'])
    .lte('contract_fights_left', 1)

  const fighters = (data ?? []) as Pick<Fighter, 'id' | 'name' | 'record' | 'salary_monthly' | 'contract_fights_left'>[]
  if (fighters.length === 0) return { messages: [], expenseDelta: 0 }

  const messages: string[] = []
  let expenseDelta = 0

  for (const f of fighters) {
    if (f.record.w < f.record.l) continue // hanya perpanjang fighter berprestasi

    const newSalary = Math.round((f.salary_monthly * 1.08) / 100_000) * 100_000
    const { error } = await supabase
      .from('fighters')
      .update({ contract_fights_left: f.contract_fights_left + 3, salary_monthly: newSalary })
      .eq('id', f.id)

    if (!error) {
      expenseDelta += newSalary - f.salary_monthly
      messages.push(`📝 Asisten Manajer memperpanjang kontrak ${f.name} (+3 laga, gaji naik jadi ${formatCurrency(newSalary)}/minggu).`)
    }
  }

  if (expenseDelta > 0) {
    await supabase.from('gyms').update({ monthly_expense: gym.monthly_expense + expenseDelta }).eq('id', gym.id)
  }

  return { messages, expenseDelta }
}

/**
 * Asisten Manajer turunkan intensitas latihan fighter yang training_load-nya
 * sudah tinggi (>=80) untuk mengurangi risiko overtraining/cedera minggu depan.
 */
export async function runAssistantManagerTrainingLoad(gym: Gym): Promise<{ messages: string[] }> {
  if (!gym.assistant_manager_id) return { messages: [] }
  if (gym.assistant_tasks?.training_load !== true) return { messages: [] }

  const supabase = createClient()
  const { data } = await supabase
    .from('fighters')
    .select('id, name, training_load, training_intensity')
    .eq('gym_id', gym.id)
    .eq('status', 'training')
    .gte('training_load', 80)
    .neq('training_intensity', 'low')

  const fighters = (data ?? []) as Pick<Fighter, 'id' | 'name' | 'training_load' | 'training_intensity'>[]
  if (fighters.length === 0) return { messages: [] }

  const messages: string[] = []
  for (const f of fighters) {
    const { error } = await supabase.from('fighters').update({ training_intensity: 'low' }).eq('id', f.id)
    if (!error) {
      messages.push(`⚠️ Asisten Manajer menurunkan intensitas latihan ${f.name} (beban ${f.training_load}%) untuk cegah overtraining.`)
    }
  }
  return { messages }
}

/**
 * Asisten Manajer rekrut prospek murah dari pool (sudah di-scout, sesuai
 * reputasi) untuk mengisi weight class yang kosong di roster. Maks 1 fighter
 * per minggu agar tidak menguras saldo.
 */
export async function runAssistantManagerRosterFiller(
  gym: Gym,
  fighters: Fighter[]
): Promise<{ message: string | null; newFighter: Fighter | null; expenseDelta: number; balanceDelta: number }> {
  if (!gym.assistant_manager_id) return { message: null, newFighter: null, expenseDelta: 0, balanceDelta: 0 }
  if (gym.assistant_tasks?.roster_filler !== true) return { message: null, newFighter: null, expenseDelta: 0, balanceDelta: 0 }

  const WEIGHT_CLASSES: WeightClass[] = [
    'Strawweight','Flyweight','Bantamweight','Featherweight',
    'Lightweight','Welterweight','Middleweight','Heavyweight',
  ]

  const active = fighters.filter((f) => f.status !== 'retired')
  const filledClasses = new Set(active.map((f) => f.weight_class))
  const emptyClasses = WEIGHT_CLASSES.filter((wc) => !filledClasses.has(wc))
  if (emptyClasses.length === 0) return { message: null, newFighter: null, expenseDelta: 0, balanceDelta: 0 }

  const supabase = createClient()
  const { data: poolData } = await supabase
    .from('fighters').select('*').is('gym_id', null).eq('status', 'prospect')
    .in('weight_class', emptyClasses)
  const pool = (poolData ?? []) as Fighter[]

  const eligible = pool.filter((f) => gym.reputation >= requiredReputation(f))
  if (eligible.length === 0) return { message: null, newFighter: null, expenseDelta: 0, balanceDelta: 0 }

  const candidates = eligible
    .map((f) => ({ fighter: f, candidate: poolFighterToCandidate(f) }))
    .sort((a, b) => a.candidate.cost - b.candidate.cost)

  const pick = candidates.find(({ candidate }) => gym.balance >= candidate.cost * 3)
  if (!pick) return { message: null, newFighter: null, expenseDelta: 0, balanceDelta: 0 }

  const { fighter, candidate } = pick
  const { data: signed, error } = await supabase.rpc('recruit_pool_fighter', {
    p_fighter_id:        fighter.id,
    p_gym_id:            gym.id,
    p_salary:            candidate.salary_monthly,
    p_win_bonus:         Math.round(candidate.salary_monthly * 0.1 / 100_000) * 100_000,
    p_purse_share_pct:   10,
    p_contract_fights:   3,
    p_buyout_clause:     candidate.salary_monthly * 4,
    p_title_shot_clause: false,
    p_signing_bonus:     candidate.cost,
  })

  if (error || !signed) return { message: null, newFighter: null, expenseDelta: 0, balanceDelta: 0 }

  return {
    message: `🆕 Asisten Manajer merekrut ${fighter.name} "${fighter.nickname}" (${fighter.weight_class}) untuk mengisi roster yang kosong.`,
    newFighter: signed as Fighter,
    expenseDelta: candidate.salary_monthly,
    balanceDelta: -candidate.cost,
  }
}

/**
 * Asisten Manajer sesuaikan iuran member: turunkan kalau member jauh di bawah
 * target (gym kurang menarik di harga sekarang), naikkan kalau member jauh di
 * atas target dan keuangan sehat.
 */
export async function runAssistantManagerMemberFee(gym: Gym): Promise<{ message: string | null; newFee: number | null }> {
  if (!gym.assistant_manager_id) return { message: null, newFee: null }
  if (gym.assistant_tasks?.member_fee !== true) return { message: null, newFee: null }

  const recentWins = await fetchRecentWins(gym.id)
  const target = calcTargetMembers(gym, recentWins)
  const idx = FEE_OPTIONS.indexOf(gym.member_fee)
  if (idx === -1) return { message: null, newFee: null }

  let newIdx = idx
  if (gym.member_count < target * 0.7 && idx > 0) {
    newIdx = idx - 1
  } else if (gym.member_count > target * 1.15 && gym.balance > gym.monthly_expense * 4 && idx < FEE_OPTIONS.length - 1) {
    newIdx = idx + 1
  }
  if (newIdx === idx) return { message: null, newFee: null }

  const newFee = FEE_OPTIONS[newIdx]
  const supabase = createClient()
  const { error } = await supabase.from('gyms').update({ member_fee: newFee }).eq('id', gym.id)
  if (error) return { message: null, newFee: null }

  const direction = newIdx < idx ? 'menurunkan' : 'menaikkan'
  return {
    message: `💳 Asisten Manajer ${direction} iuran member jadi ${formatCurrency(newFee)}/bulan (member: ${gym.member_count}, target: ${target}).`,
    newFee,
  }
}

/**
 * Asisten Manajer otomatis "tampil" di konferensi pers untuk laga minggu depan
 * yang belum direspons pemain — pakai gaya Fokus (aman, minim risiko).
 */
export async function runAssistantManagerPressConference(gym: Gym): Promise<{ message: string | null; events: MmaEvent[] | null }> {
  if (!gym.assistant_manager_id) return { message: null, events: null }
  if (gym.assistant_tasks?.press_conference !== true) return { message: null, events: null }

  const supabase = createClient()
  const { data: fightersData } = await supabase
    .from('fighters').select('id, name, attrs, record').eq('gym_id', gym.id).neq('status', 'retired')
  const myFighters = (fightersData ?? []) as Pick<Fighter, 'id' | 'name' | 'attrs' | 'record'>[]
  const myFighterIds = new Set(myFighters.map((f) => f.id))

  const nextWeek = gym.season_week + 1
  let changed = false
  let message: string | null = null

  const updatedEvents = gym.events.map((e) => {
    if (e.week !== nextWeek) return e
    let eventAttendance = e.attendance ?? 0
    const updatedSlots = e.slots.map((s) => {
      if (!s.fighter_id || !myFighterIds.has(s.fighter_id) || !s.opponent || s.press_conference) return s
      const fighter = myFighters.find((f) => f.id === s.fighter_id)!
      const resolved = resolveHype('focus', fighter as Fighter, s.opponent!.name)
      eventAttendance = Math.round((eventAttendance * resolved.attendance_mult) / 50) * 50
      changed = true
      message = `🎤 Asisten Manajer tampil di konferensi pers ${fighter.name} (gaya Fokus) menjelang ${e.name}.`
      return {
        ...s,
        press_conference: {
          style: 'focus' as const,
          my_quote: `${fighter.name} memilih tetap tenang dan fokus pada persiapan, tanpa banyak komentar ke media.`,
          opp_quote: `${s.opponent!.name} merespons santai, mengaku juga lebih fokus pada persiapan teknis.`,
          ...resolved,
        },
      }
    })
    return changed ? { ...e, attendance: eventAttendance, slots: updatedSlots } : e
  })

  if (!changed) return { message: null, events: null }

  const { error } = await supabase.from('gyms').update({ events: updatedEvents }).eq('id', gym.id)
  if (error) return { message: null, events: null }

  return { message, events: updatedEvents }
}
