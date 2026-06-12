'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/store/game-store'
import { createClient } from '@/lib/supabase'
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme'
import { IconLogout, IconRefresh, IconSun, IconMoon, formatCurrency } from './nav-icons'

export default function MobileHeader() {
  const router = useRouter()
  const gym = useGameStore((s) => s.gym)
  const resetGame = useGameStore((s) => s.resetGame)
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  async function handleNewGame() {
    if (!gym) return
    const confirmed = window.confirm(
      'Yakin ingin memulai New Game? Semua data gym, fighter, staf, dan riwayat pertarungan akan dihapus permanen.'
    )
    if (!confirmed) return

    const supabase = createClient()
    await supabase.from('fight_results').delete().eq('gym_id', gym.id)
    await supabase.from('fighters').delete().eq('gym_id', gym.id)
    await supabase.from('staff').delete().eq('gym_id', gym.id)
    await supabase.from('leaderboard').delete().eq('gym_id', gym.id)
    await supabase.from('gyms').delete().eq('id', gym.id)

    resetGame()
    router.push('/onboarding')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-octagon-border bg-octagon-card px-4 py-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{gym?.name ?? 'Gym Belum Dibuat'}</p>
        <p className="truncate text-[11px] text-gray-400">
          {gym?.city ?? '—'} · Minggu ke-{gym?.season_week ?? 1}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-[11px] text-gray-400">Saldo</p>
          <p className="text-xs font-semibold text-octagon-amber">{formatCurrency(gym?.balance ?? 0)}</p>
        </div>
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/5 hover:text-octagon-amber"
          aria-label="Ganti Tema"
        >
          {theme === 'dark' ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
        </button>
        <button
          onClick={handleNewGame}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/5 hover:text-octagon-amber"
          aria-label="New Game"
        >
          <IconRefresh className="h-5 w-5" />
        </button>
        <button
          onClick={handleLogout}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/5 hover:text-octagon-red"
          aria-label="Keluar"
        >
          <IconLogout className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
