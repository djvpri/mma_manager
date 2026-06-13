import type { Fighter, FighterAttrs, GamePlan, CornerAdvice, RoundResult, RoundTick, TickStat, FightStats, FinishMethod } from '@/types'

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
  myHP: number
  oppHP: number
  /** my_pct ronde sebelumnya dari sudut pandang lawan (100 - my_pct), untuk adaptasi AI corner lawan. Undefined di ronde 1. */
  prevOppPct?: number
  /** Jumlah tick exchange per ronde (default EXCHANGE_TICKS). Mode "Full Fight" pakai FULL_EXCHANGE_TICKS. */
  exchangeTicks?: number
}

// Matchup gaya bertarung: bonus/penalti skor ofensif berdasarkan spesialisasi
// penyerang vs spesialisasi lawan. Nilai 1 = netral. Merepresentasikan
// keunggulan situasional ala rock-paper-scissors MMA (wrestler vs striker, dst).
const SPECIALTY_MATCHUP: Record<string, Partial<Record<string, number>>> = {
  Wrestler:         { Striker: 1.10, 'Counter Fighter': 1.06, Grappler: 0.97 },
  Striker:          { Grappler: 1.06, Wrestler: 0.95 },
  Grappler:         { Wrestler: 1.04, 'All-rounder': 1.02, Striker: 0.96 },
  'Counter Fighter': { Striker: 1.08, Wrestler: 0.95 },
  'All-rounder':    { 'Counter Fighter': 1.02 },
}

function matchupMult(attackerSpecialty: string, defenderSpecialty: string): number {
  return SPECIALTY_MATCHUP[attackerSpecialty]?.[defenderSpecialty] ?? 1
}

const GAME_PLAN_MODS: Record<GamePlan, [number, number]> = {
  pressure:  [1.12, 0.92],
  counter:   [1.06, 0.97],
  grapple:   [0.94, 1.14],
  technical: [1.04, 0.96],
  brawler:   [1.18, 1.15],
  defensive: [0.85, 0.75],
}

