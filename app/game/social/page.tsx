'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/game-store'
import { fetchFriendGyms, addGymFriend, buildWhatsAppInviteUrl, type FriendGym } from '@/lib/social'

export default function SocialPage() {
  const gym = useGameStore((s) => s.gym)
  const [friends, setFriends]   = useState<FriendGym[] | null>(null)
  const [code, setCode]         = useState('')
  const [addBusy, setAddBusy]   = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)

  useEffect(() => {
    if (!gym) return
    fetchFriendGyms().then(setFriends)
  }, [gym?.id])

  if (!gym) return <p className="text-sm text-gray-400">Memuat...</p>

  async function handleCopy() {
    await navigator.clipboard.writeText(gym!.friend_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleAddFriend() {
    if (!code.trim()) return
    setAddError(null)
    setAddBusy(true)
    const { error } = await addGymFriend(code.trim())
    if (error) {
      setAddError('Gagal menambahkan teman: ' + error)
    } else {
      setCode('')
      setFriends(await fetchFriendGyms())
    }
    setAddBusy(false)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Sosial</h1>
        <p className="text-sm text-gray-400">Terhubung dengan teman dan bandingkan progres gym kalian.</p>
      </header>

      {/* Kode gym + undang via WA */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Kode Gym Kamu</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded border border-octagon-border bg-octagon-dark px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-octagon-amber">
            {gym.friend_code}
          </span>
          <button
            onClick={handleCopy}
            className="rounded border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-amber hover:text-octagon-amber"
          >
            {copied ? 'Tersalin!' : 'Salin Kode'}
          </button>
          <a
            href={buildWhatsAppInviteUrl(gym.name, gym.friend_code)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-octagon-teal px-3 py-1.5 text-xs font-semibold text-octagon-dark transition-colors hover:bg-octagon-teal/90"
          >
            Bagikan via WhatsApp
          </a>
        </div>
        <p className="mt-2 text-xs text-gray-600">Bagikan kode ini ke teman supaya mereka bisa menambahkanmu.</p>
      </div>

      {/* Tambah teman */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Tambah Teman</h2>
        {addError && <p className="mb-2 text-xs text-octagon-red">{addError}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Masukkan kode gym teman"
            maxLength={6}
            className="rounded border border-octagon-border bg-octagon-dark px-3 py-1.5 font-mono text-sm uppercase tracking-widest text-white placeholder:text-gray-600 placeholder:tracking-normal focus:border-octagon-amber focus:outline-none"
          />
          <button
            onClick={handleAddFriend}
            disabled={addBusy || !code.trim()}
            className="rounded bg-octagon-amber px-3 py-1.5 text-xs font-semibold text-octagon-dark transition-colors hover:bg-octagon-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addBusy ? 'Memproses...' : 'Tambahkan'}
          </button>
        </div>
      </div>

      {/* Daftar teman */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Daftar Teman</h2>
        {friends === null ? (
          <p className="text-sm text-gray-500">Memuat...</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada teman. Tambahkan lewat kode gym di atas.</p>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div key={f.gym_id} className="flex flex-col gap-2 rounded border border-octagon-border/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{f.name}</p>
                  <p className="text-xs text-gray-500">{f.city} · Minggu ke-{f.season_week}</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-400">Reputasi <span className="text-octagon-amber">{f.reputation}</span></span>
                  <span className="text-gray-400">Rekor <span className="text-octagon-teal">{f.wins}W</span>-<span className="text-octagon-red">{f.losses}L</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
