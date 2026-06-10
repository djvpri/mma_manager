'use client'

import { useRouter } from 'next/navigation'
import { useGameStore } from '@/store/game-store'
import { createClient } from '@/lib/supabase'
import { IconLogout, formatCurrency } from './nav-icons'

export default function MobileHeader() {
  const router = useRouter()
  const gym = useGameStore((s) => s.gym)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-octagon-border bg-octagon-card px-4 py-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{gym?.name ?? 'Gym Belum Dibuat'}</p>
        <p className="text-[11px] text-gray-400">
          {gym?.city ?? '—'} · Minggu ke-{gym?.season_week ?? 1}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-[11px] text-gray-400">Saldo</p>
          <p className="text-xs font-semibold text-octagon-amber">{formatCurrency(gym?.balance ?? 0)}</p>
        </div>
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
