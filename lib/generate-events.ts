import type { EventTier, EventPromotion, EventSlotType, EventSlot, MmaEvent, Gym, WeightClass, Fighter } from '@/types'
import { createClient } from './supabase'
import { ALL_ATTR_KEYS } from './attrs'

// ─── Backward-compat: tier config digunakan fight page untuk purse/rep mult ──

export interface EventTierConfig {
  label: string
  purseMult: number
  reputationMult: number
  attrOffset: number
  attrSpread: number
  recordRange: { wMin: number; wMax: number; lMin: number; lMax: number }
}

export const EVENT_TIER_CONFIG: Record<EventTier, EventTierConfig> = {
  local: {
    label: 'Lokal', purseMult: 0.6, reputationMult: 0.6,
    attrOffset: -8, attrSpread: 10,
    recordRange: { wMin: 1, wMax: 10, lMin: 2, lMax: 10 },
  },
  regional: {
    label: 'Regional', purseMult: 1, reputationMult: 1,
    attrOffset: 0, attrSpread: 12,
    recordRange: { wMin: 3, wMax: 18, lMin: 0, lMax: 8 },
  },
  national: {
    label: 'Nasional', purseMult: 1.8, reputationMult: 1.6,
    attrOffset: 8, attrSpread: 14,
    recordRange: { wMin: 10, wMax: 25, lMin: 0, lMax: 5 },
  },
  international: {
    label: 'Internasional', purseMult: 2.5, reputationMult: 2.2,
    attrOffset: 14, attrSpread: 16,
    recordRange: { wMin: 18, wMax: 30, lMin: 0, lMax: 4 },
  },
}

export const EVENT_TIER_BADGE_CLASS: Record<EventTier, string> = {
  local:         'border-gray-500/30 bg-gray-500/15 text-gray-300',
  regional:      'border-octagon-teal/30 bg-octagon-teal/15 text-octagon-teal',
  national:      'border-octagon-amber/30 bg-octagon-amber/15 text-octagon-amber',
  international: 'border-purple-500/30 bg-purple-500/15 text-purple-300',
}

// ─── Sistem promosi baru ──────────────────────────────────────────────────────

export interface PromotionConfig {
  label: string
  minWins: number        // syarat menang untuk masuk promosi
  tier: EventTier        // mapping ke tier lama untuk purse/rep calc
  badgeClass: string
  namePrefix: string[]
}

export const PROMOTION_CONFIG: Record<EventPromotion, PromotionConfig> = {
  lokal: {
    label: 'Circuit Lokal', minWins: 0, tier: 'local',
    badgeClass: 'border-gray-500/30 bg-gray-500/15 text-gray-300',
    namePrefix: ['Garuda Fight Night', 'Arena Tarung Kota', 'Kandang Singa FC', 'Nusantara Local Series'],
  },
  regional: {
    label: 'Regional MMA', minWins: 3, tier: 'regional',
    badgeClass: 'border-octagon-teal/30 bg-octagon-teal/15 text-octagon-teal',
    namePrefix: ['Archipelago Combat League', 'Borneo Warrior Series', 'Java Fighting Championship', 'Sunda Battle Series'],
  },
  nasional: {
    label: 'Nasional FC', minWins: 8, tier: 'national',
    badgeClass: 'border-octagon-amber/30 bg-octagon-amber/15 text-octagon-amber',
    namePrefix: ['Indonesia Championship Series', 'Garuda National Cup', 'Nusantara Grand Prix', 'Merah Putih Fight Series'],
  },
  championship: {
    label: 'Indonesia Championship', minWins: 15, tier: 'national',
    badgeClass: 'border-octagon-red/30 bg-octagon-red/15 text-octagon-red',
    namePrefix: ['Indonesia Title Fight', 'Merah Putih Championship', 'Grand Prix Nasional'],
  },
  internasional: {
    label: 'World Fighting Series', minWins: 20, tier: 'international',
    badgeClass: 'border-purple-500/30 bg-purple-500/15 text-purple-300',
    namePrefix: ['World Fighting Series', 'Apex Global Championship', 'Global Combat League', 'Worldwide Fight Night'],
  },
  turnamen: {
    label: 'Turnamen 8 Besar', minWins: 8, tier: 'national',
    badgeClass: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-300',
    namePrefix: ['Turnamen 8 Besar', 'Grand Tournament Series', 'Knockout Cup', 'Battle Royale Championship'],
  },
}

