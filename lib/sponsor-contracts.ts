import type { SponsorCategory, SponsorContract } from '@/types'

export interface SponsorBrandTemplate {
  id: string
  name: string
  tagline: string
  category: SponsorCategory
  min_reputation: number
  weekly_income: number
  win_bonus: number
  duration_weeks: number
}

export const SPONSOR_CATALOG: SponsorBrandTemplate[] = [
  // ── APPAREL (eksklusif) ──────────────────────────────────────
  { id: 'apparel_1', name: 'GarudaWear',           tagline: 'Pakaian Olahraga Lokal',       category: 'apparel',    min_reputation: 0,  weekly_income: 750_000,   win_bonus: 500_000,   duration_weeks: 8  },
  { id: 'apparel_2', name: 'IronFit Sport',         tagline: 'Gear Tempur Profesional',      category: 'apparel',    min_reputation: 30, weekly_income: 2_000_000, win_bonus: 1_500_000, duration_weeks: 10 },
  { id: 'apparel_3', name: 'EliteGear Pro',         tagline: 'Performa Tanpa Kompromi',      category: 'apparel',    min_reputation: 55, weekly_income: 4_500_000, win_bonus: 3_000_000, duration_weeks: 12 },
  { id: 'apparel_4', name: 'NasionalSport Champion',tagline: 'Brand MMA #1 Indonesia',       category: 'apparel',    min_reputation: 75, weekly_income: 9_000_000, win_bonus: 6_000_000, duration_weeks: 16 },

  // ── ENERGY DRINK (eksklusif) ─────────────────────────────────
  { id: 'energy_1',  name: 'PowerUp Drink',         tagline: 'Energi Untuk Bertarung',       category: 'energy',     min_reputation: 0,  weekly_income: 600_000,   win_bonus: 400_000,   duration_weeks: 8  },
  { id: 'energy_2',  name: 'VoltEnergy',             tagline: 'Ledakkan Potensimu',           category: 'energy',     min_reputation: 30, weekly_income: 1_800_000, win_bonus: 1_200_000, duration_weeks: 10 },
  { id: 'energy_3',  name: 'ThunderBolt',            tagline: 'Kecepatan & Kekuatan',         category: 'energy',     min_reputation: 55, weekly_income: 4_000_000, win_bonus: 2_500_000, duration_weeks: 12 },
  { id: 'energy_4',  name: 'DayaMax Extreme',        tagline: 'Bahan Bakar Para Juara',       category: 'energy',     min_reputation: 75, weekly_income: 7_500_000, win_bonus: 5_000_000, duration_weeks: 16 },

  // ── SUPLEMEN (eksklusif) ─────────────────────────────────────
  { id: 'supp_1',    name: 'VitaFit Plus',           tagline: 'Suplemen Pemulihan Harian',    category: 'supplement', min_reputation: 0,  weekly_income: 500_000,   win_bonus: 300_000,   duration_weeks: 8  },
  { id: 'supp_2',    name: 'ProMass',                tagline: 'Bangun Massa Otot Lebih Cepat',category: 'supplement', min_reputation: 30, weekly_income: 1_500_000, win_bonus: 1_000_000, duration_weeks: 10 },
  { id: 'supp_3',    name: 'KuatMax Pro',            tagline: 'Formula Atlet Elite',          category: 'supplement', min_reputation: 55, weekly_income: 3_500_000, win_bonus: 2_000_000, duration_weeks: 12 },
  { id: 'supp_4',    name: 'Champion Supps',         tagline: 'Dipercaya Para Juara Dunia',   category: 'supplement', min_reputation: 75, weekly_income: 6_000_000, win_bonus: 4_000_000, duration_weeks: 16 },

  // ── BISNIS LOKAL (tidak eksklusif) ──────────────────────────
  { id: 'local_1',   name: 'Warung Pak Dedi',        tagline: 'Makan Enak, Juara Beneran',   category: 'local',      min_reputation: 0,  weekly_income: 300_000,   win_bonus: 0,         duration_weeks: 4  },
  { id: 'local_2',   name: 'Dealer Motor Jaya',      tagline: 'Kendaraan Para Pemenang',     category: 'local',      min_reputation: 0,  weekly_income: 400_000,   win_bonus: 0,         duration_weeks: 6  },
  { id: 'local_3',   name: 'Resto Nusantara',        tagline: 'Cita Rasa Juara',             category: 'local',      min_reputation: 0,  weekly_income: 350_000,   win_bonus: 0,         duration_weeks: 4  },
  { id: 'local_4',   name: 'Apotek Sehat Prima',     tagline: 'Kesehatan Adalah Segalanya',  category: 'local',      min_reputation: 20, weekly_income: 600_000,   win_bonus: 200_000,   duration_weeks: 6  },
  { id: 'local_5',   name: 'Toko Sport Lokal',       tagline: 'Lengkap Untuk Atlet Lokal',  category: 'local',      min_reputation: 40, weekly_income: 800_000,   win_bonus: 300_000,   duration_weeks: 8  },
  { id: 'local_6',   name: 'Bank Daerah Maju',       tagline: 'Investasi Untuk Kemenangan',  category: 'local',      min_reputation: 60, weekly_income: 1_500_000, win_bonus: 500_000,   duration_weeks: 8  },
]

export const CATEGORY_LABELS: Record<SponsorCategory, string> = {
  apparel:    'Apparel',
  energy:     'Minuman Energi',
  supplement: 'Suplemen',
  local:      'Bisnis Lokal',
}

export const CATEGORY_COLORS: Record<SponsorCategory, string> = {
  apparel:    'border-blue-500/40 bg-blue-500/10 text-blue-300',
  energy:     'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  supplement: 'border-green-500/40 bg-green-500/10 text-green-300',
  local:      'border-gray-500/40 bg-gray-500/10 text-gray-300',
}

// Maksimum kontrak aktif sekaligus
export const MAX_ACTIVE_CONTRACTS = 3

// Ambil penawaran sponsor yang tersedia berdasarkan reputasi & kontrak aktif
export function getAvailableSponsors(
  reputation: number,
  activeContracts: SponsorContract[]
): SponsorBrandTemplate[] {
  const activeBrandIds = new Set(
    activeContracts.map((c) => {
      const found = SPONSOR_CATALOG.find((b) => b.name === c.brand_name)
      return found?.id ?? ''
    })
  )

  // Kategori eksklusif yang sudah terisi
  const takenExclusiveCategories = new Set(
    activeContracts
      .filter((c) => c.category !== 'local')
      .map((c) => c.category)
  )

  const eligible = SPONSOR_CATALOG.filter((brand) => {
    if (brand.min_reputation > reputation) return false
    if (activeBrandIds.has(brand.id)) return false
    if (brand.category !== 'local' && takenExclusiveCategories.has(brand.category)) return false
    return true
  })

  // Shuffle dan ambil 3
  const shuffled = [...eligible].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

export function satisfactionLabel(sat: number): { label: string; color: string } {
  if (sat >= 80) return { label: 'Sangat Puas',   color: 'text-octagon-teal' }
  if (sat >= 50) return { label: 'Puas',           color: 'text-octagon-amber' }
  if (sat >= 20) return { label: 'Tidak Puas',     color: 'text-octagon-red' }
  return             { label: 'Hampir Batal',   color: 'text-octagon-red animate-pulse' }
}
