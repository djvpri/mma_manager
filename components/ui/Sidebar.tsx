'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useGameStore } from '@/store/game-store'
import { createClient } from '@/lib/supabase'
import { NAV_ITEMS, IconLogout, IconRefresh, formatCurrency } from './nav-icons'
import ThemeToggle from './ThemeToggle'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const gym = useGameStore((s) => s.gym)
  const resetGame = useGameStore((s) => s.resetGame)

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
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-octagon-border bg-octagon-card lg:flex">
      <div className="border-b border-octagon-border px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-octagon-red text-sm font-bold text-white">
            M
          </span>
          <span className="text-lg font-bold tracking-wide text-white">MMA MANAGER</span>
        </div>
      </div>

      <div className="border-b border-octagon-border px-5 py-4">
        <p className="truncate text-sm font-semibold text-white">{gym?.name ?? 'Gym Belum Dibuat'}</p>
        <p className="text-xs text-gray-400">{gym?.city ?? '—'}</p>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-gray-400">Saldo</span>
          <span className="font-semibold text-octagon-amber">{formatCurrency(gym?.balance ?? 0)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-400">Reputasi</span>
          <span className="font-semibold text-octagon-teal">{gym?.reputation ?? 0}/100</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border border-octagon-red/30 bg-octagon-red/10 text-octagon-red'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-100'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-octagon-border px-3 py-3 space-y-1">
        <ThemeToggle className="w-full" />
        <button
          onClick={handleNewGame}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-octagon-amber"
        >
          <IconRefresh className="h-5 w-5" />
          New Game
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-octagon-red"
        >
          <IconLogout className="h-5 w-5" />
          Keluar
        </button>
      </div>

      <div className="border-t border-octagon-border px-5 py-4 text-xs text-gray-500">
        Minggu ke-{gym?.season_week ?? 1}
      </div>
    </aside>
  )
}
