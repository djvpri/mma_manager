'use client'

import { useState } from 'react'
import type { Fighter, FightResult } from '@/types'
import Avatar from '@/components/avatar/Avatar'
import { useGameStore } from '@/store/game-store'
import { generateFighterAvatar } from '@/lib/ai-avatar'
import { createClient } from '@/lib/supabase'

const STATUS_STYLES: Record<Fighter['status'], string> = {
  active: 'border-octagon-teal/30 bg-octagon-teal/15 text-octagon-teal',
  training: 'border-octagon-amber/30 bg-octagon-amber/15 text-octagon-amber',
  injured: 'border-octagon-red/30 bg-octagon-red/15 text-octagon-red',
  prospect: 'border-gray-500/30 bg-gray-500/15 text-gray-300',
  retired: 'border-gray-700/40 bg-gray-700/30 text-gray-500',
}

const STATUS_LABELS: Record<Fighter['status'], string> = {
  active: 'Aktif',
  training: 'Latihan',
  injured: 'Cedera',
  prospect: 'Prospek',
  retired: 'Pensiun',
}

const ATTR_LABELS: { key: keyof Fighter['attrs']; label: string }[] = [
  { key: 'striking', label: 'STR' },
  { key: 'grappling', label: 'GRP' },
  { key: 'cardio', label: 'CDO' },
  { key: 'fight_iq', label: 'IQ' },
  { key: 'mental', label: 'MNT' },
]

export default function FighterCard({ fighter }: { fighter: Fighter }) {
  const { record, attrs } = fighter
  const updateFighter = useGameStore((s) => s.updateFighter)
  const seasonWeek = useGameStore((s) => s.gym?.season_week ?? 1)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<FightResult[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  async function handleToggleHistory() {
    if (!showHistory && history === null) {
      setLoadingHistory(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('fight_results')
        .select('*')
        .eq('fighter_id', fighter.id)
        .order('fight_date', { ascending: false })
        .limit(5)
      setHistory((data ?? []) as FightResult[])
      setLoadingHistory(false)
    }
    setShowHistory((v) => !v)
  }

  async function handleGenerateAvatar() {
    setGenError(null)
    setGenerating(true)
    try {
      const avatarUrl = await generateFighterAvatar(fighter)
      updateFighter(fighter.id, { avatar_url: avatarUrl })
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Gagal membuat foto')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
      <div className="flex items-start gap-3">
        <Avatar
          seed={fighter.avatar_seed}
          imageUrl={fighter.avatar_url}
          size={64}
          className="shrink-0 overflow-hidden rounded-full bg-octagon-dark"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-semibold text-white">{fighter.name}</h3>
            <span
              className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[fighter.status]}`}
            >
              {STATUS_LABELS[fighter.status]}
            </span>
          </div>
          {fighter.nickname && (
            <p className="truncate text-sm italic text-octagon-amber">&ldquo;{fighter.nickname}&rdquo;</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {fighter.weight_class} · {fighter.specialty} · {fighter.age} th
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-300">
          Rekor{' '}
          <span className="font-semibold text-white">
            {record.w}-{record.l}-{record.d}
          </span>
        </span>
        <span className="text-xs text-gray-500">{fighter.personality}</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {ATTR_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-8 text-[10px] font-medium text-gray-500">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-octagon-dark">
              <div className="h-full rounded-full bg-octagon-teal" style={{ width: `${attrs[key]}%` }} />
            </div>
            <span className="w-6 text-right text-[10px] text-gray-400">{attrs[key]}</span>
          </div>
        ))}
      </div>

      {fighter.injury && <p className="mt-3 text-xs text-octagon-red">⚠ Cedera: {fighter.injury}</p>}
      {fighter.next_fight_week !== null && fighter.next_fight_week > seasonWeek && (
        <p className="mt-3 text-xs text-octagon-amber">📅 Siap bertanding minggu ke-{fighter.next_fight_week}</p>
      )}

      <button
        onClick={handleToggleHistory}
        className="mt-3 w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal"
      >
        {loadingHistory ? 'Memuat riwayat...' : showHistory ? 'Sembunyikan Riwayat' : 'Riwayat Pertarungan'}
      </button>

      {showHistory && !loadingHistory && (
        <div className="mt-2 space-y-1.5">
          {history && history.length > 0 ? (
            history.map((fr) => (
              <div key={fr.id} className="flex items-center justify-between rounded-md bg-octagon-dark px-2.5 py-1.5 text-xs">
                <div className="min-w-0">
                  <p className="truncate text-gray-200">vs {fr.opponent_name}</p>
                  <p className="text-gray-500">{new Date(fr.fight_date).toLocaleDateString('id-ID')}</p>
                </div>
                <span
                  className={`shrink-0 font-semibold uppercase ${
                    fr.overall_winner === 'my'
                      ? 'text-octagon-teal'
                      : fr.overall_winner === 'opp'
                        ? 'text-octagon-red'
                        : 'text-octagon-amber'
                  }`}
                >
                  {fr.overall_winner === 'my' ? 'Menang' : fr.overall_winner === 'opp' ? 'Kalah' : 'Imbang'}
                  {' · '}
                  {fr.finish_method.toUpperCase()}
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-xs text-gray-500">Belum ada riwayat pertarungan.</p>
          )}
        </div>
      )}

      <button
        onClick={handleGenerateAvatar}
        disabled={generating}
        className="mt-3 w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generating ? 'Membuat foto...' : fighter.avatar_url ? 'Buat Ulang Foto AI' : 'Generate Foto AI'}
      </button>
      {genError && <p className="mt-1 text-[10px] text-octagon-red">{genError}</p>}
    </div>
  )
}
