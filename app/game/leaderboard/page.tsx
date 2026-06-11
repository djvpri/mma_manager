'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'

interface LeaderboardEntry {
  id: string
  gym_id: string
  gym_name: string
  reputation: number
  total_wins: number
}

export default function LeaderboardPage() {
  const gym = useGameStore((s) => s.gym)
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('reputation', { ascending: false })
        .order('total_wins', { ascending: false })
        .limit(50)

      if (error) setError(error.message)
      else setEntries((data ?? []) as LeaderboardEntry[])
    }
    load()
  }, [])

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-sm text-gray-400">Peringkat gym berdasarkan reputasi & total kemenangan.</p>
      </header>

      {error && <p className="text-sm text-octagon-red">{error}</p>}

      {entries === null ? (
        <p className="text-sm text-gray-400">Memuat leaderboard...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400">Belum ada data leaderboard.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-octagon-border bg-octagon-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-octagon-border text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Gym</th>
                <th className="px-4 py-3 text-right">Reputasi</th>
                <th className="px-4 py-3 text-right">Menang</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-b border-octagon-border last:border-0 ${
                    entry.gym_id === gym?.id ? 'bg-octagon-red/10' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-white">{entry.gym_name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-octagon-teal">{entry.reputation}</td>
                  <td className="px-4 py-3 text-right text-gray-200">{entry.total_wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
