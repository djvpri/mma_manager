import type { FighterPersonality } from '@/types'
import type { RecruitCandidate } from './generate-recruits'
import { formatCurrency } from './format'
import { overallRating } from './attrs'

export interface ContractOffer {
  salary: number // Base Purse (gaji mingguan tetap)
  winBonus: number // Bonus dibayar tiap kemenangan
  purseSharePct: number // 0-30: persentase purse yang jadi hak fighter tiap pertandingan
  bonus: number // Bonus tanda tangan
  contractLength: number
  titleShotClause: boolean // Jika menang 3x beruntun, berhak menuntut title shot
  buyoutClause: number // Biaya gym jika memutus kontrak sebelum waktunya
}

interface NegotiationProfile {
  winBonusMult: number
  baseBias: number // 0-1: 1 = mengutamakan Base Purse, 0 = mengutamakan kompensasi berbasis performa
  purseShareDesire: number // 0-1: dari porsi performa, seberapa besar diinginkan dalam bentuk bagi hasil purse vs win bonus
  titleShotDesire: number // 0-1: seberapa ingin klausul Title Shot
  buyoutFlexPref: number // 0-1: seberapa keberatan dengan klausul buyout tinggi
  contractPref: number
  flexibility: number
  patience: number
  phrase: string
}

export const NEGOTIATION_PROFILES: Record<FighterPersonality, NegotiationProfile> = {
  Disciplined: {
    winBonusMult: 0.9,
    baseBias: 0.6, purseShareDesire: 0.45, titleShotDesire: 0.4, buyoutFlexPref: 0.4,
    contractPref: 3, flexibility: 0.35, patience: 4, phrase: 'mempertimbangkan dengan tenang',
  },
  Hardworker: {
    winBonusMult: 1.0,
    baseBias: 0.5, purseShareDesire: 0.5, titleShotDesire: 0.5, buyoutFlexPref: 0.5,
    contractPref: 3, flexibility: 0.5, patience: 4, phrase: 'menghargai kesempatan ini',
  },
  Perfectionist: {
    winBonusMult: 1.1,
    baseBias: 0.55, purseShareDesire: 0.5, titleShotDesire: 0.75, buyoutFlexPref: 0.3,
    contractPref: 3, flexibility: 0.25, patience: 3, phrase: 'merasa belum sesuai standarnya',
  },
  Veteran: {
    winBonusMult: 0.6,
    baseBias: 0.85, purseShareDesire: 0.25, titleShotDesire: 0.2, buyoutFlexPref: 0.1,
    contractPref: 2, flexibility: 0.2, patience: 3, phrase: 'bersikap tegas soal pengalamannya',
  },
  'Raw Talent': {
    winBonusMult: 1.4,
    baseBias: 0.3, purseShareDesire: 0.65, titleShotDesire: 0.8, buyoutFlexPref: 0.8,
    contractPref: 4, flexibility: 0.55, patience: 5, phrase: 'antusias mendapat kesempatan',
  },
  Calculated: {
    winBonusMult: 1.15,
    baseBias: 0.6, purseShareDesire: 0.6, titleShotDesire: 0.6, buyoutFlexPref: 0.7,
    contractPref: 3, flexibility: 0.15, patience: 5, phrase: 'menghitung untung-rugi dengan cermat',
  },
}

export const MIN_CONTRACT_LENGTH = 2
export const MAX_CONTRACT_LENGTH = 5
export const MAX_NEGOTIATION_ROUNDS = 5
export const MAX_PURSE_SHARE_PCT = 30

/** Klausul buyout minimum yang dianggap "sangat tinggi" untuk skala penalti kepuasan. */
export const BUYOUT_REFERENCE_MULT = 10

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Daya tawar fighter, ~0.6 (rendah) - 1.6 (tinggi), berdasarkan kemampuan
 * saat ini, potensi, rekor amatir, dan usia. Fighter dengan leverage tinggi
 * menuntut lebih banyak, kurang fleksibel, dan lebih cepat tidak sabar
 * terhadap tawaran rendah — merepresentasikan "banyak gym lain yang minat".
 * Fighter leverage rendah lebih bersyukur dengan tawaran apa pun.
 */
export function getLeverage(candidate: RecruitCandidate): number {
  const ability = overallRating(candidate.attrs)
  const totalFights = candidate.record.w + candidate.record.l
  const winRate = totalFights > 0 ? candidate.record.w / totalFights : 0.5

  const qualityScore = ability * 0.4 + candidate.potential * 0.4 + winRate * 100 * 0.2
  let leverage = clamp(0.6 + (qualityScore - 50) / 80, 0.6, 1.6)

  // Prospek muda berpotensi tinggi makin pede dengan masa depan panjang
  if (candidate.age <= 23 && leverage > 1) leverage = clamp(leverage + 0.1, 0.6, 1.6)
  // Veteran usia 32+ punya jendela karier sempit, sedikit lebih fleksibel
  if (candidate.age >= 32) leverage = clamp(leverage - 0.15, 0.5, 1.6)

  return leverage
}

/**
 * Ekspektasi awal kandidat, dipengaruhi personality & reputasi gym (gym lebih bereputasi = ekspektasi sedikit lebih rendah).
 * Kandidat berstatus rekor amatir tidak menuntut Base Purse maupun Bonus Tanda Tangan -
 * kompensasi mereka sepenuhnya berbasis performa (Win Bonus + Bagi Hasil Purse).
 */
