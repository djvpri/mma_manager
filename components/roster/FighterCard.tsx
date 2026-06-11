'use client'

import { useState } from 'react'
import type { Fighter, FightResult } from '@/types'
import Avatar from '@/components/avatar/Avatar'
import { useGameStore } from '@/store/game-store'
import { generateFighterAvatar } from '@/lib/ai-avatar'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/format'
import { getPotentialLabel } from '@/lib/potential'
import { ATTR_GROUPS, getCategoryAverages } from '@/lib/attrs'

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

export default function FighterCard({ fighter }: { fighter: Fighter }) {
  const { record, attrs } = fighter
  const renewalCost = Math.round((fighter.salary_monthly * 4) / 500_000) * 500_000
  const newSalary = Math.round((fighter.salary_monthly * 1.1) / 100_000) * 100_000
  const newWinBonus = Math.round((fighter.win_bonus * 1.1) / 100_000) * 100_000
  const isUnderContract = fighter.status !== 'retired' && fighter.contract_fights_left > 0
  const buyoutCost = isUnderContract ? fighter.buyout_clause : 0
  const potentialLabel = getPotentialLabel(fighter.potential)
  const updateFighter = useGameStore((s) => s.updateFighter)
  const removeFighter = useGameStore((s) => s.removeFighter)
  const gym = useGameStore((s) => s.gym)
  const setGym = useGameStore((s) => s.setGym)
  const seasonWeek = gym?.season_week ?? 1
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<FightResult[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [savingFocus, setSavingFocus] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [renewError, setRenewError] = useState<string | null>(null)
  const [confirmingRelease, setConfirmingRelease] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)

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

  async function handleFocusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    const newFocus = (value === '' ? null : value) as Fighter['training_focus']
    setSavingFocus(true)
    const supabase = createClient()
    const { error } = await supabase.from('fighters').update({ training_focus: newFocus }).eq('id', fighter.id)
    if (!error) {
      updateFighter(fighter.id, { training_focus: newFocus })
    }
    setSavingFocus(false)
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
      .update({ contract_fights_left: 3, salary_monthly: newSalary, win_bonus: newWinBonus })
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

    updateFighter(fighter.id, { contract_fights_left: 3, salary_monthly: newSalary, win_bonus: newWinBonus })
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

    const { error: deleteError } = await supabase.from('fighters').delete().eq('id', fighter.id)
    if (deleteError) {
      setReleaseError(deleteError.message)
      setReleasing(false)
      return
    }

    const newBalance = gym.balance - buyoutCost
    const newExpense = Math.max(0, gym.monthly_expense - fighter.salary_monthly)
    const { error: gymError } = await supabase
      .from('gyms')
      .update({ balance: newBalance, monthly_expense: newExpense })
      .eq('id', gym.id)

    if (gymError) {
      setReleaseError(gymError.message)
      setReleasing(false)
      return
    }

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
      <div className="flex items-start gap-3">
        <Avatar
          imageUrl={fighter.avatar_url}
          size={64}
          className="shrink-0 overflow-hidden rounded-full bg-octagon-dark"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-semibold text-white">{fighter.name}</h3>
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
        <span className="text-xs text-gray-500">{fighter.personality}</span>
      </div>

      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-gray-500">Potensi</span>
        <span className={`font-medium ${potentialLabel.colorClass}`}>{potentialLabel.label}</span>
      </div>

      <div className="mt-3 space-y-1.5">
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
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <label htmlFor={`focus-${fighter.id}`} className="text-gray-400">
            Fokus Latihan
          </label>
          <select
            id={`focus-${fighter.id}`}
            value={fighter.training_focus ?? ''}
            onChange={handleFocusChange}
            disabled={savingFocus}
            className="rounded-md border border-octagon-border bg-octagon-dark px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            <option value="">Tidak ada</option>
            {ATTR_GROUPS.map((group) => (
              <optgroup key={group.key} label={group.label}>
                {group.attrs.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {fighter.injury && (
        <p className="mt-3 text-xs text-octagon-red">
          ⚠ Cedera: {fighter.injury}
          {fighter.injury_weeks_left !== null && ` · sembuh dalam ${fighter.injury_weeks_left} minggu`}
        </p>
      )}
      {fighter.next_fight_week !== null && fighter.next_fight_week > seasonWeek && (
        <p className="mt-3 text-xs text-octagon-amber">📅 Siap bertanding minggu ke-{fighter.next_fight_week}</p>
      )}

      {fighter.status !== 'retired' && (
        <div className="mt-3 space-y-1 text-xs text-gray-400">
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

      {fighter.title_shot_pending && (
        <p className="mt-2 text-xs font-semibold text-octagon-amber">
          🏆 Berhak menuntut Title Shot sesuai klausul kontrak.
        </p>
      )}

      {fighter.status !== 'retired' && fighter.contract_fights_left <= 1 && (
        <div className="mt-2 rounded-md border border-octagon-amber/30 bg-octagon-amber/10 p-2">
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
        className="mt-3 w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal"
      >
        {loadingHistory ? 'Memuat riwayat...' : showHistory ? 'Sembunyikan Riwayat' : 'Riwayat Pertarungan'}
      </button>

      {showHistory && !loadingHistory && (
        <div className="mt-2 space-y-1.5">
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
        className="mt-3 w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generating ? 'Membuat foto...' : fighter.avatar_url ? 'Buat Ulang Foto AI' : 'Generate Foto AI'}
      </button>
      {genError && <p className="mt-1 text-[10px] text-octagon-red">{genError}</p>}

      {confirmingRelease ? (
        <div className="mt-3 rounded-md border border-octagon-red/30 bg-octagon-red/10 p-2">
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
          className="mt-3 w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-octagon-red hover:text-octagon-red"
        >
          Putus Kontrak
        </button>
      )}
    </div>
  )
}
