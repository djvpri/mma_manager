import type { WeightClass, Specialty, FighterPersonality, FighterAttrs, FighterRecord } from '@/types'

export interface RecruitCandidate {
  id: string
  name: string
  nickname: string
  age: number
  hometown: string
  weight_class: WeightClass
  specialty: Specialty
  personality: FighterPersonality
  attrs: FighterAttrs
  record: FighterRecord
  potential: number
  avatar_seed: number
  salary_monthly: number
  cost: number
}

export const FIRST_NAMES = [
  'Andi', 'Bayu', 'Candra', 'Dimas', 'Eko', 'Fajar', 'Gilang', 'Hendra',
  'Irfan', 'Joko', 'Kurniawan', 'Lukman', 'Maulana', 'Naufal', 'Oscar',
  'Putra', 'Rizal', 'Surya', 'Taufik', 'Wahyu',
]

export const LAST_NAMES = [
  'Saputra', 'Pratama', 'Wijaya', 'Kusuma', 'Santoso', 'Hidayat',
  'Nugraha', 'Setiawan', 'Permana', 'Gunawan',
]

const NICKNAMES = [
  'Singa', 'Elang', 'Macan', 'Kobra', 'Petir', 'Badai', 'Ronin',
  'Garuda', 'Naga', 'Hiu', 'Banteng', 'Serigala',
]

const HOMETOWNS = [
  'Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Makassar', 'Semarang',
  'Palembang', 'Balikpapan', 'Manado', 'Pontianak', 'Denpasar', 'Yogyakarta',
]

const WEIGHT_CLASSES: WeightClass[] = [
  'Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight',
  'Lightweight', 'Welterweight', 'Middleweight', 'Heavyweight',
]

const SPECIALTIES: Specialty[] = ['Striker', 'Grappler', 'All-rounder', 'Counter Fighter', 'Wrestler']

const PERSONALITIES: FighterPersonality[] = [
  'Disciplined', 'Hardworker', 'Perfectionist', 'Veteran', 'Raw Talent', 'Calculated',
]

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

function clampAttr(value: number) {
  return Math.max(35, Math.min(95, value))
}

export function generateRecruit(): RecruitCandidate {
  const age = randInt(18, 29)
  const potential = randInt(50, 92)
  const baseAttr = randInt(45, 70)

  const attrs: FighterAttrs = {
    striking: clampAttr(baseAttr + randInt(-10, 10)),
    grappling: clampAttr(baseAttr + randInt(-10, 10)),
    cardio: clampAttr(baseAttr + randInt(-10, 10)),
    fight_iq: clampAttr(baseAttr + randInt(-10, 10)),
    mental: clampAttr(baseAttr + randInt(-10, 10)),
  }

  const sumAttrs = attrs.striking + attrs.grappling + attrs.cardio + attrs.fight_iq + attrs.mental
  const cost = Math.round(((sumAttrs + potential) * 100_000) / 500_000) * 500_000
  const salary_monthly = Math.round((2_000_000 + potential * 25_000) / 100_000) * 100_000

  return {
    id: crypto.randomUUID(),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    nickname: pick(NICKNAMES),
    age,
    hometown: pick(HOMETOWNS),
    weight_class: pick(WEIGHT_CLASSES),
    specialty: pick(SPECIALTIES),
    personality: pick(PERSONALITIES),
    attrs,
    record: { w: randInt(0, 4), l: randInt(0, 2), d: 0 },
    potential,
    avatar_seed: randInt(10_000, 99_999),
    salary_monthly,
    cost,
  }
}

export function generateRecruitPool(size: number): RecruitCandidate[] {
  return Array.from({ length: size }, generateRecruit)
}
