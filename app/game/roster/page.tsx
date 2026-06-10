'use client'

import Link from 'next/link'
import { useGameStore } from '@/store/game-store'
import FighterCard from '@/components/roster/FighterCard'

export default function RosterPage() {
  const fighters = useGameStore((s) => s.fighters)
  const gym = useGameStore((s) => s.gym)

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roster Fighter</h1>
          <p className="text-sm text-gray-400">
            {gym ? `${gym.name} — ` : ''}
            {fighters.length} fighter terdaftar
          </p>
        </div>
        <Link
          href="/game/recruit"
          className="inline-block rounded-md bg-octagon-red px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-octagon-red/90"
        >
          + Rekrut Fighter
        </Link>
      </header>

      {fighters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-octagon-border bg-octagon-card py-16 text-center">
          <p className="text-gray-400">Belum ada fighter di roster.</p>
          <Link href="/game/recruit" className="mt-3 text-sm font-medium text-octagon-amber hover:underline">
            Rekrut fighter pertamamu →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fighters.map((fighter) => (
            <FighterCard key={fighter.id} fighter={fighter} />
          ))}
        </div>
      )}
    </div>
  )
}
