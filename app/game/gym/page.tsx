'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import type { Fighter, FighterAttrs, GymRooms } from '@/types'
import { ATTR_NAME_LABELS } from '@/lib/attrs'

type RoomKey = keyof GymRooms

interface WeeklyReport {
  week: number
  balanceChange: number
  agedUp: boolean
  retirements: { name: string; reason: string }[]
  healed: string[]
  growth: { name: string; attr: string; from: number; to: number }[]
  contractWarnings: string[]
}

function buildWeeklyReport(
  prev: Fighter[],
  next: Fighter[],
  prevBalance: number,
  newBalance: number,
  newWeek: number
): WeeklyReport {
  const prevById = new Map(prev.map((f) => [f.id, f]))
  const retirements: WeeklyReport['retirements'] = []
  const healed: string[] = []
  const growth: WeeklyReport['growth'] = []
  const contractWarnings: string[] = []

  for (const f of next) {
    const p = prevById.get(f.id)
    if (!p) continue

    if (p.status !== 'retired' && f.status === 'retired') {
      const reason = f.age >= 38 ? 'usia veteran' : 'kontrak habis'
      retirements.push({ name: f.name, reason })
      continue
    }

    if (p.status === 'injured' && f.status === 'training') {
      healed.push(f.name)
    }

    for (const key of Object.keys(ATTR_NAME_LABELS) as (keyof FighterAttrs)[]) {
      if (f.attrs[key] > p.attrs[key]) {
        growth.push({ name: f.name, attr: ATTR_NAME_LABELS[key], from: p.attrs[key], to: f.attrs[key] })
      }
    }

    if (f.status !== 'retired' && f.contract_fights_left <= 1) {
      contractWarnings.push(f.name)
    }
  }

  return {
    week: newWeek,
    balanceChange: newBalance - prevBalance,
    agedUp: newWeek % 12 === 0,
    retirements,
    healed,
    growth,
    contractWarnings,
  }
}

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
  const setFighters = useGameStore((s) => s.setFighters)

  const [upgrading, setUpgrading] = useState<RoomKey | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<WeeklyReport | null>(null)

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

  async function handleAdvanceWeek() {
    if (!gym) return
    setError(null)
    setAdvancing(true)
    setReport(null)
    const supabase = createClient()

    const prevFighters = useGameStore.getState().fighters
    const prevBalance = gym.balance

    const { error: rpcError } = await supabase.rpc('advance_week', { p_gym_id: gym.id })
    if (rpcError) {
      setError(rpcError.message)
      setAdvancing(false)
      return
    }

    const [gymRes, fightersRes] = await Promise.all([
      supabase.from('gyms').select('*').eq('id', gym.id).single(),
      supabase.from('fighters').select('*').eq('gym_id', gym.id).order('created_at'),
    ])

    if (gymRes.error) setError(gymRes.error.message)
    else if (gymRes.data) setGym(gymRes.data)

    if (!fightersRes.error && fightersRes.data) {
      const newFighters = fightersRes.data as Fighter[]
      setFighters(newFighters)
      setReport(
        buildWeeklyReport(
          prevFighters,
          newFighters,
          prevBalance,
          gymRes.data?.balance ?? prevBalance,
          gymRes.data?.season_week ?? gym.season_week + 1
        )
      )
    }

    setAdvancing(false)
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

      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Lanjut ke Minggu Berikutnya</p>
            <p className="text-xs text-gray-400">
              Saldo akan bertambah/berkurang sesuai pemasukan-pengeluaran, dan training load fighter akan pulih.
            </p>
          </div>
          <button
            onClick={handleAdvanceWeek}
            disabled={advancing}
            className="shrink-0 rounded-md bg-octagon-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:opacity-50"
          >
            {advancing ? 'Memproses...' : `Lanjut ke Minggu ${gym.season_week + 1}`}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-octagon-red">{error}</p>}

      {report && (
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Laporan Minggu ke-{report.week}</h2>
            <button onClick={() => setReport(null)} className="text-xs text-gray-400 hover:text-gray-200">
              Tutup
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-400">
            Saldo {report.balanceChange >= 0 ? 'bertambah' : 'berkurang'}{' '}
            <span className={`font-semibold ${report.balanceChange >= 0 ? 'text-octagon-teal' : 'text-octagon-red'}`}>
              {formatCurrency(Math.abs(report.balanceChange))}
            </span>
          </p>

          {report.agedUp && <p className="mt-1 text-xs text-octagon-amber">🎂 Semua fighter bertambah usia 1 tahun.</p>}

          {report.growth.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-300">Perkembangan Atribut</p>
              <ul className="mt-1 space-y-0.5 text-xs text-octagon-teal">
                {report.growth.map((g, i) => (
                  <li key={i}>
                    {g.name}: {g.attr} {g.from} → {g.to}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.healed.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-300">Pulih dari Cedera</p>
              <ul className="mt-1 space-y-0.5 text-xs text-octagon-teal">
                {report.healed.map((name, i) => (
                  <li key={i}>{name} sudah pulih dan kembali berlatih.</li>
                ))}
              </ul>
            </div>
          )}

          {report.retirements.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-300">Pensiun</p>
              <ul className="mt-1 space-y-0.5 text-xs text-octagon-red">
                {report.retirements.map((r, i) => (
                  <li key={i}>
                    {r.name} pensiun ({r.reason}).
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.contractWarnings.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-300">Kontrak Hampir Habis</p>
              <ul className="mt-1 space-y-0.5 text-xs text-octagon-amber">
                {report.contractWarnings.map((name, i) => (
                  <li key={i}>{name} — segera perpanjang kontrak di halaman Roster.</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
