'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import { formatCurrency } from '@/lib/format'

interface MediaEvent {
  id: string
  type: string
  fighter_id: string | null
  message: string
  data: Record<string, unknown> | null
  resolved: boolean
  response: string | null
  season_week: number
}

const CAMPAIGN_OPTIONS = [
  { budget: 1_000_000, label: 'Kecil', desc: '+1 rep, +8 heat' },
  { budget: 3_000_000, label: 'Menengah', desc: '+2 rep, +15 heat' },
  { budget: 5_000_000, label: 'Besar', desc: '+3 rep, +25 heat' },
]

const INVESTIGATION_RESPONSES = [
  { value: 'transparent', label: '✅ Transparan', desc: 'Jujur — reputasi naik +2' },
  { value: 'deny', label: '🛡️ Bantah', desc: 'Tidak mengakui — netral' },
  { value: 'silent', label: '🤫 Diam', desc: 'Tidak berkomentar — reputasi -3' },
]

const PRESS_RESPONSES = [
  { value: 'confident', label: '💪 Percaya Diri', desc: 'Morale naik, butuh mental tinggi' },
  { value: 'diplomatic', label: '🤝 Diplomatis', desc: 'Reputasi gym naik +2' },
  { value: 'provocative', label: '🔥 Provokatif', desc: 'Berisiko — bisa backfire' },
  { value: 'silent', label: '🤫 Diam', desc: 'Reputasi -1' },
]

const ENDORSEMENT_RESPONSES = [
  { value: true, label: '✅ Terima', desc: 'Income naik, training_load +8' },
  { value: false, label: '❌ Tolak', desc: 'Fighter fokus, morale +5' },
]

