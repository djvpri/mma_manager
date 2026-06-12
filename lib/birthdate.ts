const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// Tahun "sekarang" di dunia game, dipakai untuk menghitung tahun lahir dari usia fighter.
const GAME_CURRENT_YEAR = 2026

/** Konversi birth_week (1-52) + usia fighter menjadi tanggal lahir, mis. "12 Maret 1988". */
export function formatBirthDate(birthWeek: number, age: number): string {
  const dayOfYear = Math.min(365, (birthWeek - 1) * 7 + 4)
  const date = new Date(2023, 0, dayOfYear) // 2023 = tahun referensi non-kabisat
  const year = GAME_CURRENT_YEAR - age
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${year}`
}
