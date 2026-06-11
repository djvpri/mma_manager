'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import Avatar from '@/components/avatar/Avatar'
import { getPotentialLabel } from '@/lib/potential'
import { getCategoryAverages } from '@/lib/attrs'
import { formatCurrency } from '@/lib/format'
import { poolFighterToCandidate, requiredReputation } from '@/lib/pool-fighter'
import NegotiationPanel from '@/components/recruit/NegotiationPanel'
import type { ContractOffer } from '@/lib/negotiation'
import type { Fighter, WeightClass } from '@/types'

const WEIGHT_CLASSES: WeightClass[] = [
  'Strawweight','Flyweight','Bantamweight','Featherweight',
  'Lightweight','Welterweight','Middleweight','Heavyweight',
]
const PAGE_SIZE = 12

export default function RecruitPage() {
  const gym         = useGameStore((s) => s.gym)
  const fighters    = useGameStore((s) => s.fighters)
  const setGym      = useGameStore((s) => s.setGym)
  const setFighters = useGameStore((s) => s.setFighters)

  const [pool, setPool]             = useState<Fighter[]>([])
  const [loading, setLoading]       = useState(true)
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)
  const [signingId, setSigningId]   = useState<string | null>(null)
  const [aiTexts, setAiTexts]       = useState<Record<string, string>>({})
  const [negotiatingId, setNegotiatingId] = useState<string | null>(null)
  const [filterWC, setFilterWC]     = useState<WeightClass | 'all'>('all')
  const [page, setPage]             = useState(1)
  const [error, setError]           = useState<string | null>(null)
  const [info, setInfo]             = useState<string | null>(null)

  useEffect(() => {
    if (!gym) return
    loadPool()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym?.id])

  async function loadPool() {
    setLoading(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('fighters').select('*').is('gym_id', null).eq('status', 'prospect').order('age')
    if (!err) setPool((data ?? []) as Fighter[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    if (filterWC === 'all') return pool
    return pool.filter((f) => f.weight_class === filterWC)
  }, [pool, filterWC])

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filtered.length

  async function handleAiScout(fighter: Fighter) {
    setAiLoadingId(fighter.id)
    try {
      const res = await fetch('/api/ai-scout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fighter: poolFighterToCandidate(fighter) }),
      })
      const data = await res.json()
      setAiTexts((m) => ({ ...m, [fighter.id]: data.text ?? 'Gagal memuat report.' }))
    } catch {
      setAiTexts((m) => ({ ...m, [fighter.id]: 'Gagal memuat report.' }))
    } finally {
      setAiLoadingId(null)
    }
  }

  async function handleSignContract(fighter: Fighter, offer: ContractOffer) {
    if (!gym) return
    setError(null)
    setSigningId(fighter.id)
    const supabase = createClient()

    const { data, error: rpcError } = await supabase.rpc('recruit_pool_fighter', {
      p_fighter_id:        fighter.id,
      p_gym_id:            gym.id,
      p_salary:            offer.salary,
      p_win_bonus:         offer.winBonus,
      p_purse_share_pct:   offer.purseSharePct,
      p_contract_fights:   offer.contractLength,
      p_buyout_clause:     offer.buyoutClause,
      p_title_shot_clause: offer.titleShotClause,
      p_signing_bonus:     offer.bonus,
    })

    if (rpcError || !data) {
      setError(rpcError?.message ?? 'Gagal merekrut fighter.')
      setSigningId(null)
      return
    }

    setGym({ ...gym, balance: gym.balance - offer.bonus, monthly_expense: gym.monthly_expense + offer.salary })
    setFighters([...fighters, data as Fighter])
    setPool((prev) => prev.filter((f) => f.id !== fighter.id))
    setNegotiatingId(null)
    setSigningId(null)
    setInfo(`${fighter.name} resmi bergabung dengan ${gym.name}!`)
  }

  if (!gym) return <p className="text-sm text-gray-400">Memuat...</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Rekrutmen</h1>
        <p className="text-sm text-gray-400">
          {loading ? 'Memuat pool...' : `${filtered.length} fighter tersedia`}
          {filterWC !== 'all' && ` · ${filterWC}`}
          {' · '}Saldo: <span className="font-semibold text-octagon-amber">{formatCurrency(gym.balance)}</span>
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setFilterWC('all'); setPage(1) }}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${filterWC === 'all' ? 'border-octagon-red bg-octagon-red/20 text-white' : 'border-octagon-border text-gray-400 hover:border-gray-500'}`}
        >
          Semua
        </button>
        {WEIGHT_CLASSES.map((wc) => (
          <button key={wc} onClick={() => { setFilterWC(wc); setPage(1) }}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${filterWC === wc ? 'border-octagon-red bg-octagon-red/20 text-white' : 'border-octagon-border text-gray-400 hover:border-gray-500'}`}
          >
            {wc}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-octagon-red">{error}</p>}
      {info  && <p className="text-sm text-octagon-teal">{info}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Memuat database fighter...</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-octagon-border bg-octagon-card py-16 text-center">
          <p className="text-gray-400">Tidak ada fighter tersedia.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((fighter) => {
              const reqRep   = requiredReputation(fighter)
              const canRecruit = gym.reputation >= reqRep
              const candidate  = poolFighterToCandidate(fighter)
              const potLabel   = getPotentialLabel(fighter.potential)

              return (
                <div key={fighter.id}
                  className={`rounded-lg border bg-octagon-card p-4 ${!canRecruit ? 'opacity-60' : 'border-octagon-border'}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar size={56} className="shrink-0 overflow-hidden rounded-full bg-octagon-dark" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-white">{fighter.name}</h3>
                      <p className="truncate text-sm italic text-octagon-amber">&ldquo;{fighter.nickname}&rdquo;</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {fighter.weight_class} · {fighter.specialty} · {fighter.age} th
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-300">
                      Rekor <span className="font-semibold text-white">{fighter.record.w}-{fighter.record.l}-{fighter.record.d}</span>
                    </span>
                    <span className="text-xs text-gray-500">{fighter.personality}</span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Potensi</span>
                    <span className={`font-medium ${potLabel.colorClass}`}>{potLabel.label}</span>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {getCategoryAverages(fighter.attrs).map(({ key, label, value }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-8 text-[10px] font-medium text-gray-500">{label}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-octagon-dark">
                          <div className="h-full rounded-full bg-octagon-teal" style={{ width: `${value}%` }} />
                        </div>
                        <span className="w-6 text-right text-[10px] text-gray-400">{value}</span>
                      </div>
                    ))}
                  </div>

                  {!canRecruit && (
                    <p className="mt-2 text-[10px] text-octagon-red">
                      Butuh reputasi gym minimal {reqRep} untuk merekrut fighter ini.
                    </p>
                  )}

                  {aiTexts[fighter.id] && (
                    <p className="mt-3 whitespace-pre-line rounded-md border border-octagon-border bg-octagon-dark p-2 text-xs text-gray-300">
                      {aiTexts[fighter.id]}
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleAiScout(fighter)}
                      disabled={aiLoadingId === fighter.id}
                      className="flex-1 rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {aiLoadingId === fighter.id ? 'Memuat...' : 'Scouting AI'}
                    </button>
                    <button
                      onClick={() => setNegotiatingId((id) => id === fighter.id ? null : fighter.id)}
                      disabled={!canRecruit || signingId === fighter.id}
                      className="flex-1 rounded-md bg-octagon-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {negotiatingId === fighter.id ? 'Tutup' : 'Nego Kontrak'}
                    </button>
                  </div>

                  {negotiatingId === fighter.id && (
                    <NegotiationPanel
                      key={fighter.id}
                      candidate={candidate}
                      reputation={gym.reputation}
                      balance={gym.balance}
                      signing={signingId === fighter.id}
                      onCancel={() => setNegotiatingId(null)}
                      onAccept={(offer) => handleSignContract(fighter, offer)}
                      onWalkAway={() => { setNegotiatingId(null); setInfo(`${fighter.name} pergi mencari tawaran lain.`) }}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-octagon-border px-6 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal"
              >
                Tampilkan lebih banyak ({filtered.length - visible.length} tersisa)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
