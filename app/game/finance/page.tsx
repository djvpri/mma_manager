'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import { formatCurrency } from '@/lib/format'
import { CATEGORY_LABELS } from '@/lib/sponsor-contracts'
import type { Staff, SponsorContract } from '@/types'

const BASE_INCOME       = 5_000_000
const REP_INCOME_RATE   = 250_000
const FIGHTER_INCOME_RATE = 2_000_000
const BASE_EXPENSE      = 15_000_000

export default function FinancePage() {
  const gym     = useGameStore((s) => s.gym)
  const fighters = useGameStore((s) => s.fighters)
  const [staff, setStaff]           = useState<Staff[] | null>(null)
  const [contracts, setContracts]   = useState<SponsorContract[] | null>(null)

  useEffect(() => {
    if (!gym) return
    const supabase = createClient()
    Promise.all([
      supabase.from('staff').select('*').eq('gym_id', gym.id).eq('is_hired', true),
      supabase.from('sponsor_contracts').select('*').eq('gym_id', gym.id).eq('status', 'active'),
    ]).then(([staffRes, contractsRes]) => {
      if (!staffRes.error)     setStaff((staffRes.data ?? []) as Staff[])
      if (!contractsRes.error) setContracts((contractsRes.data ?? []) as SponsorContract[])
    })
  }, [gym?.id])

  if (!gym) return <p className="text-sm text-gray-400">Memuat...</p>

  const activeFighters  = fighters.filter((f) => f.status !== 'retired')
  const repBonus        = gym.reputation * REP_INCOME_RATE
  const fighterBonus    = activeFighters.length * FIGHTER_INCOME_RATE
  const sponsorIncome   = (contracts ?? []).reduce((s, c) => s + c.weekly_income, 0)
  const projectedIncome = BASE_INCOME + repBonus + fighterBonus + sponsorIncome

  const fighterSalaries = activeFighters.reduce((s, f) => s + f.salary_monthly, 0)
  const staffSalaries   = (staff ?? []).reduce((s, x) => s + x.salary, 0)

  const netCurrent      = gym.monthly_income - gym.monthly_expense
  const netProjected    = projectedIncome - gym.monthly_expense
  const runway          = netCurrent < 0 ? Math.floor(gym.balance / Math.abs(netCurrent)) : null

  const commissionRate  = 0.1 + (gym.reputation / 100) * 0.1
  const hasFisio        = (staff ?? []).some((s) => s.specialty === 'Pemulihan Cedera')
  const purseShares     = activeFighters.map((f) => f.purse_share_pct)
  const psRange         = purseShares.length > 0
    ? { min: Math.min(...purseShares), max: Math.max(...purseShares) }
    : null

  const maxBar = Math.max(projectedIncome, gym.monthly_expense, 1)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Keuangan</h1>
        <p className="text-sm text-gray-400">Minggu ke-{gym.season_week} · Saldo: <span className="font-semibold text-octagon-amber">{formatCurrency(gym.balance)}</span></p>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
          <p className="text-xs text-gray-500">Pemasukan/Minggu</p>
          <p className="mt-1 text-base font-bold text-octagon-teal">{formatCurrency(gym.monthly_income)}</p>
        </div>
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
          <p className="text-xs text-gray-500">Pengeluaran/Minggu</p>
          <p className="mt-1 text-base font-bold text-octagon-red">{formatCurrency(gym.monthly_expense)}</p>
        </div>
        <div className={`rounded-lg border bg-octagon-card p-3 ${netCurrent >= 0 ? 'border-octagon-teal/30' : 'border-octagon-red/30'}`}>
          <p className="text-xs text-gray-500">Net/Minggu</p>
          <p className={`mt-1 text-base font-bold ${netCurrent >= 0 ? 'text-octagon-teal' : 'text-octagon-red'}`}>
            {netCurrent >= 0 ? '+' : ''}{formatCurrency(netCurrent)}
          </p>
        </div>
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-3">
          <p className="text-xs text-gray-500">Proyeksi Net</p>
          <p className={`mt-1 text-base font-bold ${netProjected >= 0 ? 'text-octagon-teal' : 'text-octagon-red'}`}>
            {netProjected >= 0 ? '+' : ''}{formatCurrency(netProjected)}
          </p>
        </div>
      </div>

      {/* Runway warning */}
      {runway !== null && runway <= 8 && (
        <div className="rounded-lg border border-octagon-red/40 bg-octagon-red/10 p-3">
          <p className="text-sm font-semibold text-octagon-red">
            ⚠ Saldo habis dalam ~{runway} minggu jika pengeluaran tidak dikurangi.
          </p>
        </div>
      )}

      {/* Visual cashflow bar */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Cashflow Visual (Proyeksi)</h2>
        <div className="space-y-2">
          <div>
            <div className="mb-1 flex justify-between text-xs text-gray-400">
              <span>Pemasukan</span><span className="text-octagon-teal">{formatCurrency(projectedIncome)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-octagon-dark">
              <div className="h-full rounded-full bg-octagon-teal" style={{ width: `${(projectedIncome / maxBar) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-gray-400">
              <span>Pengeluaran</span><span className="text-octagon-red">{formatCurrency(gym.monthly_expense)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-octagon-dark">
              <div className="h-full rounded-full bg-octagon-red" style={{ width: `${(gym.monthly_expense / maxBar) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Income breakdown */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Rincian Pemasukan</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Pemasukan dasar</span>
            <span className="text-white">{formatCurrency(BASE_INCOME)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Bonus reputasi ({gym.reputation} × {formatCurrency(REP_INCOME_RATE)})</span>
            <span className="text-white">{formatCurrency(repBonus)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Bonus roster ({activeFighters.length} fighter)</span>
            <span className="text-white">{formatCurrency(fighterBonus)}</span>
          </div>

          {/* Sponsor contracts */}
          {(contracts ?? []).length > 0 && (
            <>
              <div className="border-t border-octagon-border/50 pt-2">
                <p className="mb-1.5 text-xs font-medium text-gray-500">Sponsor Aktif</p>
                {(contracts ?? []).map((c) => (
                  <div key={c.id} className="flex justify-between">
                    <span className="text-gray-400">
                      {c.brand_name}
                      <span className="ml-1 text-[10px] text-gray-600">({CATEGORY_LABELS[c.category]})</span>
                    </span>
                    <span className="text-octagon-teal">+{formatCurrency(c.weekly_income)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-between border-t border-octagon-border pt-2 font-semibold">
            <span className="text-gray-200">Proyeksi total</span>
            <span className="text-octagon-teal">{formatCurrency(projectedIncome)}</span>
          </div>

          {projectedIncome !== gym.monthly_income && (
            <p className="text-xs text-gray-600">
              Berlaku setelah klik &ldquo;Lanjut ke Minggu Berikutnya&rdquo; di tab Roster.
            </p>
          )}
        </div>
      </div>

      {/* Expense breakdown */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Rincian Pengeluaran</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Operasional dasar</span>
            <span className="text-white">{formatCurrency(BASE_EXPENSE)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Gaji fighter ({activeFighters.length} orang)</span>
            <span className="text-white">{formatCurrency(fighterSalaries)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Gaji staf ({staff?.length ?? 0} orang)</span>
            <span className="text-white">{staff === null ? '...' : formatCurrency(staffSalaries)}</span>
          </div>
          <div className="flex justify-between border-t border-octagon-border pt-2 font-semibold">
            <span className="text-gray-200">Total</span>
            <span className="text-octagon-red">{formatCurrency(gym.monthly_expense)}</span>
          </div>
        </div>
      </div>

      {/* Per-fighter finance */}
      {activeFighters.length > 0 && (
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Detail Kontrak Fighter</h2>
          <div className="space-y-2">
            {activeFighters.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-sm">
                <span className="font-medium text-white">{f.name}</span>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>Gaji <span className="text-gray-200">{formatCurrency(f.salary_monthly)}</span></span>
                  <span>Win bonus <span className="text-octagon-amber">{formatCurrency(f.win_bonus)}</span></span>
                  <span>Purse share <span className="text-gray-200">{f.purse_share_pct}%</span></span>
                  <span className={f.contract_fights_left <= 1 ? 'text-octagon-red' : ''}>
                    {f.contract_fights_left}x sisa
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff */}
      {staff && staff.length > 0 && (
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Detail Gaji Staf</h2>
          <div className="space-y-1.5 text-sm">
            {staff.map((s) => (
              <div key={s.id} className="flex justify-between">
                <span className="text-gray-300">{s.name} <span className="text-xs text-gray-500">({s.role})</span></span>
                <span className="text-white">{formatCurrency(s.salary)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fight cashflow info */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Cashflow Per Pertandingan</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Komisi promotor</span>
            <span className="text-octagon-red">−{Math.round(commissionRate * 100)}% dari purse</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Biaya medis (cedera)</span>
            <span className="text-octagon-red">−{formatCurrency(1_000_000)}/minggu {hasFisio ? <span className="text-gray-500">(−30% diskon fisioterapis)</span> : ''}</span>
          </div>
          {psRange && (
            <div className="flex justify-between">
              <span className="text-gray-400">Bagi hasil purse fighter</span>
              <span className="text-octagon-red">−{psRange.min}% s/d −{psRange.max}%</span>
            </div>
          )}
          {(contracts ?? []).some((c) => c.win_bonus > 0) && (
            <div className="flex justify-between">
              <span className="text-gray-400">Win bonus sponsor</span>
              <span className="text-octagon-teal">
                +{formatCurrency((contracts ?? []).reduce((s, c) => s + c.win_bonus, 0))} per kemenangan
              </span>
            </div>
          )}
          <p className="text-xs text-gray-600">Dihitung saat hasil pertarungan disimpan, tidak termasuk cashflow mingguan.</p>
        </div>
      </div>
    </div>
  )
}
