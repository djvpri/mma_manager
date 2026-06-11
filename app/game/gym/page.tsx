'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import type { GymRooms } from '@/types'

type RoomKey = keyof GymRooms

const ROOM_META: Record<RoomKey, { label: string; description: string; baseCost: number }> = {
  striking: {
    label: 'Sasana Striking',
    description: 'Tempat fighter mengasah pukulan & tendangan. Level lebih tinggi mempercepat perkembangan atribut striking.',
    baseCost: 15_000_000,
  },
  grappling: {
    label: 'Sasana Grappling',
    description: 'Matras gulat & BJJ untuk latihan bantingan dan submission. Level lebih tinggi mempercepat perkembangan atribut grappling.',
    baseCost: 15_000_000,
  },
  cardio: {
    label: 'Ruang Kardio',
    description: 'Peralatan kebugaran untuk daya tahan. Level lebih tinggi mempercepat perkembangan atribut cardio.',
    baseCost: 12_000_000,
  },
  recovery: {
    label: 'Pusat Pemulihan',
    description: 'Fasilitas pemulihan cedera & kelelahan. Level lebih tinggi membuat training load fighter turun lebih cepat tiap minggu.',
    baseCost: 10_000_000,
  },
  locker: {
    label: 'Ruang Ganti',
    description: 'Kenyamanan fighter di gym. Level lebih tinggi meningkatkan moral tim.',
    baseCost: 8_000_000,
  },
  analytics: {
    label: 'Ruang Analisis',
    description: 'Tim analis video & data lawan. Level lebih tinggi meningkatkan akurasi scouting report AI.',
    baseCost: 18_000_000,
  },
}

const ROOM_ORDER: RoomKey[] = ['striking', 'grappling', 'cardio', 'recovery', 'locker', 'analytics']

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function upgradeCost(room: RoomKey, currentLevel: number) {
  return ROOM_META[room].baseCost * (currentLevel + 1)
}

export default function GymPage() {
  const gym = useGameStore((s) => s.gym)
  const setGym = useGameStore((s) => s.setGym)

  const [upgrading, setUpgrading] = useState<RoomKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!gym) {
    return <p className="text-sm text-gray-400">Memuat data gym...</p>
  }

  const netWeekly = gym.monthly_income - gym.monthly_expense

  async function handleUpgrade(room: RoomKey) {
    if (!gym) return
    setError(null)
    const current = gym.rooms[room]
    if (current.level >= current.max_level) return

    const cost = upgradeCost(room, current.level)
    if (gym.balance < cost) {
      setError('Saldo tidak cukup untuk upgrade ini.')
      return
    }

    setUpgrading(room)
    const supabase = createClient()
    const newRooms: GymRooms = {
      ...gym.rooms,
      [room]: { ...current, level: current.level + 1 },
    }
    const newBalance = gym.balance - cost

    const { error: updateError } = await supabase
      .from('gyms')
      .update({ rooms: newRooms, balance: newBalance })
      .eq('id', gym.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setGym({ ...gym, rooms: newRooms, balance: newBalance })
    }
    setUpgrading(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">{gym.name}</h1>
        <p className="text-sm text-gray-400">{gym.city} · Minggu ke-{gym.season_week}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <p className="text-xs text-gray-400">Saldo</p>
          <p className="mt-1 text-lg font-bold text-octagon-amber">{formatCurrency(gym.balance)}</p>
        </div>
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <p className="text-xs text-gray-400">Reputasi</p>
          <p className="mt-1 text-lg font-bold text-octagon-teal">{gym.reputation}/100</p>
        </div>
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <p className="text-xs text-gray-400">Pemasukan / Pengeluaran</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {formatCurrency(gym.monthly_income)} / {formatCurrency(gym.monthly_expense)}
          </p>
        </div>
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <p className="text-xs text-gray-400">Net per Minggu</p>
          <p className={`mt-1 text-lg font-bold ${netWeekly >= 0 ? 'text-octagon-teal' : 'text-octagon-red'}`}>
            {netWeekly >= 0 ? '+' : ''}
            {formatCurrency(netWeekly)}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-octagon-red">{error}</p>}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Fasilitas Gym</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ROOM_ORDER.map((room) => {
            const meta = ROOM_META[room]
            const data = gym.rooms[room]
            const maxed = data.level >= data.max_level
            const cost = upgradeCost(room, data.level)
            const canAfford = gym.balance >= cost

            return (
              <div key={room} className="rounded-lg border border-octagon-border bg-octagon-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{meta.label}</h3>
                  <span className="text-xs font-medium text-gray-400">
                    Lv {data.level}/{data.max_level}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-400">{meta.description}</p>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-octagon-dark">
                  <div
                    className="h-full rounded-full bg-octagon-teal"
                    style={{ width: `${(data.level / data.max_level) * 100}%` }}
                  />
                </div>

                <button
                  onClick={() => handleUpgrade(room)}
                  disabled={maxed || !canAfford || upgrading === room}
                  className="mt-3 w-full rounded-md border border-octagon-border px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-octagon-teal hover:text-octagon-teal disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {maxed
                    ? 'Maksimal'
                    : upgrading === room
                      ? 'Memproses...'
                      : `Upgrade · ${formatCurrency(cost)}`}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
