'use client'

import { useState } from 'react'
import type { Fighter, FightResult, WeeklySchedule, TrainingSession, TrainingIntensity } from '@/types'
import Avatar from '@/components/avatar/Avatar'
import { useGameStore } from '@/store/game-store'
import { generateFighterAvatar } from '@/lib/ai-avatar'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/format'
import { getPotentialLabel } from '@/lib/potential'
import { getCategoryAverages, overallRating } from '@/lib/attrs'

const SCHEDULE_DAYS: { key: keyof WeeklySchedule; label: string }[] = [
  { key: 'mon', label: 'Sen' },
  { key: 'tue', label: 'Sel' },
  { key: 'wed', label: 'Rab' },
  { key: 'thu', label: 'Kam' },
  { key: 'fri', label: 'Jum' },
  { key: 'sat', label: 'Sab' },
]

const SESSION_OPTIONS: { value: TrainingSession; label: string; dot: string }[] = [
  { value: 'striking',  label: 'Striking',   dot: 'bg-orange-400' },
  { value: 'grappling', label: 'Grappling',  dot: 'bg-blue-400' },
  { value: 'cardio',    label: 'Cardio',     dot: 'bg-red-400' },
  { value: 'analytics', label: 'Analitik',   dot: 'bg-purple-400' },
  { value: 'mental',    label: 'Mental',     dot: 'bg-green-400' },
  { value: 'sparring',  label: 'Sparring',   dot: 'bg-yellow-400' },
  { value: 'rest',      label: 'Istirahat',  dot: 'bg-gray-500' },
]

const SESSION_DOT: Record<TrainingSession, string> = Object.fromEntries(
  SESSION_OPTIONS.map((s) => [s.value, s.dot])
) as Record<TrainingSession, string>

const DEFAULT_SCHEDULE: WeeklySchedule = {
  mon: 'striking',
  tue: 'grappling',
  wed: 'cardio',
  thu: 'sparring',
  fri: 'mental',
  sat: 'rest',
}

const STATUS_STYLES: Record<Fighter['status'], string> = {
  active: 'border-octagon-teal/30 bg-octagon-teal/15 text-octagon-teal',
  training: 'border-octagon-amber/30 bg-octagon-amber/15 text-octagon-amber',
  injured: 'border-octagon-red/30 bg-octagon-red/15 text-octagon-red',
  prospect: 'border-gray-500/30 bg-gray-500/15 text-gray-300',
  retired: 'border-gray-700/40 bg-gray-700/30 text-gray-500',
}

const STATUS_LABELS: Record<Fighter['status'], string> = {
  active: 'Aktif',
  training: 'Latihan',
  injured: 'Cedera',
  prospect: 'Prospek',
  retired: 'Pensiun',
}