export interface SlotConfig {
  label: string
  purseMult: number
  minWins: number   // menang di weight class tertentu
  icon: string
}

export const SLOT_CONFIG: Record<EventSlotType, SlotConfig> = {
  main:       { label: 'Main Event', purseMult: 2.5, minWins: 12, icon: '👑' },
  comain:     { label: 'Co-Main',    purseMult: 1.8, minWins: 7,  icon: '⭐' },
  featured:   { label: 'Featured',   purseMult: 1.3, minWins: 3,  icon: ''   },
  undercard:  { label: 'Undercard',  purseMult: 1.0, minWins: 0,  icon: ''   },
  tournament: { label: 'Turnamen 8 Besar', purseMult: 2.0, minWins: 8, icon: '🏆' },
}

const WEIGHT_CLASSES: WeightClass[] = [
  'Strawweight','Flyweight','Bantamweight','Featherweight',
  'Lightweight','Welterweight','Middleweight','Heavyweight',
]

const OPPONENT_COLORS = ['#3B82F6','#A855F7','#F59E0B','#06B6D4','#EC4899','#EF4444','#22C55E']

// ─── Venue & estimasi penonton ───────────────────────────────────────────────

const VENUE_POOL: Record<EventPromotion, string[]> = {
  lokal: ['GOR Kecamatan Cibubur', 'Aula Serbaguna Mawar', 'Sasana Tinju Garuda', 'GOR Pemuda'],
  regional: ['GOR Saparua Bandung', 'Sportorium UGM Yogyakarta', 'C-Tra Arena Bandung', 'GOR Tri Sakti Surabaya'],
  nasional: ['Istora Senayan Jakarta', 'ICE BSD Tangerang', 'GOR Among Rogo Yogyakarta', 'Sentul International Convention Center'],
  championship: ['Indonesia Arena Jakarta', 'GBK Main Stadium Jakarta', 'Jakarta International Velodrome'],
  internasional: ['T-Mobile Arena Las Vegas', 'Etihad Arena Abu Dhabi', 'Saitama Super Arena Tokyo', 'Singapore Indoor Stadium', 'The O2 Arena London'],
  turnamen: ['Istora Senayan Jakarta', 'GOR Among Rogo Yogyakarta', 'C-Tra Arena Bandung', 'ICE BSD Tangerang'],
}

const ATTENDANCE_RANGE: Record<EventPromotion, { min: number; max: number }> = {
  lokal: { min: 150, max: 800 },
  regional: { min: 1500, max: 6000 },
  nasional: { min: 8000, max: 18000 },
  championship: { min: 15000, max: 40000 },
  internasional: { min: 25000, max: 60000 },
  turnamen: { min: 10000, max: 22000 },
}

export function getEventVenue(promotion: EventPromotion): string {
  return pick(VENUE_POOL[promotion])
}

export function getEventAttendance(promotion: EventPromotion): number {
  const { min, max } = ATTENDANCE_RANGE[promotion]
  return Math.round(randInt(min, max) / 50) * 50
}

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

function generateEmptySlots(promotion: EventPromotion): EventSlot[] {
  if (promotion === 'turnamen') {
    return [{
      type: 'tournament',
      purse_mult: SLOT_CONFIG.tournament.purseMult,
      min_wins:   SLOT_CONFIG.tournament.minWins,
      fighter_id: null,
      opponent:   null,
      opponents:  null,
      bracket_round: 0,
    }]
  }
  const types: EventSlotType[] = ['main','comain','featured','undercard']
  return types.map((type) => ({
    type,
    purse_mult: SLOT_CONFIG[type].purseMult,
    min_wins:   SLOT_CONFIG[type].minWins,
    fighter_id: null,
    opponent:   null,
  }))
}

