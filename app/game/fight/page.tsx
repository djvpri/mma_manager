'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useGameStore } from '@/store/game-store'
import { simulateRound, calculateFightResult } from '@/lib/fight-engine'
import { getAICornerAdvice, getAINarration } from '@/lib/ai-corner'
import { generateOpponent } from '@/lib/generate-opponent'
import type { GamePlan, CornerAdvice } from '@/types'

const TOTAL_ROUNDS = 3

const GAME_PLANS: { value: GamePlan; label: string; desc: string }[] = [
  { value: 'pressure', label: 'Pressure', desc: 'Maju terus, tekan lawan ke pagar' },
  { value: 'counter', label: 'Counter', desc: 'Sabar, balas serangan lawan' },
  { value: 'grapple', label: 'Grapple', desc: 'Takedown dan kontrol di canvas' },
  { value: 'technical', label: 'Technical', desc: 'Jaga jarak, striking terukur' },
]

const CORNER_OPTIONS: { value: CornerAdvice; label: string; desc: string }[] = [
  { value: 'push', label: 'Push', desc: 'Tambah agresivitas striking' },
  { value: 'patient', label: 'Patient', desc: 'Jaga stamina, tetap stabil' },
  { value: 'takedown', label: 'Takedown', desc: 'Fokus bawa ke ground' },
  { value: 'striking', label: 'Striking', desc: 'Fokus pukulan jarak jauh' },
]

