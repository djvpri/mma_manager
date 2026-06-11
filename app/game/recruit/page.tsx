'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import Avatar from '@/components/avatar/Avatar'
import { generateRecruitPool, type RecruitCandidate } from '@/lib/generate-recruits'
import { getPotentialLabel } from '@/lib/potential'
import { getCategoryAverages } from '@/lib/attrs'
import type { ContractOffer } from '@/lib/negotiation'
import NegotiationPanel from '@/components/recruit/NegotiationPanel'

const POOL_SIZE = 6

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function RecruitPage() {
  const gym = useGameStore((s) => s.gym)
  const fighters = useGameStore((s) => s.fighters)
  const setGym = useGameStore((s) => s.setGym)
  const setFighters = useGameStore((s) => s.setFighters)

  const [pool, setPool] = useState<RecruitCandidate[]>(() => generateRecruitPool(POOL_SIZE))
  const [signingId, setSigningId] = useState<string | null>(null)
  const [scoutingId, setScoutingId] = useState<string | null>(null)
  const [scoutTexts, setScoutTexts] = useState<Record<string, string>>({})
  const [negotiatingId, setNegotiatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (!gym) {
    return <p className="text-sm text-gray-400">Memuat data gym...</p>
  }

  function handleRefresh() {
    setError(null)
    setInfo(null)
    setScoutTexts({})
    setNegotiatingId(null)
    setPool(generateRecruitPool(POOL_SIZE))
  }

  function handleWalkAway(candidate: RecruitCandidate) {
    setNegotiatingId(null)
    setInfo(`${candidate.name} pergi mencari tawaran lain.`)
    setPool((p) => p.filter((c) => c.id !== candidate.id))
  }

  async function handleScout(candidate: RecruitCandidate) {
    setScoutingId(candidate.id)
    try {
      const res = await fetch('/api/ai-scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fighter: candidate }),
      })
      const data = await res.json()
      setScoutTexts((m) => ({ ...m, [candidate.id]: data.text ?? 'Gagal memuat scouting report.' }))
    } catch {
      setScoutTexts((m) => ({ ...m, [candidate.id]: 'Gagal memuat scouting report.' }))
    } finally {
      setScoutingId(null)
    }
  }

  async function handleSignContract(candidate: RecruitCandidate, offer: ContractOffer) {
    if (!gym) return
    setError(null)
    setInfo(null)

    if (gym.balance < offer.bonus) {
      setError('Saldo tidak cukup untuk membayar bonus tanda tangan.')
      return
    }

    setSigningId(candidate.id)
    const supabase = createClient()

    const { data: newFighter, error: insertError } = await supabase
      .from('fighters')
      .insert({
        gym_id: gym.id,
        name: candidate.name,
        nickname: candidate.nickname,
        age: candidate.age,
        hometown: candidate.hometown,
        weight_class: candidate.weight_class,
        status: 'training',
        specialty: candidate.specialty,
        personality: candidate.personality,
        attrs: candidate.attrs,
        record: candidate.record,
        potential: candidate.potential,
        avatar_seed: candidate.avatar_seed,
        salary_monthly: offer.salary,
        win_bonus: offer.winBonus,
        contract_fights_left: offer.contractLength,
        title_shot_clause: offer.titleShotClause,
        buyout_clause: offer.buyoutClause,
        win_streak: 0,
        title_shot_pending: false,
      })
      .select()
      .single()

    if (insertError || !newFighter) {
      setError(insertError?.message ?? 'Gagal merekrut fighter.')
      setSigningId(null)
      return
    }

    const newBalance = gym.balance - offer.bonus
    const newExpense = gym.monthly_expense + offer.salary
    const { error: balanceError } = await supabase
      .from('gyms')
      .update({ balance: newBalance, monthly_expense: newExpense })
      .eq('id', gym.id)

    if (balanceError) {
      setError(balanceError.message)
      setSigningId(null)
      return
    }

    setGym({ ...gym, balance: newBalance, monthly_expense: newExpense })
    setFighters([...fighters, newFighter])
    setPool((p) => p.filter((c) => c.id !== candidate.id))
    setNegotiatingId(null)
    setSigningId(null)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Rekrutmen</h1>
          <p className="text-sm text-gray-400">
            Saldo: <span className="font-semibold text-octagon-amber">{formatCurrency(gym.balance)}</span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="rounded-md border border-octagon-border px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal"
        >
          Cari Kandidat Baru
        </button>
      </header>

      {error && <p className="text-sm text-octagon-red">{error}</p>}
      {info && <p className="text-sm text-octagon-teal">{info}</p>}

      {pool.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-octagon-border bg-octagon-card py-16 text-center">
          <p className="text-gray-400">Semua kandidat sudah direkrut.</p>
          <button onClick={handleRefresh} className="mt-3 text-sm font-medium text-octagon-amber hover:underline">
            Cari kandidat baru →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pool.map((candidate) => {
            return (
              <div key={candidate.id} className="rounded-lg border border-octagon-border bg-octagon-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar
                    size={64}
                    className="shrink-0 overflow-hidden rounded-full bg-octagon-dark"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-white">{candidate.name}</h3>
                    <p className="truncate text-sm italic text-octagon-amber">&ldquo;{candidate.nickname}&rdquo;</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {candidate.weight_class} · {candidate.specialty} · {candidate.age} th
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-300">
                    Rekor amatir{' '}
                    <span className="font-semibold text-white">
                      {candidate.record.w}-{candidate.record.l}-{candidate.record.d}
                    </span>
                  </span>
                  <span className="text-xs text-gray-500">{candidate.personality}</span>
                </div>

                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-gray-500">Potensi</span>
                  <span className={`font-medium ${getPotentialLabel(candidate.potential).colorClass}`}>
                    {getPotentialLabel(candidate.potential).label}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {getCategoryAverages(candidate.attrs).map(({ key, label, value }) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-8 text-[10px] font-medium text-gray-500">{label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-octagon-dark">
                        <div
                          className="h-full rounded-full bg-octagon-teal"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-[10px] text-gray-400">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-xs text-gray-400">Perkiraan gaji/minggu</span>
                  <span className="font-medium text-white">{formatCurrency(candidate.salary_monthly)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-xs text-gray-400">Perkiraan bonus tanda tangan</span>
                  <span className="font-semibold text-octagon-amber">{formatCurrency(candidate.cost)}</span>
                </div>

                {scoutTexts[candidate.id] && (
                  <p className="mt-3 whitespace-pre-line rounded-md border border-octagon-border bg-octagon-dark p-2 text-xs text-gray-300">
                    {scoutTexts[candidate.id]}
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleScout(candidate)}
                    disabled={scoutingId === candidate.id}
                    className="flex-1 rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {scoutingId === candidate.id ? 'Memuat...' : 'Scouting Report AI'}
                  </button>
                  <button
                    onClick={() => setNegotiatingId((id) => (id === candidate.id ? null : candidate.id))}
                    disabled={signingId === candidate.id}
                    className="flex-1 rounded-md bg-octagon-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {negotiatingId === candidate.id ? 'Tutup Negosiasi' : 'Nego Kontrak'}
                  </button>
                </div>

                {negotiatingId === candidate.id && (
                  <NegotiationPanel
                    key={candidate.id}
                    candidate={candidate}
                    reputation={gym.reputation}
                    balance={gym.balance}
                    signing={signingId === candidate.id}
                    onCancel={() => setNegotiatingId(null)}
                    onAccept={(offer) => handleSignContract(candidate, offer)}
                    onWalkAway={() => handleWalkAway(candidate)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
