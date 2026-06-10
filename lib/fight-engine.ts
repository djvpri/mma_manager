import type { Fighter, FighterAttrs, GamePlan, CornerAdvice, RoundResult, FinishMethod } from '@/types'

export interface FightConfig {
  myFighter: Fighter
  opponent: { name: string; attrs: FighterAttrs; specialty: string }
  gamePlan: GamePlan
  cornerAdvice: CornerAdvice
  roundNum: number
}

const GAME_PLAN_MODS: Record<GamePlan, [number, number]> = {
  pressure:  [1.12, 0.92],
  counter:   [1.06, 0.97],
  grapple:   [0.94, 1.14],
  technical: [1.04, 0.96],
}

const CORNER_MODS: Record<CornerAdvice, [number, number]> = {
  push:     [1.08, 0.95],
  patient:  [1.03, 1.00],
  takedown: [0.97, 1.10],
  striking: [1.10, 0.93],
}

export function simulateRound(config: FightConfig): RoundResult {
  const { myFighter, opponent, gamePlan, cornerAdvice, roundNum } = config
  const a = myFighter.attrs
  const o = opponent.attrs

  let myScore = a.striking * 0.35 + a.grappling * 0.25 + a.cardio * 0.20 + a.fight_iq * 0.20
  let opScore = o.striking * 0.35 + o.grappling * 0.25 + o.cardio * 0.20 + o.fight_iq * 0.20

  const [mm, om] = GAME_PLAN_MODS[gamePlan]
  const [cm, co] = CORNER_MODS[cornerAdvice]
  myScore *= mm * cm
  opScore *= om * co

  // Cardio decay
  const fatigue = 1 - (roundNum - 1) * 0.04
  myScore *= Math.max(0.75, fatigue + (a.cardio - 80) * 0.003)
  opScore *= Math.max(0.75, fatigue + (o.cardio - 80) * 0.003)

  // ±12% variance
  myScore *= 0.88 + Math.random() * 0.24
  opScore *= 0.88 + Math.random() * 0.24

  const total = myScore + opScore
  const myPct = Math.round((myScore / total) * 100)
  const winner = myScore > opScore ? 'my' : 'opp'

  // Finish chance
  let finish: FinishMethod | null = null
  const finishChance = winner === 'my'
    ? Math.max(0, (myScore - opScore) / total * 1.8 - 0.1)
    : 0
  if (Math.random() < finishChance * 1.2) {
    const roll = Math.random()
    finish = gamePlan === 'grapple'
      ? 'submission'
      : roll < 0.5 ? 'ko' : 'tko'
  }

  return {
    round: roundNum,
    winner,
    my_pct: myPct,
    opp_pct: 100 - myPct,
    events: generateEvents(myFighter.name, opponent.name, gamePlan, winner),
    finish,
    corner_advice: cornerAdvice,
  }
}

function generateEvents(
  myName: string,
  oppName: string,
  gamePlan: GamePlan,
  winner: 'my' | 'opp'
): string[] {
  const first = myName.split(' ')[0]
  const oFirst = oppName.split(' ')[0]
  const pools: Record<GamePlan, string[]> = {
    pressure: [
      `${first} menekan terus ke pagar, memaksa ${oFirst} bertahan`,
      `Volume striking ${first} luar biasa — jab-cross-hook tanpa henti`,
      `${first} membungkam ${oFirst} dengan kombinasi ke badan`,
    ],
    counter: [
      `${first} menunggu sabar — counter mendarat bersih ke rahang ${oFirst}`,
      `Footwork ${first} elegan, bergeser lalu membalas dengan uppercut`,
      `${oFirst} maju — dan berjalan masuk ke cross keras ${first}`,
    ],
    grapple: [
      `Double-leg takedown berhasil! ${first} membanting ${oFirst} ke canvas`,
      `${first} mengontrol di half-guard, siku menghujam tulang rusuk`,
      `Rear naked choke dikunci — ${oFirst} berjuang keras untuk lepas`,
    ],
    technical: [
      `Jab ${first} mengena enam kali tanpa dibalas — poin bersih`,
      `${first} mengontrol jarak dengan sempurna, ${oFirst} tidak bisa masuk`,
      `Kombinasi terukur dari ${first} — setiap serangan efisien`,
    ],
  }
  const events = pools[gamePlan]
  const result = [events[Math.floor(Math.random() * events.length)]]
  if (winner === 'opp') {
    result.push(`${oFirst} membalas dengan serangan balik yang keras`)
  }
  return result
}

export function calculateFightResult(rounds: RoundResult[]): {
  winner: 'my' | 'opp' | 'draw'
  method: FinishMethod
  scorecard: string
} {
  const finish = rounds.find(r => r.finish)
  if (finish) {
    return { winner: finish.winner, method: finish.finish!, scorecard: '' }
  }
  const myWins = rounds.filter(r => r.winner === 'my').length
  const oppWins = rounds.filter(r => r.winner === 'opp').length
  const myScore = rounds.reduce((a, r) => a + (r.winner === 'my' ? 10 : 9), 0)
  const oppScore = rounds.reduce((a, r) => a + (r.winner === 'opp' ? 10 : 9), 0)
  return {
    winner: myWins > oppWins ? 'my' : myWins < oppWins ? 'opp' : 'draw',
    method: 'decision',
    scorecard: `${myScore}–${oppScore}`,
  }
}

const INJURY_POOL: { name: string; minWeeks: number; maxWeeks: number }[] = [
  { name: 'Memar wajah', minWeeks: 1, maxWeeks: 1 },
  { name: 'Cedera tangan', minWeeks: 2, maxWeeks: 3 },
  { name: 'Cedera bahu', minWeeks: 2, maxWeeks: 4 },
  { name: 'Cedera lutut', minWeeks: 3, maxWeeks: 5 },
  { name: 'Patah tulang rusuk', minWeeks: 4, maxWeeks: 8 },
  { name: 'Gegar otak ringan', minWeeks: 2, maxWeeks: 4 },
]

export function rollInjury(
  winner: 'my' | 'opp' | 'draw',
  isFinish: boolean
): { name: string; weeks: number } | null {
  const chance =
    winner === 'opp' ? (isFinish ? 0.25 : 0.15) : winner === 'draw' ? 0.08 : isFinish ? 0.06 : 0.04

  if (Math.random() > chance) return null

  const pick = INJURY_POOL[Math.floor(Math.random() * INJURY_POOL.length)]
  const weeks = pick.minWeeks + Math.floor(Math.random() * (pick.maxWeeks - pick.minWeeks + 1))
  return { name: pick.name, weeks }
}
