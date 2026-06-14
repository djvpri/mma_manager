'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { overallRating, getCategoryAverages } from '@/lib/attrs'
import type { Fighter } from '@/types'

interface Props {
  fighterId: string | null
  fighterName?: string
  onClose: () => void
}

export default function OpponentModal({ fighterId, fighterName, onClose }: Props) {
  const [fighter, setFighter] = useState<Fighter | null>(null)
  const [gymName, setGymName] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fighterId) return
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('fighters')
      .select('*')
      .eq('id', fighterId)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setFighter(data as Fighter)
          if (data.gym_id) {
            const { data: gym } = await supabase
              .from('gyms')
              .select('name')
              .eq('id', data.gym_id)
              .single()
            setGymName(gym?.name ?? 'Gym Lain')
          } else {
            setGymName('Free Agent')
          }
        }
        setLoading(false)
      })
  }, [fighterId])

  if (!fighterId) return null

  const ovr = fighter ? overallRating(fighter.attrs) : null
  const cats = fighter ? getCategoryAverages(fighter.attrs) : []
  const record = fighter?.record

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl border-t border-octagon-border bg-octagon-dark p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{fighter?.name ?? fighterName ?? '...'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>

        {loading && <p className="text-sm text-gray-500">Memuat data...</p>}

        {fighter && !loading && (
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
                <p className="text-gray-500">Rekor</p>
                <p className="mt-0.5 text-base font-bold text-white">
                  {record?.w ?? 0}-{record?.l ?? 0}-{record?.d ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
                <p className="text-gray-500">Overall</p>
                <p className="mt-0.5 text-base font-bold text-octagon-amber">{ovr} OVR</p>
              </div>
              <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
                <p className="text-gray-500">Spesialisasi</p>
                <p className="mt-0.5 font-semibold text-white">{fighter.specialty}</p>
              </div>
              <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
                <p className="text-gray-500">Weight Class</p>
                <p className="mt-0.5 font-semibold text-white">{fighter.weight_class}</p>
              </div>
              <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
                <p className="text-gray-500">Usia</p>
                <p className="mt-0.5 font-semibold text-white">{fighter.age} th</p>
              </div>
              <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
                <p className="text-gray-500">Gym</p>
                <p className="mt-0.5 truncate font-semibold text-white">{gymName}</p>
              </div>
            </div>

            {/* Attribute bars */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Statistik</p>
              <div className="space-y-1.5">
                {cats.map(({ key, label, value }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-10 text-[10px] text-gray-500">{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-octagon-dark">
                      <div
                        className="h-full rounded-full bg-octagon-teal"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-[10px] text-gray-400">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Win streak */}
            {(fighter.win_streak ?? 0) >= 2 && (
              <p className="text-xs font-semibold text-octagon-amber">
                🔥 Win streak: {fighter.win_streak}x
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