export const CORNER_MODS: Record<CornerAdvice, [number, number]> = {
  push:     [1.08, 0.95],
  patient:  [1.03, 1.00],
  takedown: [0.97, 1.10],
  striking: [1.10, 0.93],
  survive:  [0.60, 0.85],
  allout:   [1.25, 1.05],
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
  const { myFighter, opponent, gamePlan, cornerAdvice, roundNum, myStamina, oppStamina, myMental, oppMental, myHP, oppHP, prevOppPct, exchangeTicks } = config
  const a = myFighter.attrs
  const o = opponent.attrs

  // Defense lawan meredam/memperkuat skor ofensif (defense 50 = netral, ±20% di ujung skala)
  let myScore = offenseScore(a) * (1 - (defenseScore(o) - 50) / 250)
  let opScore = offenseScore(o) * (1 - (defenseScore(a) - 50) / 250)

  // Style matchup: keunggulan/kerugian situasional berdasarkan spesialisasi
  myScore *= matchupMult(myFighter.specialty, opponent.specialty)
  opScore *= matchupMult(opponent.specialty, myFighter.specialty)

  const [mm, om] = GAME_PLAN_MODS[gamePlan]
  const [cm, co] = CORNER_MODS[cornerAdvice]
  myScore *= mm * cm
  opScore *= om * co

  // AI corner lawan beradaptasi dari ronde sebelumnya: kalau lawan didominasi
  // (my_pct ronde lalu tinggi), corner-nya mendorong lebih agresif (desperation);
  // kalau lawan mendominasi, mereka justru main aman dan membuka sedikit ruang.
  if (prevOppPct !== undefined) {
    if (prevOppPct < 35) {
      opScore *= 1.07
    } else if (prevOppPct > 65) {
      opScore *= 0.97
      myScore *= 1.03
    }
  }

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

  // Finish chance (simetris) — makin besar jika pihak yang kalah ronde sudah
  // kehabisan stamina/mental, atau sudah babak belur (HP rendah). Diredam
  // oleh chin & daya tahan pihak yang kalah.
  const margin = Math.abs(myScore - opScore) / total
  let finishChance = Math.max(0, margin * 1.8 - 0.1)

  const loserStamina = winner === 'my' ? oppStamina : myStamina
  const loserMental = winner === 'my' ? oppMental : myMental
  const loserHP = winner === 'my' ? oppHP : myHP
  const loserAttrs = winner === 'my' ? o : a

  if (loserStamina < 30) finishChance += (30 - loserStamina) * 0.01
  if (loserMental < 40) finishChance += (40 - loserMental) * 0.01
  // Babak belur (HP < 35): makin rentan finish, wasit mulai waspada
  if (loserHP < 35) finishChance += (35 - loserHP) * 0.015

  const toughness = (loserAttrs.chin * 0.6 + loserAttrs.durability * 0.4) / 100
  finishChance *= 1 - toughness * 0.35

  // Survive: kalau saya yang kalah ronde ini, drastis kurangi risiko di-finish lawan.
  // All-out: risiko finish naik di kedua arah — saya lebih agresif tapi juga lebih terbuka.
  if (cornerAdvice === 'survive' && winner === 'opp') {
    finishChance *= 0.4
  } else if (cornerAdvice === 'allout') {
    finishChance *= winner === 'my' ? 1.5 : 1.4
  }

  let finish: FinishMethod | null = null
  if (Math.random() < finishChance * 1.2) {
    const winnerAttrs = winner === 'my' ? a : o
    const subBias = winnerAttrs.submission > 70 && Math.random() < 0.4
    finish = subBias ? 'submission' : (Math.random() < 0.5 ? 'ko' : 'tko')
  }

  const dmgToOpp = Math.round(myPct * 0.25)
  const dmgToMe = Math.round((100 - myPct) * 0.25)

  const myFirst = myFighter.name.split(' ')[0]
  const oppFirst = opponent.name.split(' ')[0]
  const winnerName = winner === 'my' ? myFirst : oppFirst
  const loserName = winner === 'my' ? oppFirst : myFirst

  const ticks = generateTicks(roundNum, myFirst, oppFirst, gamePlan, dmgToMe, dmgToOpp, finish, winnerName, loserName, a, o, exchangeTicks ?? EXCHANGE_TICKS)
  const { my: myStats, opp: oppStats } = aggregateTickStats(ticks)

  const myFinished = finish !== null && winner === 'opp'
  const oppFinished = finish !== null && winner === 'my'

  // Kriteria juri: striking effectiveness & grappling/control, masing-masing
  // sebagai persentase dominasi (mirip statistik FightMetric).
  const myStrikeScore = a.punch_power * 0.3 + a.kick_power * 0.25 + a.accuracy * 0.35 + a.speed * 0.1
  const opStrikeScore = o.punch_power * 0.3 + o.kick_power * 0.25 + o.accuracy * 0.35 + o.speed * 0.1
  const myStrikeAdj = myStrikeScore * (1 - (o.striking_defense - 50) / 250)
  const opStrikeAdj = opStrikeScore * (1 - (a.striking_defense - 50) / 250)
  const strikeTotal = myStrikeAdj + opStrikeAdj
  const myStrikingPct = Math.round((myStrikeAdj / strikeTotal) * 100)

  const myGrappleScore = a.takedowns * 0.35 + a.ground_control * 0.35 + a.submission * 0.3
  const opGrappleScore = o.takedowns * 0.35 + o.ground_control * 0.35 + o.submission * 0.3
  const myGrappleAdj = myGrappleScore * (1 - (o.takedown_defense - 50) / 250)
  const opGrappleAdj = opGrappleScore * (1 - (a.takedown_defense - 50) / 250)
  const grappleTotal = myGrappleAdj + opGrappleAdj
  const myGrapplingPct = Math.round((myGrappleAdj / grappleTotal) * 100)

  // Skor 10-point must: ronde dominan (margin >= 15%) dapat 10-8, sisanya 10-9
  const dominant = Math.abs(myPct - 50) >= 15
  let myRoundScore: number
  let oppRoundScore: number
  if (finish) {
    myRoundScore = winner === 'my' ? 10 : 9
    oppRoundScore = winner === 'opp' ? 10 : 9
  } else if (winner === 'my') {
    myRoundScore = 10
    oppRoundScore = dominant ? 8 : 9
  } else {
    oppRoundScore = 10
    myRoundScore = dominant ? 8 : 9
  }

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
    my_mental: clamp(myMental + mentalChange(winner === 'my', dmgToMe, myFinished, a.mental) + (cornerAdvice === 'survive' ? 4 : 0), 0, 100),
    opp_mental: clamp(oppMental + mentalChange(winner === 'opp', dmgToOpp, oppFinished, o.mental), 0, 100),
    myStats,
    oppStats,
    criteria: {
      striking: { my: myStrikingPct, opp: 100 - myStrikingPct },
      grappling: { my: myGrapplingPct, opp: 100 - myGrapplingPct },
    },
    my_round_score: myRoundScore,
    opp_round_score: oppRoundScore,
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
  brawler: 17,
  defensive: 6,
}

