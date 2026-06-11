'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'

interface TopFighter {
  name: string
  record: string
  specialty: string
  wins: number
}

interface LeaderboardEntry {
  id: string
  gym_id: string
  gym_name: string
  reputation: number
  total_wins: number
  top_fighters: TopFighter[]
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
                <th className="px-4 py-3">Gym & Fighter Terbaik</th>
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
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{entry.gym_name}</p>
                    {entry.top_fighters?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.top_fighters.map((f, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center gap-1 rounded border border-octagon-border bg-octagon-dark px-1.5 py-0.5 text-[10px] text-gray-300"
                          >
                            <span className="font-medium text-white">{f.name}</span>
                            <span className="text-gray-500">{f.record}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
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
