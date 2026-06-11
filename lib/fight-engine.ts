import type { Fighter, FighterAttrs, GamePlan, CornerAdvice, RoundResult, RoundTick, FinishMethod } from '@/types'

export interface FightConfig {
  myFighter: Fighter
  opponent: { name: string; attrs: FighterAttrs; specialty: string }
  gamePlan: GamePlan
  cornerAdvice: CornerAdvice
  roundNum: number
  myStamina: number
  oppStamina: number
  myMental: number
  oppMental: number
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

// Skor ofensif: gabungan kekuatan/akurasi striking, grappling, kecepatan, dan fight IQ
function offenseScore(attrs: FighterAttrs): number {
  return (
    attrs.punch_power * 0.18 +
    attrs.kick_power * 0.12 +
    attrs.accuracy * 0.20 +
    attrs.takedowns * 0.12 +
    attrs.ground_control * 0.10 +
    attrs.submission * 0.08 +
    attrs.speed * 0.08 +
    attrs.fight_iq * 0.12
  )
}

// Skor defensif: seberapa sulit fighter ini ditembus/dijatuhkan
function defenseScore(attrs: FighterAttrs): number {
  return (
    attrs.striking_defense * 0.35 +
    attrs.takedown_defense * 0.25 +
    attrs.durability * 0.25 +
    attrs.chin * 0.15
  )
}

export function simulateRound(config: FightConfig): RoundResult {
  const { myFighter, opponent, gamePlan, cornerAdvice, roundNum, myStamina, oppStamina, myMental, oppMental } = config
  const a = myFighter.attrs
  const o = opponent.attrs

  // Defense lawan meredam/memperkuat skor ofensif (defense 50 = netral, ±20% di ujung skala)
  let myScore = offenseScore(a) * (1 - (defenseScore(o) - 50) / 250)
  let opScore = offenseScore(o) * (1 - (defenseScore(a) - 50) / 250)

  const [mm, om] = GAME_PLAN_MODS[gamePlan]
  const [cm, co] = CORNER_MODS[cornerAdvice]
  myScore *= mm * cm
  opScore *= om * co

  // Stamina & mental yang sudah terkuras dari ronde sebelumnya menggerus performa
  myScore *= 0.85 + (myStamina / 100) * 0.15
  opScore *= 0.85 + (oppStamina / 100) * 0.15
  myScore *= 0.92 + (myMental / 100) * 0.08
  opScore *= 0.92 + (oppMental / 100) * 0.08

  // ±12% variance
  myScore *= 0.88 + Math.random() * 0.24
  opScore *= 0.88 + Math.random() * 0.24

  const total = myScore + opScore
  const myPct = Math.round((myScore / total) * 100)
  const winner = myScore > opScore ? 'my' : 'opp'

  // Finish chance — makin besar jika lawan kehabisan stamina/mental, diredam oleh chin & daya tahan lawan
  let finishChance = winner === 'my'
    ? Math.max(0, (myScore - opScore) / total * 1.8 - 0.1)
    : 0
  if (winner === 'my') {
    if (oppStamina < 30) finishChance += (30 - oppStamina) * 0.01
    if (oppMental < 40) finishChance += (40 - oppMental) * 0.01
    const toughness = (o.chin * 0.6 + o.durability * 0.4) / 100
    finishChance *= 1 - toughness * 0.35
  }

  let finish: FinishMethod | null = null
  if (Math.random() < finishChance * 1.2) {
    const roll = Math.random()
    finish = gamePlan === 'grapple'
      ? 'submission'
      : roll < 0.5 ? 'ko' : 'tko'
  }

  const dmgToOpp = Math.round(myPct * 0.25)
  const dmgToMe = Math.round((100 - myPct) * 0.25)

  const myFirst = myFighter.name.split(' ')[0]
  const oppFirst = opponent.name.split(' ')[0]
  const winnerName = winner === 'my' ? myFirst : oppFirst
  const loserName = winner === 'my' ? oppFirst : myFirst

  const ticks = generateTicks(roundNum, myFirst, oppFirst, gamePlan, dmgToMe, dmgToOpp, finish, winnerName, loserName)

  const myFinished = finish !== null && winner === 'opp'
  const oppFinished = finish !== null && winner === 'my'

  return {
    round: roundNum,
    winner,
    my_pct: myPct,
    opp_pct: 100 - myPct,
    events: ticks.map((t) => t.text),
    finish,
    corner_advice: cornerAdvice,
    ticks,
    my_stamina: clamp(myStamina - myStaminaLoss(gamePlan, cornerAdvice, a.cardio, a.recovery), 0, 100),
    opp_stamina: clamp(oppStamina - oppStaminaLoss(o.cardio, o.recovery), 0, 100),
    my_mental: clamp(myMental + mentalChange(winner === 'my', dmgToMe, myFinished, a.mental), 0, 100),
    opp_mental: clamp(oppMental + mentalChange(winner === 'opp', dmgToOpp, oppFinished, o.mental), 0, 100),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

const GAME_PLAN_STAMINA_COST: Record<GamePlan, number> = {
  pressure: 14,
  counter: 9,
  grapple: 12,
  technical: 8,
}

const CORNER_STAMINA_COST: Record<CornerAdvice, number> = {
  push: 4,
  patient: -3,
  takedown: 2,
  striking: 2,
}

function myStaminaLoss(gamePlan: GamePlan, cornerAdvice: CornerAdvice, cardio: number, recovery: number): number {
  const base = GAME_PLAN_STAMINA_COST[gamePlan] + CORNER_STAMINA_COST[cornerAdvice]
  const cardioRelief = (cardio - 70) * 0.08
  const recoveryRelief = (recovery - 70) * 0.04
  const variance = Math.random() * 4 - 2
  return Math.max(3, Math.round(base - cardioRelief - recoveryRelief + variance))
}

function oppStaminaLoss(cardio: number, recovery: number): number {
  const base = 10
  const cardioRelief = (cardio - 70) * 0.08
  const recoveryRelief = (recovery - 70) * 0.04
  const variance = Math.random() * 4 - 2
  return Math.max(3, Math.round(base - cardioRelief - recoveryRelief + variance))
}

// Perubahan mental setelah satu ronde: menang menambah, kalah/kena hit besar/finish mengurangi.
// Atribut mental yang tinggi meredam penurunan (lebih tahan banting).
function mentalChange(won: boolean, dmgTaken: number, gotFinished: boolean, mental: number): number {
  let change = won ? 2 + Math.floor(Math.random() * 4) : -(2 + Math.floor(Math.random() * 4))
  if (dmgTaken >= 12) change -= 5
  if (gotFinished) change -= 15
  if (change < 0) {
    const resilience = clamp((mental - 50) * 0.006, -0.3, 0.3)
    change = Math.round(change * (1 - resilience))
  }
  return change
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const NARRATION_OPENERS: ((round: number) => string)[] = [
  (round) => `Ronde ${round} dimulai dengan kedua petarung saling melempar jab pembuka untuk membaca jarak.`,
  (round) => `Bel berbunyi tanda ronde ${round} dimulai — penonton langsung berdiri menyambut aksi pembuka.`,
  (round) => `Tensi langsung naik begitu ronde ${round} bergulir, kedua sudut berteriak memberi instruksi.`,
  (round) => `Ronde ${round}: kedua petarung saling mengunci pandangan sebelum baku hantam dimulai.`,
  (round) => `Wasit memberi aba-aba, dan ronde ${round} pun pecah dengan pertukaran pukulan cepat.`,
]

function exchangeLines(attacker: string, defender: string, gamePlan: GamePlan): string[] {
  const pools: Record<GamePlan, string[]> = {
    pressure: [
      `${attacker} terus menekan maju, memaksa ${defender} merapat ke pagar`,
      `Kombinasi jab-cross-hook dari ${attacker} mendarat telak ke kepala ${defender}`,
      `${attacker} memburu dengan pukulan ke badan, ${defender} mulai kehabisan ruang`,
      `Overhand keras dari ${attacker} nyaris merobohkan ${defender}`,
    ],
    counter: [
      `${attacker} menunggu sabar lalu membalas dengan counter bersih ke rahang ${defender}`,
      `${defender} maju ceroboh — dan langsung disambut cross keras dari ${attacker}`,
      `Footwork ${attacker} membuka sudut untuk uppercut tajam`,
      `${attacker} slip lalu membalas dengan hook yang mengejutkan ${defender}`,
    ],
    grapple: [
      `${attacker} berhasil takedown dan langsung mengambil posisi dominan di atas`,
      `Dari posisi atas, ${attacker} menghujamkan siku-siku keras ke ${defender}`,
      `${attacker} mengejar leher, ${defender} berjuang keras mempertahankan posisi`,
      `Ground and pound dari ${attacker} membuat ${defender} kesulitan bertahan`,
    ],
    technical: [
      `Jab terukur ${attacker} mengena beruntun tanpa dibalas`,
      `${attacker} mengontrol jarak dengan sempurna, ${defender} kesulitan masuk`,
      `Kombinasi efisien dari ${attacker} menambah poin bersih di mata juri`,
      `Leg kick dari ${attacker} mulai membuat ${defender} pincang`,
    ],
  }
  return pools[gamePlan]
}

function evenExchangeLines(myFirst: string, oppFirst: string): string[] {
  return [
    `${myFirst} dan ${oppFirst} saling baku hantam di tengah oktagon, sama-sama tak mau mundur`,
    `Pertukaran pukulan cepat — keduanya terlihat sama kuat di momen ini`,
    `${myFirst} mencoba masuk, ${oppFirst} membalas — sama-sama mendarat pukulan keras`,
    `Clinch di pagar, keduanya berebut posisi tanpa ada yang dominan`,
  ]
}

const FINISH_LINES: Record<Exclude<FinishMethod, 'decision'>, (winner: string, loser: string) => string> = {
  ko: (w, l) =>
    `DAN ITU DIA — pukulan telak menghantam ${l}, tubuhnya langsung ambruk ke kanvas! ${w} mengakhiri pertarungan dengan KNOCKOUT brutal!`,
  tko: (w, l) =>
    `Wasit melompat masuk menghentikan pertarungan! ${l} sudah tidak mampu melindungi diri — TKO untuk ${w}!`,
  submission: (w, l) =>
    `${l} menepuk matras berkali-kali — submission sempurna dari ${w} mengunci kemenangan malam ini!`,
}

const ROUND_CLOSERS: string[] = [
  'Kedua sudut kini sibuk menyiapkan strategi untuk ronde berikutnya.',
  'Penonton bersorak menantikan apa yang akan terjadi di ronde selanjutnya.',
  'Pelatih masing-masing fighter berteriak dari pinggir oktagon, mencoba mengubah momentum.',
]

const FIGHT_END_CLOSERS: string[] = [
  'Bel berbunyi menandai akhir pertarungan — kini tinggal menunggu keputusan juri.',
  'Pertarungan ini akan dikenang sebagai salah satu yang paling intens malam ini.',
  'Kedua petarung saling merangkul di tengah oktagon, menghormati perjuangan masing-masing.',
]

const EXCHANGE_TICKS = 4

// Bagi `total` menjadi `parts` angka non-negatif yang jumlahnya tetap `total`.
function splitTotal(total: number, parts: number): number[] {
  if (total <= 0) return Array(parts).fill(0)
  const cuts = Array.from({ length: parts - 1 }, () => Math.random()).sort((a, b) => a - b)
  const points = [0, ...cuts, 1]
  const result = points.slice(1).map((p, i) => Math.round((p - points[i]) * total))
  const sum = result.reduce((a, b) => a + b, 0)
  result[result.length - 1] += total - sum
  return result
}

function generateTicks(
  roundNum: number,
  myFirst: string,
  oppFirst: string,
  gamePlan: GamePlan,
  dmgToMe: number,
  dmgToOpp: number,
  finish: FinishMethod | null,
  winnerName: string,
  loserName: string
): RoundTick[] {
  const opener: RoundTick = { text: pick(NARRATION_OPENERS)(roundNum), my_dmg: 0, opp_dmg: 0 }

  const myDmgParts = splitTotal(dmgToMe, EXCHANGE_TICKS)
  const oppDmgParts = splitTotal(dmgToOpp, EXCHANGE_TICKS)

  const exchanges: RoundTick[] = myDmgParts.map((myDmg, i) => {
    const oppDmg = oppDmgParts[i]
    let line: string
    if (oppDmg > myDmg) line = pick(exchangeLines(myFirst, oppFirst, gamePlan))
    else if (myDmg > oppDmg) line = pick(exchangeLines(oppFirst, myFirst, gamePlan))
    else line = pick(evenExchangeLines(myFirst, oppFirst))
    return { text: `${line}.`, my_dmg: myDmg, opp_dmg: oppDmg }
  })

  if (finish && finish !== 'decision') {
    exchanges[exchanges.length - 1].text = FINISH_LINES[finish](winnerName, loserName)
  }

  return [opener, ...exchanges]
}

export function generateClosingLine(isFightOver: boolean): string {
  return pick(isFightOver ? FIGHT_END_CLOSERS : ROUND_CLOSERS)
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
  isFinish: boolean,
  injuryReduction = 0
): { name: string; weeks: number } | null {
  const chance =
    (winner === 'opp' ? (isFinish ? 0.25 : 0.15) : winner === 'draw' ? 0.08 : isFinish ? 0.06 : 0.04) *
    (1 - injuryReduction)

  if (Math.random() > chance) return null

  const pick = INJURY_POOL[Math.floor(Math.random() * INJURY_POOL.length)]
  const weeks = pick.minWeeks + Math.floor(Math.random() * (pick.maxWeeks - pick.minWeeks + 1))
  return { name: pick.name, weeks }
}