function pickPromotion(seasonWeek: number, week: number): EventPromotion {
  // Turnamen 8 Besar: 1 kali per 8 minggu per weight class, mulai tersedia sejak syarat Nasional
  if (seasonWeek >= 17 && week % 8 === 0) return 'turnamen'
  if (seasonWeek >= 35) return pick(['lokal','regional','nasional','championship','internasional'] as EventPromotion[])
  if (seasonWeek >= 25) return pick(['lokal','regional','nasional','championship'] as EventPromotion[])
  if (seasonWeek >= 17) return pick(['lokal','regional','nasional'] as EventPromotion[])
  if (seasonWeek >= 9)  return pick(['lokal','regional'] as EventPromotion[])
  return 'lokal'
}

function generateEvent(week: number, seasonWeek: number, wcIndex: number): MmaEvent {
  const promotion  = pickPromotion(seasonWeek, week)
  const config     = PROMOTION_CONFIG[promotion]
  const weightClass = WEIGHT_CLASSES[wcIndex % 8]
  return {
    id:          crypto.randomUUID(),
    name:        promotion === 'turnamen'
      ? `${pick(config.namePrefix)} ${weightClass}`
      : `${pick(config.namePrefix)} Vol. ${randInt(1,99)}`,
    promotion,
    tier:        config.tier,
    week,
    weight_class: weightClass,
    slots:       generateEmptySlots(promotion),
    venue:       getEventVenue(promotion),
    attendance:  getEventAttendance(promotion),
  }
}

/** Pastikan ada event untuk minggu ini + 3 minggu ke depan (4 minggu lookahead). */
export function generateUpcomingEvents(gym: Gym): MmaEvent[] {
  const existing = gym.events
  const newEvents: MmaEvent[] = []

  for (let offset = 0; offset <= 3; offset++) {
    const targetWeek = gym.season_week + offset
    const hasEvent   = existing.some((e) => e.week === targetWeek)
    if (!hasEvent) {
      newEvents.push(generateEvent(targetWeek, gym.season_week, targetWeek))
    }
  }
  return newEvents
}

/** Generate & simpan event upcoming jika belum ada. Menggantikan ensureEventsForCurrentMonth. */
export async function ensureEventsForUpcomingWeeks(gym: Gym): Promise<Gym> {
  const newEvents = generateUpcomingEvents(gym)
  if (newEvents.length === 0) return gym

  // Bersihkan event lama + event format lama (tanpa slots)
  const pruned = gym.events.filter(
    (e) => e.week >= gym.season_week - 1 && Array.isArray(e.slots) && e.promotion
  )
  const events = [...pruned, ...newEvents].sort((a, b) => a.week - b.week)

  const supabase = createClient()
  const { data, error } = await supabase.from('gyms').update({ events }).eq('id', gym.id).select().single()
  if (error || !data) return gym
  return data as Gym
}

/** Ambil semua event untuk minggu tertentu. */
export function getEventsForWeek(events: MmaEvent[], week: number): MmaEvent[] {
  return events.filter((e) => e.week === week)
}

/** Tetap ada untuk backward compat dengan events page lama. */
export function getEventsForMonth(events: MmaEvent[], seasonWeek: number): MmaEvent[] {
  return events
    .filter((e) => e.week >= seasonWeek && e.week <= seasonWeek + 3)
    .sort((a, b) => a.week - b.week)
}

/** Tentukan slot terbaik yang bisa didapat fighter (berdasarkan wins).
 *  Fighter top-5 kontender (title_shot_pending) diprioritaskan ke slot "main"
 *  event championship, bypass syarat min_wins — posisi rankingnya sudah
 *  membuktikan kelayakannya untuk laga title. */
export function getBestAvailableSlot(event: MmaEvent, fighterWins: number, titleShotPending = false): EventSlot | null {
  if (titleShotPending && event.promotion === 'championship') {
    const mainSlot = event.slots.find((s) => s.type === 'main')
    if (mainSlot && mainSlot.fighter_id === null) return mainSlot
  }

  const order: EventSlotType[] = event.promotion === 'turnamen'
    ? ['tournament']
    : ['main','comain','featured','undercard']
  for (const type of order) {
    const slot = event.slots.find((s) => s.type === type)
    if (!slot) continue
    if (slot.fighter_id !== null) continue          // sudah terisi
    if (fighterWins < slot.min_wins) continue       // tidak memenuhi syarat
    return slot
  }
  return null
}

