'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import { overallRating } from '@/lib/attrs'
import FighterDetailModal from '@/components/roster/FighterDetailModal'
import type { Championship, Fighter, WeightClass } from '@/types'

// ─── Gym tier system ─────────────────────────────────────────────────────────

const GYM_TIERS = [
  { min: 86, label: 'Legend',    textColor: 'text-yellow-400',      badgeClass: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' },
  { min: 71, label: 'Champion',  textColor: 'text-octagon-amber',   badgeClass: 'border-octagon-amber/40 bg-octagon-amber/10 text-octagon-amber' },
  { min: 51, label: 'Elite',     textColor: 'text-octagon-teal',    badgeClass: 'border-octagon-teal/40 bg-octagon-teal/10 text-octagon-teal' },
  { min: 31, label: 'Contender', textColor: 'text-blue-400',        badgeClass: 'border-blue-500/40 bg-blue-500/10 text-blue-300' },
  { min: 0,  label: 'Amateur',   textColor: 'text-gray-400',        badgeClass: 'border-gray-500/40 bg-gray-500/10 text-gray-400' },
]

function getGymTier(rep: number) {
  return GYM_TIERS.find((t) => rep >= t.min) ?? GYM_TIERS[GYM_TIERS.length - 1]
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopFighter { name: string; record: string; specialty: string; wins: number }

interface LeaderboardEntry {
  id: string; gym_id: string; gym_name: string
  reputation: number; total_wins: number; total_losses: number
  top_fighters: TopFighter[]
}

const WEIGHT_CLASSES: WeightClass[] = [
  'Strawweight','Flyweight','Bantamweight','Featherweight',
  'Lightweight','Welterweight','Middleweight','Heavyweight',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const gym     = useGameStore((s) => s.gym)
  const fighters = useGameStore((s) => s.fighters)

  const [tab, setTab]               = useState<'gym' | 'fighter' | 'champions'>('gym')
  const [entries, setEntries]       = useState<LeaderboardEntry[] | null>(null)
  const [poolFighters, setPool]     = useState<Fighter[] | null>(null)
  const [champions, setChampions]   = useState<Championship[] | null>(null)
  const [selectedWC, setSelectedWC] = useState<WeightClass>(
    () => fighters.find((f) => f.status !== 'retired')?.weight_class ?? 'Flyweight'
  )
  const [error, setError]           = useState<string | null>(null)
  const [selectedFighter, setSelectedFighter] = useState<Fighter | null>(null)

  // Gym leaderboard
  useEffect(() => {
    const supabase = createClient()
    supabase.from('leaderboard').select('*')
      .order('reputation', { ascending: false })
      .order('total_wins',  { ascending: false })
      .limit(60)
      .then(({ data, error: e }) => {
        if (e) setError(e.message)
        else setEntries((data ?? []) as LeaderboardEntry[])
      })
  }, [])

  // Champions: load gelar juara per weight class (on-mount, dipakai juga untuk badge di Ranking Fighter)
  useEffect(() => {
    if (champions !== null) return
    const supabase = createClient()
    supabase.from('championships').select('*')
      .then(({ data }) => {
        const rows = (data ?? []) as Championship[]
        rows.sort((a, b) => WEIGHT_CLASSES.indexOf(a.weight_class) - WEIGHT_CLASSES.indexOf(b.weight_class))
        setChampions(rows)
      })
  }, [champions])

  // Fighter rankings: load pool + player fighters untuk weight class terpilih
  useEffect(() => {
    if (tab !== 'fighter') return
    setPool(null)
    const supabase = createClient()
    supabase.from('fighters')
      .select('id,name,nickname,age,birth_week,hometown,weight_class,specialty,attrs,record,gym_id,status,personality,avatar_url')
      .eq('weight_class', selectedWC)
      .neq('status', 'retired')
      .limit(150)
      .then(({ data }) => {
        setPool((data ?? []) as Fighter[])
      })
  }, [tab, selectedWC])

  if (!gym) return <p className="text-sm text-gray-400">Memuat...</p>

  // Fighter ranking: merge pool + player fighters, sort by OVR
  const rankedFighters = poolFighters
    ? [...poolFighters]
        .sort((a, b) => overallRating(b.attrs) - overallRating(a.attrs))
        .slice(0, 25)
    : []

  // Map gym_id -> nama gym (untuk label CPU gym di Ranking Fighter)
  const gymNameMap = new Map((entries ?? []).map((e) => [e.gym_id, e.gym_name]))

  // Champion fighter id untuk weight class yang dipilih (badge 🏆)
  const championForWC = champions?.find((c) => c.weight_class === selectedWC)

  function gymLabelFor(f: Fighter) {
    if (f.gym_id === gym!.id) return gym!.name
    if (f.gym_id === null) return 'Free Agent'
    return gymNameMap.get(f.gym_id) ?? 'Gym Lain'
  }

  const myTier = getGymTier(gym.reputation)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${myTier.badgeClass}`}>{myTier.label}</span>
          <p className="text-sm text-gray-400">{gym.name} · Reputasi {gym.reputation}/100</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-octagon-border bg-octagon-card p-1">
        {(['gym','fighter','champions'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-octagon-red text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t === 'gym' ? '🏋️ Ranking Gym' : t === 'fighter' ? '🥊 Ranking Fighter' : '🏆 Champions'}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-octagon-red">{error}</p>}

      {/* ── TAB: GYM RANKING ─────────────────────────────────────────── */}
      {tab === 'gym' && (
        entries === null ? (
          <p className="text-sm text-gray-400">Memuat...</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-octagon-border bg-octagon-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-octagon-border text-left text-xs uppercase text-gray-500">
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">Gym & Fighter Terbaik</th>
                    <th className="px-3 py-3 text-right">Rep</th>
                    <th className="px-3 py-3 text-right hidden sm:table-cell">W-L</th>
                    <th className="px-3 py-3 text-right hidden sm:table-cell">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const tier    = getGymTier(entry.reputation)
                    const isMe    = entry.gym_id === gym.id
                    const total   = entry.total_wins + (entry.total_losses ?? 0)
                    const winPct  = total > 0 ? Math.round((entry.total_wins / total) * 100) : 0

                    return (
                      <tr key={entry.id}
                        className={`border-b border-octagon-border last:border-0 ${isMe ? 'bg-octagon-red/10' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <span className={`font-bold ${i < 3 ? ['text-yellow-400','text-gray-300','text-amber-600'][i] : 'text-gray-500'}`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`hidden shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold sm:inline ${tier.badgeClass}`}>
                              {tier.label}
                            </span>
                            <span className={`truncate font-semibold ${isMe ? 'text-octagon-red' : 'text-white'}`}>
                              {entry.gym_name}{isMe && ' ★'}
                            </span>
                          </div>
                          {entry.top_fighters?.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {entry.top_fighters.map((f, j) => (
                                <span key={j} className="inline-flex items-center gap-1 rounded border border-octagon-border bg-octagon-dark px-1.5 py-0.5 text-[10px] text-gray-300">
                                  <span className="font-medium text-white">{f.name}</span>
                                  <span className="text-gray-500">{f.record}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-bold ${tier.textColor}`}>{entry.reputation}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300 hidden sm:table-cell">
                          {entry.total_wins}-{entry.total_losses ?? '?'}
                        </td>
                        <td className="px-3 py-3 text-right hidden sm:table-cell">
                          <span className={winPct >= 60 ? 'font-semibold text-octagon-teal' : winPct >= 40 ? 'text-gray-300' : 'text-octagon-red'}>
                            {winPct}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── TAB: FIGHTER RANKING ─────────────────────────────────────── */}
      {tab === 'fighter' && (
        <div className="space-y-4">
          {/* Weight class filter */}
          <div className="flex flex-wrap gap-1.5">
            {WEIGHT_CLASSES.map((wc) => (
              <button key={wc} onClick={() => setSelectedWC(wc)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedWC === wc
                    ? 'border-octagon-red bg-octagon-red/20 text-white'
                    : 'border-octagon-border text-gray-400 hover:border-gray-500'
                }`}
              >
                {wc}
              </button>
            ))}
          </div>

          {poolFighters === null ? (
            <p className="text-sm text-gray-400">Memuat ranking...</p>
          ) : rankedFighters.length === 0 ? (
            <p className="text-sm text-gray-400">Tidak ada fighter di kelas {selectedWC}.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-octagon-border bg-octagon-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-octagon-border text-left text-xs uppercase text-gray-500">
                      <th className="px-3 py-3">#</th>
                      <th className="px-3 py-3">Fighter</th>
                      <th className="px-3 py-3 hidden sm:table-cell">Gym</th>
                      <th className="px-3 py-3 text-right">Record</th>
                      <th className="px-3 py-3 text-right">OVR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedFighters.map((f, i) => {
                      const isMyFighter = f.gym_id === gym.id
                      const isFreeAgent = f.gym_id === null
                      const ovr         = overallRating(f.attrs)
                      const gymLabel    = gymLabelFor(f)
                      const isChampion  = championForWC?.champion_fighter_id === f.id

                      return (
                        <tr key={f.id}
                          onClick={() => setSelectedFighter(f)}
                          className={`cursor-pointer border-b border-octagon-border last:border-0 transition-colors hover:bg-octagon-dark/50 ${isMyFighter ? 'bg-octagon-red/10' : ''}`}
                        >
                          <td className="px-3 py-3">
                            <span className={`font-bold ${i < 3 ? ['text-yellow-400','text-gray-300','text-amber-600'][i] : 'text-gray-500'}`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="max-w-[160px] px-3 py-3 sm:max-w-none">
                            <p className={`truncate font-semibold ${isMyFighter ? 'text-octagon-red' : 'text-white'}`}>
                              {isChampion && '🏆 '}{f.name}{isMyFighter && ' ★'}
                            </p>
                            <p className="truncate text-xs text-gray-500">{f.specialty} · {f.age} th</p>
                          </td>
                          <td className="px-3 py-3 hidden sm:table-cell">
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                              isMyFighter ? 'border-octagon-red/40 bg-octagon-red/10 text-octagon-red' :
                              isFreeAgent ? 'border-gray-500/40 bg-gray-500/10 text-gray-400' :
                                            'border-octagon-border text-gray-500'
                            }`}>
                              {gymLabel}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-gray-300">
                            {f.record.w}-{f.record.l}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden w-16 overflow-hidden rounded-full bg-octagon-dark sm:block" style={{ height: 4 }}>
                                <div className="h-full rounded-full bg-octagon-teal" style={{ width: `${ovr}%` }} />
                              </div>
                              <span className={`font-bold ${ovr >= 75 ? 'text-octagon-teal' : ovr >= 60 ? 'text-octagon-amber' : 'text-gray-400'}`}>
                                {ovr}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CHAMPIONS ───────────────────────────────────────────── */}
      {tab === 'champions' && (
        champions === null ? (
          <p className="text-sm text-gray-400">Memuat...</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-octagon-border bg-octagon-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-octagon-border text-left text-xs uppercase text-gray-500">
                    <th className="px-3 py-3">Kelas</th>
                    <th className="px-3 py-3">Champion</th>
                    <th className="px-3 py-3 hidden sm:table-cell">Gym</th>
                    <th className="px-3 py-3 text-right">Defenses</th>
                  </tr>
                </thead>
                <tbody>
                  {champions.map((c) => {
                    const isMe   = c.champion_gym_id === gym.id
                    const vacant = !c.champion_fighter_id

                    return (
                      <tr key={c.weight_class}
                        className={`border-b border-octagon-border last:border-0 ${isMe ? 'bg-octagon-red/10' : ''}`}
                      >
                        <td className="px-3 py-3 font-semibold text-white">{c.weight_class}</td>
                        <td className="max-w-[140px] px-3 py-3 sm:max-w-none">
                          {vacant ? (
                            <span className="text-gray-500 italic">Vacant</span>
                          ) : (
                            <span className={`block truncate font-semibold ${isMe ? 'text-octagon-red' : 'text-yellow-400'}`}>
                              🏆 {c.champion_name}{isMe && ' ★'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden text-gray-300 sm:table-cell">
                          {c.champion_gym_name ?? '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-300">
                          {vacant ? '—' : c.title_defenses}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {selectedFighter && (
        <FighterDetailModal
          fighter={selectedFighter}
          gymLabel={gymLabelFor(selectedFighter)}
          onClose={() => setSelectedFighter(null)}
        />
      )}
    </div>
  )
}