const CORNER_STAMINA_COST: Record<CornerAdvice, number> = {
  push: 4,
  patient: -3,
  takedown: 2,
  striking: 2,
  survive: -6,
  allout: 6,
}

function myStaminaLoss(gamePlan: GamePlan, cornerAdvice: CornerAdvice, cardio: number, recovery: number): number {
  const base = GAME_PLAN_STAMINA_COST[gamePlan] + CORNER_STAMINA_COST[cornerAdvice]
  const cardioRelief = (cardio - 70) * 0.08
  const recoveryRelief = (recovery - 70) * 0.04
  const variance = Math.random() * 4 - 2
  // Floor -5 (bukan 3): kombinasi Defensive+Survive dengan cardio/recovery tinggi
  // bisa benar-benar memulihkan stamina, bukan cuma memperlambat penurunan.
  return Math.max(-5, Math.round(base - cardioRelief - recoveryRelief + variance))
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
    brawler: [
      `${attacker} dan ${defender} sama-sama melepas pertahanan, baku hantam habis-habisan di tengah oktagon`,
      `${attacker} mendaratkan overhand telak — sebuah adu jotos murni tanpa kompromi`,
      `Penonton berteriak histeris saat ${attacker} dan ${defender} saling tukar pukulan keras tanpa henti`,
      `${attacker} mengambil risiko besar, maju lurus dan menghantam ${defender} dengan kombinasi brutal`,
    ],
    defensive: [
      `${attacker} hanya melepas pukulan terukur sambil terus menjaga jarak aman dari ${defender}`,
      `${attacker} memilih footwork rapi, membatasi ruang gerak ${defender} tanpa ambil risiko`,
      `Sesekali ${attacker} mencuri poin dengan jab ringan lalu langsung kembali ke posisi aman`,
      `${attacker} bermain sabar, memastikan ${defender} tidak punya celah untuk balas serius`,
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

export const EXCHANGE_TICKS = 4
export const FULL_EXCHANGE_TICKS = 9

// Bagi `total` menjadi `parts` angka non-negatif yang jumlahnya tetap `total`.
export function splitTotal(total: number, parts: number): number[] {
  if (total <= 0) return Array(parts).fill(0)
  const cuts = Array.from({ length: parts - 1 }, () => Math.random()).sort((a, b) => a - b)
  const points = [0, ...cuts, 1]
  const result = points.slice(1).map((p, i) => Math.round((p - points[i]) * total))
  const sum = result.reduce((a, b) => a + b, 0)
  result[result.length - 1] += total - sum
  return result
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Distribusi target striking [head, body, leg] per game plan
const STRIKE_TARGET_WEIGHTS: Record<GamePlan, [number, number, number]> = {
  pressure:  [0.50, 0.35, 0.15],
  counter:   [0.60, 0.25, 0.15],
  grapple:   [0.40, 0.40, 0.20],
  technical: [0.40, 0.20, 0.40],
  brawler:   [0.65, 0.30, 0.05],
  defensive: [0.35, 0.25, 0.40],
}

function pickTarget(gamePlan: GamePlan): 'head' | 'body' | 'leg' {
  const [head, body] = STRIKE_TARGET_WEIGHTS[gamePlan]
  const r = Math.random()
  if (r < head) return 'head'
  if (r < head + body) return 'body'
  return 'leg'
}

// Peluang sebuah exchange berupa upaya takedown, bukan pertukaran pukulan
const TAKEDOWN_ATTEMPT_CHANCE: Record<GamePlan, number> = {
  pressure: 0.08,
  counter: 0.08,
  grapple: 0.45,
  technical: 0.05,
  brawler: 0.04,
  defensive: 0.10,
}

// Hasilkan statistik (sig. strike / takedown) untuk satu exchange, dari sudut pandang attacker
function generateTickStat(attacker: FighterAttrs, defender: FighterAttrs, gamePlan: GamePlan, dmg: number): TickStat {
  if (Math.random() < TAKEDOWN_ATTEMPT_CHANCE[gamePlan]) {
    const successChance = clamp(0.3 + (attacker.takedowns - defender.takedown_defense) / 150, 0.1, 0.9)
    const landed = Math.random() < successChance
    return {
      type: 'takedown',
      attempted: 1,
      landed: landed ? 1 : 0,
      controlSec: landed ? Math.round(15 + (attacker.ground_control / 100) * 45 + Math.random() * 10) : 0,
      knockdown: false,
    }
  }

  const attempted = randInt(2, 5)
  const landRatio = clamp(0.3 + (attacker.accuracy - defender.striking_defense) / 150, 0.15, 0.85)
  const landed = clamp(Math.round(attempted * landRatio), dmg > 0 ? 1 : 0, attempted)

  return {
    type: 'strike',
    target: pickTarget(gamePlan),
    attempted,
    landed,
    controlSec: 0,
    knockdown: dmg >= 8 && Math.random() < 0.4,
  }
}

export function emptyFightStats(): FightStats {
  return {
    knockdowns: 0,
    sigStrikesLanded: 0,
    sigStrikesAttempted: 0,
    strikesHead: 0,
    strikesBody: 0,
    strikesLeg: 0,
    takedownsLanded: 0,
    takedownsAttempted: 0,
    controlSec: 0,
  }
}

function applyTickStat(stats: FightStats, stat: TickStat | null | undefined) {
  if (!stat) return
  if (stat.type === 'strike') {
    stats.sigStrikesAttempted += stat.attempted
    stats.sigStrikesLanded += stat.landed
    if (stat.target === 'head') stats.strikesHead += stat.landed
    if (stat.target === 'body') stats.strikesBody += stat.landed
    if (stat.target === 'leg') stats.strikesLeg += stat.landed
    if (stat.knockdown) stats.knockdowns += 1
  } else {
    stats.takedownsAttempted += stat.attempted
    stats.takedownsLanded += stat.landed
    stats.controlSec += stat.controlSec
  }
}

export function aggregateTickStats(ticks: RoundTick[]): { my: FightStats; opp: FightStats } {
  const my = emptyFightStats()
  const opp = emptyFightStats()
  for (const tick of ticks) {
    applyTickStat(my, tick.myStat)
    applyTickStat(opp, tick.oppStat)
  }
  return { my, opp }
}

export function sumFightStats(list: FightStats[]): FightStats {
  return list.reduce((acc, s) => {
    acc.knockdowns += s.knockdowns
    acc.sigStrikesLanded += s.sigStrikesLanded
    acc.sigStrikesAttempted += s.sigStrikesAttempted
    acc.strikesHead += s.strikesHead
    acc.strikesBody += s.strikesBody
    acc.strikesLeg += s.strikesLeg
    acc.takedownsLanded += s.takedownsLanded
    acc.takedownsAttempted += s.takedownsAttempted
    acc.controlSec += s.controlSec
    return acc
  }, emptyFightStats())
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
  loserName: string,
  myAttrs: FighterAttrs,
  oppAttrs: FighterAttrs,
  exchangeTicks: number
): RoundTick[] {
  const opener: RoundTick = { text: pick(NARRATION_OPENERS)(roundNum), my_dmg: 0, opp_dmg: 0 }

  const myDmgParts = splitTotal(dmgToMe, exchangeTicks)
  const oppDmgParts = splitTotal(dmgToOpp, exchangeTicks)

  const exchanges: RoundTick[] = myDmgParts.map((myDmg, i) => {
    const oppDmg = oppDmgParts[i]
    let line: string
    if (oppDmg > myDmg) line = pick(exchangeLines(myFirst, oppFirst, gamePlan))
    else if (myDmg > oppDmg) line = pick(exchangeLines(oppFirst, myFirst, gamePlan))
    else line = pick(evenExchangeLines(myFirst, oppFirst))

    // myStat: statistik ofensif milik fighter saya (damage yang dia hasilkan ke lawan)
    const myStat = oppDmg > 0 ? generateTickStat(myAttrs, oppAttrs, gamePlan, oppDmg) : null
    // oppStat: statistik ofensif milik lawan (damage yang dia hasilkan ke saya)
    const oppStat = myDmg > 0 ? generateTickStat(oppAttrs, myAttrs, gamePlan, myDmg) : null

    return { text: `${line}.`, my_dmg: myDmg, opp_dmg: oppDmg, myStat, oppStat }
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
  const myScore = rounds.reduce((a, r) => a + (r.my_round_score ?? (r.winner === 'my' ? 10 : 9)), 0)
  const oppScore = rounds.reduce((a, r) => a + (r.opp_round_score ?? (r.winner === 'opp' ? 10 : 9)), 0)
  return {
    winner: myScore > oppScore ? 'my' : myScore < oppScore ? 'opp' : 'draw',
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
