import type { Fighter, HypeStyle, PressConferenceResult } from '@/types'

export const HYPE_STYLES: { value: HypeStyle; label: string; desc: string }[] = [
  { value: 'confident', label: 'Percaya Diri', desc: 'Tunjukkan keyakinan tanpa menjatuhkan lawan' },
  { value: 'provoke', label: 'Provokasi', desc: 'Panaskan suasana — bisa goyahkan mental lawan, tapi berisiko' },
  { value: 'respect', label: 'Hormat', desc: 'Sportif ke lawan, jaga citra positif' },
  { value: 'focus', label: 'Fokus', desc: 'Minim komentar, hindari drama' },
]

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min: number, max: number) {
  return min + Math.random() * (max - min)
}

/** Hitung dampak gaya hype yang dipilih fighter di konferensi pers. */
export function resolveHype(
  style: HypeStyle,
  fighter: Fighter,
  opponentName: string
): Omit<PressConferenceResult, 'style' | 'my_quote' | 'opp_quote'> {
  switch (style) {
    case 'confident':
      return {
        outcome: `${fighter.name} tampil percaya diri di depan media, menambah antusiasme penonton.`,
        my_mental_delta: 5,
        opp_mental_delta: 0,
        attendance_mult: randFloat(1.05, 1.1),
      }
    case 'provoke': {
      // Mental tinggi = lebih mampu menjaga provokasi tetap terkontrol.
      const success = randInt(0, 100) < fighter.attrs.mental
      return success
        ? {
            outcome: `Provokasi ${fighter.name} berhasil memancing emosi ${opponentName}!`,
            my_mental_delta: 3,
            opp_mental_delta: -8,
            attendance_mult: randFloat(1.15, 1.25),
          }
        : {
            outcome: `Provokasi ${fighter.name} terlihat dipaksakan dan justru membakar motivasi ${opponentName}.`,
            my_mental_delta: -5,
            opp_mental_delta: 3,
            attendance_mult: randFloat(1.1, 1.2),
          }
    }
    case 'respect':
      return {
        outcome: `${fighter.name} dan ${opponentName} saling menunjukkan rasa hormat — narasi sportif menarik perhatian media.`,
        my_mental_delta: 2,
        opp_mental_delta: 2,
        attendance_mult: randFloat(1.02, 1.05),
      }
    case 'focus':
      return {
        outcome: `${fighter.name} memilih tetap fokus dan minim komentar menjelang laga.`,
        my_mental_delta: 0,
        opp_mental_delta: 0,
        attendance_mult: randFloat(1.0, 1.02),
      }
  }
}
