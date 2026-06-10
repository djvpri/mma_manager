import type { Fighter } from '@/types'
import Avatar from '@/components/avatar/Avatar'

const STATUS_STYLES: Record<Fighter['status'], string> = {
  active: 'border-octagon-teal/30 bg-octagon-teal/15 text-octagon-teal',
  training: 'border-octagon-amber/30 bg-octagon-amber/15 text-octagon-amber',
  injured: 'border-octagon-red/30 bg-octagon-red/15 text-octagon-red',
  prospect: 'border-gray-500/30 bg-gray-500/15 text-gray-300',
  retired: 'border-gray-700/40 bg-gray-700/30 text-gray-500',
}

const STATUS_LABELS: Record<Fighter['status'], string> = {
  active: 'Aktif',
  training: 'Latihan',
  injured: 'Cedera',
  prospect: 'Prospek',
  retired: 'Pensiun',
}

const ATTR_LABELS: { key: keyof Fighter['attrs']; label: string }[] = [
  { key: 'striking', label: 'STR' },
  { key: 'grappling', label: 'GRP' },
  { key: 'cardio', label: 'CDO' },
  { key: 'fight_iq', label: 'IQ' },
  { key: 'mental', label: 'MNT' },
]

export default function FighterCard({ fighter }: { fighter: Fighter }) {
  const { record, attrs } = fighter

  return (
    <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
      <div className="flex items-start gap-3">
        <Avatar
          seed={fighter.avatar_seed}
          size={64}
          className="shrink-0 overflow-hidden rounded-full bg-octagon-dark"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-semibold text-white">{fighter.name}</h3>
            <span
              className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[fighter.status]}`}
            >
              {STATUS_LABELS[fighter.status]}
            </span>
          </div>
          {fighter.nickname && (
            <p className="truncate text-sm italic text-octagon-amber">&ldquo;{fighter.nickname}&rdquo;</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {fighter.weight_class} · {fighter.specialty} · {fighter.age} th
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-300">
          Rekor{' '}
          <span className="font-semibold text-white">
            {record.w}-{record.l}-{record.d}
          </span>
        </span>
        <span className="text-xs text-gray-500">{fighter.personality}</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {ATTR_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-8 text-[10px] font-medium text-gray-500">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-octagon-dark">
              <div className="h-full rounded-full bg-octagon-teal" style={{ width: `${attrs[key]}%` }} />
            </div>
            <span className="w-6 text-right text-[10px] text-gray-400">{attrs[key]}</span>
          </div>
        ))}
      </div>

      {fighter.injury && <p className="mt-3 text-xs text-octagon-red">⚠ Cedera: {fighter.injury}</p>}
    </div>
  )
}
