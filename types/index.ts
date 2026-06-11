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

export type GamePlan = 'pressure' | 'counter' | 'grapple' | 'technical'
export type CornerAdvice = 'push' | 'patient' | 'takedown' | 'striking'
export type FinishMethod = 'ko' | 'tko' | 'submission' | 'decision'

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
  gym_id: string
  name: string
  nickname: string
  age: number
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
  avatar_seed: number
  avatar_url: string | null
  next_fight_week: number | null
  training_focus: keyof FighterAttrs | null
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
  rooms: GymRooms
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

export interface RoundTick {
  text: string
  my_dmg: number
  opp_dmg: number
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
