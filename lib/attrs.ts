import type { FighterAttrs } from '@/types'

export interface AttrGroup {
  key: string
  label: string
  abbr: string
  attrs: { key: keyof FighterAttrs; label: string }[]
}

export const ATTR_GROUPS: AttrGroup[] = [
  {
    key: 'striking',
    label: 'Striking',
    abbr: 'STR',
    attrs: [
      { key: 'punch_power', label: 'Power Pukulan' },
      { key: 'kick_power', label: 'Power Tendangan' },
      { key: 'accuracy', label: 'Akurasi' },
      { key: 'striking_defense', label: 'Pertahanan Berdiri' },
    ],
  },
  {
    key: 'grappling',
    label: 'Grappling',
    abbr: 'GRP',
    attrs: [
      { key: 'takedowns', label: 'Takedown' },
      { key: 'takedown_defense', label: 'Pertahanan Takedown' },
      { key: 'ground_control', label: 'Kontrol Ground' },
      { key: 'submission', label: 'Submission' },
    ],
  },
  {
    key: 'physical',
    label: 'Fisik',
    abbr: 'FIS',
    attrs: [
      { key: 'cardio', label: 'Cardio' },
      { key: 'chin', label: 'Chin' },
      { key: 'durability', label: 'Daya Tahan' },
      { key: 'recovery', label: 'Pemulihan' },
    ],
  },
  {
    key: 'movement',
    label: 'Pergerakan',
    abbr: 'MOV',
    attrs: [
      { key: 'speed', label: 'Kecepatan' },
    ],
  },
  {
    key: 'mental',
    label: 'Mental',
    abbr: 'MNT',
    attrs: [
      { key: 'fight_iq', label: 'Fight IQ' },
      { key: 'mental', label: 'Mental' },
    ],
  },
]

export const ALL_ATTR_KEYS: (keyof FighterAttrs)[] = ATTR_GROUPS.flatMap((g) => g.attrs.map((a) => a.key))

export const ATTR_NAME_LABELS: Record<keyof FighterAttrs, string> = ATTR_GROUPS.reduce(
  (acc, g) => {
    for (const a of g.attrs) acc[a.key] = a.label
    return acc
  },
  {} as Record<keyof FighterAttrs, string>
)

export function overallRating(attrs: FighterAttrs): number {
  return Math.round(ALL_ATTR_KEYS.reduce((sum, k) => sum + attrs[k], 0) / ALL_ATTR_KEYS.length)
}

export function getCategoryAverages(attrs: FighterAttrs): { key: string; label: string; value: number }[] {
  return ATTR_GROUPS.map((g) => ({
    key: g.key,
    label: g.abbr,
    value: Math.round(g.attrs.reduce((sum, a) => sum + attrs[a.key], 0) / g.attrs.length),
  }))
}
