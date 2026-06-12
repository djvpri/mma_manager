export type WeightClass =
  | 'Strawweight'
  | 'Flyweight'
  | 'Bantamweight'
  | 'Featherweight'
  | 'Lightweight'
  | 'Welterweight'
  | 'Middleweight'
  | 'Heavyweight'

export type FighterStatus = 'active' | 'training' | 'injured' | 'prospect' | 'retired'

export type FighterPersonality =
  | 'Disciplined'
  | 'Hardworker'
  | 'Perfectionist'
  | 'Veteran'
  | 'Raw Talent'
  | 'Calculated'

export type Specialty =
  | 'Striker'
  | 'Grappler'
  | 'All-rounder'
  | 'Counter Fighter'
  | 'Wrestler'

export type TrainingSession = 'striking' | 'grappling' | 'cardio' | 'analytics' | 'mental' | 'sparring' | 'rest'
export type SponsorCategory = 'apparel' | 'energy' | 'supplement' | 'local'

export interface SponsorContract {
  id: string
  gym_id: string
  brand_name: string
  category: SponsorCategory
  weekly_income: number
  win_bonus: number
  duration_weeks: number
  weeks_remaining: number
  satisfaction: number
  status: 'active' | 'expired' | 'cancelled'
  created_at: string
}
export type TrainingIntensity = 'low' | 'medium' | 'high'

export type WeeklySchedule = {
  mon: TrainingSession
  tue: TrainingSession
  wed: TrainingSession
  thu: TrainingSession
  fri: TrainingSession
  sat: TrainingSession
}

export type GamePlan = 'pressure' | 'counter' | 'grapple' | 'technical'
export type CornerAdvice = 'push' | 'patient' | 'takedown' | 'striking'
export type FinishMethod = 'ko' | 'tko' | 'submission' | 'decision'

export type EventTier = 'local' | 'regional' | 'national' | 'international'
export type EventPromotion = 'lokal' | 'regional' | 'nasional' | 'championship' | 'internasional' | 'turnamen'
export type EventSlotType = 'main' | 'comain' | 'featured' | 'undercard' | 'tournament'

export interface EventSlotOpponent {
  id?: string | null
  name: string
  attrs: FighterAttrs
  record: FighterRecord
  specialty: string
  color: string
  is_rival?: boolean
  rival_meetings?: number
}

export interface EventSlot {
  type: EventSlotType
  purse_mult: number
  min_wins: number
  fighter_id: string | null
  opponent: EventSlotOpponent | null
  // Khusus slot 'tournament': bracket 3 lawan (QF/SF/Final) + progress
  opponents?: EventSlotOpponent[] | null
  bracket_round?: number // 0 = belum mulai, 1 = lolos QF, 2 = lolos SF, 3 = juara
}

export interface TournamentTitle {
  id: string
  gym_id: string
  fighter_id: string
  fighter_name: string
  weight_class: WeightClass
  season_week: number
  created_at: string
}

export interface MmaEvent {
  id: string
  name: string
  promotion: EventPromotion
  tier: EventTier          // tetap ada untuk kompatibilitas purse calc
  week: number
  weight_class: WeightClass
  slots: EventSlot[]
  venue?: string           // lokasi pertandingan (tidak ada di event lama)
  attendance?: number      // estimasi jumlah penonton (tidak ada di event lama)
}

export interface FighterAttrs {
  // Striking
  punch_power: number    // 0–100
  kick_power: number
  accuracy: number
  striking_defense: number
  // Grappling
  takedowns: number
  takedown_defense: number
  ground_control: number
  submission: number
  // Fisik
  cardio: number
  chin: number
  durability: number
  recovery: number
  // Pergerakan
  speed: number
  // Mental
  fight_iq: number
  mental: number
}

export interface FighterRecord {
  w: number
  l: number
  d: number
}

