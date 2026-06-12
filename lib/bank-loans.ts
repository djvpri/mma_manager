import { createClient } from './supabase'

export const LOAN_AMOUNTS = [50_000_000, 100_000_000, 250_000_000, 500_000_000] as const
export const LOAN_TERMS = [12, 24, 36] as const

export interface BankLoan {
  id: string
  gym_id: string
  principal: number
  interest_rate: number
  total_repayment: number
  weekly_payment: number
  weeks_total: number
  weeks_remaining: number
  status: 'active' | 'paid'
  season_week_taken: number
  created_at: string
}

/** Limit pinjaman berdasarkan reputasi gym. */
export function getLoanLimit(reputation: number): number {
  if (reputation >= 75) return 500_000_000
  if (reputation >= 50) return 250_000_000
  if (reputation >= 25) return 100_000_000
  return 50_000_000
}

/** Bunga total pinjaman berdasarkan tenor & reputasi (diskon untuk gym besar). */
export function getLoanRate(weeks: number, reputation: number): number {
  const baseRate = weeks === 12 ? 0.08 : weeks === 24 ? 0.15 : 0.22
  const discount = reputation >= 75 ? 0.03 : reputation >= 50 ? 0.015 : 0
  return Math.max(0.03, baseRate - discount)
}

export function previewLoan(principal: number, weeks: number, reputation: number) {
  const rate = getLoanRate(weeks, reputation)
  const total = Math.round(principal * (1 + rate))
  const weekly = Math.ceil(total / weeks)
  return { rate, total, weekly }
}

export async function fetchActiveLoan(gymId: string): Promise<BankLoan | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('bank_loans')
    .select('*')
    .eq('gym_id', gymId)
    .eq('status', 'active')
    .maybeSingle()
  return (data as BankLoan | null) ?? null
}

export async function takeBankLoan(
  gymId: string,
  principal: number,
  weeks: number
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('take_bank_loan', {
    p_gym_id: gymId,
    p_principal: principal,
    p_weeks: weeks,
  })
  return { error: error?.message ?? null }
}
