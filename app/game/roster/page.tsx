'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import FighterCard from '@/components/roster/FighterCard'
import { buildWeeklyReport, type WeeklyReport } from '@/lib/weekly-report'
import { formatCurrency } from '@/lib/format'
import type { Fighter } from '@/types'

export default function RosterPage() {
  const fighters = useGameStore((s) => s.fighters)
  const gym = useGameStore((s) => s.gym)
  const setGym = useGameStore((s) => s.setGym)
  const setFighters = useGameStore((s) => s.setFighters)

  const router = useRouter()
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<WeeklyReport | null>(null)

  const activeFighters = fighters.filter((f) => f.status !== 'retired')
  const pendingFight = gym
    ? activeFighters.find((f) => f.next_fight_week === gym.season_week) ?? null
    : null

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
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roster Fighter</h1>
          <p className="text-sm text-gray-400">
            {gym ? `${gym.name} — ` : ''}
            {activeFighters.length} fighter terdaftar
          </p>
        </div>
        <Link
          href="/game/recruit"
          className="inline-block rounded-md bg-octagon-red px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90"
        >
          + Rekrut Fighter
        </Link>
      </header>

      {gym && (
        <div className={`mb-6 rounded-lg border bg-octagon-card p-4 ${pendingFight ? 'border-octagon-amber/50' : 'border-octagon-border'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Minggu ke-{gym.season_week}</p>
              {pendingFight ? (
                <p className="text-xs text-octagon-amber">
                  ⚡ {pendingFight.name} dijadwalkan bertanding minggu ini — selesaikan fight night dulu!
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  Saldo akan bertambah/berkurang sesuai pemasukan-pengeluaran, dan training load fighter akan pulih.
                </p>
              )}
            </div>
            {pendingFight ? (
              <button
                onClick={() => router.push('/game/fight')}
                className="shrink-0 rounded-md bg-octagon-amber px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-octagon-amber/90"
              >
                Fight Night →
              </button>
            ) : (
              <button
                onClick={handleAdvanceWeek}
                disabled={advancing}
                className="shrink-0 rounded-md bg-octagon-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:opacity-50"
              >
                {advancing ? 'Memproses...' : `Lanjut ke Minggu ${gym.season_week + 1}`}
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-octagon-red">{error}</p>}

      {report && (
        <div className="mb-6 rounded-lg border border-octagon-border bg-octagon-card p-4">
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
                  <li key={i}>{name} — segera perpanjang kontrak di bawah.</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeFighters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-octagon-border bg-octagon-card py-16 text-center">
          <p className="text-gray-400">Belum ada fighter di roster.</p>
          <Link href="/game/recruit" className="mt-3 text-sm font-medium text-octagon-amber hover:underline">
            Rekrut fighter pertamamu →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeFighters.map((fighter) => (
            <FighterCard key={fighter.id} fighter={fighter} />
          ))}
        </div>
      )}
    </div>
  )
}
