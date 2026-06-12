'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Avatar from '@/components/avatar/Avatar'
import { useGameStore } from '@/store/game-store'
import {
  simulateRound,
  calculateFightResult,
  rollInjury,
  generateClosingLine,
  aggregateTickStats,
  emptyFightStats,
  sumFightStats,
} from '@/lib/fight-engine'
import { getAICornerAdvice } from '@/lib/ai-corner'
import { getPreFightInterview } from '@/lib/ai-interview'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatNumber } from '@/lib/format'
import { syncLeaderboard } from '@/lib/leaderboard'
import { isTitleFight, resolveTitleFight } from '@/lib/championship'
import { ATTR_GROUPS, ALL_ATTR_KEYS } from '@/lib/attrs'
import { EVENT_TIER_CONFIG, EVENT_TIER_BADGE_CLASS } from '@/lib/generate-events'
import type { Fighter, FighterAttrs, GamePlan, CornerAdvice, Specialty, RoundResult, RoundTick, FightStats, EventTier } from '@/types'

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

const ROUND_DURATION_SEC = 5 * 60

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function generateOpponent(myFighter: Fighter, tier: EventTier): Opponent {
  const config = EVENT_TIER_CONFIG[tier]
  const avg = ALL_ATTR_KEYS.reduce((sum, key) => sum + myFighter.attrs[key], 0) / ALL_ATTR_KEYS.length
  const roll = () =>
    Math.max(35, Math.min(95, Math.round(avg + config.attrOffset + randInt(-config.attrSpread, config.attrSpread))))
  const { wMin, wMax, lMin, lMax } = config.recordRange

  return {
    name: OPPONENT_NAMES[randInt(0, OPPONENT_NAMES.length - 1)],
    attrs: Object.fromEntries(ALL_ATTR_KEYS.map((key) => [key, roll()])) as unknown as FighterAttrs,
    record: { w: randInt(wMin, wMax), l: randInt(lMin, lMax), d: 0 },
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
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function FighterPortrait({
  imageUrl,
  ringColor,
  size = 40,
}: {
  imageUrl?: string | null
  ringColor: string
  size?: number
}) {
  return (
    <div className="shrink-0 overflow-hidden rounded-full bg-octagon-dark" style={{ boxShadow: `0 0 0 2px ${ringColor}` }}>
      <Avatar imageUrl={imageUrl} size={size} className="block" />
    </div>
  )
}

function RoundSplitBar({
  myPct,
  oppPct,
  myLabel,
  oppLabel,
  oppColor,
  compact = false,
}: {
  myPct: number
  oppPct: number
  myLabel?: string
  oppLabel?: string
  oppColor: string
  compact?: boolean
}) {
  return (
    <div>
      {!compact && (
        <div className="mb-1 flex justify-between text-xs font-semibold">
          <span className="text-octagon-teal">{myLabel} · {myPct}</span>
          <span style={{ color: oppColor }}>{oppPct} · {oppLabel}</span>
        </div>
      )}
      <div className={`flex w-full overflow-hidden rounded-full bg-octagon-dark ${compact ? 'h-1.5' : 'h-2'}`}>
        <div className="h-full bg-octagon-teal transition-all duration-500" style={{ width: `${myPct}%` }} />
        <div className="h-full transition-all duration-500" style={{ width: `${oppPct}%`, backgroundColor: oppColor }} />
      </div>
    </div>
  )
}

function AttrCompareBar({
  label,
  myVal,
  oppVal,
  oppColor,
}: {
  label: string
  myVal: number
  oppVal: number
  oppColor: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-octagon-teal">{myVal}</span>
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold" style={{ color: oppColor }}>{oppVal}</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-octagon-dark">
          <div className="ml-auto h-full rounded-full bg-octagon-teal" style={{ width: `${myVal}%` }} />
        </div>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-octagon-dark">
          <div className="h-full rounded-full" style={{ width: `${oppVal}%`, backgroundColor: oppColor }} />
        </div>
      </div>
    </div>
  )
}

function landedPct(landed: number, attempted: number): number {
  return attempted > 0 ? Math.round((landed / attempted) * 100) : 0
}

function formatControlTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')} Mins`
}

function FightStatRow({
  label,
  myVal,
  oppVal,
  oppColor,
}: {
  label: string
  myVal: string
  oppVal: string
  oppColor: string
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-octagon-border py-1.5 text-xs last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className="w-20 text-right font-semibold text-octagon-teal">{myVal}</span>
      <span className="w-20 text-right font-semibold" style={{ color: oppColor }}>{oppVal}</span>
    </div>
  )
}

function FightStatsTable({
  myStats,
  oppStats,
  myLabel,
  oppLabel,
  oppColor,
}: {
  myStats: FightStats
  oppStats: FightStats
  myLabel: string
  oppLabel: string
  oppColor: string
}) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 pb-1.5 text-[10px] uppercase tracking-wide text-gray-600">
        <span></span>
        <span className="w-20 text-right">{myLabel}</span>
        <span className="w-20 text-right">{oppLabel}</span>
      </div>
      <FightStatRow
        label="Knockdowns"
        myVal={`${myStats.knockdowns}`}
        oppVal={`${oppStats.knockdowns}`}
        oppColor={oppColor}
      />
      <FightStatRow
        label="Sig. Strikes Landed"
        myVal={`${myStats.sigStrikesLanded}/${myStats.sigStrikesAttempted} (${landedPct(myStats.sigStrikesLanded, myStats.sigStrikesAttempted)}%)`}
        oppVal={`${oppStats.sigStrikesLanded}/${oppStats.sigStrikesAttempted} (${landedPct(oppStats.sigStrikesLanded, oppStats.sigStrikesAttempted)}%)`}
        oppColor={oppColor}
      />
      <FightStatRow
        label="Head/Body/Leg"
        myVal={`${myStats.strikesHead}/${myStats.strikesBody}/${myStats.strikesLeg}`}
        oppVal={`${oppStats.strikesHead}/${oppStats.strikesBody}/${oppStats.strikesLeg}`}
        oppColor={oppColor}
      />
      <FightStatRow
        label="Takedowns"
        myVal={`${myStats.takedownsLanded}/${myStats.takedownsAttempted} (${landedPct(myStats.takedownsLanded, myStats.takedownsAttempted)}%)`}
        oppVal={`${oppStats.takedownsLanded}/${oppStats.takedownsAttempted} (${landedPct(oppStats.takedownsLanded, oppStats.takedownsAttempted)}%)`}
        oppColor={oppColor}
      />
      <FightStatRow
        label="Control Time"
        myVal={formatControlTime(myStats.controlSec)}
        oppVal={formatControlTime(oppStats.controlSec)}
        oppColor={oppColor}
      />
    </div>
  )
}

