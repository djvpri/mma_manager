'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  fetchPvpMatch,
  subscribeToPvpMatch,
  submitPvpCorner,
  resolvePvpRound,
  type PvpMatch,
} from '@/lib/pvp'
import type { CornerAdvice, RoundResult } from '@/types'

const CORNER_OPTIONS: { value: CornerAdvice; label: string; desc: string }[] = [
  { value: 'push', label: 'Push', desc: 'Tambah agresivitas striking' },
  { value: 'patient', label: 'Patient', desc: 'Jaga stamina, tetap stabil' },
  { value: 'takedown', label: 'Takedown', desc: 'Fokus bawa ke ground' },
  { value: 'striking', label: 'Striking', desc: 'Fokus pukulan jarak jauh' },
  { value: 'survive', label: 'Survive', desc: 'Bertahan total, pulihkan stamina & mental' },
  { value: 'allout', label: 'All-Out', desc: 'Habis-habisan kejar finish, defense jadi taruhan' },
]

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-octagon-dark">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

/** RoundResult tersimpan dari sudut pandang challenger ("my"=challenger).
 *  Untuk pemain di sisi opponent, flip sudut pandangnya. */
function myView(r: RoundResult, isChallenger: boolean) {
  if (isChallenger) {
    return { myPct: r.my_pct, oppPct: r.opp_pct, won: r.winner === 'my', myScore: r.my_round_score, oppScore: r.opp_round_score }
  }
  return { myPct: r.opp_pct, oppPct: r.my_pct, won: r.winner === 'opp', myScore: r.opp_round_score, oppScore: r.my_round_score }
}