export default function FighterCard({ fighter, titleDefenses, tournamentTitles }: { fighter: Fighter; titleDefenses?: number; tournamentTitles?: number }) {
  const isChampion = titleDefenses !== undefined
  const { record, attrs } = fighter
  const renewalCost = Math.round((fighter.salary_monthly * 4) / 500_000) * 500_000
  const newSalary = Math.round((fighter.salary_monthly * 1.1) / 100_000) * 100_000
  const newWinBonus = Math.round((fighter.win_bonus * 1.1) / 100_000) * 100_000
  const newMorale = Math.min(100, fighter.morale + 10)
  const moraleColorClass =
    fighter.morale < 30 ? 'bg-octagon-red' : fighter.morale < 60 ? 'bg-octagon-amber' : 'bg-octagon-teal'
  const isUnderContract = fighter.status !== 'retired' && fighter.contract_fights_left > 0
  const buyoutCost = isUnderContract ? fighter.buyout_clause : 0
  const potentialLabel = getPotentialLabel(fighter.potential)
  const updateFighter = useGameStore((s) => s.updateFighter)
  const removeFighter = useGameStore((s) => s.removeFighter)
  const gym = useGameStore((s) => s.gym)
  const setGym = useGameStore((s) => s.setGym)
  const seasonWeek = gym?.season_week ?? 1
  const weeksToFight = fighter.next_fight_week !== null ? fighter.next_fight_week - seasonWeek : null
  const isInFightCamp = weeksToFight !== null && weeksToFight >= 1 && weeksToFight <= 4
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<FightResult[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [savingIntensity, setSavingIntensity] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [renewError, setRenewError] = useState<string | null>(null)
  const [confirmingRelease, setConfirmingRelease] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const ovr = overallRating(attrs)
  const ovrColorClass = ovr >= 75 ? 'text-octagon-teal' : ovr >= 60 ? 'text-octagon-amber' : 'text-gray-400'

  const alerts: { key: string; text: string; className: string }[] = []
  const ALERT_RED = 'border-octagon-red/40 bg-octagon-red/10 text-octagon-red'
  const ALERT_AMBER = 'border-octagon-amber/40 bg-octagon-amber/10 text-octagon-amber'
  const ALERT_TEAL = 'border-octagon-teal/40 bg-octagon-teal/10 text-octagon-teal'
  const ALERT_YELLOW = 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'

  if (isChampion) {
    alerts.push({ key: 'champion', text: `🏆 Champion · ${titleDefenses}x defense`, className: ALERT_YELLOW })
  }
  if (tournamentTitles) {
    alerts.push({ key: 'tournament', text: `🏆 Turnamen 8 Besar ×${tournamentTitles}`, className: ALERT_YELLOW })
  }
  if (fighter.title_shot_pending) {
    alerts.push({ key: 'titleshot', text: '🏆 Title Shot Pending', className: ALERT_AMBER })
  }
  if (fighter.injury) {
    alerts.push({
      key: 'injury',
      text: `⚠ ${fighter.injury}${fighter.injury_weeks_left !== null ? ` · ${fighter.injury_weeks_left}mg` : ''}`,
      className: ALERT_RED,
    })
  }
  if (fighter.next_fight_week !== null && fighter.next_fight_week > seasonWeek) {
    alerts.push({
      key: 'fight',
      text: isInFightCamp ? `⚡ Fight Camp · ${weeksToFight}mg` : `📅 Wk ${fighter.next_fight_week} · ${weeksToFight}mg`,
      className: isInFightCamp ? ALERT_TEAL : ALERT_AMBER,
    })
  }
  if (fighter.status !== 'retired' && fighter.contract_fights_left <= 1) {
    alerts.push({ key: 'contract', text: '⚠ Kontrak Hampir Habis', className: ALERT_AMBER })
  }
  if (fighter.status !== 'retired' && fighter.morale < 30) {
    alerts.push({ key: 'morale', text: '😟 Morale Rendah', className: ALERT_RED })
  }

  async function handleToggleHistory() {
    if (!showHistory && history === null) {
      setLoadingHistory(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('fight_results')
        .select('*')
        .eq('fighter_id', fighter.id)
        .order('fight_date', { ascending: false })
        .limit(5)
      setHistory((data ?? []) as FightResult[])
      setLoadingHistory(false)
    }
    setShowHistory((v) => !v)
  }

  async function handleScheduleChange(day: keyof WeeklySchedule, session: TrainingSession) {
    const currentSchedule = fighter.weekly_schedule ?? DEFAULT_SCHEDULE
    const newSchedule: WeeklySchedule = { ...currentSchedule, [day]: session }
    setSavingSchedule(true)
    const supabase = createClient()
    const { error } = await supabase.from('fighters').update({ weekly_schedule: newSchedule }).eq('id', fighter.id)
    if (!error) {
      updateFighter(fighter.id, { weekly_schedule: newSchedule })
    }
    setSavingSchedule(false)
  }

  async function handleIntensityChange(intensity: TrainingIntensity) {
    setSavingIntensity(true)
    const supabase = createClient()
    const { error } = await supabase.from('fighters').update({ training_intensity: intensity }).eq('id', fighter.id)
    if (!error) {
      updateFighter(fighter.id, { training_intensity: intensity })
    }
    setSavingIntensity(false)
  }

  async function handleRenewContract() {
    if (!gym) return
    setRenewError(null)

    if (gym.balance < renewalCost) {
      setRenewError('Saldo tidak cukup untuk perpanjang kontrak.')
      return
    }

    setRenewing(true)
    const supabase = createClient()

    const { error: fighterError } = await supabase
      .from('fighters')
      .update({ contract_fights_left: 3, salary_monthly: newSalary, win_bonus: newWinBonus, morale: newMorale })
      .eq('id', fighter.id)

    if (fighterError) {
      setRenewError(fighterError.message)
      setRenewing(false)
      return
    }

    const newBalance = gym.balance - renewalCost
    const newExpense = gym.monthly_expense - fighter.salary_monthly + newSalary
    const { error: gymError } = await supabase
      .from('gyms')
      .update({ balance: newBalance, monthly_expense: newExpense })
      .eq('id', gym.id)

    if (gymError) {
      setRenewError(gymError.message)
      setRenewing(false)
      return
    }

    updateFighter(fighter.id, { contract_fights_left: 3, salary_monthly: newSalary, win_bonus: newWinBonus, morale: newMorale })
    setGym({ ...gym, balance: newBalance, monthly_expense: newExpense })
    setRenewing(false)
  }

  async function handleReleaseFighter() {
    if (!gym) return
    setReleaseError(null)

    if (buyoutCost > 0 && gym.balance < buyoutCost) {
      setReleaseError(`Saldo tidak cukup untuk membayar klausul buyout (${formatCurrency(buyoutCost)}).`)
      return
    }

    setReleasing(true)
    const supabase = createClient()

    const { error } = await supabase.rpc('release_fighter_to_pool', {
      p_fighter_id:  fighter.id,
      p_gym_id:      gym.id,
      p_buyout_cost: buyoutCost,
      p_salary:      fighter.salary_monthly,
    })

    if (error) {
      setReleaseError(error.message)
      setReleasing(false)
      return
    }

    const newBalance = gym.balance - buyoutCost
    const newExpense = Math.max(0, gym.monthly_expense - fighter.salary_monthly)
    setGym({ ...gym, balance: newBalance, monthly_expense: newExpense })
    removeFighter(fighter.id)
  }

  async function handleGenerateAvatar() {
    setGenError(null)
    setGenerating(true)
    try {
      const avatarUrl = await generateFighterAvatar(fighter)
      updateFighter(fighter.id, { avatar_url: avatarUrl })
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Gagal membuat foto')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
      {/* ── Compact: selalu tampil ──────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <Avatar
          imageUrl={fighter.avatar_url}
          size={56}
          className="shrink-0 overflow-hidden rounded-full bg-octagon-dark"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-semibold text-white">
              {isChampion && '🏆 '}{fighter.name}
            </h3>
            <span
              className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[fighter.status]}`}
            >
              {STATUS_LABELS[fighter.status]}
            </span>
          </div>
          {fighter.nickname && (
            <p className="truncate text-sm italic text-octagon-amber">&ldquo;{fighter.nickname}&rdquo;</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {fighter.weight_class} · {fighter.specialty} ·{' '}
            <span
              className={
                fighter.age >= 38
                  ? 'font-semibold text-octagon-red'
                  : fighter.age >= 32
                    ? 'font-semibold text-octagon-amber'
                    : ''
              }
            >
              {fighter.age} th
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-300">
          Rekor{' '}
          <span className="font-semibold text-white">
            {record.w}-{record.l}-{record.d}
          </span>
        </span>
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-bold ${ovrColorClass}`}>{ovr} OVR</span>
          <span className={`font-medium ${potentialLabel.colorClass}`}>{potentialLabel.label}</span>
        </div>
      </div>

      {fighter.status !== 'retired' && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="w-10 text-[10px] font-medium text-gray-500">Morale</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-octagon-dark">
            <div className={`h-full rounded-full ${moraleColorClass}`} style={{ width: `${fighter.morale}%` }} />
          </div>
          <span className="w-6 text-right text-[10px] text-gray-400">{fighter.morale}</span>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {alerts.map((a) => (
            <span key={a.key} className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${a.className}`}>
              {a.text}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal"
      >
        {expanded ? 'Sembunyikan Detail ▲' : 'Lihat Detail ▼'}
      </button>

      {/* ── Detail: expand on demand ────────────────────────────────────── */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-octagon-border pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Personality</span>
            <span className="text-gray-300">{fighter.personality}</span>
          </div>

          <div className="space-y-1.5">
            {getCategoryAverages(attrs).map(({ key, label, value }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-8 text-[10px] font-medium text-gray-500">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-octagon-dark">
                  <div className="h-full rounded-full bg-octagon-teal" style={{ width: `${value}%` }} />
                </div>
                <span className="w-6 text-right text-[10px] text-gray-400">{value}</span>
              </div>
            ))}
          </div>

          {fighter.status === 'training' && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[10px] font-medium text-gray-400">Jadwal Latihan</p>
                {isInFightCamp && (
                  <span className="rounded border border-octagon-teal/40 bg-octagon-teal/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-octagon-teal">
                    Fight Camp
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-x-2 gap-y-2">
                {SCHEDULE_DAYS.map(({ key, label }) => {
                  const schedule = fighter.weekly_schedule ?? DEFAULT_SCHEDULE
                  const session = schedule[key]
                  return (
                    <div key={key} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${SESSION_DOT[session]}`} />
                        <span className="text-[10px] text-gray-500">{label}</span>
                      </div>
                      <select
                        value={session}
                        onChange={(e) => handleScheduleChange(key, e.target.value as TrainingSession)}
                        disabled={savingSchedule}
                        className="w-full rounded border border-octagon-border bg-octagon-dark px-1 py-0.5 text-[10px] text-white disabled:opacity-50"
                      >
                        {SESSION_OPTIONS.map(({ value, label: sLabel }) => (
                          <option key={value} value={value}>{sLabel}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-400">Intensitas</span>
                <div className="flex gap-1">
                  {(['low', 'medium', 'high'] as TrainingIntensity[]).map((lvl) => {
                    const active = (fighter.training_intensity ?? 'medium') === lvl
                    const styles: Record<TrainingIntensity, string> = {
                      low:    active ? 'border-blue-500 bg-blue-500/20 text-blue-300'   : 'border-octagon-border text-gray-500',
                      medium: active ? 'border-octagon-amber bg-octagon-amber/20 text-octagon-amber' : 'border-octagon-border text-gray-500',
                      high:   active ? 'border-octagon-red bg-octagon-red/20 text-octagon-red'   : 'border-octagon-border text-gray-500',
                    }
                    const labels: Record<TrainingIntensity, string> = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi' }
                    return (
                      <button
                        key={lvl}
                        onClick={() => handleIntensityChange(lvl)}
                        disabled={savingIntensity}
                        className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50 ${styles[lvl]}`}
                      >
                        {labels[lvl]}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {isChampion && (
            <p className="text-xs font-semibold text-yellow-400">
              🏆 Juara Indonesia Championship kelas {fighter.weight_class} · {titleDefenses}x defense
            </p>
          )}

          {!!tournamentTitles && (
            <p className="text-xs font-semibold text-yellow-400">
              🏆 Juara Turnamen 8 Besar kelas {fighter.weight_class} · {tournamentTitles}x trofi
            </p>
          )}

          {fighter.title_shot_pending && (
            <p className="text-xs font-semibold text-octagon-amber">
              🏆 Berhak menuntut Title Shot sesuai klausul kontrak.
            </p>
          )}

          {fighter.status !== 'retired' && fighter.morale < 30 && (
            <p className="text-xs font-semibold text-octagon-red">
              ⚠ Morale {fighter.name.split(' ')[0]} rendah — risiko fighter pergi saat kontrak habis meningkat.
            </p>
          )}

          {fighter.status !== 'retired' && (
            <div className="space-y-1 text-xs text-gray-400">
              <div className="flex items-center justify-between">
                <span>Kontrak</span>
                <span className={fighter.contract_fights_left <= 1 ? 'font-semibold text-octagon-red' : 'text-gray-200'}>
                  {fighter.contract_fights_left} pertarungan tersisa
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Win Bonus</span>
                <span className="text-gray-200">{formatCurrency(fighter.win_bonus)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Bagi Hasil Purse</span>
                <span className="text-gray-200">{fighter.purse_share_pct}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Klausul Buyout</span>
                <span className="text-gray-200">{formatCurrency(fighter.buyout_clause)}</span>
              </div>
              {fighter.title_shot_clause && (
                <div className="flex items-center justify-between">
                  <span>Win Streak</span>
                  <span className="text-gray-200">{fighter.win_streak}x</span>
                </div>
              )}
            </div>
          )}

          {fighter.status !== 'retired' && fighter.contract_fights_left <= 1 && (
            <div className="rounded-md border border-octagon-amber/30 bg-octagon-amber/10 p-2">
              <p className="text-xs text-octagon-amber">
                ⚠ Kontrak hampir habis — perpanjang atau berisiko fighter pensiun.
              </p>
              <button
                onClick={handleRenewContract}
                disabled={renewing || (gym ? gym.balance < renewalCost : true)}
                className="mt-2 w-full rounded-md bg-octagon-amber px-3 py-1.5 text-xs font-semibold text-octagon-dark transition-colors hover:bg-octagon-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {renewing ? 'Memproses...' : `Perpanjang Kontrak (${formatCurrency(renewalCost)})`}
              </button>
              {renewError && <p className="mt-1 text-[10px] text-octagon-red">{renewError}</p>}
            </div>
          )}

          <button
            onClick={handleToggleHistory}
            className="w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal"
          >
            {loadingHistory ? 'Memuat riwayat...' : showHistory ? 'Sembunyikan Riwayat' : 'Riwayat Pertarungan'}
          </button>

          {showHistory && !loadingHistory && (
            <div className="space-y-1.5">
              {history && history.length > 0 ? (
                history.map((fr) => (
                  <div key={fr.id} className="flex items-center justify-between rounded-md bg-octagon-dark px-2.5 py-1.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate text-gray-200">vs {fr.opponent_name}</p>
                      <p className="text-gray-500">{new Date(fr.fight_date).toLocaleDateString('id-ID')}</p>
                    </div>
                    <span
                      className={`shrink-0 font-semibold uppercase ${
                        fr.overall_winner === 'my'
                          ? 'text-octagon-teal'
                          : fr.overall_winner === 'opp'
                            ? 'text-octagon-red'
                            : 'text-octagon-amber'
                      }`}
                    >
                      {fr.overall_winner === 'my' ? 'Menang' : fr.overall_winner === 'opp' ? 'Kalah' : 'Imbang'}
                      {' · '}
                      {fr.finish_method.toUpperCase()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-gray-500">Belum ada riwayat pertarungan.</p>
              )}
            </div>
          )}

          <button
            onClick={handleGenerateAvatar}
            disabled={generating}
            className="w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? 'Membuat foto...' : fighter.avatar_url ? 'Buat Ulang Foto AI' : 'Generate Foto AI'}
          </button>
          {genError && <p className="text-[10px] text-octagon-red">{genError}</p>}

          {fighter.status !== 'retired' && (
            confirmingRelease ? (
              <div className="rounded-md border border-octagon-red/30 bg-octagon-red/10 p-2">
                <p className="text-xs text-octagon-red">
                  Yakin putus kontrak {fighter.name}? Fighter akan keluar dari roster secara permanen.
                  {buyoutCost > 0 && ` Gym akan membayar klausul buyout sebesar ${formatCurrency(buyoutCost)}.`}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleReleaseFighter}
                    disabled={releasing || (gym ? gym.balance < buyoutCost : false)}
                    className="flex-1 rounded-md bg-octagon-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {releasing ? 'Memproses...' : 'Ya, Putus Kontrak'}
                  </button>
                  <button
                    onClick={() => setConfirmingRelease(false)}
                    disabled={releasing}
                    className="flex-1 rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Batal
                  </button>
                </div>
                {releaseError && <p className="mt-1 text-[10px] text-octagon-red">{releaseError}</p>}
              </div>
            ) : (
              <button
                onClick={() => setConfirmingRelease(true)}
                className="w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-octagon-red hover:text-octagon-red"
              >
                Putus Kontrak
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
