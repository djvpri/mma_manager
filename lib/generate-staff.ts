import { FIRST_NAMES, LAST_NAMES, randInt, pick } from './generate-recruits'

export interface StaffCandidate {
  id: string
  name: string
  role: string
  specialty: string
  rating: number
  salary: number
  cost: number
}

const ROLES: { role: string; specialty: string }[] = [
  { role: 'Pelatih Kepala', specialty: 'Strategi & Mental' },
  { role: 'Pelatih Striking', specialty: 'Striking' },
  { role: 'Pelatih Grappling', specialty: 'Grappling' },
  { role: 'Pelatih Kondisi Fisik', specialty: 'Cardio' },
  { role: 'Fisioterapis', specialty: 'Pemulihan Cedera' },
  { role: 'Ahli Gizi', specialty: 'Nutrisi' },
  { role: 'Manajer Pertarungan', specialty: 'Matchmaking & Promosi' },
  { role: 'Talent Scout', specialty: 'Scouting' },
]

export function generateStaffCandidate(): StaffCandidate {
  const { role, specialty } = pick(ROLES)
  const rating = randInt(1, 5)
  const salary = Math.round((rating * 1_500_000 + randInt(-200_000, 300_000)) / 100_000) * 100_000
  const cost = salary * 2

  return {
    id: crypto.randomUUID(),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    role,
    specialty,
    rating,
    salary,
    cost,
  }
}

export function generateStaffPool(size: number): StaffCandidate[] {
  return Array.from({ length: size }, generateStaffCandidate)
}

/** Level staff berdasarkan experience_points (mirror dari SQL staff_level()). */
export function staffLevel(xp: number): 1 | 2 | 3 {
  if (xp >= 251) return 3
  if (xp >= 101) return 2
  return 1
}

export const STAFF_LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Lv.1 Junior',
  2: 'Lv.2 Senior',
  3: 'Lv.3 Elite',
}
