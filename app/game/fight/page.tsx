'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useGameStore } from '@/store/game-store'
import { simulateRound, calculateFightResult, rollInjury } from '@/lib/fight-engine'
import { getAICornerAdvice, getAINarration } from '@/lib/ai-corner'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/format'
import { syncLeaderboard } from '@/lib/leaderboard'
import type { Fighter, FighterAttrs, GamePlan, CornerAdvice, Specialty } from '@/types'

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

const OPPONENT_NAMES = [
  'Rizky Maulana', 'Carlos Medina', 'Kenji Watanabe', 'Andre Oliveira',
  'Yusuf Hidayat', 'Marco Bianchi', 'Dimas Pratama', 'Viktor Volkov',
  'Hassan Al-Rashid', 'Tomás Reyes',
]
const OPPONENT_COLORS = ['#3B82F6', '#A855F7', '#F59E0B', '#06B6D4', '#EC4899']
const SPECIALTIES: Specialty[] = ['Striker', 'Grappler', 'All-rounder', 'Counter Fighter', 'Wrestler']

type Opponent = {
  name: string
  attrs: FighterAttrs
  record: Fighter['record']
  specialty: string
  color: string
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateOpponent(myFighter: Fighter): Opponent {
  const avg =
    (myFighter.attrs.striking +
      myFighter.attrs.grappling +
      myFighter.attrs.cardio +
      myFighter.attrs.fight_iq +
      myFighter.attrs.mental) /
    5
  const roll = () => Math.max(35, Math.min(95, Math.round(avg + randInt(-12, 12))))

  return {
    name: OPPONENT_NAMES[randInt(0, OPPONENT_NAMES.length - 1)],
    attrs: {
      striking: roll(),
      grappling: roll(),
      cardio: roll(),
      fight_iq: roll(),
      mental: roll(),
    },
    record: { w: randInt(3, 18), l: randInt(0, 8), d: 0 },
    specialty: SPECIALTIES[randInt(0, SPECIALTIES.length - 1)],
    color: OPPONENT_COLORS[randInt(0, OPPONENT_COLORS.length - 1)],
  }
}

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
  const gym = useGameStore((s) => s.gym)
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
  const setFightResultSummary = useGameStore((s) => s.setFightResultSummary)
  const setGym = useGameStore((s) => s.setGym)
  const updateFighter = useGameStore((s) => s.updateFighter)
  const advanceRound = useGameStore((s) => s.advanceRound)
  const resetFight = useGameStore((s) => s.resetFight)

  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(fight.fighter?.id ?? null)
  const [savingResult, setSavingResult] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const seasonWeek = gym?.season_week ?? 1
  const notRetiredOrInjured = fighters.filter((f) => f.status !== 'retired' && f.status !== 'injured')
  const eligibleFighters = notRetiredOrInjured.filter(
    (f) => f.next_fight_week === null || f.next_fight_week <= seasonWeek
  )
  const cooldownFighters = notRetiredOrInjured.filter(
    (f) => f.next_fight_week !== null && f.next_fight_week > seasonWeek
  )
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

  // Simpan hasil pertarungan ke database saat masuk fase result
  useEffect(() => {
    if (fight.phase === 'result' && fight.fighter && fight.opponent && gym && !fight.resultSaved) {
      saveFightResult()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fight.phase])

  async function saveFightResult() {
    const fighter = fight.fighter
    const opponent = fight.opponent
    if (!fighter || !opponent || !gym || !fight.gamePlan) return

    setSavingResult(true)
    setSaveError(null)

    const result = calculateFightResult(fight.roundResults)
    const isFinish = result.method !== 'decision'

    const supabase = createClient()
    const { data: staffData } = await supabase
      .from('staff')
      .select('specialty')
      .eq('gym_id', gym.id)
      .eq('is_hired', true)
    const specialties = (staffData ?? []).map((s) => s.specialty)

    let purse = 3_000_000
    let reputationChange = 0
    if (result.winner === 'my') {
      purse = isFinish ? 8_000_000 : 5_000_000
      reputationChange = isFinish ? 5 : 3
    } else if (result.winner === 'opp') {
      purse = 2_000_000
      reputationChange = isFinish ? -4 : -2
    }

    // Manajer Pertarungan: negosiasi purse lebih baik
    if (specialties.includes('Matchmaking & Promosi')) {
      purse = Math.round((purse * 1.15) / 100_000) * 100_000
    }

    const newRecord = {
      w: fighter.record.w + (result.winner === 'my' ? 1 : 0),
      l: fighter.record.l + (result.winner === 'opp' ? 1 : 0),
      d: fighter.record.d + (result.winner === 'draw' ? 1 : 0),
    }
    const newTrainingLoad = Math.min(100, fighter.training_load + 25)
    const newContractFightsLeft = Math.max(0, fighter.contract_fights_left - 1)
    const newNextFightWeek = gym.season_week + randInt(1, 3)
    const newBalance = gym.balance + purse
    const newReputation = Math.max(0, Math.min(100, gym.reputation + reputationChange))
    const finishRound = fight.roundResults.find((r) => r.finish)?.round ?? null
    // Fisioterapis: kurangi risiko cedera pasca-tanding
    const injuryReduction = specialties.includes('Pemulihan Cedera') ? 0.3 : 0
    const injury = rollInjury(result.winner, isFinish, injuryReduction)

    const [insertRes, fighterRes, gymRes] = await Promise.all([
      supabase.from('fight_results').insert({
        gym_id: gym.id,
        fighter_id: fighter.id,
        opponent_name: opponent.name,
        opponent_record: opponent.record,
        round_results: fight.roundResults,
        overall_winner: result.winner,
        finish_method: result.method,
        finish_round: finishRound,
        scorecard: result.scorecard || null,
        game_plan_used: fight.gamePlan,
      }),
      supabase
        .from('fighters')
        .update({
          record: newRecord,
          training_load: newTrainingLoad,
          contract_fights_left: newContractFightsLeft,
          next_fight_week: newNextFightWeek,
          ...(injury
            ? { status: 'injured', injury: injury.name, injury_weeks_left: injury.weeks }
            : {}),
        })
        .eq('id', fighter.id)
        .select()
        .single(),
      supabase
        .from('gyms')
        .update({ balance: newBalance, reputation: newReputation })
        .eq('id', gym.id)
        .select()
        .single(),
    ])

    if (insertRes.error || fighterRes.error || gymRes.error) {
      setSaveError(
        insertRes.error?.message || fighterRes.error?.message || gymRes.error?.message || 'Gagal menyimpan hasil pertarungan.'
      )
    } else {
      if (fighterRes.data) updateFighter(fighter.id, fighterRes.data)
      if (gymRes.data) setGym(gymRes.data)

      const state = useGameStore.getState()
      if (state.gym) syncLeaderboard(state.gym, state.fighters)
    }

    setFightResultSummary(purse, reputationChange, newRecord, injury)
    setSavingResult(false)
  }

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
              {cooldownFighters.length === 0 && (
                <Link href="/game/roster" className="mt-2 inline-block text-sm font-medium text-octagon-amber hover:underline">
                  Cek Roster →
                </Link>
              )}
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

          {eligibleFighters.length > 0 && (
            <button
              onClick={handleStartFight}
              disabled={!selectedFighterId}
              className="rounded-md bg-octagon-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cari Lawan
            </button>
          )}

          {cooldownFighters.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Masih Pemulihan</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {cooldownFighters.map((f) => (
                  <div key={f.id} className="rounded-lg border border-octagon-border bg-octagon-card/50 p-4 opacity-70">
                    <p className="font-semibold text-white">{f.name}</p>
                    <p className="text-xs text-gray-400">
                      {f.weight_class} · {f.specialty} · {f.record.w}-{f.record.l}-{f.record.d}
                    </p>
                    <p className="mt-1 text-xs text-octagon-amber">
                      Siap bertanding minggu ke-{f.next_fight_week}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
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

            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4 text-left">
              <p className="mb-3 text-xs font-semibold uppercase text-gray-500">Dampak Pertarungan</p>
              {savingResult ? (
                <p className="animate-pulse text-sm text-gray-500">Menyimpan hasil pertarungan...</p>
              ) : saveError ? (
                <p className="text-sm text-octagon-red">Gagal menyimpan hasil: {saveError}</p>
              ) : fight.fightSummary ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Purse</span>
                    <span className="font-semibold text-octagon-amber">
                      +{formatCurrency(fight.fightSummary.purse)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Reputasi Gym</span>
                    <span
                      className={`font-semibold ${
                        fight.fightSummary.reputationChange > 0
                          ? 'text-octagon-teal'
                          : fight.fightSummary.reputationChange < 0
                            ? 'text-octagon-red'
                            : 'text-gray-300'
                      }`}
                    >
                      {fight.fightSummary.reputationChange > 0 ? '+' : ''}
                      {fight.fightSummary.reputationChange}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Rekor {fight.fighter!.name.split(' ')[0]}</span>
                    <span className="font-semibold text-white">
                      {fight.fightSummary.newRecord.w}-{fight.fightSummary.newRecord.l}-{fight.fightSummary.newRecord.d}
                    </span>
                  </div>
                  {fight.fightSummary.injury && (
                    <div className="mt-2 rounded-md bg-octagon-red/10 px-3 py-2 text-octagon-red">
                      ⚠ {fight.fighter!.name.split(' ')[0]} mengalami {fight.fightSummary.injury.name} — pulih
                      dalam {fight.fightSummary.injury.weeks} minggu.
                    </div>
                  )}
                </div>
              ) : null}
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