export default function MediaPage() {
  const gym = useGameStore((s) => s.gym)
  const fighters = useGameStore((s) => s.fighters)

  const [events, setEvents] = useState<MediaEvent[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [campaignResult, setCampaignResult] = useState<string | null>(null)

  const supabase = createClient()

  const fetchEvents = useCallback(async () => {
    if (!gym) return
    const { data } = await supabase
      .from('media_events')
      .select('*')
      .eq('gym_id', gym.id)
      .order('season_week', { ascending: false })
      .limit(20)
    setEvents(data ?? [])
  }, [gym?.id])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  if (!gym) return <p className="text-sm text-gray-400">Memuat...</p>

  const pendingEvents = events.filter((e) => !e.resolved)
  const resolvedEvents = events.filter((e) => e.resolved)
  const campaignCooldown = gym.last_campaign_week >= gym.season_week - 3
  const cooldownLeft = campaignCooldown ? 4 - (gym.season_week - (gym.last_campaign_week ?? 0)) : 0

  async function handleCampaign(budget: number) {
    setBusy('campaign')
    setError(null)
    setCampaignResult(null)
    const { data, error } = await supabase.rpc('run_social_campaign', { p_budget: budget })
    if (error) setError(error.message)
    else setCampaignResult(`✅ Campaign berhasil! Reputasi +${data.rep_boost}, heat +${data.heat_boost}`)
    setBusy(null)
  }

  async function handleInvestigation(eventId: string, response: string) {
    setBusy(eventId)
    setError(null)
    const { error } = await supabase.rpc('respond_media_investigation', {
      p_event_id: eventId, p_response: response,
    })
    if (error) setError(error.message)
    await fetchEvents()
    setBusy(null)
  }

  async function handleEndorsement(eventId: string, accept: boolean) {
    setBusy(eventId)
    setError(null)
    const { error } = await supabase.rpc('respond_endorsement', {
      p_event_id: eventId, p_accept: accept,
    })
    if (error) setError(error.message)
    await fetchEvents()
    setBusy(null)
  }

  async function handlePressResponse(eventId: string, style: string) {
    setBusy(eventId)
    setError(null)
    const { error } = await supabase.rpc('respond_press_question', {
      p_event_id: eventId, p_style: style,
    })
    if (error) setError(error.message)
    await fetchEvents()
    setBusy(null)
  }

  async function handleGeneratePressQuestion(fighterId: string) {
    setBusy('pressgen')
    setError(null)
    const { error } = await supabase.rpc('generate_tough_press_question', { p_fighter_id: fighterId })
    if (error) setError(error.message)
    await fetchEvents()
    setBusy(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">📱 Media & Influencer</h1>
        <p className="text-sm text-gray-400">
          Media Heat: <span className="font-semibold text-octagon-amber">{gym.media_heat ?? 0}</span>/100
          · Reputasi: <span className="font-semibold text-octagon-teal">{gym.reputation}</span>
        </p>
      </div>

      {error && <p className="rounded border border-octagon-red/30 bg-octagon-red/5 p-2 text-xs text-octagon-red">{error}</p>}

      {/* Social Media Campaign */}
      <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">📣 Social Media Campaign</h2>
        {campaignCooldown ? (
          <p className="text-xs text-gray-500">Cooldown — tersedia lagi dalam {cooldownLeft} minggu.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {CAMPAIGN_OPTIONS.map((opt) => (
              <button
                key={opt.budget}
                onClick={() => handleCampaign(opt.budget)}
                disabled={busy === 'campaign' || gym.balance < opt.budget}
                className="rounded border border-octagon-border p-2 text-left text-xs transition-colors hover:border-octagon-amber/40 hover:bg-octagon-amber/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <p className="font-semibold text-white">{opt.label}</p>
                <p className="text-[10px] text-gray-500">{formatCurrency(opt.budget)}</p>
                <p className="text-[10px] text-octagon-amber">{opt.desc}</p>
              </button>
            ))}
          </div>
        )}
        {campaignResult && <p className="mt-2 text-xs text-octagon-teal">{campaignResult}</p>}
      </div>

      {/* Generate Press Conference Question */}
      {fighters.filter(f => f.status === 'active' || f.status === 'training').length > 0 && (
        <div className="rounded-lg border border-octagon-border bg-octagon-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">🎙️ Press Conference Tajam</h2>
          <div className="flex flex-wrap gap-2">
            {fighters.filter(f => f.status === 'active' || f.status === 'training').map(f => (
              <button
                key={f.id}
                onClick={() => handleGeneratePressQuestion(f.id)}
                disabled={busy === 'pressgen'}
                className="rounded border border-octagon-border px-2.5 py-1 text-xs text-gray-300 transition-colors hover:border-octagon-amber hover:text-white disabled:opacity-40"
              >
                {f.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-gray-600">Pilih fighter untuk mendapat pertanyaan tajam dari media — lalu pilih respons terbaik.</p>
        </div>
      )}

      {/* Pending Events */}
      {pendingEvents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">⚡ Perlu Respons</h2>
          {pendingEvents.map((e) => (
            <div key={e.id} className="rounded-lg border border-octagon-amber/30 bg-octagon-amber/5 p-4">
              <p className="mb-3 text-sm text-gray-200">{e.message}</p>

              {e.type === 'investigation' && (
                <div className="flex flex-wrap gap-2">
                  {INVESTIGATION_RESPONSES.map((r) => (
                    <button key={r.value}
                      onClick={() => handleInvestigation(e.id, r.value)}
                      disabled={busy === e.id}
                      className="rounded border border-octagon-border px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-octagon-amber hover:text-white disabled:opacity-40"
                    >
                      <span className="font-semibold">{r.label}</span>
                      <span className="ml-1 text-gray-500">— {r.desc}</span>
                    </button>
                  ))}
                </div>
              )}

              {e.type === 'endorsement_offer' && (
                <div className="flex flex-wrap gap-2">
                  {ENDORSEMENT_RESPONSES.map((r) => (
                    <button key={String(r.value)}
                      onClick={() => handleEndorsement(e.id, r.value)}
                      disabled={busy === e.id}
                      className={`rounded border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                        r.value
                          ? 'border-octagon-teal text-octagon-teal hover:bg-octagon-teal/10'
                          : 'border-octagon-border text-gray-400 hover:border-octagon-red hover:text-octagon-red'
                      }`}
                    >
                      {r.label} <span className="font-normal text-gray-500">— {r.desc}</span>
                    </button>
                  ))}
                </div>
              )}

              {e.type === 'press_question' && (
                <div className="grid grid-cols-2 gap-2">
                  {PRESS_RESPONSES.map((r) => (
                    <button key={r.value}
                      onClick={() => handlePressResponse(e.id, r.value)}
                      disabled={busy === e.id}
                      className="rounded border border-octagon-border p-2 text-left text-xs transition-colors hover:border-octagon-amber hover:bg-octagon-amber/5 disabled:opacity-40"
                    >
                      <p className="font-semibold text-white">{r.label}</p>
                      <p className="text-[10px] text-gray-500">{r.desc}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolved History */}
      {resolvedEvents.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">📋 Riwayat</h2>
          {resolvedEvents.slice(0, 5).map((e) => (
            <div key={e.id} className="rounded border border-octagon-border/40 px-3 py-2 opacity-60">
              <p className="text-xs text-gray-400">{e.message.slice(0, 120)}...</p>
              {e.response && <p className="mt-0.5 text-[10px] text-gray-600">Respons: {e.response}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
