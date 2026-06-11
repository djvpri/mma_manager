'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'

const CITIES = ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Bali', 'Yogyakarta']

const MIN_BALANCE = 50_000_000
const MAX_BALANCE = 500_000_000
const BALANCE_STEP = 10_000_000

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function OnboardingPage() {
  const router = useRouter()
  const setGym = useGameStore((s) => s.setGym)
  const setFighters = useGameStore((s) => s.setFighters)

  const [name, setName] = useState('')
  const [city, setCity] = useState(CITIES[0])
  const [balance, setBalance] = useState(MIN_BALANCE)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login')
        return
      }

      const { data: gym } = await supabase
        .from('gyms')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (gym) {
        router.replace('/game/roster')
        return
      }
      setChecking(false)
    }
    check()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/auth/login')
      return
    }

    const { data: gym, error: gymError } = await supabase
      .from('gyms')
      .insert({ user_id: user.id, name: name.trim() || 'Garuda MMA', city, balance })
      .select()
      .single()

    if (gymError || !gym) {
      setError(gymError?.message ?? 'Gagal membuat gym.')
      setLoading(false)
      return
    }

    setGym(gym)
    setFighters([])
    router.push('/game/roster')
    router.refresh()
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-octagon-dark">
        <p className="text-sm text-gray-400">Memuat...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-octagon-dark px-4">
      <div className="w-full max-w-md rounded-lg border border-octagon-border bg-octagon-card p-6">
        <h1 className="text-xl font-bold text-white">Buat Gym Pertamamu</h1>
        <p className="mt-1 text-sm text-gray-400">
          Mulai karir sebagai manajer MMA. Roster awal kosong — rekrut fighter pertamamu di menu Rekrutmen.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Nama Gym</label>
            <input
              type="text"
              placeholder="Garuda MMA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-octagon-border bg-octagon-dark px-3 py-2 text-sm text-white focus:border-octagon-red focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Kota</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-md border border-octagon-border bg-octagon-dark px-3 py-2 text-sm text-white focus:border-octagon-red focus:outline-none"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-medium text-gray-400">Saldo Awal</label>
              <span className="text-sm font-semibold text-octagon-amber">{formatCurrency(balance)}</span>
            </div>
            <input
              type="range"
              min={MIN_BALANCE}
              max={MAX_BALANCE}
              step={BALANCE_STEP}
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
              className="w-full accent-octagon-red"
            />
            <div className="mt-1 flex justify-between text-[10px] text-gray-500">
              <span>{formatCurrency(MIN_BALANCE)}</span>
              <span>{formatCurrency(MAX_BALANCE)}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Saldo lebih besar mempermudah awal permainan, namun reputasi & pemasukan tetap dimulai dari nol.
            </p>
          </div>

          {error && <p className="text-sm text-octagon-red">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-octagon-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:opacity-50"
          >
            {loading ? 'Membuat gym...' : 'Mulai Karir'}
          </button>
        </form>
      </div>
    </div>
  )
}