function HpBar({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{value}/100</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-octagon-dark">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function FightPage() {
  const fighters = useGameStore((s) => s.fighters)
  const fight = useGameStore((s) => s.fight)
  const setFightFighter = useGameStore((s) => s.setFightFighter)
  const setOpponent = useGameStore((s) => s.setOpponent)
  const setFightPhase = useGameStore((s) => s.setFightPhase)
  const setGamePlan = useGameStore((s) => s.setGamePlan)
  const setCornerAdvice = useGameStore((s) => s.setCornerAdvice)
  const addRoundResult = useGameStore((s) => s.addRoundResult)
  const setMyHP = useGameStore((s) => s.setMyHP)
  const setOppHP = useGameStore((s) => s.setOppHP)
  const setAiCornerText = useGameStore((s) => s.setAiCornerText)
  const setAiNarration = useGameStore((s) => s.setAiNarration)
  const setAiLoading = useGameStore((s) => s.setAiLoading)
  const advanceRound = useGameStore((s) => s.advanceRound)
  const resetFight = useGameStore((s) => s.resetFight)

  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(fight.fighter?.id ?? null)

  const eligibleFighters = fighters.filter((f) => f.status !== 'retired' && f.status !== 'injured')
  const currentRoundResult = fight.roundResults.find((r) => r.round === fight.currentRound)
  const isFightOver =
    !!currentRoundResult &&
    (!!currentRoundResult.finish || fight.myHP <= 0 || fight.oppHP <= 0 || fight.currentRound >= TOTAL_ROUNDS)

  // Ambil saran corner dari AI saat masuk fase istirahat antar ronde
  useEffect(() => {
    if (fight.phase === 'corner' && fight.fighter && fight.opponent && fight.gamePlan) {
      setAiLoading(true)
      getAICornerAdvice(
        fight.currentRound,
        fight.roundResults,
        fight.gamePlan,
        fight.fighter,
        fight.opponent.name,
        fight.opponent.specialty
      )
        .then(setAiCornerText)
        .finally(() => setAiLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fight.phase])

  function handleStartFight() {
    const fighter = eligibleFighters.find((f) => f.id === selectedFighterId)
    if (!fighter) return
    setFightFighter(fighter)
    setOpponent(generateOpponent(fighter))
    setFightPhase('gameplan')
  }

  function handleStartFighting() {
    if (!fight.gamePlan) return
    setFightPhase('fighting')
  }

  async function handleSimulateRound() {
    if (!fight.fighter || !fight.opponent || !fight.gamePlan) return
    setAiNarration('')
    setAiLoading(true)

    const result = simulateRound({
      myFighter: fight.fighter,
      opponent: { name: fight.opponent.name, attrs: fight.opponent.attrs, specialty: fight.opponent.specialty },
      gamePlan: fight.gamePlan,
      cornerAdvice: fight.cornerAdvice,
      roundNum: fight.currentRound,
    })

    const dmgToOpp = Math.round(result.my_pct * 0.25)
    const dmgToMe = Math.round(result.opp_pct * 0.25)
    const newMyHP = Math.max(0, fight.myHP - dmgToMe)
    const newOppHP = Math.max(0, fight.oppHP - dmgToOpp)
    setMyHP(newMyHP)
    setOppHP(newOppHP)

    const knockedOut = (newMyHP === 0 || newOppHP === 0) && !result.finish
    const final = knockedOut
      ? { ...result, winner: (newOppHP === 0 ? 'my' : 'opp') as 'my' | 'opp', finish: 'tko' as const }
      : result

    addRoundResult(final)

    const narration = await getAINarration(
      fight.currentRound,
      final,
      fight.fighter.name,
      fight.opponent.name,
      fight.gamePlan
    )
    setAiNarration(narration)
    setAiLoading(false)
  }

  function handleAfterRound() {
    setFightPhase(isFightOver ? 'result' : 'corner')
  }

  function handleNextRound(advice: CornerAdvice) {
    setCornerAdvice(advice)
    advanceRound()
    setFightPhase('fighting')
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Fight Night</h1>
        {fight.fighter && fight.opponent ? (
          <p className="text-sm text-gray-400">
            {fight.fighter.name} <span className="text-gray-600">vs</span> {fight.opponent.name}
          </p>
        ) : (
          <p className="text-sm text-gray-400">Pilih fighter untuk memulai pertarungan malam ini.</p>
        )}
      </header>

      {fight.phase === 'pregame' && (
        <div className="space-y-6">
          {eligibleFighters.length === 0 ? (
            <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-8 text-center">
              <p className="text-gray-400">Tidak ada fighter yang siap bertanding.</p>
              <Link href="/game/roster" className="mt-2 inline-block text-sm font-medium text-octagon-amber hover:underline">
                Cek Roster →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {eligibleFighters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFighterId(f.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    selectedFighterId === f.id
                      ? 'border-octagon-red bg-octagon-red/10'
                      : 'border-octagon-border bg-octagon-card hover:bg-white/5'
                  }`}
                >
                  <p className="font-semibold text-white">{f.name}</p>
                  <p className="text-xs text-gray-400">
                    {f.weight_class} · {f.specialty} · {f.record.w}-{f.record.l}-{f.record.d}
                  </p>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleStartFight}
            disabled={!selectedFighterId}
            className="rounded-md bg-octagon-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cari Lawan
          </button>
        </div>
      )}

      {fight.phase === 'gameplan' && fight.fighter && fight.opponent && (
        <div className="space-y-6">
          <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Lawan Ditemukan</p>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{fight.opponent.name}</p>
                <p className="text-xs text-gray-400">
                  {fight.opponent.specialty} · {fight.opponent.record.w}-{fight.opponent.record.l}-{fight.opponent.record.d}
                </p>
              </div>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: fight.opponent.color }} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-white">Pilih Game Plan</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {GAME_PLANS.map((gp) => (
                <button
                  key={gp.value}
                  onClick={() => setGamePlan(gp.value)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    fight.gamePlan === gp.value
                      ? 'border-octagon-red bg-octagon-red/10'
                      : 'border-octagon-border bg-octagon-card hover:bg-white/5'
                  }`}
                >
                  <p className="font-semibold text-white">{gp.label}</p>
                  <p className="text-xs text-gray-400">{gp.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartFighting}
            disabled={!fight.gamePlan}
            className="rounded-md bg-octagon-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mulai Pertarungan
          </button>
        </div>
      )}

      {fight.phase === 'fighting' && fight.fighter && fight.opponent && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-octagon-border bg-octagon-card p-4">
            <div>
              <p className="text-xs text-gray-500">Ronde</p>
              <p className="text-3xl font-bold text-white">
                {fight.currentRound} <span className="text-base font-normal text-gray-500">/ {TOTAL_ROUNDS}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Game Plan</p>
              <p className="font-semibold capitalize text-octagon-amber">{fight.gamePlan}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <p className="mb-2 truncate font-semibold text-white">{fight.fighter.name}</p>
              <HpBar label="HP" value={fight.myHP} colorClass="bg-octagon-teal" />
            </div>
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: fight.opponent.color }} />
                <p className="truncate font-semibold text-white">{fight.opponent.name}</p>
              </div>
              <HpBar label="HP" value={fight.oppHP} colorClass="bg-octagon-red" />
            </div>
          </div>

          {currentRoundResult ? (
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <p className="mb-2 text-sm font-semibold text-white">
                Ronde {currentRoundResult.round}:{' '}
                {currentRoundResult.winner === 'my' ? fight.fighter.name : fight.opponent.name} unggul (
                {currentRoundResult.my_pct}–{currentRoundResult.opp_pct})
              </p>
              <ul className="space-y-1 text-sm text-gray-300">
                {currentRoundResult.events.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
              {currentRoundResult.finish && (
                <p className="mt-2 text-sm font-bold uppercase text-octagon-red">
                  {currentRoundResult.finish}! Pertarungan selesai di ronde {currentRoundResult.round}.
                </p>
              )}
              {fight.aiLoading ? (
                <p className="mt-3 animate-pulse text-sm text-gray-500">Komentator sedang berbicara...</p>
              ) : fight.aiNarration ? (
                <p className="mt-3 rounded-md bg-octagon-dark p-3 text-sm italic text-gray-300">
                  &ldquo;{fight.aiNarration}&rdquo;
                </p>
              ) : null}

              <button
                onClick={handleAfterRound}
                disabled={fight.aiLoading}
                className="mt-4 rounded-md bg-octagon-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isFightOver ? 'Lihat Hasil' : 'Lanjut ke Corner'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleSimulateRound}
              disabled={fight.aiLoading}
              className="rounded-md bg-octagon-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {fight.aiLoading ? 'Mensimulasikan...' : `Mulai Ronde ${fight.currentRound}`}
            </button>
          )}

          {fight.roundResults.length > 1 && (
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Riwayat Ronde</p>
              <div className="space-y-1.5">
                {fight.roundResults.map((r) => (
                  <div key={r.round} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Ronde {r.round}</span>
                    <span className="text-gray-200">
                      {r.my_pct}–{r.opp_pct}
                    </span>
                    <span className={r.winner === 'my' ? 'text-octagon-teal' : 'text-octagon-red'}>
                      {r.winner === 'my' ? fight.fighter!.name.split(' ')[0] : fight.opponent!.name.split(' ')[0]}
                      {r.finish ? ` (${r.finish.toUpperCase()})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {fight.phase === 'corner' && fight.fighter && fight.opponent && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <p className="mb-2 truncate font-semibold text-white">{fight.fighter.name}</p>
              <HpBar label="HP" value={fight.myHP} colorClass="bg-octagon-teal" />
            </div>
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: fight.opponent.color }} />
                <p className="truncate font-semibold text-white">{fight.opponent.name}</p>
              </div>
              <HpBar label="HP" value={fight.oppHP} colorClass="bg-octagon-red" />
            </div>
          </div>

          <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Saran Corner</p>
            {fight.aiLoading ? (
              <p className="animate-pulse text-sm text-gray-500">Corner sedang memberi instruksi...</p>
            ) : (
              <p className="text-sm italic text-octagon-amber">&ldquo;{fight.aiCornerText}&rdquo;</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-white">
              Pilih instruksi untuk Ronde {fight.currentRound + 1}:
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CORNER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleNextRound(opt.value)}
                  className="rounded-lg border border-octagon-border bg-octagon-card p-3 text-left transition-colors hover:border-octagon-red/40 hover:bg-octagon-red/10"
                >
                  <p className="font-semibold text-white">{opt.label}</p>
                  <p className="text-xs text-gray-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {fight.phase === 'result' && fight.fighter && fight.opponent && (() => {
        const result = calculateFightResult(fight.roundResults)
        const won = result.winner === 'my'
        return (
          <div className="space-y-6 text-center">
            <div
              className={`rounded-lg border p-8 ${
                result.winner === 'draw'
                  ? 'border-octagon-amber/40 bg-octagon-amber/10'
                  : won
                    ? 'border-octagon-teal/40 bg-octagon-teal/10'
                    : 'border-octagon-red/40 bg-octagon-red/10'
              }`}
            >
              <p className="text-sm uppercase tracking-widest text-gray-400">
                {result.winner === 'draw' ? 'Hasil Imbang' : won ? 'Kemenangan!' : 'Kekalahan'}
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {fight.fighter!.name} vs {fight.opponent!.name}
              </p>
              <p className="mt-2 text-gray-300">
                Metode: <span className="font-semibold">{result.method.toUpperCase()}</span>
                {result.scorecard && ` · Scorecard ${result.scorecard}`}
              </p>
            </div>

            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4 text-left">
              <p className="mb-3 text-xs font-semibold uppercase text-gray-500">Ringkasan Ronde</p>
              <div className="space-y-2">
                {fight.roundResults.map((r) => (
                  <div key={r.round} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Ronde {r.round}</span>
                    <span className="text-gray-200">
                      {r.my_pct}–{r.opp_pct}
                    </span>
                    <span className={r.winner === 'my' ? 'text-octagon-teal' : 'text-octagon-red'}>
                      {r.winner === 'my' ? fight.fighter!.name.split(' ')[0] : fight.opponent!.name.split(' ')[0]}
                      {r.finish ? ` (${r.finish.toUpperCase()})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={resetFight}
                className="rounded-md bg-octagon-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90"
              >
                Pertarungan Baru
              </button>
              <Link
                href="/game/roster"
                className="rounded-md border border-octagon-border px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5"
              >
                Kembali ke Roster
              </Link>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
