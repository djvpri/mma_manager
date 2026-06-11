export interface SponsorBrand {
  id: string
  name: string
  category: string
  baseAmount: number
  minReputation: number
}

export const SPONSOR_POOL: SponsorBrand[] = [
  { id: 'local-supp', name: 'NutriFuel Lokal', category: 'Suplemen', baseAmount: 3_000_000, minReputation: 0 },
  { id: 'energy-drink', name: 'VoltEnergy', category: 'Minuman Energi', baseAmount: 5_000_000, minReputation: 10 },
  { id: 'apparel', name: 'Garuda Fightwear', category: 'Apparel', baseAmount: 8_000_000, minReputation: 25 },
  { id: 'regional-bank', name: 'Bank Nusantara', category: 'Perbankan', baseAmount: 12_000_000, minReputation: 40 },
  { id: 'national-media', name: 'Trans Sportindo', category: 'Media & Olahraga', baseAmount: 18_000_000, minReputation: 60 },
  { id: 'global-brand', name: 'Apex Global', category: 'Brand Internasional', baseAmount: 28_000_000, minReputation: 80 },
]

export interface SponsorApproach {
  id: 'santai' | 'profesional' | 'agresif'
  label: string
  description: string
  baseChance: number
  rewardMult: number
  reputationPenaltyOnFail: number
}

export const SPONSOR_APPROACHES: SponsorApproach[] = [
  {
    id: 'santai',
    label: 'Pendekatan Santai',
    description: 'Networking ringan dan low-pressure. Peluang sukses tinggi, tapi nilai kontrak kecil.',
    baseChance: 0.75,
    rewardMult: 0.7,
    reputationPenaltyOnFail: 0,
  },
  {
    id: 'profesional',
    label: 'Proposal Profesional',
    description: 'Ajukan proposal formal dengan data performa gym. Seimbang antara peluang dan nilai kontrak.',
    baseChance: 0.55,
    rewardMult: 1.1,
    reputationPenaltyOnFail: 0,
  },
  {
    id: 'agresif',
    label: 'Pitch Agresif',
    description: 'Minta nilai kontrak besar langsung. Peluang sukses rendah, dan kalau gagal reputasi gym sedikit turun.',
    baseChance: 0.35,
    rewardMult: 1.8,
    reputationPenaltyOnFail: 2,
  },
]

export function getAvailableSponsors(reputation: number): SponsorBrand[] {
  return SPONSOR_POOL.filter((s) => reputation >= s.minReputation)
}

export function pickSponsor(reputation: number): SponsorBrand {
  const pool = getAvailableSponsors(reputation)
  return pool[Math.floor(Math.random() * pool.length)]
}

export function getSuccessChance(approach: SponsorApproach, reputation: number): number {
  return Math.min(0.95, approach.baseChance + (reputation / 100) * 0.15)
}

export interface SponsorResult {
  success: boolean
  amount: number
  reputationChange: number
}

export function resolveSponsorHunt(sponsor: SponsorBrand, approach: SponsorApproach, reputation: number): SponsorResult {
  const chance = getSuccessChance(approach, reputation)
  const success = Math.random() < chance

  if (success) {
    const amount = Math.round((sponsor.baseAmount * approach.rewardMult) / 100_000) * 100_000
    return { success: true, amount, reputationChange: 0 }
  }

  return { success: false, amount: 0, reputationChange: -approach.reputationPenaltyOnFail }
}