function OctagonBackground() {
  return (
    <svg
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-[0.04]"
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <polygon
        points="120,20 280,20 380,120 380,280 280,380 120,380 20,280 20,120"
        fill="none"
        stroke="#E24B4A"
        strokeWidth="2"
      />
      <polygon
        points="160,60 240,60 340,160 340,240 240,340 160,340 60,240 60,160"
        fill="none"
        stroke="#E24B4A"
        strokeWidth="1"
      />
    </svg>
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
  const setFightVitals = useGameStore((s) => s.setFightVitals)
  const setAiCornerText = useGameStore((s) => s.setAiCornerText)
  const setAiNarration = useGameStore((s) => s.setAiNarration)
  const setAiLoading = useGameStore((s) => s.setAiLoading)
  const setFightResultSummary = useGameStore((s) => s.setFightResultSummary)
  const setGym = useGameStore((s) => s.setGym)
  const updateFighter = useGameStore((s) => s.updateFighter)
  const advanceRound = useGameStore((s) => s.advanceRound)
  const resetFight = useGameStore((s) => s.resetFight)

  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(fight.fighter?.id ?? null)
  const [interviewText, setInterviewText] = useState<string | null>(null)
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [savingResult, setSavingResult] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [flashMy, setFlashMy] = useState(false)
  const [flashOpp, setFlashOpp] = useState(false)
  const [animation, setAnimation] = useState<{
    ticks: RoundTick[]
    index: number
    feed: string[]
    final: RoundResult
    isFightOver: boolean
    newVitals: { myStamina: number; oppStamina: number; myMental: number; oppMental: number }
  } | null>(null)
  const [roundClock, setRoundClock] = useState(ROUND_DURATION_SEC)

  const seasonWeek = gym?.season_week ?? 1
  // Ambil semua event minggu ini (bisa lebih dari satu untuk weight class berbeda)
  const todaysEvents = gym?.events.filter((e) => e.week === seasonWeek) ?? []
  const todaysEvent  = todaysEvents[0] ?? null // backward compat untuk saveFightResult
  const notRetiredOrInjured = fighters.filter((f) => f.status !== 'retired' && f.status !== 'injured')
  const cooldownReady = notRetiredOrInjured.filter(
    (f) => f.next_fight_week === null || f.next_fight_week <= seasonWeek
  )
  const cooldownFighters = notRetiredOrInjured.filter(
    (f) => f.next_fight_week !== null && f.next_fight_week > seasonWeek
  )
  // Fighter yang terdaftar di salah satu event minggu ini (via slots)
  const registeredThisWeek = todaysEvents.flatMap((e) =>
    (e.slots ?? []).filter((s) => s.fighter_id !== null).map((s) => s.fighter_id!)
  )
  const eligibleFighters = cooldownReady.filter((f) => registeredThisWeek.includes(f.id))
  const unscheduledFighters = cooldownReady.filter((f) => !registeredThisWeek.includes(f.id))

  // Wawancara pra-pertandingan: hanya untuk fighter terpilih di event tier nasional/internasional
  const selectedFighter = eligibleFighters.find((f) => f.id === selectedFighterId) ?? null
  const selectedSlot = selectedFighter
    ? todaysEvents.flatMap((e) => e.slots ?? []).find((s) => s.fighter_id === selectedFighter.id)
    : null
  const showInterview =
    (todaysEvent?.tier === 'national' || todaysEvent?.tier === 'international') &&
    !!selectedFighter && !!selectedSlot?.opponent
  const currentRoundResult = fight.roundResults.find((r) => r.round === fight.currentRound)
  const isFightOver =
    !!currentRoundResult &&
    (!!currentRoundResult.finish || fight.myHP <= 0 || fight.oppHP <= 0 || fight.currentRound >= TOTAL_ROUNDS)
  const liveTicks = currentRoundResult
    ? currentRoundResult.ticks ?? []
    : animation
      ? animation.ticks.slice(0, animation.index)
      : []
  const { my: liveMyStats, opp: liveOppStats } = aggregateTickStats(liveTicks)

  // Reset wawancara pra-pertandingan saat ganti fighter terpilih
  useEffect(() => {
    setInterviewText(null)
  }, [selectedFighterId])

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
    // Cari event & slot fighter ini
    const event = gym.events.find((e) => (e.slots ?? []).some((s) => s.fighter_id === fighter.id)) ?? null
    const slot  = event?.slots?.find((s) => s.fighter_id === fighter.id) ?? null
    const tierConfig = EVENT_TIER_CONFIG[event?.tier ?? 'regional']
    const slotPurseMult = slot?.purse_mult ?? 1.0

    const supabase = createClient()
    const [staffRes, sponsorRes] = await Promise.all([
      supabase.from('staff').select('specialty').eq('gym_id', gym.id).eq('is_hired', true),
      supabase.from('sponsor_contracts').select('id, win_bonus, satisfaction').eq('gym_id', gym.id).eq('status', 'active'),
    ])
    const specialties = (staffRes.data ?? []).map((s) => s.specialty)
    const activeSponsors = sponsorRes.data ?? []

    let purse = 3_000_000
    let reputationChange = 0
    if (result.winner === 'my') {
      purse = isFinish ? 8_000_000 : 5_000_000
      reputationChange = isFinish ? 5 : 3
    } else if (result.winner === 'opp') {
      purse = 2_000_000
      reputationChange = isFinish ? -4 : -2
    }

    // Multiplier sesuai tier event (Lokal/Regional/Nasional)
    purse = Math.round((purse * tierConfig.purseMult * slotPurseMult) / 100_000) * 100_000
    reputationChange = Math.round(reputationChange * tierConfig.reputationMult)

    // Manajer Pertarungan: negosiasi purse lebih baik
    if (specialties.includes('Matchmaking & Promosi')) {
      purse = Math.round((purse * 1.15) / 100_000) * 100_000
    }

    // Komisi Promotor: potongan 10-20% dari purse, naik seiring reputasi gym
    const commissionRate = 0.1 + (gym.reputation / 100) * 0.1
    const commission = Math.round((purse * commissionRate) / 100_000) * 100_000

    // Bagi Hasil Purse: persentase purse yang jadi hak fighter sesuai kontrak
    const purseShare = Math.round((purse * fighter.purse_share_pct) / 100 / 100_000) * 100_000

    const newRecord = {
      w: fighter.record.w + (result.winner === 'my' ? 1 : 0),
      l: fighter.record.l + (result.winner === 'opp' ? 1 : 0),
      d: fighter.record.d + (result.winner === 'draw' ? 1 : 0),
    }
    const newTrainingLoad = Math.min(100, fighter.training_load + 25)
    const newContractFightsLeft = Math.max(0, fighter.contract_fights_left - 1)
    const newNextFightWeek = gym.season_week + randInt(1, 3)
    const finishRound = fight.roundResults.find((r) => r.finish)?.round ?? null
    // Fisioterapis: kurangi risiko cedera pasca-tanding
    const injuryReduction = specialties.includes('Pemulihan Cedera') ? 0.3 : 0
    const injury = rollInjury(result.winner, isFinish, injuryReduction)

    // Win bonus dibayar ke fighter (mengurangi balance gym) tiap kali menang
    const winBonusPaid = result.winner === 'my' ? fighter.win_bonus : 0
    const newWinStreak = result.winner === 'my' ? fighter.win_streak + 1 : 0
    const titleShotTriggered =
      fighter.title_shot_clause && !fighter.title_shot_pending && newWinStreak >= 3

    let reputationBonus = 0
    if (titleShotTriggered) {
      reputationBonus = 8
    }

    // Biaya Medis: upkeep cost saat fighter cedera, didiskon Fisioterapis
    const medicalDiscount = specialties.includes('Pemulihan Cedera') ? 0.3 : 0
    const medicalCost = injury ? Math.round(injury.weeks * 1_000_000 * (1 - medicalDiscount)) : 0

    // Morale: naik saat menang/dapat win bonus/title shot, turun saat kalah/cedera
    let moraleChange = 0
    if (result.winner === 'my') {
      moraleChange += isFinish ? 5 : 3
      if (winBonusPaid > 0) moraleChange += 2
    } else if (result.winner === 'opp') {
      moraleChange -= isFinish ? 6 : 3
    }
    if (injury) moraleChange -= 5
    if (titleShotTriggered) moraleChange += 10
    const newMorale = Math.max(0, Math.min(100, fighter.morale + moraleChange))

    const sponsorWinBonus = result.winner === 'my'
      ? activeSponsors.reduce((sum, s) => sum + s.win_bonus, 0)
      : 0
    const newBalance = gym.balance + purse + commission + sponsorWinBonus - winBonusPaid - medicalCost - purseShare
    const newReputation = Math.max(0, Math.min(100, gym.reputation + reputationChange + reputationBonus))
    // Kosongkan slot fighter setelah bertanding
    const newEvents = event
      ? gym.events.map((e) =>
          e.id !== event.id ? e : {
            ...e,
            slots: (e.slots ?? []).map((s) =>
              s.fighter_id === fighter.id ? { ...s, fighter_id: null, opponent: null } : s
            ),
          }
        )
      : gym.events

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
          win_streak: newWinStreak,
          morale: newMorale,
          ...(titleShotTriggered ? { title_shot_pending: true } : {}),
          ...(injury
            ? { status: 'injured', injury: injury.name, injury_weeks_left: injury.weeks }
            : {}),
        })
        .eq('id', fighter.id)
        .select()
        .single(),
      supabase
        .from('gyms')
        .update({ balance: newBalance, reputation: newReputation, events: newEvents })
        .eq('id', gym.id)
        .select()
        .single(),
    ])

    let titleBeltResult: Awaited<ReturnType<typeof resolveTitleFight>> = null

    if (insertRes.error || fighterRes.error || gymRes.error) {
      setSaveError(
        insertRes.error?.message || fighterRes.error?.message || gymRes.error?.message || 'Gagal menyimpan hasil pertarungan.'
      )
    } else {
      if (fighterRes.data) updateFighter(fighter.id, fighterRes.data)
      if (gymRes.data) setGym(gymRes.data)

      // Update satisfaction sponsor aktif berdasarkan hasil fight
      if (activeSponsors.length > 0) {
        const satDelta = result.winner === 'my' ? 5 : -8
        for (const s of activeSponsors) {
          const newSat = Math.max(0, Math.min(100, s.satisfaction + satDelta))
          supabase.from('sponsor_contracts').update({ satisfaction: newSat }).eq('id', s.id).then()
        }
      }

      // Title fight: update gelar juara per weight class
      if (isTitleFight(event, slot)) {
        titleBeltResult = await resolveTitleFight(fighter, gym, result.winner === 'my')
      }

      const state = useGameStore.getState()
      if (state.gym) syncLeaderboard(state.gym, state.fighters)
    }

    setFightResultSummary(
      purse,
      reputationChange + reputationBonus,
      newRecord,
      injury,
      winBonusPaid,
      titleShotTriggered,
      titleBeltResult,
      commission,
      medicalCost,
      moraleChange,
      purseShare
    )
    setSavingResult(false)
  }

  async function handleWatchInterview() {
    if (!selectedFighter || !selectedSlot?.opponent || !todaysEvent) return
    setInterviewLoading(true)
    const text = await getPreFightInterview(
      selectedFighter,
      selectedSlot.opponent.name,
      selectedSlot.opponent.specialty,
      todaysEvent.name
    )
    setInterviewText(text)
    setInterviewLoading(false)
  }

  function handleStartFight() {
    const fighter = eligibleFighters.find((f) => f.id === selectedFighterId)
    if (!fighter) return

    // Cari lawan yang sudah di-booking di event slot
    const eventForFighter = todaysEvents.find((e) =>
      (e.slots ?? []).some((s) => s.fighter_id === fighter.id)
    )
    const slot = eventForFighter?.slots?.find((s) => s.fighter_id === fighter.id)
    const bookedOpponent = slot?.opponent

    // Gunakan lawan yang sudah di-booking, atau fallback ke generate random
    const tier = eventForFighter?.tier ?? todaysEvent?.tier ?? 'regional'
    const opponent = bookedOpponent
      ? { name: bookedOpponent.name, attrs: bookedOpponent.attrs, record: bookedOpponent.record, specialty: bookedOpponent.specialty as Specialty, color: bookedOpponent.color }
      : generateOpponent(fighter, tier as EventTier)

    setFightFighter(fighter)
    setOpponent(opponent)
    setFightVitals({
      myStamina: fighter.attrs.cardio,
      oppStamina: opponent.attrs.cardio,
      myMental: fighter.attrs.mental,
      oppMental: opponent.attrs.mental,
    })
    setFightPhase('gameplan')
  }

  function handleStartFighting() {
    if (!fight.gamePlan) return
    setFightPhase('fighting')
  }

  function handleSimulateRound() {
    if (!fight.fighter || !fight.opponent || !fight.gamePlan) return

    const result = simulateRound({
      myFighter: fight.fighter,
      opponent: { name: fight.opponent.name, attrs: fight.opponent.attrs, specialty: fight.opponent.specialty },
      gamePlan: fight.gamePlan,
      cornerAdvice: fight.cornerAdvice,
      roundNum: fight.currentRound,
      myStamina: fight.myStamina,
      oppStamina: fight.oppStamina,
      myMental: fight.myMental,
      oppMental: fight.oppMental,
    })

    const ticks = result.ticks ?? []
    const dmgToMe = ticks.reduce((sum, t) => sum + t.my_dmg, 0)
    const dmgToOpp = ticks.reduce((sum, t) => sum + t.opp_dmg, 0)
    const newMyHP = Math.max(0, fight.myHP - dmgToMe)
    const newOppHP = Math.max(0, fight.oppHP - dmgToOpp)

    const knockedOut = (newMyHP === 0 || newOppHP === 0) && !result.finish
    const final = knockedOut
      ? { ...result, winner: (newOppHP === 0 ? 'my' : 'opp') as 'my' | 'opp', finish: 'tko' as const }
      : result

    const isFightOver = !!final.finish || newMyHP === 0 || newOppHP === 0 || fight.currentRound >= TOTAL_ROUNDS

    const newVitals = {
      myStamina: result.my_stamina ?? fight.myStamina,
      oppStamina: result.opp_stamina ?? fight.oppStamina,
      myMental: result.my_mental ?? fight.myMental,
      oppMental: result.opp_mental ?? fight.oppMental,
    }

    setAiNarration('')
    setRoundClock(ROUND_DURATION_SEC)
    setAnimation({ ticks, index: 0, feed: [], final, isFightOver, newVitals })
  }

  function finalizeRound(anim: NonNullable<typeof animation>) {
    const remaining = anim.ticks.slice(anim.index)
    const dmgToMe = remaining.reduce((sum, t) => sum + t.my_dmg, 0)
    const dmgToOpp = remaining.reduce((sum, t) => sum + t.opp_dmg, 0)
    setMyHP(Math.max(0, fight.myHP - dmgToMe))
    setOppHP(Math.max(0, fight.oppHP - dmgToOpp))
    setFightVitals(anim.newVitals)
    addRoundResult(anim.final)
    setAiNarration(generateClosingLine(anim.isFightOver))
    setRoundClock(0)
    setAnimation(null)
  }

  function handleSkipAnimation() {
    if (!animation) return
    finalizeRound(animation)
  }

  // Jam ronde berjalan real-time mengikuti durasi animasi narasi (5:00 -> 0:00)
  useEffect(() => {
    if (!animation) return

    const totalDurationMs = 300 + (animation.ticks.length - 1) * 1300
    const startedAt = Date.now()

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, ROUND_DURATION_SEC - Math.round((elapsed / totalDurationMs) * ROUND_DURATION_SEC))
      setRoundClock(remaining)
    }, 100)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation !== null])

  // Putar narasi pertarungan tick demi tick, mengikuti kondisi HP secara live
  useEffect(() => {
    if (!animation) return

    if (animation.index >= animation.ticks.length) {
      finalizeRound(animation)
      return
    }

    const tick = animation.ticks[animation.index]
    const BIG_HIT = 6
    const delay = animation.index === 0 ? 300 : 1300

    const timer = setTimeout(() => {
      if (tick.my_dmg > 0) setMyHP(Math.max(0, fight.myHP - tick.my_dmg))
      if (tick.opp_dmg > 0) setOppHP(Math.max(0, fight.oppHP - tick.opp_dmg))
      if (tick.my_dmg >= BIG_HIT) {
        setFlashMy(true)
        setTimeout(() => setFlashMy(false), 600)
      }
      if (tick.opp_dmg >= BIG_HIT) {
        setFlashOpp(true)
        setTimeout(() => setFlashOpp(false), 600)
      }
      setAnimation((a) => (a ? { ...a, index: a.index + 1, feed: [...a.feed, tick.text] } : a))
    }, delay)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation])

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
      <OctagonBackground />
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
          {todaysEvent ? (
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Event Minggu Ini</p>
                  <p className="font-semibold text-white">{todaysEvent.name}</p>
                  {todaysEvent.venue && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      📍 {todaysEvent.venue}
                      {todaysEvent.attendance && ` · 👥 ~${formatNumber(todaysEvent.attendance)} penonton`}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${EVENT_TIER_BADGE_CLASS[todaysEvent.tier]}`}
                >
                  {EVENT_TIER_CONFIG[todaysEvent.tier].label}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-4 text-center">
              <p className="text-sm text-gray-400">Tidak ada event MMA minggu ini.</p>
              <Link href="/game/events" className="mt-1 inline-block text-sm font-medium text-octagon-amber hover:underline">
                Cek Kalender Event →
              </Link>
            </div>
          )}

          {eligibleFighters.length === 0 ? (
            <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-8 text-center">
              <p className="text-gray-400">
                {todaysEvent
                  ? 'Belum ada fighter yang terdaftar di event minggu ini.'
                  : 'Tidak ada fighter yang siap bertanding minggu ini.'}
              </p>
              {todaysEvent && (
                <Link href="/game/events" className="mt-2 inline-block text-sm font-medium text-octagon-amber hover:underline">
                  Daftarkan Fighter →
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

          {showInterview && (
            <div className="rounded-lg border border-octagon-amber/30 bg-octagon-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-octagon-amber">
                🎤 Wawancara Pra-Pertandingan
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {selectedFighter?.name} vs {selectedSlot?.opponent?.name} — {todaysEvent?.name}
              </p>

              {interviewText ? (
                <p className="mt-3 whitespace-pre-line text-sm italic text-gray-200">&ldquo;{interviewText}&rdquo;</p>
              ) : (
                <button
                  onClick={handleWatchInterview}
                  disabled={interviewLoading}
                  className="mt-3 rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-amber hover:text-octagon-amber disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {interviewLoading ? 'Memuat...' : 'Tonton Wawancara'}
                </button>
              )}
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

          {unscheduledFighters.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Belum Terdaftar Event</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {unscheduledFighters.map((f) => (
                  <div key={f.id} className="rounded-lg border border-octagon-border bg-octagon-card/50 p-4 opacity-70">
                    <p className="font-semibold text-white">{f.name}</p>
                    <p className="text-xs text-gray-400">
                      {f.weight_class} · {f.specialty} · {f.record.w}-{f.record.l}-{f.record.d}
                    </p>
                    <Link href="/game/events" className="mt-1 inline-block text-xs font-medium text-octagon-amber hover:underline">
                      Daftarkan ke event →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
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
            <div className="mt-2 flex items-center gap-3">
              <FighterPortrait imageUrl={null} ringColor={fight.opponent.color} size={48} />
              <div>
                <p className="font-semibold text-white">{fight.opponent.name}</p>
                <p className="text-xs text-gray-400">
                  {fight.opponent.specialty} · {fight.opponent.record.w}-{fight.opponent.record.l}-{fight.opponent.record.d}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-gray-500">Statistik Fighter</p>
            <div className="space-y-4">
              {ATTR_GROUPS.map((group) => (
                <div key={group.key}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">{group.label}</p>
                  <div className="space-y-3">
                    {group.attrs.map(({ key, label }) => (
                      <AttrCompareBar
                        key={key}
                        label={label}
                        myVal={fight.fighter!.attrs[key]}
                        oppVal={fight.opponent!.attrs[key]}
                        oppColor={fight.opponent!.color}
                      />
                    ))}
                  </div>
                </div>
              ))}
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
          <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FighterPortrait imageUrl={fight.fighter.avatar_url} ringColor="#1D9E75" size={36} />
                <p className="truncate text-sm font-semibold text-white">{fight.fighter.name.split(' ')[0]}</p>
              </div>
              <span className="shrink-0 text-xs font-bold text-gray-600">VS</span>
              <div className="flex min-w-0 flex-row-reverse items-center gap-2">
                <FighterPortrait imageUrl={null} ringColor={fight.opponent.color} size={36} />
                <p className="truncate text-sm font-semibold text-white">{fight.opponent.name.split(' ')[0]}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Ronde</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-2xl font-bold text-white">
                    {fight.currentRound} <span className="text-sm font-normal text-gray-500">/ {TOTAL_ROUNDS}</span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
                      const roundNum = i + 1
                      const done =
                        roundNum < fight.currentRound || (roundNum === fight.currentRound && !!currentRoundResult)
                      const active = roundNum === fight.currentRound
                      return (
                        <span
                          key={roundNum}
                          className={`h-2.5 w-2.5 rounded-full transition-colors ${
                            done
                              ? 'bg-octagon-red'
                              : active
                                ? 'bg-octagon-red/40 ring-2 ring-octagon-red'
                                : 'bg-octagon-border'
                          }`}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Waktu</p>
                <p className="font-mono text-2xl font-bold text-white">{formatClock(roundClock)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Game Plan</p>
                <p className="font-semibold capitalize text-octagon-amber">{fight.gamePlan}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div
              className={`rounded-lg border p-4 transition-colors duration-500 ${
                flashMy ? 'border-octagon-red bg-octagon-red/20' : 'border-octagon-border bg-octagon-card'
              }`}
            >
              <div className="mb-2 flex items-center gap-3">
                <FighterPortrait imageUrl={fight.fighter.avatar_url} ringColor="#1D9E75" />
                <p className="truncate font-semibold text-white">{fight.fighter.name}</p>
              </div>
              <div className="space-y-2">
                <HpBar label="HP" value={fight.myHP} colorClass="bg-octagon-teal" />
                <HpBar label="Stamina" value={fight.myStamina} colorClass="bg-octagon-amber" />
                <HpBar label="Mental" value={fight.myMental} colorClass="bg-purple-400" />
              </div>
            </div>
            <div
              className={`rounded-lg border p-4 transition-colors duration-500 ${
                flashOpp ? 'border-octagon-red bg-octagon-red/20' : 'border-octagon-border bg-octagon-card'
              }`}
            >
              <div className="mb-2 flex items-center gap-3">
                <FighterPortrait imageUrl={null} ringColor={fight.opponent.color} />
                <p className="truncate font-semibold text-white">{fight.opponent.name}</p>
              </div>
              <div className="space-y-2">
                <HpBar label="HP" value={fight.oppHP} colorClass="bg-octagon-red" />
                <HpBar label="Stamina" value={fight.oppStamina} colorClass="bg-octagon-amber" />
                <HpBar label="Mental" value={fight.oppMental} colorClass="bg-purple-400" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-gray-500">
              Statistik (Ronde {fight.currentRound})
            </p>
            <FightStatsTable
              myStats={liveMyStats}
              oppStats={liveOppStats}
              myLabel={fight.fighter.name.split(' ')[0]}
              oppLabel={fight.opponent.name.split(' ')[0]}
              oppColor={fight.opponent.color}
            />
          </div>

          {animation ? (
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <p className="mb-2 text-sm font-semibold text-white">Ronde {fight.currentRound} berlangsung...</p>
              <ul className="space-y-1.5 text-sm text-gray-300">
                {animation.feed.map((line, i) => (
                  <li key={i}>• {line}</li>
                ))}
              </ul>
              {animation.index < animation.ticks.length && (
                <p className="mt-2 animate-pulse text-sm text-gray-500">● ● ●</p>
              )}
              <button
                onClick={handleSkipAnimation}
                className="mt-4 rounded-md border border-octagon-border px-4 py-2 text-xs font-semibold text-gray-400 transition-colors hover:bg-white/5"
              >
                Lewati
              </button>
            </div>
          ) : currentRoundResult ? (
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <p className="mb-2 text-sm font-semibold text-white">
                Ronde {currentRoundResult.round}:{' '}
                {currentRoundResult.winner === 'my' ? fight.fighter.name : fight.opponent.name} unggul (
                {currentRoundResult.my_pct}–{currentRoundResult.opp_pct})
              </p>
              <RoundSplitBar
                myPct={currentRoundResult.my_pct}
                oppPct={currentRoundResult.opp_pct}
                myLabel={fight.fighter.name.split(' ')[0]}
                oppLabel={fight.opponent.name.split(' ')[0]}
                oppColor={fight.opponent.color}
              />
              <ul className="mt-3 space-y-1 text-sm text-gray-300">
                {currentRoundResult.events.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
              {currentRoundResult.finish && (
                <p className="mt-2 text-sm font-bold uppercase text-octagon-red">
                  {currentRoundResult.finish}! Pertarungan selesai di ronde {currentRoundResult.round}.
                </p>
              )}
              {fight.aiNarration && (
                <p className="mt-3 rounded-md bg-octagon-dark p-3 text-sm italic text-gray-300">
                  &ldquo;{fight.aiNarration}&rdquo;
                </p>
              )}

              <button
                onClick={handleAfterRound}
                className="mt-4 rounded-md bg-octagon-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90"
              >
                {isFightOver ? 'Lihat Hasil' : 'Lanjut ke Corner'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleSimulateRound}
              className="rounded-md bg-octagon-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90"
            >
              {`Mulai Ronde ${fight.currentRound}`}
            </button>
          )}

          {fight.roundResults.length > 1 && (
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Riwayat Ronde</p>
              <div className="space-y-2.5">
                {fight.roundResults.map((r) => (
                  <div key={r.round} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Ronde {r.round}</span>
                      <span className={r.winner === 'my' ? 'text-octagon-teal' : 'text-octagon-red'}>
                        {r.winner === 'my' ? fight.fighter!.name.split(' ')[0] : fight.opponent!.name.split(' ')[0]}
                        {r.finish ? ` (${r.finish.toUpperCase()})` : ''}
                      </span>
                    </div>
                    <RoundSplitBar myPct={r.my_pct} oppPct={r.opp_pct} oppColor={fight.opponent!.color} compact />
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
              <div className="mb-2 flex items-center gap-3">
                <FighterPortrait imageUrl={fight.fighter.avatar_url} ringColor="#1D9E75" />
                <p className="truncate font-semibold text-white">{fight.fighter.name}</p>
              </div>
              <div className="space-y-2">
                <HpBar label="HP" value={fight.myHP} colorClass="bg-octagon-teal" />
                <HpBar label="Stamina" value={fight.myStamina} colorClass="bg-octagon-amber" />
                <HpBar label="Mental" value={fight.myMental} colorClass="bg-purple-400" />
              </div>
            </div>
            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
              <div className="mb-2 flex items-center gap-3">
                <FighterPortrait imageUrl={null} ringColor={fight.opponent.color} />
                <p className="truncate font-semibold text-white">{fight.opponent.name}</p>
              </div>
              <div className="space-y-2">
                <HpBar label="HP" value={fight.oppHP} colorClass="bg-octagon-red" />
                <HpBar label="Stamina" value={fight.oppStamina} colorClass="bg-octagon-amber" />
                <HpBar label="Mental" value={fight.oppMental} colorClass="bg-purple-400" />
              </div>
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
              <div className="space-y-2.5">
                {fight.roundResults.map((r) => (
                  <div key={r.round} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Ronde {r.round}</span>
                      <span className={r.winner === 'my' ? 'text-octagon-teal' : 'text-octagon-red'}>
                        {r.winner === 'my' ? fight.fighter!.name.split(' ')[0] : fight.opponent!.name.split(' ')[0]}
                        {r.finish ? ` (${r.finish.toUpperCase()})` : ''}
                      </span>
                    </div>
                    <RoundSplitBar myPct={r.my_pct} oppPct={r.opp_pct} oppColor={fight.opponent!.color} compact />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-octagon-border bg-octagon-card p-4 text-left">
              <p className="mb-3 text-xs font-semibold uppercase text-gray-500">Statistik Pertandingan</p>
              <div className="space-y-4">
                {fight.roundResults.map((r) => (
                  <div key={r.round}>
                    <p className="mb-1.5 text-xs font-semibold text-gray-400">Ronde {r.round}</p>
                    <FightStatsTable
                      myStats={r.myStats ?? emptyFightStats()}
                      oppStats={r.oppStats ?? emptyFightStats()}
                      myLabel={fight.fighter!.name.split(' ')[0]}
                      oppLabel={fight.opponent!.name.split(' ')[0]}
                      oppColor={fight.opponent!.color}
                    />
                  </div>
                ))}
                {fight.roundResults.length > 1 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-gray-400">Total</p>
                    <FightStatsTable
                      myStats={sumFightStats(fight.roundResults.map((r) => r.myStats ?? emptyFightStats()))}
                      oppStats={sumFightStats(fight.roundResults.map((r) => r.oppStats ?? emptyFightStats()))}
                      myLabel={fight.fighter!.name.split(' ')[0]}
                      oppLabel={fight.opponent!.name.split(' ')[0]}
                      oppColor={fight.opponent!.color}
                    />
                  </div>
                )}
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
                  {fight.fightSummary.commission > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Komisi Promotor</span>
                      <span className="font-semibold text-octagon-amber">
                        +{formatCurrency(fight.fightSummary.commission)}
                      </span>
                    </div>
                  )}
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
                  {fight.fightSummary.winBonusPaid > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Win Bonus untuk {fight.fighter!.name.split(' ')[0]}</span>
                      <span className="font-semibold text-octagon-red">
                        -{formatCurrency(fight.fightSummary.winBonusPaid)}
                      </span>
                    </div>
                  )}
                  {fight.fightSummary.purseShare > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">
                        Bagi Hasil Purse ({fight.fighter!.purse_share_pct}%) untuk {fight.fighter!.name.split(' ')[0]}
                      </span>
                      <span className="font-semibold text-octagon-red">
                        -{formatCurrency(fight.fightSummary.purseShare)}
                      </span>
                    </div>
                  )}
                  {fight.fightSummary.moraleChange !== 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Morale {fight.fighter!.name.split(' ')[0]}</span>
                      <span
                        className={`font-semibold ${
                          fight.fightSummary.moraleChange > 0 ? 'text-octagon-teal' : 'text-octagon-red'
                        }`}
                      >
                        {fight.fightSummary.moraleChange > 0 ? '+' : ''}
                        {fight.fightSummary.moraleChange}
                      </span>
                    </div>
                  )}
                  {fight.fightSummary.medicalCost > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Biaya Medis</span>
                      <span className="font-semibold text-octagon-red">
                        -{formatCurrency(fight.fightSummary.medicalCost)}
                      </span>
                    </div>
                  )}
                  {fight.fightSummary.injury && (
                    <div className="mt-2 rounded-md bg-octagon-red/10 px-3 py-2 text-octagon-red">
                      ⚠ {fight.fighter!.name.split(' ')[0]} mengalami {fight.fightSummary.injury.name} — pulih
                      dalam {fight.fightSummary.injury.weeks} minggu.
                    </div>
                  )}
                  {fight.fightSummary.titleShotTriggered && (
                    <div className="mt-2 rounded-md bg-octagon-amber/10 px-3 py-2 text-octagon-amber">
                      🏆 {fight.fighter!.name.split(' ')[0]} menang 3x beruntun dan menuntut Title Shot sesuai
                      klausul kontrak! Reputasi gym naik tambahan.
                    </div>
                  )}
                  {fight.fightSummary.titleBeltResult === 'won' && (
                    <div className="mt-2 rounded-md bg-yellow-500/10 px-3 py-2 font-semibold text-yellow-400">
                      🏆 JUARA BARU! {fight.fighter!.name.split(' ')[0]} merebut gelar Indonesia Championship
                      kelas {fight.fighter!.weight_class}!
                    </div>
                  )}
                  {fight.fightSummary.titleBeltResult === 'defended' && (
                    <div className="mt-2 rounded-md bg-yellow-500/10 px-3 py-2 font-semibold text-yellow-400">
                      🏆 GELAR DIPERTAHANKAN! {fight.fighter!.name.split(' ')[0]} berhasil mempertahankan
                      gelar juara kelas {fight.fighter!.weight_class}.
                    </div>
                  )}
                  {fight.fightSummary.titleBeltResult === 'lost' && (
                    <div className="mt-2 rounded-md bg-octagon-red/10 px-3 py-2 font-semibold text-octagon-red">
                      💔 GELAR LEPAS! {fight.fighter!.name.split(' ')[0]} gagal mempertahankan gelar juara
                      kelas {fight.fighter!.weight_class}. Title kini vacant.
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
