'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import { formatCurrency } from '@/lib/format'
import {
  pickSponsor,
  SPONSOR_APPROACHES,
  getSuccessChance,
  resolveSponsorHunt,
  type SponsorApproach,
  type SponsorBrand,
  type SponsorResult,
} from '@/lib/sponsor'

export default function SponsorPage() {
  const gym = useGameStore((s) => s.gym)
  const setGym = useGameStore((s) => s.setGym)

  const [sponsor] = useState<SponsorBrand | null>(() => (gym ? pickSponsor(gym.reputation) : null))
  const [pitching, setPitching] = useState<SponsorApproach['id'] | null>(null)
  const [result, setResult] = useState<{ approach: SponsorApproach; outcome: SponsorResult } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!gym) {
    return <p className="text-sm text-gray-400">Memuat data gym...</p>
  }

  const alreadyHunted = gym.last_sponsor_week === gym.season_week

  async function handlePitch(approach: SponsorApproach) {
    if (!gym || !sponsor) return
    setError(null)
    setPitching(approach.id)

    const outcome = resolveSponsorHunt(sponsor, approach, gym.reputation)
    const newBalance = gym.balance + outcome.amount
    const newReputation = Math.max(0, Math.min(100, gym.reputation + outcome.reputationChange))

    const supabase = createClient()
    const { data, error: updateError } = await supabase
      .from('gyms')
      .update({ balance: newBalance, reputation: newReputation, last_sponsor_week: gym.season_week })
      .eq('id', gym.id)
      .select()
      .single()

    if (updateError) {
      setError(updateError.message)
      setPitching(null)
      return
    }

    if (data) setGym(data)
    setResult({ approach, outcome })
    setPitching(null)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Sponsor Hunt</h1>
        <p className="text-sm text-gray-400">Cari sponsor tambahan untuk gym, sekali per minggu.</p>
      </header>

      {alreadyHunted ? (
        <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-8 text-center">
          <p className="text-gray-400">Kamu sudah melakukan sponsor hunt minggu ini.</p>
          <p className="mt-1 text-xs text-gray-500">Kembali lagi setelah lanjut ke minggu berikutnya.</p>
        </div>
      ) : sponsor ? (
        <>
          <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Calon Sponsor</p>
            <p className="mt-1 text-lg font-bold text-white">{sponsor.name}</p>
            <p className="text-sm text-gray-400">{sponsor.category}</p>
            <p className="mt-2 text-sm text-gray-300">
              Estimasi nilai kontrak dasar:{' '}
              <span className="font-semibold text-octagon-amber">{formatCurrency(sponsor.baseAmount)}</span>
            </p>
          </div>

          {error && <p className="text-sm text-octagon-red">{error}</p>}

          {!result && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SPONSOR_APPROACHES.map((approach) => {
                const chance = getSuccessChance(approach, gym.reputation)
                const reward = Math.round((sponsor.baseAmount * approach.rewardMult) / 100_000) * 100_000
                return (
                  <button
                    key={approach.id}
                    onClick={() => handlePitch(approach)}
                    disabled={pitching !== null}
                    className="rounded-lg border border-octagon-border bg-octagon-card p-4 text-left transition-colors hover:border-octagon-red/40 hover:bg-octagon-red/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <p className="font-semibold text-white">{approach.label}</p>
                    <p className="mt-1 text-xs text-gray-400">{approach.description}</p>
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Peluang sukses</span>
                        <span className="font-semibold text-octagon-teal">{Math.round(chance * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Jika berhasil</span>
                        <span className="font-semibold text-octagon-amber">+{formatCurrency(reward)}</span>
                      </div>
                      {approach.reputationPenaltyOnFail > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Jika gagal</span>
                          <span className="font-semibold text-octagon-red">
                            -{approach.reputationPenaltyOnFail} reputasi
                          </span>
                        </div>
                      )}
                    </div>
                    {pitching === approach.id && (
                      <p className="mt-2 animate-pulse text-xs text-gray-500">Menghubungi sponsor...</p>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {result && (
            <div
              className={`rounded-lg border p-4 ${
                result.outcome.success
                  ? 'border-octagon-teal/40 bg-octagon-teal/10'
                  : 'border-octagon-red/40 bg-octagon-red/10'
              }`}
            >
              <p className="text-sm font-semibold text-white">
                {result.outcome.success
                  ? `${sponsor.name} setuju bekerja sama!`
                  : `${sponsor.name} menolak tawaranmu.`}
              </p>
              {result.outcome.success ? (
                <p className="mt-1 text-sm text-octagon-teal">
                  Kontrak sponsor cair: +{formatCurrency(result.outcome.amount)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-400">
                  Pendekatan &ldquo;{result.approach.label}&rdquo; tidak berhasil.
                  {result.outcome.reputationChange < 0 &&
                    ` Reputasi gym turun ${Math.abs(result.outcome.reputationChange)} poin.`}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">Coba lagi minggu depan setelah lanjut ke minggu berikutnya.</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
