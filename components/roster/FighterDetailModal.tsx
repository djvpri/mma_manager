'use client'

import Avatar from '@/components/avatar/Avatar'
import { getCategoryAverages, overallRating } from '@/lib/attrs'
import { formatBirthDate } from '@/lib/birthdate'
import type { Fighter } from '@/types'

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

export type FighterDetailData = Pick<Fighter,
  'name' | 'nickname' | 'age' | 'birth_week' | 'hometown' |
  'weight_class' | 'specialty' | 'personality' | 'status' | 'attrs' | 'record' | 'avatar_url'
>

interface FighterDetailModalProps {
  fighter: FighterDetailData
  gymLabel?: string
  onClose: () => void
}

export default function FighterDetailModal({ fighter, gymLabel, onClose }: FighterDetailModalProps) {
  const ovr = overallRating(fighter.attrs)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-octagon-border bg-octagon-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar size={56} imageUrl={fighter.avatar_url} className="shrink-0 overflow-hidden rounded-full bg-octagon-dark" />
            <div>
              <h3 className="font-semibold text-white">{fighter.name}</h3>
              <p className="text-sm italic text-octagon-amber">&ldquo;{fighter.nickname}&rdquo;</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded border px-1.5 py-0.5 font-medium ${STATUS_STYLES[fighter.status]}`}>
            {STATUS_LABELS[fighter.status]}
          </span>
          <span className="text-gray-400">{fighter.weight_class} · {fighter.specialty} · {fighter.age} th</span>
          {gymLabel && <span className="text-gray-500">· {gymLabel}</span>}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-gray-500">Rekor</p>
            <p className="font-semibold text-white">{fighter.record.w}-{fighter.record.l}-{fighter.record.d}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">OVR</p>
            <p className={`font-bold ${ovr >= 75 ? 'text-octagon-teal' : ovr >= 60 ? 'text-octagon-amber' : 'text-gray-400'}`}>{ovr}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Asal</p>
            <p className="text-white">{fighter.hometown}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Lahir</p>
            <p className="text-white">{formatBirthDate(fighter.birth_week, fighter.age)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500">Personality</p>
            <p className="text-white">{fighter.personality}</p>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          {getCategoryAverages(fighter.attrs).map(({ key, label, value }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-8 text-[10px] font-medium text-gray-500">{label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-octagon-dark">
                <div className="h-full rounded-full bg-octagon-teal" style={{ width: `${value}%` }} />
              </div>
              <span className="w-6 text-right text-[10px] text-gray-400">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