export function getInitialExpectation(candidate: RecruitCandidate, reputation: number): ContractOffer {
  const profile = NEGOTIATION_PROFILES[candidate.personality]
  const repFactor = clamp(1 - (reputation - 50) * 0.002, 0.85, 1.15)
  const leverage = getLeverage(candidate)

  return {
    salary: 0,
    winBonus: roundTo(candidate.salary_monthly * profile.winBonusMult * repFactor * leverage, 100_000),
    purseSharePct: clamp(Math.round((8 + profile.purseShareDesire * 14) * repFactor * leverage), 5, MAX_PURSE_SHARE_PCT),
    bonus: 0,
    contractLength: profile.contractPref,
    titleShotClause: profile.titleShotDesire * leverage >= 0.6,
    buyoutClause: profile.buyoutFlexPref * leverage >= 0.5
      ? roundTo(candidate.salary_monthly * 3 / Math.max(0.7, leverage), 500_000)
      : roundTo(candidate.salary_monthly * 8, 500_000),
  }
}

/** Tawaran pembuka default yang ditampilkan ke pemain saat nego dimulai. */
export function getOpeningOffer(candidate: RecruitCandidate): ContractOffer {
  const profile = NEGOTIATION_PROFILES[candidate.personality]
  return {
    salary: 0,
    winBonus: roundTo(candidate.salary_monthly * 0.5, 100_000),
    purseSharePct: Math.round((8 + profile.purseShareDesire * 14) * 0.4),
    bonus: 0,
    contractLength: 3,
    titleShotClause: false,
    buyoutClause: roundTo(candidate.salary_monthly * 8, 500_000),
  }
}

export interface NegotiationResult {
  outcome: 'accept' | 'counter' | 'reject'
  expectation: ContractOffer
  message: string
}

export function evaluateOffer(
  candidate: RecruitCandidate,
  expectation: ContractOffer,
  offer: ContractOffer,
  round: number
): NegotiationResult {
  const profile = NEGOTIATION_PROFILES[candidate.personality]
  const leverage = getLeverage(candidate)
  // Leverage tinggi -> kurang fleksibel (yakin dengan harga sendiri) & lebih cepat tidak sabar
  const effFlexibility = clamp(profile.flexibility / leverage, 0.05, 0.9)
  const effPatience = leverage > 1.2 ? Math.max(2, profile.patience - 1) : profile.patience

  const salaryRatio = expectation.salary > 0 ? clamp(offer.salary / expectation.salary, 0, 1.5) : 1
  const winBonusRatio = expectation.winBonus > 0 ? clamp(offer.winBonus / expectation.winBonus, 0, 1.5) : 1
  const purseShareRatio = expectation.purseSharePct > 0 ? clamp(offer.purseSharePct / expectation.purseSharePct, 0, 1.5) : 1

  const performanceWeight = 1 - profile.baseBias
  const purseShareWeight = performanceWeight * profile.purseShareDesire
  const winBonusWeight = performanceWeight - purseShareWeight
  const payRatio = salaryRatio * profile.baseBias + winBonusRatio * winBonusWeight + purseShareRatio * purseShareWeight

  const bonusRatio = expectation.bonus > 0 ? clamp(offer.bonus / expectation.bonus, 0, 1.5) : 1
  const contractScore = clamp(1 - Math.abs(offer.contractLength - expectation.contractLength) / 3, 0, 1)

  let satisfaction = payRatio * 0.5 + bonusRatio * 0.3 + contractScore * 0.2

  if (profile.titleShotDesire >= 0.6) {
    satisfaction += offer.titleShotClause ? 0.05 : -0.07
  }

  const buyoutRef = candidate.salary_monthly * BUYOUT_REFERENCE_MULT
  const buyoutRatio = clamp(offer.buyoutClause / buyoutRef, 0, 1)
  satisfaction -= buyoutRatio * 0.08 * profile.buyoutFlexPref

  if (satisfaction >= 1) {
    return {
      outcome: 'accept',
      expectation,
      message: `${candidate.name} menerima tawaranmu!`,
    }
  }

  if (round >= effPatience || round >= MAX_NEGOTIATION_ROUNDS) {
    return {
      outcome: 'reject',
      expectation,
      message: `${candidate.name} ${profile.phrase}, merasa negosiasi sudah buntu, dan memilih mencari tawaran lain.`,
    }
  }

  const moveToward = (current: number, target: number, step: number) => {
    if (target >= current) return current
    return roundTo(current - (current - target) * effFlexibility, step)
  }

  const counter: ContractOffer = {
    salary: moveToward(expectation.salary, offer.salary, 100_000),
    winBonus: moveToward(expectation.winBonus, offer.winBonus, 100_000),
    purseSharePct: moveToward(expectation.purseSharePct, offer.purseSharePct, 1),
    bonus: moveToward(expectation.bonus, offer.bonus, 500_000),
    contractLength: clamp(
      Math.round(expectation.contractLength - (expectation.contractLength - offer.contractLength) * effFlexibility),
      MIN_CONTRACT_LENGTH,
      MAX_CONTRACT_LENGTH
    ),
    titleShotClause: expectation.titleShotClause,
    buyoutClause: expectation.buyoutClause,
  }

  const clauseNotes: string[] = []
  if (profile.titleShotDesire >= 0.6 && !offer.titleShotClause) {
    clauseNotes.push('minta klausul Title Shot jika menang 3x beruntun')
  }
  if (profile.buyoutFlexPref >= 0.5 && offer.buyoutClause > expectation.buyoutClause) {
    clauseNotes.push('keberatan dengan klausul buyout setinggi itu')
  }
  const clauseText = clauseNotes.length > 0 ? ` Mereka juga ${clauseNotes.join(' dan ')}.` : ''

  return {
    outcome: 'counter',
    expectation: counter,
    message: `${candidate.name} ${profile.phrase} dan membalas: win bonus ${formatCurrency(counter.winBonus)}, bagi hasil purse ${counter.purseSharePct}%, kontrak ${counter.contractLength}x pertarungan.${clauseText}`,
  }
}
