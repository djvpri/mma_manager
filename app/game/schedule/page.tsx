'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import Avatar from '@/components/avatar/Avatar'
import { generateOpponent } from '@/lib/generate-opponent'
import type { Fighter } from '@/types'

const WEEK_OPTIONS = [1, 2, 3, 4]

export default function SchedulePage() {
  const gym = useGameStore((s) => s.gym)
  const fighters = useGameStore((s) => s.fighters)
  const updateFighter = useGameStore((s) => s.updateFighter)
  const setFightFighter = useGameStore((s) => s.setFightFighter)
  const setOpponent = useGameStore((s) => s.setOpponent)
  const setFightPhase = useGameStore((s) => s.setFightPhase)
  const resetFight = useGameStore((s) => s.resetFight)
  const router = useRouter()

  const [pickerFighterId, setPickerFighterId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!gym) {
    return <p className="text-sm text-gray-400">Memuat data gym...</p>
  }

  const eligible = fighters.filter((f) => f.status !== 'retired')
  const scheduled = eligible
    .filter((f) => f.scheduled_week != null)
    .sort((a, b) => (a.scheduled_week ?? 0) - (b.scheduled_week ?? 0))
  const unscheduled = eligible.filter((f) => f.scheduled_week == null)

  async function handleSchedule(fighter: Fighter, weeksAhead: number) {
    if (!gym) return
    setBusyId(fighter.id)
    setError(null)

    const opponent = generateOpponent(fighter)
    const scheduledWeek = gym.season_week + weeksAhead

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('fighters')
      .update({ scheduled_week: scheduledWeek, scheduled_opponent: opponent })
      .eq('id', fighter.id)

    if (updateError) {
      setError(updateError.message)
      setBusyId(null)
      return
    }

    updateFighter(fighter.id, { scheduled_week: scheduledWeek, scheduled_opponent: opponent })
    setPickerFighterId(null)
    setBusyId(null)
  }

  async function handleCancel(fighter: Fighter) {
    setBusyId(fighter.id)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('fighters')
      .update({ scheduled_week: null, scheduled_opponent: null })
      .eq('id', fighter.id)

    if (updateError) {
      setError(updateError.message)
      setBusyId(null)
      return
    }

    updateFighter(fighter.id, { scheduled_week: null, scheduled_opponent: null })
    setBusyId(null)
  }

  async function handleStartFight(fighter: Fighter) {
    if (!fighter.scheduled_opponent) return
    setBusyId(fighter.id)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('fighters')
      .update({ scheduled_week: null, scheduled_opponent: null })
      .eq('id', fighter.id)

    if (updateError) {
      setError(updateError.message)
      setBusyId(null)
      return
    }

    updateFighter(fighter.id, { scheduled_week: null, scheduled_opponent: null })

    resetFight()
    setFightFighter(fighter)
    setOpponent(fighter.scheduled_opponent)
    setFightPhase('gameplan')
    router.push('/game/fight')
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Kalender Pertarungan</h1>
        <p className="text-sm text-gray-400">Minggu ke-{gym.season_week}</p>
      </header>

      {error && <p className="text-sm text-octagon-red">{error}</p>}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Pertarungan Mendatang
        </h2>
        {scheduled.length === 0 ? (
          <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-6 text-center text-sm text-gray-400">
            Belum ada pertarungan yang dijadwalkan.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {scheduled.map((fighter) => {
              const opponent = fighter.scheduled_opponent!
              const ready = (fighter.scheduled_week ?? 0) <= gym.season_week
              return (
                <div key={fighter.id} className="rounded-lg border border-octagon-border bg-octagon-card p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      seed={fighter.avatar_seed}
                      imageUrl={fighter.avatar_url}
                      size={56}
                      className="shrink-0 overflow-hidden rounded-full bg-octagon-dark"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-white">{fighter.name}</h3>
                      <p className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: opponent.color }} />
                        vs {opponent.name}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {opponent.specialty} · {opponent.record.w}-{opponent.record.l}-{opponent.record.d}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${
                        ready
                          ? 'border-octagon-teal/30 bg-octagon-teal/15 text-octagon-teal'
                          : 'border-octagon-amber/30 bg-octagon-amber/15 text-octagon-amber'
                      }`}
                    >
                      {ready ? 'Siap Bertarung' : `Minggu ke-${fighter.scheduled_week}`}
                    </span>
                    <button
                      onClick={() => handleCancel(fighter)}
                      disabled={busyId === fighter.id}
                      className="text-xs font-medium text-gray-500 transition-colors hover:text-octagon-red disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Batal
                    </button>
                  </div>

                  {ready && (
                    <button
                      onClick={() => handleStartFight(fighter)}
                      disabled={busyId === fighter.id}
                      className="mt-3 w-full rounded-md bg-octagon-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === fighter.id ? 'Memproses...' : 'Mulai Pertarungan'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Belum Dijadwalkan</h2>
        {unscheduled.length === 0 ? (
          <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-6 text-center text-sm text-gray-400">
            Semua fighter sudah punya jadwal pertarungan.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {unscheduled.map((fighter) => (
              <div key={fighter.id} className="rounded-lg border border-octagon-border bg-octagon-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar
                    seed={fighter.avatar_seed}
                    imageUrl={fighter.avatar_url}
                    size={56}
                    className="shrink-0 overflow-hidden rounded-full bg-octagon-dark"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-white">{fighter.name}</h3>
                    <p className="text-xs text-gray-400">
                      {fighter.weight_class} · {fighter.specialty}
                    </p>
                    {fighter.status === 'injured' && (
                      <p className="mt-1 text-xs text-octagon-red">⚠ Cedera — tidak bisa bertanding</p>
                    )}
                  </div>
                </div>

                {fighter.status !== 'injured' && (
                  <div className="mt-3">
                    {pickerFighterId === fighter.id ? (
                      <div className="flex flex-wrap gap-2">
                        {WEEK_OPTIONS.map((w) => (
                          <button
                            key={w}
                            onClick={() => handleSchedule(fighter, w)}
                            disabled={busyId === fighter.id}
                            className="rounded-md border border-octagon-border px-2.5 py-1 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            +{w} minggu
                          </button>
                        ))}
                        <button
                          onClick={() => setPickerFighterId(null)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-300"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPickerFighterId(fighter.id)}
                        className="w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal"
                      >
                        Jadwalkan Pertarungan
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
