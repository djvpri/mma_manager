// components/finance/MemberSection.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import { formatCurrency } from '@/lib/format'
import {
  FEE_OPTIONS,
  STANDARD_FEE,
  calcTargetMembers,
  weeklyMemberIncome,
  fetchRecentWins,
  updateMemberFee,
} from '@/lib/gym-members'
import type { Gym } from '@/types'

export default function MemberSection() {
  const gym    = useGameStore((s) => s.gym)
  const setGym = useGameStore((s) => s.setGym)
  const [recentWins, setRecentWins] = useState<number>(0)
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    if (!gym) return
    fetchRecentWins(gym.id).then(setRecentWins)
  }, [gym?.id])

  if (!gym) return null

  const target  = calcTargetMembers(gym, recentWins)
  const income  = weeklyMemberIncome(gym)
  const trend   = target - gym.member_count
  const trendUp = trend > 5
  const trendDn = trend < -5

  async function handleFeeChange(fee: number) {
    if (!gym || fee === gym.member_fee) return
    setError(null)
    setBusy(true)
    const err = await updateMemberFee(gym.id, fee)
    if (err) {
      setError('Gagal mengubah iuran: ' + err)
    } else {
      const supabase = createClient()
      const { data } = await supabase.from('gyms').select('*').eq('id', gym.id).single()
      if (data) setGym(data as Gym)
    }
    setBusy(false)
  }

  return (
    <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Member Gym
      </h2>

      {error && <p className="mb-2 text-xs text-octagon-red">{error}</p>}

      {/* Stat utama */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-500">Member aktif</p>
          <p className="mt-0.5 text-lg font-bold text-white">
            {gym.member_count}
            {trendUp && <span className="ml-1.5 text-xs font-semibold text-octagon-teal">▲ naik</span>}
            {trendDn && <span className="ml-1.5 text-xs font-semibold text-octagon-red">▼ turun</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Target</p>
          <p className="mt-0.5 text-lg font-bold text-gray-300">{target}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Pemasukan/minggu</p>
          <p className="mt-0.5 text-lg font-bold text-octagon-teal">{formatCurrency(income)}</p>
        </div>
      </div>

      {/* Progress menuju target */}
      <div className="mb-1 h-2 overflow-hidden rounded-full bg-octagon-dark">
        <div
          className={`h-full rounded-full ${gym.member_count >= target ? 'bg-octagon-teal' : 'bg-octagon-amber'}`}
          style={{ width: `${Math.min(100, (gym.member_count / Math.max(target, 1)) * 100)}%` }}
        />
      </div>
      <p className="mb-4 text-xs text-gray-600">
        Member bergerak menuju target setiap minggu. Target dipengaruhi reputasi ({gym.reputation}),
        level fasilitas, kemenangan 4 minggu terakhir ({recentWins}), dan iuran.
      </p>

      {/* Pengaturan iuran */}
      <p className="mb-1.5 text-xs text-gray-500">Iuran member/bulan</p>
      <div className="flex flex-wrap gap-2">
        {FEE_OPTIONS.map((fee) => (
          <button
            key={fee}
            disabled={busy}
            onClick={() => handleFeeChange(fee)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              gym.member_fee === fee
                ? 'border-octagon-amber bg-octagon-amber/10 text-octagon-amber'
                : 'border-octagon-border text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}
          >
            {formatCurrency(fee)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-600">
        {gym.member_fee > STANDARD_FEE
          ? 'Iuran di atas standar — untung per member besar, tapi target member berkurang.'
          : gym.member_fee < STANDARD_FEE
          ? 'Iuran murah — menarik banyak member, tapi untung per member kecil.'
          : 'Iuran standar pasar (Rp 350rb).'}
      </p>
    </div>
  )
}
