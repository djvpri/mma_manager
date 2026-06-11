'use client'

import { useEffect, useState } from 'react'
import Avatar from '@/components/avatar/Avatar'
import { useGameStore } from '@/store/game-store'
import { createClient } from '@/lib/supabase'
import {
  EVENT_TIER_CONFIG,
  EVENT_TIER_BADGE_CLASS,
  getEventsForMonth,
  ensureEventsForCurrentMonth,
} from '@/lib/generate-events'
import type { Fighter, MmaEvent } from '@/types'

export default function EventsPage() {
  const gym = useGameStore((s) => s.gym)
  const fighters = useGameStore((s) => s.fighters)
  const setGym = useGameStore((s) => s.setGym)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [busyEventId, setBusyEventId] = useState<string | null>(null)

  useEffect(() => {
    if (!gym) return
    let cancelled = false
    ensureEventsForCurrentMonth(gym).then((updated) => {
      if (cancelled) return
      if (updated !== gym) setGym(updated)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym?.id, gym?.season_week])

  if (!gym || loading) {
    return <p className="text-sm text-gray-400">Memuat kalender event...</p>
  }

  const seasonWeek = gym.season_week
  const monthEvents = getEventsForMonth(gym.events, seasonWeek)
  const registeredFighterIds = new Set(monthEvents.flatMap((e) => e.fighter_ids))

  function getRegisteredFighters(event: MmaEvent): Fighter[] {
    return event.fighter_ids
      .map((id) => fighters.find((f) => f.id === id))
      .filter((f): f is Fighter => !!f)
  }

  function getEligibleFighters(event: MmaEvent): Fighter[] {
    return fighters.filter(
      (f) =>
        f.status !== 'retired' &&
        f.status !== 'injured' &&
        (f.next_fight_week === null || f.next_fight_week <= event.week) &&
        !registeredFighterIds.has(f.id)
    )
  }

  async function persistEvents(newEvents: MmaEvent[]) {
    if (!gym) return
    const supabase = createClient()
    const { data, error: updateError } = await supabase
      .from('gyms')
      .update({ events: newEvents })
      .eq('id', gym.id)
      .select()
      .single()

    if (updateError) {
      setError(updateError.message)
      return
    }
    if (data) setGym(data)
  }

  async function handleRegister(event: MmaEvent) {
    if (!gym) return
    const fighterId = selected[event.id]
    if (!fighterId) return

    setError(null)
    setBusyEventId(event.id)
    const newEvents = gym.events.map((e) =>
      e.id === event.id ? { ...e, fighter_ids: [...e.fighter_ids, fighterId] } : e
    )
    await persistEvents(newEvents)
    setSelected((s) => ({ ...s, [event.id]: '' }))
    setBusyEventId(null)
  }

  async function handleUnregister(event: MmaEvent, fighterId: string) {
    if (!gym) return
    setError(null)
    setBusyEventId(event.id)
    const newEvents = gym.events.map((e) =>
      e.id === event.id ? { ...e, fighter_ids: e.fighter_ids.filter((id) => id !== fighterId) } : e
    )
    await persistEvents(newEvents)
    setBusyEventId(null)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Kalender Event MMA</h1>
        <p className="text-sm text-gray-400">
          Daftarkan fighter ke event bulan ini, atau biarkan istirahat — fighter hanya bisa
          bertanding pada minggu event yang ia ikuti.
        </p>
      </header>

      {error && <p className="text-sm text-octagon-red">{error}</p>}

      {monthEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-8 text-center">
          <p className="text-gray-400">Tidak ada event MMA bulan ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {monthEvents.map((event) => {
            const tierConfig = EVENT_TIER_CONFIG[event.tier]
            const isPast = event.week < seasonWeek
            const isToday = event.week === seasonWeek
            const registered = getRegisteredFighters(event)
            const eligible = getEligibleFighters(event)
            const busy = busyEventId === event.id

            return (
              <div
                key={event.id}
                className={`rounded-lg border border-octagon-border bg-octagon-card p-4 ${isPast ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{event.name}</p>
                    <p className="text-xs text-gray-400">
                      Minggu ke-{event.week}
                      {isToday && ' · Berlangsung minggu ini'}
                      {isPast && ' · Selesai'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${EVENT_TIER_BADGE_CLASS[event.tier]}`}
                  >
                    {tierConfig.label}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {registered.length === 0 ? (
                    <p className="text-xs text-gray-500">Belum ada fighter terdaftar.</p>
                  ) : (
                    registered.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-octagon-dark px-2.5 py-1.5"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar imageUrl={f.avatar_url} size={28} className="shrink-0 overflow-hidden rounded-full" />
                          <span className="truncate text-sm text-gray-200">{f.name}</span>
                        </div>
                        {!isPast && (
                          <button
                            onClick={() => handleUnregister(event, f.id)}
                            disabled={busy}
                            className="shrink-0 text-xs font-medium text-gray-500 transition-colors hover:text-octagon-red disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Batalkan
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {!isPast && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select
                      value={selected[event.id] ?? ''}
                      onChange={(e) => setSelected((s) => ({ ...s, [event.id]: e.target.value }))}
                      disabled={busy || eligible.length === 0}
                      className="flex-1 rounded-md border border-octagon-border bg-octagon-dark px-2 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      <option value="">
                        {eligible.length === 0 ? 'Tidak ada fighter yang tersedia' : 'Pilih fighter...'}
                      </option>
                      {eligible.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.weight_class})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRegister(event)}
                      disabled={busy || !selected[event.id]}
                      className="shrink-0 rounded-md bg-octagon-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Daftarkan
                    </button>
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
