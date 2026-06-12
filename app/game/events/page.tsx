'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Avatar from '@/components/avatar/Avatar'
import { useGameStore } from '@/store/game-store'
import {
  PROMOTION_CONFIG,
  SLOT_CONFIG,
  ensureEventsForUpcomingWeeks,
  registerFighterToEvent,
  unregisterFighterFromEvent,
  getBestAvailableSlot,
} from '@/lib/generate-events'
import { formatCurrency, formatNumber } from '@/lib/format'
import type { Fighter, MmaEvent } from '@/types'

const TOURNAMENT_ROUND_LABELS = ['Quarterfinal', 'Semifinal', 'Final']

export default function EventsPage() {
  const gym      = useGameStore((s) => s.gym)
  const fighters = useGameStore((s) => s.fighters)
  const setGym   = useGameStore((s) => s.setGym)

  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [busyId, setBusyId]     = useState<string | null>(null) // eventId_slotType

  useEffect(() => {
    if (!gym) return
    let cancelled = false
    ensureEventsForUpcomingWeeks(gym).then((updated) => {
      if (cancelled) return
      if (updated !== gym) setGym(updated)
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym?.id, gym?.season_week])

  if (!gym || loading) return <p className="text-sm text-gray-400">Memuat kalender event...</p>

  const seasonWeek    = gym.season_week
  const activeFighters = fighters.filter(
    (f) => f.status !== 'retired' && f.status !== 'injured'
  )

  // Filter: hanya event format baru (punya slots & promotion)
  const validEvents = gym.events.filter((e) => Array.isArray(e.slots) && e.promotion)

  // Semua fighter yang sudah terdaftar di event apapun
  const registeredFighterIds = new Set(
    validEvents.flatMap((e) => e.slots.map((s) => s.fighter_id).filter(Boolean)) as string[]
  )

  // Upcoming events: minggu ini + 3 ke depan
  const upcomingEvents = validEvents
    .filter((e) => e.week >= seasonWeek && e.week <= seasonWeek + 3)
    .sort((a, b) => a.week - b.week)

  // Fighter yang eligible untuk event tertentu
  function getEligibleFighters(event: MmaEvent): Fighter[] {
    const promoCfg = PROMOTION_CONFIG[event.promotion] ?? PROMOTION_CONFIG.lokal
    return activeFighters.filter((f) => {
      if (f.weight_class !== event.weight_class) return false
      if (f.record.w < promoCfg.minWins) return false
      if (registeredFighterIds.has(f.id)) return false
      if (f.next_fight_week !== null && f.next_fight_week > seasonWeek) return false
      return true
    })
  }

  async function handleRegister(event: MmaEvent, fighter: Fighter) {
    if (!gym) return
    setError(null)
    setBusyId(`${event.id}_register`)

    const updated = await registerFighterToEvent(gym, event.id, fighter)
    if (!updated) {
      setError('Gagal mendaftarkan fighter. Coba lagi.')
    } else {
      setGym(updated)
    }
    setBusyId(null)
  }

  async function handleUnregister(event: MmaEvent, fighterId: string) {
    if (!gym) return
    setError(null)
    setBusyId(`${event.id}_unregister`)

    const updated = await unregisterFighterFromEvent(gym, event.id, fighterId)
    if (!updated) {
      setError('Gagal membatalkan pendaftaran.')
    } else {
      setGym(updated)
    }
    setBusyId(null)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Kalender Event</h1>
        <p className="text-sm text-gray-400">
          Daftarkan fighter ke event — slot & lawan otomatis dipilihkan sesuai rekam bertanding.
        </p>
      </header>

      {error && <p className="text-sm text-octagon-red">{error}</p>}

      {upcomingEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-8 text-center">
          <p className="text-gray-400">Tidak ada event mendatang.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcomingEvents.map((event) => {
            const promoCfg    = PROMOTION_CONFIG[event.promotion]
            const isPast      = event.week < seasonWeek
            const isThisWeek  = event.week === seasonWeek
            const eligible    = getEligibleFighters(event)
            const isBusy      = busyId?.startsWith(event.id) ?? false

            return (
              <div key={event.id} className={`rounded-lg border bg-octagon-card ${isPast ? 'opacity-50 border-octagon-border' : 'border-octagon-border'}`}>
                {/* Event header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-octagon-border px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${promoCfg.badgeClass}`}>
                        {promoCfg.label}
                      </span>
                      {isThisWeek && (
                        <span className="rounded border border-octagon-red/40 bg-octagon-red/10 px-2 py-0.5 text-[10px] font-semibold text-octagon-red">
                          Minggu Ini
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-semibold text-white">{event.name}</p>
                    <p className="text-xs text-gray-400">
                      Minggu ke-{event.week} · {event.weight_class} · Syarat: {promoCfg.minWins}+ menang
                    </p>
                    {event.venue && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        📍 {event.venue}
                        {event.attendance && ` · 👥 ~${formatNumber(event.attendance)} penonton`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Fight card slots */}
                <div className="divide-y divide-octagon-border/50">
                  {event.slots.map((slot) => {
                    const slotCfg   = SLOT_CONFIG[slot.type]
                    const myFighter = slot.fighter_id
                      ? fighters.find((f) => f.id === slot.fighter_id)
                      : null

                    return (
                      <div key={slot.type} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        {/* Slot label */}
                        <div className="w-20 shrink-0 sm:w-28">
                          <p className="text-xs font-semibold text-white">
                            {slotCfg.icon && <span className="mr-1">{slotCfg.icon}</span>}
                            {slotCfg.label}
                          </p>
                          <p className="text-[10px] text-octagon-amber">×{slotCfg.purseMult} purse</p>
                          <p className="text-[10px] text-gray-600">{slotCfg.minWins}+ menang</p>
                        </div>

                        {/* Fighter side */}
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {myFighter ? (
                            <>
                              <Avatar size={32} imageUrl={myFighter.avatar_url} className="shrink-0 overflow-hidden rounded-full bg-octagon-dark" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-octagon-teal">{myFighter.name}</p>
                                <p className="text-[10px] text-gray-500">{myFighter.record.w}-{myFighter.record.l} · {myFighter.specialty}</p>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-gray-600 italic">—</p>
                          )}
                        </div>

                        {/* VS + Opponent */}
                        {slot.fighter_id && (
                          <>
                            <span className="text-xs font-bold text-gray-600">VS</span>
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              {slot.type === 'tournament' && slot.opponents ? (
                                (() => {
                                  const round = slot.bracket_round ?? 0
                                  const currentOpp = slot.opponents?.[round]
                                  return currentOpp ? (
                                    <>
                                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-octagon-dark" style={{ boxShadow: `0 0 0 2px ${currentOpp.color}` }} />
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-gray-200">
                                          {currentOpp.name}
                                          {currentOpp.is_rival && <span className="ml-1 text-octagon-red">🔥</span>}
                                        </p>
                                        <p className="text-[10px] text-gray-500">{currentOpp.record.w}-{currentOpp.record.l} · {currentOpp.specialty}</p>
                                        <p className="text-[10px] font-semibold text-yellow-400">{TOURNAMENT_ROUND_LABELS[round]}</p>
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-xs text-gray-600 italic">—</p>
                                  )
                                })()
                              ) : slot.opponent ? (
                                <>
                                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-octagon-dark" style={{ boxShadow: `0 0 0 2px ${slot.opponent.color}` }} />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-gray-200">
                                      {slot.opponent.name}
                                      {slot.opponent.is_rival && <span className="ml-1 text-octagon-red">🔥</span>}
                                    </p>
                                    <p className="text-[10px] text-gray-500">{slot.opponent.record.w}-{slot.opponent.record.l} · {slot.opponent.specialty}</p>
                                  </div>
                                </>
                              ) : (
                                <p className="text-xs text-gray-600 italic">Mencari lawan...</p>
                              )}
                            </div>
                          </>
                        )}

                        {/* Action buttons */}
                        {!isPast && (
                          <div className="shrink-0">
                            {myFighter ? (
                              <button
                                onClick={() => handleUnregister(event, myFighter.id)}
                                disabled={isBusy || isThisWeek}
                                className="rounded border border-octagon-border px-2 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:border-octagon-red hover:text-octagon-red disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Batalkan
                              </button>
                            ) : slot.fighter_id === null ? (
                              <div className="flex flex-col gap-1">
                                {eligible.length > 0 ? (
                                  eligible
                                    .filter((f) => getBestAvailableSlot(event, f.record.w)?.type === slot.type)
                                    .map((f) => (
                                      <button
                                        key={f.id}
                                        onClick={() => handleRegister(event, f)}
                                        disabled={isBusy}
                                        className="rounded bg-octagon-red px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:opacity-50"
                                      >
                                        {isBusy ? '...' : `+ ${f.name}`}
                                      </button>
                                    ))
                                ) : (
                                  <span className="text-[10px] text-gray-600">Tidak ada fighter eligible</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Info eligible fighters */}
                {!isPast && !isThisWeek && eligible.length === 0 && (
                  <div className="border-t border-octagon-border/50 px-4 py-2">
                    <p className="text-xs text-gray-600">
                      Tidak ada fighter {event.weight_class} dengan {promoCfg.minWins}+ menang yang tersedia.{' '}
                      <Link href="/game/recruit" className="text-octagon-amber hover:underline">Rekrut fighter →</Link>
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
