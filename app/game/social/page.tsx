'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/game-store'
import { fetchFriendGyms, addGymFriend, buildWhatsAppInviteUrl, type FriendGym } from '@/lib/social'
import {
  fetchMyPvpMatches,
  createPvpChallenge,
  respondPvpChallenge,
  setPvpGamePlan,
  cancelPvpChallenge,
  type PvpMatch,
} from '@/lib/pvp'
import type { GamePlan } from '@/types'

const GAME_PLAN_LABELS: { value: GamePlan; label: string }[] = [
  { value: 'pressure', label: 'Pressure' },
  { value: 'counter', label: 'Counter' },
  { value: 'grapple', label: 'Grapple' },
  { value: 'technical', label: 'Technical' },
  { value: 'brawler', label: 'Brawler' },
  { value: 'defensive', label: 'Defensive' },
]

export default function SocialPage() {
  const gym = useGameStore((s) => s.gym)
  const fighters = useGameStore((s) => s.fighters)
  const eligibleFighters = fighters.filter((f) => f.status === 'training' || f.status === 'active')

  const [friends, setFriends]   = useState<FriendGym[] | null>(null)
  const [code, setCode]         = useState('')
  const [addBusy, setAddBusy]   = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)

  const [pvpMatches, setPvpMatches] = useState<PvpMatch[] | null>(null)
  const [pvpBusy, setPvpBusy]       = useState<string | null>(null)
  const [pvpError, setPvpError]     = useState<string | null>(null)
  const [challengeFighter, setChallengeFighter] = useState<Record<string, string>>({})
  const [respondFighter, setRespondFighter]     = useState<Record<string, string>>({})

  useEffect(() => {
    if (!gym) return
    fetchFriendGyms().then(setFriends)
    refreshPvp()
  }, [gym?.id])

  async function refreshPvp() {
    setPvpMatches(await fetchMyPvpMatches())
  }

  if (!gym) return <p className="text-sm text-gray-400">Memuat...</p>

  async function handleCopy() {
    await navigator.clipboard.writeText(gym!.friend_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleAddFriend() {
    if (!code.trim()) return
    setAddError(null)
    setAddBusy(true)
    const { error } = await addGymFriend(code.trim())
    if (error) {
      setAddError('Gagal menambahkan teman: ' + error)
    } else {
      setCode('')
      setFriends(await fetchFriendGyms())
    }
    setAddBusy(false)
  }

  async function handleChallenge(friendCode: string, gymId: string) {
    const fighterId = challengeFighter[gymId] ?? eligibleFighters[0]?.id
    if (!fighterId) return
    setPvpError(null)
    setPvpBusy(gymId)
    const { error } = await createPvpChallenge(friendCode, fighterId)
    if (error) setPvpError('Gagal mengirim tantangan: ' + error)
    await refreshPvp()
    setPvpBusy(null)
  }

  async function handleRespond(matchId: string, accept: boolean) {
    const fighterId = accept ? (respondFighter[matchId] ?? eligibleFighters[0]?.id ?? null) : null
    setPvpError(null)
    setPvpBusy(matchId)
    const { error } = await respondPvpChallenge(matchId, fighterId, accept)
    if (error) setPvpError('Gagal merespons: ' + error)
    await refreshPvp()
    setPvpBusy(null)
  }

  async function handleSetGamePlan(matchId: string, plan: GamePlan) {
    setPvpError(null)
    setPvpBusy(matchId)
    const { error } = await setPvpGamePlan(matchId, plan)
    if (error) setPvpError('Gagal memilih game plan: ' + error)
    await refreshPvp()
    setPvpBusy(null)
  }

  async function handleCancel(matchId: string) {
    setPvpBusy(matchId)
    await cancelPvpChallenge(matchId)
    await refreshPvp()
    setPvpBusy(null)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Sosial</h1>
        <p className="text-sm text-gray-400">Terhubung dengan teman dan bandingkan progres gym kalian.</p>
      </header>

      {/* Kode gym + undang via WA */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Kode Gym Kamu</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded border border-octagon-border bg-octagon-dark px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-octagon-amber">
            {gym.friend_code}
          </span>
          <button
            onClick={handleCopy}
            className="rounded border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-amber hover:text-octagon-amber"
          >
            {copied ? 'Tersalin!' : 'Salin Kode'}
          </button>
          <a
            href={buildWhatsAppInviteUrl(gym.name, gym.friend_code)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-octagon-teal px-3 py-1.5 text-xs font-semibold text-octagon-dark transition-colors hover:bg-octagon-teal/90"
          >
            Bagikan via WhatsApp
          </a>
        </div>
        <p className="mt-2 text-xs text-gray-600">Bagikan kode ini ke teman supaya mereka bisa menambahkanmu.</p>
      </div>

      {/* Tambah teman */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Tambah Teman</h2>
        {addError && <p className="mb-2 text-xs text-octagon-red">{addError}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Masukkan kode gym teman"
            maxLength={6}
            className="rounded border border-octagon-border bg-octagon-dark px-3 py-1.5 font-mono text-sm uppercase tracking-widest text-white placeholder:text-gray-600 placeholder:tracking-normal focus:border-octagon-amber focus:outline-none"
          />
          <button
            onClick={handleAddFriend}
            disabled={addBusy || !code.trim()}
            className="rounded bg-octagon-amber px-3 py-1.5 text-xs font-semibold text-octagon-dark transition-colors hover:bg-octagon-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addBusy ? 'Memproses...' : 'Tambahkan'}
          </button>
        </div>
      </div>

      {/* Daftar teman */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Daftar Teman</h2>
        {friends === null ? (
          <p className="text-sm text-gray-500">Memuat...</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada teman. Tambahkan lewat kode gym di atas.</p>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div key={f.gym_id} className="flex flex-col gap-2 rounded border border-octagon-border/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{f.name}</p>
                  <p className="text-xs text-gray-500">{f.city} · Minggu ke-{f.season_week}</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-400">Reputasi <span className="text-octagon-amber">{f.reputation}</span></span>
                  <span className="text-gray-400">Rekor <span className="text-octagon-teal">{f.wins}W</span>-<span className="text-octagon-red">{f.losses}L</span></span>
                </div>
                {eligibleFighters.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={challengeFighter[f.gym_id] ?? eligibleFighters[0].id}
                      onChange={(e) => setChallengeFighter((c) => ({ ...c, [f.gym_id]: e.target.value }))}
                      className="rounded border border-octagon-border bg-octagon-dark px-2 py-1 text-xs text-white focus:border-octagon-amber focus:outline-none"
                    >
                      {eligibleFighters.map((fi) => (
                        <option key={fi.id} value={fi.id}>{fi.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleChallenge(f.friend_code, f.gym_id)}
                      disabled={pvpBusy === f.gym_id}
                      className="rounded bg-octagon-red px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pvpBusy === f.gym_id ? 'Mengirim...' : '⚔️ Tantang'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PvP: Tantangan & Laga */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tantangan &amp; Laga PvP</h2>
          <button onClick={refreshPvp} className="text-xs text-gray-500 hover:text-octagon-amber">↻ Refresh</button>
        </div>
        {pvpError && <p className="mb-2 text-xs text-octagon-red">{pvpError}</p>}

        {pvpMatches === null ? (
          <p className="text-sm text-gray-500">Memuat...</p>
        ) : pvpMatches.filter((m) => m.status !== 'declined' && m.status !== 'cancelled').length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada tantangan. Tantang teman lewat daftar di atas.</p>
        ) : (
          <div className="space-y-3">
            {pvpMatches.filter((m) => m.status !== 'declined' && m.status !== 'cancelled').map((m) => {
              const isChallenger = m.my_side === 'challenger'
              const opponentName = isChallenger ? m.opponent_gym_name : m.challenger_gym_name
              const myFighterName = isChallenger ? m.challenger_fighter_name : m.opponent_fighter_name
              const myGamePlan = isChallenger ? m.challenger_game_plan : m.opponent_game_plan
              const myHP = isChallenger ? m.challenger_hp : m.opponent_hp
              const oppHP = isChallenger ? m.opponent_hp : m.challenger_hp
              const won = m.winner_gym_id === (isChallenger ? m.challenger_gym_id : m.opponent_gym_id)
              const draw = m.status === 'finished' && m.winner_gym_id === null

              return (
                <div key={m.id} className="rounded border border-octagon-border/50 px-3 py-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">vs {opponentName}</p>
                    <span className="text-[10px] uppercase text-gray-500">{m.status}</span>
                  </div>

                  {/* Pending: menunggu respons */}
                  {m.status === 'pending' && isChallenger && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">Menunggu {opponentName} merespons tantanganmu...</p>
                      <button
                        onClick={() => handleCancel(m.id)}
                        disabled={pvpBusy === m.id}
                        className="rounded border border-octagon-border px-2.5 py-1 text-xs text-gray-400 hover:border-octagon-red hover:text-octagon-red"
                      >
                        Batalkan
                      </button>
                    </div>
                  )}

                  {/* Pending: aku ditantang */}
                  {m.status === 'pending' && !isChallenger && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">
                        {opponentName} menantang <span className="text-white">{m.challenger_fighter_name}</span>-nya melawan fighter pilihanmu.
                      </p>
                      {eligibleFighters.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={respondFighter[m.id] ?? eligibleFighters[0].id}
                            onChange={(e) => setRespondFighter((c) => ({ ...c, [m.id]: e.target.value }))}
                            className="rounded border border-octagon-border bg-octagon-dark px-2 py-1 text-xs text-white focus:border-octagon-amber focus:outline-none"
                          >
                            {eligibleFighters.map((fi) => (
                              <option key={fi.id} value={fi.id}>{fi.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleRespond(m.id, true)}
                            disabled={pvpBusy === m.id}
                            className="rounded bg-octagon-teal px-3 py-1 text-xs font-semibold text-octagon-dark hover:bg-octagon-teal/90"
                          >
                            Terima
                          </button>
                          <button
                            onClick={() => handleRespond(m.id, false)}
                            disabled={pvpBusy === m.id}
                            className="rounded border border-octagon-border px-3 py-1 text-xs text-gray-400 hover:border-octagon-red hover:text-octagon-red"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Gameplan: pilih game plan awal */}
                  {m.status === 'gameplan' && (
                    myGamePlan ? (
                      <p className="text-xs text-gray-400">Game plan dipilih ({GAME_PLAN_LABELS.find((g) => g.value === myGamePlan)?.label}). Menunggu {opponentName} memilih...</p>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs text-gray-400">Pilih game plan untuk {myFighterName}:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {GAME_PLAN_LABELS.map((g) => (
                            <button
                              key={g.value}
                              onClick={() => handleSetGamePlan(m.id, g.value)}
                              disabled={pvpBusy === m.id}
                              className="rounded border border-octagon-border px-2.5 py-1 text-xs text-gray-300 transition-colors hover:border-octagon-red hover:text-white"
                            >
                              {g.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  )}

                  {/* Active: laga berjalan */}
                  {m.status === 'active' && (
                    <div className="flex items-center justify-between text-xs">
                      <p className="text-gray-400">🔴 Ronde {m.current_round}/3 — {myFighterName} (HP {myHP}) vs {oppHP} HP</p>
                    </div>
                  )}

                  {/* Finished */}
                  {m.status === 'finished' && (
                    <p className={`text-xs font-semibold ${draw ? 'text-gray-400' : won ? 'text-octagon-teal' : 'text-octagon-red'}`}>
                      {draw ? '🤝 Seri' : won ? '🏆 Menang' : '💀 Kalah'}
                      {m.finish_method && m.finish_method !== 'decision' ? ` via ${m.finish_method.toUpperCase()}` : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