export default function PvpFightPage() {
  const params = useParams<{ matchId: string }>()
  const router = useRouter()
  const matchId = params.matchId

  const [match, setMatch] = useState<PvpMatch | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setMatch(await fetchPvpMatch(matchId))
  }, [matchId])

  useEffect(() => {
    refresh()
    const unsub = subscribeToPvpMatch(matchId, (raw) => {
      setMatch((prev) => (prev ? ({ ...prev, ...raw } as PvpMatch) : prev))
    })
    return unsub
  }, [matchId, refresh])

  // Begitu kedua corner advice terisi & status masih active, minta server
  // menghitung ronde. Idempotent — aman dipanggil dari kedua sisi, panggilan
  // kedua otomatis no-op. Refresh manual setelahnya sebagai fallback kalau
  // event realtime tidak sampai.
  useEffect(() => {
    if (!match) return
    if (match.status === 'active' && match.challenger_corner && match.opponent_corner) {
      resolvePvpRound(matchId).then(({ error }) => {
        if (error) setError(error)
        refresh()
      })
    }
  }, [match?.challenger_corner, match?.opponent_corner, match?.status, matchId, refresh])

  if (!match) return <p className="text-sm text-gray-400">Memuat laga...</p>

  const isChallenger = match.my_side === 'challenger'
  const myName = (isChallenger ? match.challenger_fighter_name : match.opponent_fighter_name) ?? 'Fighter-mu'
  const oppName = (isChallenger ? match.opponent_fighter_name : match.challenger_fighter_name) ?? 'Lawan'
  const opponentGymName = isChallenger ? match.opponent_gym_name : match.challenger_gym_name
  const myHP = isChallenger ? match.challenger_hp : match.opponent_hp
  const oppHP = isChallenger ? match.opponent_hp : match.challenger_hp
  const myStamina = isChallenger ? match.challenger_stamina : match.opponent_stamina
  const oppStamina = isChallenger ? match.opponent_stamina : match.challenger_stamina
  const myMental = isChallenger ? match.challenger_mental : match.opponent_mental
  const oppMental = isChallenger ? match.opponent_mental : match.challenger_mental
  const myCorner = isChallenger ? match.challenger_corner : match.opponent_corner
  const oppCorner = isChallenger ? match.opponent_corner : match.challenger_corner

  const won = match.status === 'finished' && match.winner_gym_id === (isChallenger ? match.challenger_gym_id : match.opponent_gym_id)
  const draw = match.status === 'finished' && match.winner_gym_id === null

  async function handleCorner(c: CornerAdvice) {
    setError(null)
    setBusy(true)
    const { error } = await submitPvpCorner(matchId, c)
    if (error) setError(error)
    setBusy(false)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">⚔️ {myName} vs {oppName}</h1>
        <p className="text-sm text-gray-400">
          {opponentGymName} {match.status === 'finished' ? '· Selesai' : `· Ronde ${match.current_round}/3`}
        </p>
      </header>

      {error && <p className="rounded-md border border-octagon-red/30 bg-octagon-red/5 p-2 text-xs text-octagon-red">{error}</p>}

      {/* Vitals */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-octagon-border bg-octagon-card p-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">{myName} (kamu)</p>
          <div>
            <p className="mb-0.5 text-[10px] text-gray-500">HP {myHP}</p>
            <Bar value={myHP} color="bg-octagon-teal" />
          </div>
          <div>
            <p className="mb-0.5 text-[10px] text-gray-500">Stamina {myStamina}</p>
            <Bar value={myStamina} color="bg-octagon-amber" />
          </div>
          <div>
            <p className="mb-0.5 text-[10px] text-gray-500">Mental {myMental}</p>
            <Bar value={myMental} color="bg-octagon-red/70" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <p className="text-sm font-semibold text-white">{oppName}</p>
          <div>
            <p className="mb-0.5 text-[10px] text-gray-500">HP {oppHP}</p>
            <Bar value={oppHP} color="bg-octagon-teal" />
          </div>
          <div>
            <p className="mb-0.5 text-[10px] text-gray-500">Stamina {oppStamina}</p>
            <Bar value={oppStamina} color="bg-octagon-amber" />
          </div>
          <div>
            <p className="mb-0.5 text-[10px] text-gray-500">Mental {oppMental}</p>
            <Bar value={oppMental} color="bg-octagon-red/70" />
          </div>
        </div>
      </div>

      {/* Hasil akhir */}
      {match.status === 'finished' && (
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4 text-center">
          <p className={`text-2xl font-bold ${draw ? 'text-gray-300' : won ? 'text-octagon-teal' : 'text-octagon-red'}`}>
            {draw ? '🤝 SERI' : won ? '🏆 MENANG!' : '💀 KALAH'}
          </p>
          {match.finish_method && (
            <p className="mt-1 text-sm text-gray-400">Metode: {match.finish_method.toUpperCase()}</p>
          )}
          <button
            onClick={() => router.push('/game/social')}
            className="mt-4 rounded-md bg-octagon-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90"
          >
            Kembali ke Sosial
          </button>
        </div>
      )}

      {/* Corner advice picker */}
      {match.status === 'active' && (
        myCorner ? (
          <div className="rounded-lg border border-octagon-border bg-octagon-card p-4 text-center">
            <p className="text-sm text-gray-300">
              ✅ Instruksimu: <span className="font-semibold text-white">{CORNER_OPTIONS.find((c) => c.value === myCorner)?.label}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {oppCorner ? '⏳ Menghitung hasil ronde...' : `Menunggu ${opponentGymName} memberi instruksi...`}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
            <p className="mb-3 text-sm font-semibold text-white">Pilih instruksi untuk Ronde {match.current_round}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CORNER_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => handleCorner(c.value)}
                  disabled={busy}
                  className="rounded-md border border-octagon-border bg-octagon-dark p-2.5 text-left transition-colors hover:border-octagon-red/40 hover:bg-octagon-red/5 disabled:opacity-50"
                >
                  <p className="text-xs font-semibold text-white">{c.label}</p>
                  <p className="text-[10px] text-gray-500">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* Riwayat ronde */}
      {match.round_results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Riwayat Ronde</p>
          {match.round_results.map((r, i) => {
            const v = myView(r, isChallenger)
            return (
              <div key={i} className="rounded-lg border border-octagon-border bg-octagon-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Ronde {r.round}</p>
                  <span className={`text-xs font-semibold ${v.won ? 'text-octagon-teal' : 'text-octagon-red'}`}>
                    {v.won ? 'Menang' : 'Kalah'} Ronde {v.myScore ?? '-'}-{v.oppScore ?? '-'}
                    {r.finish ? ` (${r.finish.toUpperCase()})` : ''}
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-gray-300">
                  {r.events.map((line, j) => (
                    <li key={j}>• {line}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
