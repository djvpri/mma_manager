'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import { formatCurrency } from '@/lib/format'
import type { Staff } from '@/types'

const BASE_INCOME = 5_000_000
const REPUTATION_INCOME_RATE = 250_000
const FIGHTER_INCOME_RATE = 2_000_000
const BASE_EXPENSE = 15_000_000

export default function FinancePage() {
  const gym = useGameStore((s) => s.gym)
  const fighters = useGameStore((s) => s.fighters)
  const [staff, setStaff] = useState<Staff[] | null>(null)

  useEffect(() => {
    if (!gym) return
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('staff').select('*').eq('gym_id', gym!.id).eq('is_hired', true)
      setStaff((data ?? []) as Staff[])
    }
    load()
  }, [gym])

  if (!gym) {
    return <p className="text-sm text-gray-400">Memuat data gym...</p>
  }

  const activeFighters = fighters.filter((f) => f.status !== 'retired')
  const reputationBonus = gym.reputation * REPUTATION_INCOME_RATE
  const fighterBonus = activeFighters.length * FIGHTER_INCOME_RATE
  const projectedIncome = BASE_INCOME + reputationBonus + fighterBonus

  const fighterSalaries = activeFighters.reduce((sum, f) => sum + f.salary_monthly, 0)
  const staffSalaries = (staff ?? []).reduce((sum, s) => sum + s.salary, 0)

  const netCurrent = gym.monthly_income - gym.monthly_expense
  const commissionRate = 0.1 + (gym.reputation / 100) * 0.1
  const hasFisioterapis = (staff ?? []).some((s) => s.specialty === 'Pemulihan Cedera')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Keuangan</h1>
        <p className="text-sm text-gray-400">Rincian pemasukan dan pengeluaran gym per minggu.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <p className="text-xs text-gray-400">Pemasukan / Minggu</p>
          <p className="mt-1 text-lg font-bold text-octagon-teal">{formatCurrency(gym.monthly_income)}</p>
        </div>
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <p className="text-xs text-gray-400">Pengeluaran / Minggu</p>
          <p className="mt-1 text-lg font-bold text-octagon-red">{formatCurrency(gym.monthly_expense)}</p>
        </div>
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <p className="text-xs text-gray-400">Net / Minggu</p>
          <p className={`mt-1 text-lg font-bold ${netCurrent >= 0 ? 'text-octagon-teal' : 'text-octagon-red'}`}>
            {netCurrent >= 0 ? '+' : ''}
            {formatCurrency(netCurrent)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Rincian Pemasukan</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Pemasukan dasar</span>
            <span className="text-white">{formatCurrency(BASE_INCOME)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">
              Bonus reputasi ({gym.reputation}/100 × {formatCurrency(REPUTATION_INCOME_RATE)})
            </span>
            <span className="text-white">{formatCurrency(reputationBonus)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">
              Bonus roster ({activeFighters.length} fighter × {formatCurrency(FIGHTER_INCOME_RATE)})
            </span>
            <span className="text-white">{formatCurrency(fighterBonus)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-octagon-border pt-2 font-semibold">
            <span className="text-gray-200">Proyeksi minggu depan</span>
            <span className="text-octagon-teal">{formatCurrency(projectedIncome)}</span>
          </div>
          {projectedIncome !== gym.monthly_income && (
            <p className="text-xs text-gray-500">
              Pemasukan minggu ini ({formatCurrency(gym.monthly_income)}) dihitung dari kondisi gym minggu lalu.
              Klik &ldquo;Lanjut ke Minggu Berikutnya&rdquo; di tab Roster untuk memperbarui ke proyeksi di atas.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Rincian Pengeluaran</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Operasional dasar</span>
            <span className="text-white">{formatCurrency(BASE_EXPENSE)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Gaji fighter ({activeFighters.length} orang)</span>
            <span className="text-white">{formatCurrency(fighterSalaries)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Gaji staf ({staff?.length ?? 0} orang)</span>
            <span className="text-white">{staff === null ? '...' : formatCurrency(staffSalaries)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-octagon-border pt-2 font-semibold">
            <span className="text-gray-200">Total pengeluaran</span>
            <span className="text-octagon-red">{formatCurrency(gym.monthly_expense)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Cash Flow Pertandingan</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">
              Komisi Promotor ({Math.round(commissionRate * 100)}% dari purse, naik seiring reputasi)
            </span>
            <span className="text-octagon-teal">+{Math.round(commissionRate * 100)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">
              Biaya Medis (per cedera, {formatCurrency(1_000_000)}/minggu pemulihan
              {hasFisioterapis ? ', didiskon 30% oleh Fisioterapis' : ''})
            </span>
            <span className="text-octagon-red">{hasFisioterapis ? '-70%' : '-100%'}</span>
          </div>
          <p className="text-xs text-gray-500">
            Komisi dan biaya medis dihitung per pertandingan, tidak termasuk dalam pemasukan/pengeluaran mingguan
            di atas. Lihat ringkasan di layar hasil pertarungan.
          </p>
        </div>
      </div>

      {activeFighters.length > 0 && (
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Gaji Fighter</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            {activeFighters.map((f) => (
              <div key={f.id} className="flex items-center justify-between">
                <span className="text-gray-300">{f.name}</span>
                <span className="text-white">{formatCurrency(f.salary_monthly)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {staff && staff.length > 0 && (
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Gaji Staf</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-gray-300">
                  {s.name} <span className="text-xs text-gray-500">({s.role})</span>
                </span>
                <span className="text-white">{formatCurrency(s.salary)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
