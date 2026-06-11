'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import { formatCurrency } from '@/lib/format'
import {
  getAvailableSponsors,
  satisfactionLabel,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  MAX_ACTIVE_CONTRACTS,
  type SponsorBrandTemplate,
} from '@/lib/sponsor-contracts'
import type { SponsorContract } from '@/types'

export default function SponsorPage() {
  const gym = useGameStore((s) => s.gym)
  const setGym = useGameStore((s) => s.setGym)

  const [contracts, setContracts] = useState<SponsorContract[] | null>(null)
  const [offers, setOffers] = useState<SponsorBrandTemplate[] | null>(null)
  const [signing, setSigning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gym) return
    loadContracts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym?.id])

  async function loadContracts() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('sponsor_contracts')
      .select('*')
      .eq('gym_id', gym!.id)
      .eq('status', 'active')
      .order('created_at')
    if (!error) setContracts((data ?? []) as SponsorContract[])
  }

  async function handleSearchSponsors() {
    if (!gym) return
    setError(null)

    // Tandai minggu ini sudah search
    const supabase = createClient()
    const { data, error: updateError } = await supabase
      .from('gyms')
      .update({ last_sponsor_week: gym.season_week })
      .eq('id', gym.id)
      .select()
      .single()
    if (updateError) { setError(updateError.message); return }
    if (data) setGym(data)

    setOffers(getAvailableSponsors(gym.reputation, contracts ?? []))
  }

  async function handleSign(brand: SponsorBrandTemplate) {
    if (!gym || !contracts) return
    setError(null)
    setSigning(brand.id)

    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from('sponsor_contracts')
      .insert({
        gym_id:          gym.id,
        brand_name:      brand.name,
        category:        brand.category,
        weekly_income:   brand.weekly_income,
        win_bonus:       brand.win_bonus,
        duration_weeks:  brand.duration_weeks,
        weeks_remaining: brand.duration_weeks,
        satisfaction:    70,
        status:          'active',
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
    } else if (data) {
      setContracts((prev) => [...(prev ?? []), data as SponsorContract])
      setOffers((prev) => prev?.filter((o) => o.id !== brand.id) ?? null)
    }
    setSigning(null)
  }

  if (!gym) return <p className="text-sm text-gray-400">Memuat...</p>

  const activeContracts = contracts ?? []
  const alreadySearched = gym.last_sponsor_week === gym.season_week
  const canSign = activeContracts.length < MAX_ACTIVE_CONTRACTS
  const weeklyFromSponsors = activeContracts.reduce((s, c) => s + c.weekly_income, 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Sponsor</h1>
        <p className="text-sm text-gray-400">
          Kelola kontrak sponsor gym. Maksimum {MAX_ACTIVE_CONTRACTS} kontrak aktif sekaligus.
        </p>
      </header>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
          <p className="text-xs text-gray-500">Kontrak Aktif</p>
          <p className="mt-1 text-xl font-bold text-white">
            {activeContracts.length}
            <span className="text-sm font-normal text-gray-500"> / {MAX_ACTIVE_CONTRACTS}</span>
          </p>
        </div>
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
          <p className="text-xs text-gray-500">Pemasukan/Minggu</p>
          <p className="mt-1 text-lg font-bold text-octagon-teal">{formatCurrency(weeklyFromSponsors)}</p>
        </div>
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
          <p className="text-xs text-gray-500">Reputasi Gym</p>
          <p className="mt-1 text-xl font-bold text-octagon-amber">{gym.reputation}<span className="text-sm font-normal text-gray-500">/100</span></p>
        </div>
      </div>

      {error && <p className="text-sm text-octagon-red">{error}</p>}

      {/* Kontrak Aktif */}
      {contracts === null ? (
        <p className="text-sm text-gray-400">Memuat kontrak...</p>
      ) : activeContracts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-8 text-center">
          <p className="text-gray-400">Belum ada kontrak sponsor aktif.</p>
          <p className="mt-1 text-xs text-gray-500">Cari sponsor di bawah untuk mulai mendapat pemasukan mingguan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Kontrak Aktif</h2>
          {activeContracts.map((c) => {
            const sat = satisfactionLabel(c.satisfaction)
            const progress = Math.round((c.weeks_remaining / c.duration_weeks) * 100)
            return (
              <div key={c.id} className="rounded-lg border border-octagon-border bg-octagon-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{c.brand_name}</p>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[c.category]}`}>
                        {CATEGORY_LABELS[c.category]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatCurrency(c.weekly_income)}/minggu
                      {c.win_bonus > 0 && ` · +${formatCurrency(c.win_bonus)} per kemenangan`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-medium ${sat.color}`}>{sat.label}</p>
                    <p className="text-xs text-gray-500">{c.weeks_remaining} minggu tersisa</p>
                  </div>
                </div>

                {/* Progress bar sisa kontrak */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>Durasi Kontrak</span>
                    <span>{c.weeks_remaining}/{c.duration_weeks} minggu</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-octagon-dark">
                    <div className="h-full rounded-full bg-octagon-teal transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {/* Satisfaction bar */}
                <div className="mt-1.5 space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>Kepuasan Sponsor</span>
                    <span>{c.satisfaction}/100</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-octagon-dark">
                    <div
                      className={`h-full rounded-full transition-all ${c.satisfaction >= 50 ? 'bg-octagon-teal' : c.satisfaction >= 20 ? 'bg-octagon-amber' : 'bg-octagon-red'}`}
                      style={{ width: `${c.satisfaction}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Cari Sponsor Baru */}
      {canSign && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Cari Sponsor Baru</h2>

          {alreadySearched && !offers ? (
            <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-6 text-center">
              <p className="text-sm text-gray-400">Sudah mencari sponsor minggu ini.</p>
              <p className="text-xs text-gray-500 mt-1">Kembali minggu depan untuk penawaran baru.</p>
            </div>
          ) : !offers ? (
            <button
              onClick={handleSearchSponsors}
              className="rounded-md bg-octagon-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90"
            >
              Cari Penawaran Sponsor
            </button>
          ) : offers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-6 text-center">
              <p className="text-sm text-gray-400">Tidak ada penawaran yang tersedia saat ini.</p>
              <p className="text-xs text-gray-500 mt-1">Tingkatkan reputasi gym untuk menarik sponsor lebih besar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {offers.map((brand) => (
                <div key={brand.id} className="rounded-lg border border-octagon-border bg-octagon-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{brand.name}</p>
                      <p className="text-xs text-gray-500">{brand.tagline}</p>
                    </div>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[brand.category]}`}>
                      {CATEGORY_LABELS[brand.category]}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Per minggu</span>
                      <span className="font-semibold text-octagon-teal">{formatCurrency(brand.weekly_income)}</span>
                    </div>
                    {brand.win_bonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bonus menang</span>
                        <span className="font-semibold text-octagon-amber">+{formatCurrency(brand.win_bonus)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Durasi</span>
                      <span className="text-gray-200">{brand.duration_weeks} minggu</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total estimasi</span>
                      <span className="text-gray-200">{formatCurrency(brand.weekly_income * brand.duration_weeks)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSign(brand)}
                    disabled={signing !== null}
                    className="mt-3 w-full rounded-md bg-octagon-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:opacity-50"
                  >
                    {signing === brand.id ? 'Menandatangani...' : 'Tanda Tangan Kontrak'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!canSign && (
        <p className="text-xs text-gray-500">Slot sponsor penuh ({MAX_ACTIVE_CONTRACTS}/{MAX_ACTIVE_CONTRACTS}). Tunggu kontrak berakhir untuk menambah sponsor baru.</p>
      )}
    </div>
  )
}
