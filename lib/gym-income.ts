// lib/gym-income.ts
// Pemasukan operasional gym — dihitung dari level fasilitas.
// HARUS sinkron dengan trigger trg_gym_operational_income (migration 049).
import { totalRoomLevels } from '@/lib/gym-members'
import type { Gym } from '@/types'

export const DAYPASS_BASE = 600_000 // per (1 + level Locker Room)
export const RENTAL_RATE  = 200_000 // per total level semua ruangan
export const CANTEEN_FLAT = 600_000 // flat per minggu

export interface OperationalIncome {
  daypass: number
  rental: number
  canteen: number
  total: number
  lockerLevel: number
  totalLevels: number
}

export function calcOperationalIncome(gym: Gym): OperationalIncome {
  const lockerLevel = gym.rooms.locker?.level ?? 0
  const totalLevels = totalRoomLevels(gym)
  const daypass = DAYPASS_BASE * (1 + lockerLevel)
  const rental  = RENTAL_RATE * totalLevels
  const canteen = CANTEEN_FLAT
  return { daypass, rental, canteen, total: daypass + rental + canteen, lockerLevel, totalLevels }
}