export interface Fighter {
  id: string
  gym_id: string | null   // null = free agent di pool
  is_cpu?: boolean         // true = roster CPU gym, dikontrol simulasi
  name: string
  nickname: string
  age: number
  birth_week: number       // 1-52, minggu "ulang tahun" dalam siklus season_week
  hometown: string
  weight_class: WeightClass
  status: FighterStatus
  specialty: Specialty
  personality: FighterPersonality
  attrs: FighterAttrs
  record: FighterRecord
  potential: number       // 0–100, hidden from player
  training_load: number   // 0–100
  injury: string | null
  injury_weeks_left: number | null
  contract_fights_left: number
  salary_monthly: number
  win_bonus: number
  purse_share_pct: number // 0-30, persentase purse yang jadi hak fighter tiap pertandingan
  title_shot_clause: boolean
  buyout_clause: number
  win_streak: number
  title_shot_pending: boolean
  morale: number          // 0–100, mempengaruhi peluang bertahan saat kontrak habis
  avatar_seed: number
  avatar_url: string | null
  next_fight_week: number | null
  training_focus: keyof FighterAttrs | null
  weekly_schedule: WeeklySchedule | null
  training_intensity: TrainingIntensity
  created_at: string
}

export interface RoomLevel {
  level: number
  max_level: number
}

export interface GymRooms {
  striking: RoomLevel
  grappling: RoomLevel
  cardio: RoomLevel
  recovery: RoomLevel
  locker: RoomLevel
  analytics: RoomLevel
}

export interface Gym {
  id: string
  user_id: string
  name: string
  city: string
  reputation: number      // 0–100
  balance: number         // IDR
  monthly_income: number
  monthly_expense: number
  season_week: number
  last_sponsor_week: number | null
  rooms: GymRooms
  events: MmaEvent[]
  friend_code: string
  assistant_manager_id: string | null
  created_at: string
}

export interface Championship {
  weight_class: WeightClass
  champion_fighter_id: string | null
  champion_gym_id: string | null
  champion_gym_name: string | null
  champion_name: string | null
  title_defenses: number
  won_at_week: number | null
  updated_at: string
}

export interface HallOfFameEntry {
  id: string
  gym_id: string
  fighter_id: string
  name: string
  nickname: string | null
  avatar_url: string | null
  weight_class: WeightClass
  specialty: string
  personality: string
  age_at_retirement: number
  record: FighterRecord
  attrs: FighterAttrs
  was_champion: boolean
  retired_at_week: number
  created_at: string
}

export interface Staff {
  id: string
  gym_id: string
  name: string
  role: string
  specialty: string
  salary: number
  rating: number          // 1–5
  is_hired: boolean
}

export interface FightResult {
  id: string
  gym_id: string
  fighter_id: string
  opponent_id?: string | null
  opponent_name: string
  opponent_record: FighterRecord
  round_results: RoundResult[]
  overall_winner: 'my' | 'opp' | 'draw'
  finish_method: FinishMethod
  finish_round: number | null
  scorecard: string | null
  game_plan_used: GamePlan
  fight_date: string
  created_at: string
}

export interface TickStat {
  type: 'strike' | 'takedown'
  target?: 'head' | 'body' | 'leg' // hanya untuk type 'strike'
  attempted: number
  landed: number
  controlSec: number
  knockdown: boolean
}

export interface RoundTick {
  text: string
  my_dmg: number
  opp_dmg: number
  myStat?: TickStat | null
  oppStat?: TickStat | null
}

// Statistik ala broadcast UFC: knockdown, sig. strikes, takedown, control time
export interface FightStats {
  knockdowns: number
  sigStrikesLanded: number
  sigStrikesAttempted: number
  strikesHead: number
  strikesBody: number
  strikesLeg: number
  takedownsLanded: number
  takedownsAttempted: number
  controlSec: number
}

export interface RoundResult {
  round: number
  winner: 'my' | 'opp'
  my_pct: number
  opp_pct: number
  events: string[]
  finish: FinishMethod | null
  corner_advice: CornerAdvice | null
  ticks?: RoundTick[]
  my_stamina?: number
  opp_stamina?: number
  my_mental?: number
  opp_mental?: number
  myStats?: FightStats
  oppStats?: FightStats
}

export interface GameState {
  gym: Gym | null
  fighters: Fighter[]
  currentFight: {
    fighter: Fighter | null
    opponent: {
      name: string
      attrs: FighterAttrs
      record: FighterRecord
      specialty: Specialty
    } | null
    phase: 'pregame' | 'gameplan' | 'fighting' | 'corner' | 'result'
    currentRound: number
    gamePlan: GamePlan | null
    cornerAdvice: CornerAdvice
    roundResults: RoundResult[]
    myHP: number
    oppHP: number
  }
}