/** Fetch opponent dari pool free agent + roster CPU gym (weight class sama, wins mirip). */
export async function fetchPoolOpponent(
  weightClass: WeightClass,
  targetWins: number,
  fighterId?: string
): Promise<MmaEvent['slots'][0]['opponent']> {
  const supabase = createClient()
  const [{ data: poolData }, { data: cpuData }] = await Promise.all([
    supabase
      .from('fighters')
      .select('id, name, attrs, record, specialty')
      .is('gym_id', null)
      .eq('status', 'prospect')
      .eq('weight_class', weightClass)
      .limit(30),
    supabase
      .from('fighters')
      .select('id, name, attrs, record, specialty')
      .eq('is_cpu', true)
      .eq('status', 'active')
      .eq('weight_class', weightClass)
      .limit(30),
  ])

  const pool = [
    ...((poolData ?? []) as Pick<Fighter, 'id' | 'name' | 'attrs' | 'record' | 'specialty'>[]),
    ...((cpuData ?? []) as Pick<Fighter, 'id' | 'name' | 'attrs' | 'record' | 'specialty'>[]),
  ]

  if (pool.length === 0) return generateFallbackOpponent(targetWins)

  // Ambil 5 lawan terakhir fighter ini untuk dihindari (anti-ulang lawan sama)
  let recentOpponentIds: string[] = []
  if (fighterId) {
    const { data: recentFights } = await supabase
      .from('fight_results')
      .select('opponent_id')
      .eq('fighter_id', fighterId)
      .not('opponent_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)
    recentOpponentIds = (recentFights ?? []).map((r) => r.opponent_id).filter(Boolean)
  }

  const similar = pool.filter((f) => Math.abs(f.record.w - targetWins) <= 4)
  const candidates = similar.length > 0 ? similar : pool

  // Prioritaskan lawan yang belum pernah dihadapi baru-baru ini
  const fresh = candidates.filter((f) => !recentOpponentIds.includes(f.id ?? ''))
  const chosen = fresh.length > 0 ? pick(fresh) : pick(candidates)

  // Cek histori pertemuan untuk rivalry: sudah pernah bertanding sebelumnya = rematch rival.
  let rivalMeetings = 0
  if (fighterId) {
    const { count } = await supabase
      .from('fight_results')
      .select('id', { count: 'exact', head: true })
      .eq('fighter_id', fighterId)
      .eq('opponent_id', chosen.id)
    rivalMeetings = count ?? 0
  }

  return {
    id:        chosen.id,
    name:      chosen.name,
    attrs:     chosen.attrs,
    record:    chosen.record,
    specialty: chosen.specialty,
    color:     pick(OPPONENT_COLORS),
    is_rival:  rivalMeetings >= 1,
    rival_meetings: rivalMeetings,
  }
}

/** Fallback jika pool kosong: generate lawan sintetis. */
function generateFallbackOpponent(targetWins: number): MmaEvent['slots'][0]['opponent'] {
  const baseAttr = 50 + targetWins * 1.5
  const attrs = Object.fromEntries(
    ALL_ATTR_KEYS.map((k) => [k, Math.max(40, Math.min(90, Math.round(baseAttr + randInt(-10,10))))])
  ) as unknown as Fighter['attrs']

  return {
    id:        null,
    name:      `Fighter #${randInt(100,999)}`,
    attrs,
    record:    { w: targetWins + randInt(-2,2), l: randInt(0,5), d: 0 },
    specialty: pick(['Striker','Grappler','All-rounder','Counter Fighter','Wrestler']),
    color:     pick(OPPONENT_COLORS),
    is_rival:  false,
    rival_meetings: 0,
  }
}

/** Generate 3 lawan bracket turnamen (Quarterfinal, Semifinal, Final) — progresif makin sulit. */
export async function fetchTournamentOpponents(
  weightClass: WeightClass,
  targetWins: number,
  fighterId?: string
): Promise<NonNullable<EventSlot['opponents']>> {
  const tierBoosts = [-2, 3, 9] // QF: sedikit di bawah, SF: sedikit di atas, Final: jauh di atas
  const opponents = await Promise.all(
    tierBoosts.map((boost) => fetchPoolOpponent(weightClass, Math.max(0, targetWins + boost), fighterId))
  )
  return opponents.map((opp, i) => opp ?? generateFallbackOpponent(targetWins + tierBoosts[i])) as NonNullable<EventSlot['opponents']>
}

/** Daftarkan fighter ke event: assign slot terbaik + booking lawan dari pool. */
export async function registerFighterToEvent(
  gym: Gym,
  eventId: string,
  fighter: Fighter
): Promise<Gym | null> {
  const event = gym.events.find((e) => e.id === eventId)
  if (!event) return null

  const slot = getBestAvailableSlot(event, fighter.record.w, fighter.title_shot_pending)
  if (!slot) return null

  let updatedEvents: MmaEvent[]

  if (event.promotion === 'turnamen') {
    const opponents = await fetchTournamentOpponents(event.weight_class, fighter.record.w, fighter.id)
    updatedEvents = gym.events.map((e) => {
      if (e.id !== eventId) return e
      return {
        ...e,
        slots: e.slots.map((s) =>
          s.type === slot.type
            ? { ...s, fighter_id: fighter.id, opponents, bracket_round: 0 }
            : s
        ),
      }
    })
  } else {
    const isTitle = event.promotion === 'championship' && slot.type === 'main'
    let opponent: MmaEvent['slots'][0]['opponent']

    if (isTitle) {
      // Title fight: cari top kontender di weight class yang sama (title_shot_pending)
      // atau fighter CPU dengan rating tertinggi di weight class itu
      const supabase = createClient()
      const { data: contenderData } = await supabase
        .from('fighters')
        .select('id, name, attrs, record, specialty')
        .eq('is_cpu', true)
        .eq('weight_class', event.weight_class)
        .eq('status', 'active')
        .neq('id', fighter.id)
        .order('win_streak', { ascending: false })
        .limit(10)

      if (contenderData && contenderData.length > 0) {
        // Pilih yang rating atribut tertinggi
        const best = contenderData.reduce((a, b) => {
          const aOvr = Object.values(a.attrs as Record<string, number>).reduce((s, v) => s + v, 0)
          const bOvr = Object.values(b.attrs as Record<string, number>).reduce((s, v) => s + v, 0)
          return bOvr > aOvr ? b : a
        })
        opponent = {
          id: best.id,
          name: best.name,
          attrs: best.attrs as Fighter['attrs'],
          record: best.record as Fighter['record'],
          specialty: best.specialty as Fighter['specialty'],
          color: OPPONENT_COLORS[Math.floor(Math.random() * OPPONENT_COLORS.length)],
          is_rival: false,
          rival_meetings: 0,
        }
      } else {
        opponent = await fetchPoolOpponent(event.weight_class, fighter.record.w, fighter.id)
      }
    } else {
      opponent = await fetchPoolOpponent(event.weight_class, fighter.record.w, fighter.id)
    }
    updatedEvents = gym.events.map((e) => {
      if (e.id !== eventId) return e
      return {
        ...e,
        slots: e.slots.map((s) =>
          s.type === slot.type
            ? { ...s, fighter_id: fighter.id, opponent }
            : s
        ),
      }
    })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('gyms').update({ events: updatedEvents }).eq('id', gym.id).select().single()
  if (error || !data) return null
  return data as Gym
}

/** Batalkan pendaftaran fighter dari event. */
export async function unregisterFighterFromEvent(
  gym: Gym,
  eventId: string,
  fighterId: string
): Promise<Gym | null> {
  const updatedEvents = gym.events.map((e) => {
    if (e.id !== eventId) return e
    return {
      ...e,
      slots: e.slots.map((s) =>
        s.fighter_id === fighterId
          ? { ...s, fighter_id: null, opponent: null, opponents: null, bracket_round: 0 }
          : s
      ),
    }
  })

  const supabase = createClient()
  const { data, error } = await supabase
    .from('gyms').update({ events: updatedEvents }).eq('id', gym.id).select().single()
  if (error || !data) return null
  return data as Gym
}

/** Helper: apakah fighter sudah terdaftar di event manapun minggu ini? */
export function getFighterSlot(events: MmaEvent[], fighterId: string, week: number): EventSlot | null {
  for (const event of events) {
    if (event.week !== week) continue
    const slot = event.slots.find((s) => s.fighter_id === fighterId)
    if (slot) return slot
  }
  return null
}
