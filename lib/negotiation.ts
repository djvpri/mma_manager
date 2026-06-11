import type { FighterPersonality } from '@/types'
import type { RecruitCandidate } from './generate-recruits'
import { formatCurrency } from './format'

export interface ContractOffer {
  salary: number // Base Purse (gaji mingguan tetap)
  winBonus: number // Bonus dibayar tiap kemenangan
  bonus: number // Bonus tanda tangan
  contractLength: number
  titleShotClause: boolean // Jika menang 3x beruntun, berhak menuntut title shot
  buyoutClause: number // Biaya gym jika memutus kontrak sebelum waktunya
}

interface NegotiationProfile {
  salaryMult: number
  winBonusMult: number
  bonusMult: number
  baseBias: number // 0-1: 1 = mengutamakan Base Purse, 0 = mengutamakan Win Bonus
  titleShotDesire: number // 0-1: seberapa ingin klausul Title Shot
  buyoutFlexPref: number // 0-1: seberapa keberatan dengan klausul buyout tinggi
  contractPref: number
  flexibility: number
  patience: number
  phrase: string
}

export const NEGOTIATION_PROFILES: Record<FighterPersonality, NegotiationProfile> = {
  Disciplined: {
    salaryMult: 1.0, winBonusMult: 0.9, bonusMult: 1.0,
    baseBias: 0.6, titleShotDesire: 0.4, buyoutFlexPref: 0.4,
    contractPref: 3, flexibility: 0.35, patience: 4, phrase: 'mempertimbangkan dengan tenang',
  },
  Hardworker: {
    salaryMult: 0.9, winBonusMult: 1.0, bonusMult: 0.85,
    baseBias: 0.5, titleShotDesire: 0.5, buyoutFlexPref: 0.5,
    contractPref: 3, flexibility: 0.5, patience: 4, phrase: 'menghargai kesempatan ini',
  },
  Perfectionist: {
    salaryMult: 1.15, winBonusMult: 1.1, bonusMult: 1.25,
    baseBias: 0.55, titleShotDesire: 0.75, buyoutFlexPref: 0.3,
    contractPref: 3, flexibility: 0.25, patience: 3, phrase: 'merasa belum sesuai standarnya',
  },
  Veteran: {
    salaryMult: 1.2, winBonusMult: 0.6, bonusMult: 1.1,
    baseBias: 0.85, titleShotDesire: 0.2, buyoutFlexPref: 0.1,
    contractPref: 2, flexibility: 0.2, patience: 3, phrase: 'bersikap tegas soal pengalamannya',
  },
  'Raw Talent': {
    salaryMult: 0.7, winBonusMult: 1.4, bonusMult: 0.7,
    baseBias: 0.3, titleShotDesire: 0.8, buyoutFlexPref: 0.8,
    contractPref: 4, flexibility: 0.55, patience: 5, phrase: 'antusias mendapat kesempatan',
  },
  Calculated: {
    salaryMult: 1.05, winBonusMult: 1.15, bonusMult: 1.2,
    baseBias: 0.6, titleShotDesire: 0.6, buyoutFlexPref: 0.7,
    contractPref: 3, flexibility: 0.15, patience: 5, phrase: 'menghitung untung-rugi dengan cermat',
  },
}

export const MIN_CONTRACT_LENGTH = 2
export const MAX_CONTRACT_LENGTH = 5
export const MAX_NEGOTIATION_ROUNDS = 5

/** Klausul buyout minimum yang dianggap "sangat tinggi" untuk skala penalti kepuasan. */
export const BUYOUT_REFERENCE_MULT = 10

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Ekspektasi awal kandidat, dipengaruhi personality & reputasi gym (gym lebih bereputasi = ekspektasi sedikit lebih rendah). */
export function getInitialExpectation(candidate: RecruitCandidate, reputation: number): ContractOffer {
  const profile = NEGOTIATION_PROFILES[candidate.personality]
  const repFactor = clamp(1 - (reputation - 50) * 0.002, 0.85, 1.15)

  return {
    salary: roundTo(candidate.salary_monthly * profile.salaryMult * repFactor, 100_000),
    winBonus: roundTo(candidate.salary_monthly * profile.winBonusMult * repFactor, 100_000),
    bonus: roundTo(candidate.cost * profile.bonusMult * repFactor, 500_000),
    contractLength: profile.contractPref,
    titleShotClause: profile.titleShotDesire >= 0.6,
    buyoutClause: profile.buyoutFlexPref >= 0.5
      ? roundTo(candidate.salary_monthly * 3, 500_000)
      : roundTo(candidate.salary_monthly * 8, 500_000),
  }
}

/** Tawaran pembuka default yang ditampilkan ke pemain saat nego dimulai. */
export function getOpeningOffer(candidate: RecruitCandidate): ContractOffer {
  return {
    salary: roundTo(candidate.salary_monthly * 0.85, 100_000),
    winBonus: roundTo(candidate.salary_monthly * 0.5, 100_000),
    bonus: roundTo(candidate.cost * 0.6, 500_000),
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

  const salaryRatio = clamp(offer.salary / expectation.salary, 0, 1.5)
  const winBonusRatio = expectation.winBonus > 0 ? clamp(offer.winBonus / expectation.winBonus, 0, 1.5) : 1
  const payRatio = salaryRatio * profile.baseBias + winBonusRatio * (1 - profile.baseBias)

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

  if (round >= profile.patience || round >= MAX_NEGOTIATION_ROUNDS) {
    return {
      outcome: 'reject',
      expectation,
      message: `${candidate.name} ${profile.phrase}, merasa negosiasi sudah buntu, dan memilih mencari tawaran lain.`,
    }
  }

  const moveToward = (current: number, target: number, step: number) => {
    if (target >= current) return current
    return roundTo(current - (current - target) * profile.flexibility, step)
  }

  const counter: ContractOffer = {
    salary: moveToward(expectation.salary, offer.salary, 100_000),
    winBonus: moveToward(expectation.winBonus, offer.winBonus, 100_000),
    bonus: moveToward(expectation.bonus, offer.bonus, 500_000),
    contractLength: clamp(
      Math.round(expectation.contractLength - (expectation.contractLength - offer.contractLength) * profile.flexibility),
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
    message: `${candidate.name} ${profile.phrase} dan membalas: ${formatCurrency(counter.salary)}/minggu, win bonus ${formatCurrency(counter.winBonus)}, bonus tanda tangan ${formatCurrency(counter.bonus)}, kontrak ${counter.contractLength}x pertarungan.${clauseText}`,
  }
}
