'use client'

import { useEffect } from 'react'
import { useGameStore } from '@/store/game-store'
import { syncLeaderboard } from '@/lib/leaderboard'
import Sidebar from './Sidebar'
import type { Fighter, Gym } from '@/types'

export default function GameShell({
  gym,
  fighters,
  children,
}: {
  gym: Gym
  fighters: Fighter[]
  children: React.ReactNode
}) {
  const setGym = useGameStore((s) => s.setGym)
  const setFighters = useGameStore((s) => s.setFighters)

  useEffect(() => {
    setGym(gym)
    setFighters(fighters)
    syncLeaderboard(gym, fighters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym.id])

  return (
    <div className="flex min-h-screen bg-octagon-dark">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  )
}
