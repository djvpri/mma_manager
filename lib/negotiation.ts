import type { FighterPersonality } from '@/types'
import type { RecruitCandidate } from './generate-recruits'
import { formatCurrency } from './format'

export interface ContractOffer {
  salary: number
  bonus: number
  contractLength: number
}

interface NegotiationProfile {
  salaryMult: number
  bonusMult: number
  contractPref: number
  flexibility: number
  patience: number
  phrase: string
}

export const NEGOTIATION_PROFILES: Record<FighterPersonality, NegotiationProfile> = {
  Disciplined: {
    salaryMult: 1.0, bonusMult: 1.0, contractPref: 3,
    flexibility: 0.35, patience: 4, phrase: 'mempertimbangkan dengan tenang',
  },
  Hardworker: {
    salaryMult: 0.9, bonusMult: 0.85, contractPref: 3,
    flexibility: 0.5, patience: 4, phrase: 'menghargai kesempatan ini',
  },
  Perfectionist: {
    salaryMult: 1.15, bonusMult: 1.25, contractPref: 3,
    flexibility: 0.25, patience: 3, phrase: 'merasa belum sesuai standarnya',
  },
  Veteran: {
    salaryMult: 1.2, bonusMult: 1.1, contractPref: 2,
    flexibility: 0.2, patience: 3, phrase: 'bersikap tegas soal pengalamannya',
  },
  'Raw Talent': {
    salaryMult: 0.85, bonusMult: 0.7, contractPref: 4,
    flexibility: 0.55, patience: 5, phrase: 'antusias mendapat kesempatan',
  },
  Calculated: {
    salaryMult: 1.05, bonusMult: 1.2, contractPref: 3,
    flexibility: 0.15, patience: 5, phrase: 'menghitung untung-rugi dengan cermat',
  },
}

export const MIN_CONTRACT_LENGTH = 2
export const MAX_CONTRACT_LENGTH = 5
export const MAX_NEGOTIATION_ROUNDS = 5

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
    bonus: roundTo(candidate.cost * profile.bonusMult * repFactor, 500_000),
    contractLength: profile.contractPref,
  }
}

/** Tawaran pembuka default yang ditampilkan ke pemain saat nego dimulai. */
export function getOpeningOffer(candidate: RecruitCandidate): ContractOffer {
  return {
    salary: roundTo(candidate.salary_monthly * 0.85, 100_000),
    bonus: roundTo(candidate.cost * 0.6, 500_000),
    contractLength: 3,
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
  const bonusRatio = expectation.bonus > 0 ? clamp(offer.bonus / expectation.bonus, 0, 1.5) : 1
  const contractScore = clamp(1 - Math.abs(offer.contractLength - expectation.contractLength) / 3, 0, 1)

  const satisfaction = salaryRatio * 0.5 + bonusRatio * 0.3 + contractScore * 0.2

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
    bonus: moveToward(expectation.bonus, offer.bonus, 500_000),
    contractLength: clamp(
      Math.round(expectation.contractLength - (expectation.contractLength - offer.contractLength) * profile.flexibility),
      MIN_CONTRACT_LENGTH,
      MAX_CONTRACT_LENGTH
    ),
  }

  return {
    outcome: 'counter',
    expectation: counter,
    message: `${candidate.name} ${profile.phrase} dan membalas: ${formatCurrency(counter.salary)}/bulan, bonus ${formatCurrency(counter.bonus)}, kontrak ${counter.contractLength}x pertarungan.`,
  }
}
