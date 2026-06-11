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
}

export const EVENT_TIER_BADGE_CLASS: Record<EventTier, string> = {
  local:    'border-gray-500/30 bg-gray-500/15 text-gray-300',
  regional: 'border-octagon-teal/30 bg-octagon-teal/15 text-octagon-teal',
  national: 'border-octagon-amber/30 bg-octagon-amber/15 text-octagon-amber',
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
}

export interface SlotConfig {
  label: string
  purseMult: number
  minWins: number   // menang di weight class tertentu
  icon: string
}

export const SLOT_CONFIG: Record<EventSlotType, SlotConfig> = {
  main:      { label: 'Main Event', purseMult: 2.5, minWins: 12, icon: '👑' },
  comain:    { label: 'Co-Main',    purseMult: 1.8, minWins: 7,  icon: '⭐' },
  featured:  { label: 'Featured',   purseMult: 1.3, minWins: 3,  icon: ''   },
  undercard: { label: 'Undercard',  purseMult: 1.0, minWins: 0,  icon: ''   },
}

const WEIGHT_CLASSES: WeightClass[] = [
  'Strawweight','Flyweight','Bantamweight','Featherweight',
  'Lightweight','Welterweight','Middleweight','Heavyweight',
]

const OPPONENT_COLORS = ['#3B82F6','#A855F7','#F59E0B','#06B6D4','#EC4899','#EF4444','#22C55E']

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

function generateEmptySlots(): EventSlot[] {
  const types: EventSlotType[] = ['main','comain','featured','undercard']
  return types.map((type) => ({
    type,
    purse_mult: SLOT_CONFIG[type].purseMult,
    min_wins:   SLOT_CONFIG[type].minWins,
    fighter_id: null,
    opponent:   null,
  }))
}

function pickPromotion(seasonWeek: number): EventPromotion {
  if (seasonWeek >= 25) return pick(['lokal','regional','nasional','championship'] as EventPromotion[])
  if (seasonWeek >= 17) return pick(['lokal','regional','nasional'] as EventPromotion[])
  if (seasonWeek >= 9)  return pick(['lokal','regional'] as EventPromotion[])
  return 'lokal'
}

function generateEvent(week: number, seasonWeek: number, wcIndex: number): MmaEvent {
  const promotion  = pickPromotion(seasonWeek)
  const config     = PROMOTION_CONFIG[promotion]
  const weightClass = WEIGHT_CLASSES[wcIndex % 8]
  return {
    id:          crypto.randomUUID(),
    name:        `${pick(config.namePrefix)} Vol. ${randInt(1,99)}`,
    promotion,
    tier:        config.tier,
    week,
    weight_class: weightClass,
    slots:       generateEmptySlots(),
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

/** Tentukan slot terbaik yang bisa didapat fighter (berdasarkan wins). */
export function getBestAvailableSlot(event: MmaEvent, fighterWins: number): EventSlot | null {
  const order: EventSlotType[] = ['main','comain','featured','undercard']
  for (const type of order) {
    const slot = event.slots.find((s) => s.type === type)
    if (!slot) continue
    if (slot.fighter_id !== null) continue          // sudah terisi
    if (fighterWins < slot.min_wins) continue       // tidak memenuhi syarat
    return slot
  }
  return null
}

/** Fetch opponent dari pool (weight class sama, wins mirip). */
export async function fetchPoolOpponent(
  weightClass: WeightClass,
  targetWins: number
): Promise<MmaEvent['slots'][0]['opponent']> {
  const supabase = createClient()
  const { data } = await supabase
    .from('fighters')
    .select('name, attrs, record, specialty')
    .is('gym_id', null)
    .eq('status', 'prospect')
    .eq('weight_class', weightClass)
    .limit(30)

  if (!data || data.length === 0) return generateFallbackOpponent(targetWins)

  const pool = data as Pick<Fighter, 'name' | 'attrs' | 'record' | 'specialty'>[]
  const similar = pool.filter((f) => Math.abs(f.record.w - targetWins) <= 4)
  const chosen  = similar.length > 0 ? pick(similar) : pick(pool)

  return {
    name:      chosen.name,
    attrs:     chosen.attrs,
    record:    chosen.record,
    specialty: chosen.specialty,
    color:     pick(OPPONENT_COLORS),
  }
}

/** Fallback jika pool kosong: generate lawan sintetis. */
function generateFallbackOpponent(targetWins: number): MmaEvent['slots'][0]['opponent'] {
  const baseAttr = 50 + targetWins * 1.5
  const attrs = Object.fromEntries(
    ALL_ATTR_KEYS.map((k) => [k, Math.max(40, Math.min(90, Math.round(baseAttr + randInt(-10,10))))])
  ) as unknown as Fighter['attrs']

  return {
    name:      `Fighter #${randInt(100,999)}`,
    attrs,
    record:    { w: targetWins + randInt(-2,2), l: randInt(0,5), d: 0 },
    specialty: pick(['Striker','Grappler','All-rounder','Counter Fighter','Wrestler']),
    color:     pick(OPPONENT_COLORS),
  }
}

/** Daftarkan fighter ke event: assign slot terbaik + booking lawan dari pool. */
export async function registerFighterToEvent(
  gym: Gym,
  eventId: string,
  fighter: Fighter
): Promise<Gym | null> {
  const event = gym.events.find((e) => e.id === eventId)
  if (!event) return null

  const slot = getBestAvailableSlot(event, fighter.record.w)
  if (!slot) return null

  const opponent = await fetchPoolOpponent(event.weight_class, fighter.record.w)

  const updatedEvents = gym.events.map((e) => {
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
        s.fighter_id === fighterId ? { ...s, fighter_id: null, opponent: null } : s
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
