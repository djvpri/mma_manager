'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import { STARTER_FIGHTERS } from '@/lib/seed-fighters'

const CITIES = ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Bali', 'Yogyakarta']

export default function OnboardingPage() {
  const router = useRouter()
  const setGym = useGameStore((s) => s.setGym)
  const setFighters = useGameStore((s) => s.setFighters)

  const [name, setName] = useState('')
  const [city, setCity] = useState(CITIES[0])
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
      .insert({ user_id: user.id, name: name.trim() || 'Garuda MMA', city })
      .select()
      .single()

    if (gymError || !gym) {
      setError(gymError?.message ?? 'Gagal membuat gym.')
      setLoading(false)
      return
    }

    const { data: fighters, error: fightersError } = await supabase
      .from('fighters')
      .insert(STARTER_FIGHTERS.map((f) => ({ ...f, gym_id: gym.id })))
      .select()

    if (fightersError) {
      setError(fightersError.message)
      setLoading(false)
      return
    }

    await supabase.from('gyms').update({ starters_seeded: true }).eq('id', gym.id)

    setGym({ ...gym, starters_seeded: true })
    setFighters(fighters ?? [])
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
          Mulai karir sebagai manajer MMA. Kamu akan mendapat 6 fighter awal untuk roster.
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
