// @ts-nocheck — file Deno (Supabase Edge Function), bukan bagian aplikasi Next.js.
// Salinan minimal tipe yang dibutuhkan fight-engine.ts, disesuaikan untuk Deno
// (Edge Function tidak bisa import dari '@/types' app Next.js).
// Sinkronkan manual kalau ada perubahan struktural di types/index.ts.

export type GamePlan = 'pressure' | 'counter' | 'grapple' | 'technical' | 'brawler' | 'defensive'
export type CornerAdvice = 'push' | 'patient' | 'takedown' | 'striking' | 'survive' | 'allout'
export type FinishMethod = 'ko' | 'tko' | 'submission' | 'decision'

export interface FighterAttrs {
  punch_power: number
  kick_power: number
  accuracy: number
  striking_defense: number
  takedowns: number
  takedown_defense: number
  ground_control: number
  submission: number
  cardio: number
  chin: number
  durability: number
  recovery: number
  speed: number
  fight_iq: number
  mental: number
}

export interface TickStat {
  type: 'strike' | 'takedown'
  target?: 'head' | 'body' | 'leg'
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
  criteria?: {
    striking: { my: number; opp: number }
    grappling: { my: number; opp: number }
  }
  my_round_score?: number
  opp_round_score?: number
}

/** Bentuk minimal fighter yang dibutuhkan simulateRound (attrs, specialty, name). */
export interface EdgeFighter {
  name: string
  attrs: FighterAttrs
  specialty: string
}
