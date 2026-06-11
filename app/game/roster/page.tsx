'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import FighterCard from '@/components/roster/FighterCard'
import { buildWeeklyReport, type WeeklyReport } from '@/lib/weekly-report'
import { formatCurrency } from '@/lib/format'
import { ensureEventsForUpcomingWeeks, getBestAvailableSlot, PROMOTION_CONFIG } from '@/lib/generate-events'
import type { Championship, Fighter, Gym } from '@/types'

export default function RosterPage() {
  const fighters = useGameStore((s) => s.fighters)
  const gym = useGameStore((s) => s.gym)
  const setGym = useGameStore((s) => s.setGym)
  const setFighters = useGameStore((s) => s.setFighters)

  const router = useRouter()
  const [advancing, setAdvancing] = useState(false)
  const [gymReady, setGymReady] = useState(false)

  // Refresh gym dari Supabase setiap kali halaman ini dimuat,
  // agar event.fighter_ids selalu mencerminkan hasil fight terbaru.
  // gymReady mencegah tombol fight/lanjut muncul sebelum data fresh siap.
  useEffect(() => {
    if (!gym) { setGymReady(true); return }
    const supabase = createClient()
    supabase.from('gyms').select('*').eq('id', gym.id).single().then(({ data }) => {
      if (data) setGym(data as Gym)
      setGymReady(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [championships, setChampionships] = useState<Championship[]>([])

  // Cek gelar juara yang dipegang fighter di gym ini
  useEffect(() => {
    if (!gym) return
    const supabase = createClient()
    supabase.from('championships').select('*').eq('champion_gym_id', gym.id).then(({ data }) => {
      setChampionships((data ?? []) as Championship[])
    })
  }, [gym?.id])

  // Pastikan kalender event sudah ter-generate untuk minggu berjalan + 3 ke depan
  useEffect(() => {
    if (!gym) return
    let cancelled = false
    ensureEventsForUpcomingWeeks(gym).then((updated) => {
      if (cancelled) return
      if (updated !== gym) setGym(updated)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym?.id, gym?.season_week])

  const activeFighters = fighters.filter((f) => f.status !== 'retired')
  // Semua event minggu ini — bisa lebih dari satu (beda weight class)
  const todaysEvents = gym?.events.filter((e) => e.week === gym.season_week) ?? []
  const pendingFighters = todaysEvents.flatMap((e) =>
    (e.slots ?? [])
      .filter((s) => s.fighter_id !== null)
      .map((s) => fighters.find((f) => f.id === s.fighter_id))
      .filter((f): f is Fighter => f !== undefined)
  )
  const hasPendingFight = pendingFighters.length > 0

  // Fighter yang punya slot event terbuka & cocok (minggu ini s/d 3 minggu ke depan)
  const seasonWeek = gym?.season_week ?? 0
  const validEvents = gym?.events.filter((e) => Array.isArray(e.slots) && e.promotion) ?? []
  const upcomingEvents = validEvents.filter((e) => e.week >= seasonWeek && e.week <= seasonWeek + 3)
  const registeredFighterIds = new Set(
    validEvents.flatMap((e) => e.slots.map((s) => s.fighter_id).filter(Boolean)) as string[]
  )
  const matchedFighters = activeFighters.filter((f) => {
    if (f.status === 'injured') return false
    if (registeredFighterIds.has(f.id)) return false
    if (f.next_fight_week !== null && f.next_fight_week > seasonWeek) return false
    return upcomingEvents.some((e) => {
      if (e.weight_class !== f.weight_class) return false
      const promoCfg = PROMOTION_CONFIG[e.promotion] ?? PROMOTION_CONFIG.lokal
      if (f.record.w < promoCfg.minWins) return false
      return getBestAvailableSlot(e, f.record.w) !== null
    })
  })

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
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Roster Fighter</h1>
        <p className="text-sm text-gray-400">
          {gym ? `${gym.name} — ` : ''}
          {activeFighters.length} fighter terdaftar
        </p>
      </header>

      {gym && (
        <div className={`mb-6 rounded-lg border bg-octagon-card p-4 ${gymReady && hasPendingFight ? 'border-octagon-amber/50' : 'border-octagon-border'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Minggu ke-{gym.season_week}</p>
              {gymReady && hasPendingFight ? (
                <p className="text-xs text-octagon-amber">
                  ⚡ {pendingFighters.map((f) => f.name).join(', ')} dijadwalkan bertanding minggu ini — selesaikan fight night dulu!
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  Saldo akan bertambah/berkurang sesuai pemasukan-pengeluaran, dan training load fighter akan pulih.
                </p>
              )}
            </div>
            {!gymReady ? (
              <button disabled className="shrink-0 rounded-md bg-octagon-border px-4 py-2 text-sm font-semibold text-gray-500 opacity-50">
                Memuat...
              </button>
            ) : hasPendingFight ? (
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

      {gymReady && matchedFighters.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-octagon-teal/40 bg-octagon-teal/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-octagon-teal">📅 Event Tersedia</p>
            <p className="text-xs text-gray-300">
              {matchedFighters.map((f) => f.name).join(', ')}{' '}
              {matchedFighters.length > 1 ? 'cocok dengan event' : 'cocok dengan sebuah event'} yang tersedia — daftarkan sebelum lanjut minggu.
            </p>
          </div>
          <Link
            href="/game/events"
            className="shrink-0 rounded-md bg-octagon-teal px-4 py-2 text-center text-sm font-semibold text-octagon-dark transition-colors hover:bg-octagon-teal/90"
          >
            Lihat Event →
          </Link>
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
          {activeFighters.map((fighter) => {
            const belt = championships.find((c) => c.champion_fighter_id === fighter.id)
            return (
              <FighterCard key={fighter.id} fighter={fighter} titleDefenses={belt?.title_defenses} />
            )
          })}
        </div>
      )}
    </div>
  )
}
