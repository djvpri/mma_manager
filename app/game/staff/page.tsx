'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useGameStore } from '@/store/game-store'
import { formatCurrency } from '@/lib/format'
import { generateStaffPool, type StaffCandidate } from '@/lib/generate-staff'
import type { Gym, Staff } from '@/types'

const POOL_SIZE = 4

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-octagon-amber">
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  )
}

export default function StaffPage() {
  const gym = useGameStore((s) => s.gym)
  const setGym = useGameStore((s) => s.setGym)

  const [hired, setHired] = useState<Staff[] | null>(null)
  const [pool, setPool] = useState<StaffCandidate[]>(() => generateStaffPool(POOL_SIZE))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gym) return
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('staff').select('*').eq('gym_id', gym!.id).eq('is_hired', true)
      setHired((data ?? []) as Staff[])
    }
    load()
  }, [gym])

  if (!gym) {
    return <p className="text-sm text-gray-400">Memuat data gym...</p>
  }

  function handleRefresh() {
    setError(null)
    setPool(generateStaffPool(POOL_SIZE))
  }

  async function handleHire(candidate: StaffCandidate) {
    if (!gym) return
    setError(null)

    if (gym.balance < candidate.cost) {
      setError('Saldo tidak cukup untuk merekrut staf ini.')
      return
    }

    setBusyId(candidate.id)
    const supabase = createClient()

    const { data: newStaff, error: insertError } = await supabase
      .from('staff')
      .insert({
        gym_id: gym.id,
        name: candidate.name,
        role: candidate.role,
        specialty: candidate.specialty,
        salary: candidate.salary,
        rating: candidate.rating,
        is_hired: true,
      })
      .select()
      .single()

    if (insertError || !newStaff) {
      setError(insertError?.message ?? 'Gagal merekrut staf.')
      setBusyId(null)
      return
    }

    const newBalance = gym.balance - candidate.cost
    const newExpense = gym.monthly_expense + candidate.salary
    const { error: gymError } = await supabase
      .from('gyms')
      .update({ balance: newBalance, monthly_expense: newExpense })
      .eq('id', gym.id)

    if (gymError) {
      setError(gymError.message)
      setBusyId(null)
      return
    }

    setGym({ ...gym, balance: newBalance, monthly_expense: newExpense })
    setHired((h) => [...(h ?? []), newStaff as Staff])
    setPool((p) => p.filter((c) => c.id !== candidate.id))
    setBusyId(null)
  }

  async function handleFire(member: Staff) {
    if (!gym) return
    setError(null)
    setBusyId(member.id)
    const supabase = createClient()

    const { error: deleteError } = await supabase.from('staff').delete().eq('id', member.id)
    if (deleteError) {
      setError(deleteError.message)
      setBusyId(null)
      return
    }

    const newExpense = Math.max(0, gym.monthly_expense - member.salary)
    const { error: gymError } = await supabase
      .from('gyms')
      .update({ monthly_expense: newExpense })
      .eq('id', gym.id)

    if (gymError) {
      setError(gymError.message)
      setBusyId(null)
      return
    }

    const wasAssistantManager = gym.assistant_manager_id === member.id
    setGym({ ...gym, monthly_expense: newExpense, ...(wasAssistantManager ? { assistant_manager_id: null } : {}) })
    setHired((h) => (h ?? []).filter((s) => s.id !== member.id))
    setBusyId(null)
  }

  async function handleToggleAssistantManager(member: Staff) {
    if (!gym) return
    setError(null)
    setBusyId(member.id)
    const supabase = createClient()

    const newId = gym.assistant_manager_id === member.id ? null : member.id
    const { error: gymError } = await supabase
      .from('gyms')
      .update({ assistant_manager_id: newId })
      .eq('id', gym.id)

    if (gymError) {
      setError(gymError.message)
      setBusyId(null)
      return
    }

    setGym({ ...gym, assistant_manager_id: newId })
    setBusyId(null)
  }

  async function handleToggleTask(task: keyof Gym['assistant_tasks']) {
    if (!gym) return
    setError(null)
    const updated = { ...gym.assistant_tasks, [task]: !gym.assistant_tasks?.[task] }
    const supabase = createClient()
    const { error: gymError } = await supabase
      .from('gyms')
      .update({ assistant_tasks: updated })
      .eq('id', gym.id)

    if (gymError) {
      setError(gymError.message)
      return
    }
    setGym({ ...gym, assistant_tasks: updated })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Staf Gym</h1>
          <p className="text-sm text-gray-400">
            Saldo: <span className="font-semibold text-octagon-amber">{formatCurrency(gym.balance)}</span>
            {' · '}
            Pengeluaran/minggu: <span className="font-semibold text-white">{formatCurrency(gym.monthly_expense)}</span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="rounded-md border border-octagon-border px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-octagon-teal hover:text-octagon-teal"
        >
          Cari Kandidat Baru
        </button>
      </header>

      {error && <p className="text-sm text-octagon-red">{error}</p>}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Staf Aktif</h2>
        <p className="mb-3 text-xs text-gray-500">
          Jadikan satu staf sebagai Asisten Manajer, lalu pilih tugas mana saja yang dijalankan otomatis tiap minggu.
        </p>

        {gym.assistant_manager_id && (
          <div className="mb-4 rounded-lg border border-octagon-teal/30 bg-octagon-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-octagon-teal">Tugas Asisten Manajer</h3>
            <div className="space-y-2.5">
              {([
                { key: 'sponsor', label: 'Sponsor', desc: 'Cari & tanda tangani sponsor baru saat ada slot kosong.' },
                { key: 'event_registration', label: 'Daftar Event', desc: 'Daftarkan fighter yang siap tanding ke event yang cocok.' },
                { key: 'scouting', label: 'Scouting', desc: 'Mulai misi scouting prospek terbaik saat ada slot Talent Scout kosong.' },
                { key: 'training_focus', label: 'Fokus Latihan', desc: 'Atur fokus latihan otomatis untuk fighter baru berdasarkan atribut terlemah relatif potensi.' },
                { key: 'contract_renewal', label: 'Perpanjangan Kontrak', desc: 'Perpanjang kontrak fighter berprestasi yang sisa kontraknya hampir habis.' },
                { key: 'training_load', label: 'Manajemen Beban Latihan', desc: 'Turunkan intensitas latihan fighter yang beban latihannya terlalu tinggi.' },
                { key: 'roster_filler', label: 'Pengisi Roster', desc: 'Rekrut prospek murah dari pool untuk mengisi weight class yang kosong.' },
                { key: 'member_fee', label: 'Optimasi Iuran Member', desc: 'Sesuaikan iuran member otomatis berdasarkan tren jumlah member.' },
                { key: 'press_conference', label: 'Konferensi Pers', desc: 'Tampil di konferensi pers (gaya Fokus) untuk laga minggu depan yang belum direspons.' },
              ] as { key: keyof Gym['assistant_tasks']; label: string; desc: string }[]).map((task) => {
                const active = gym.assistant_tasks?.[task.key] ?? false
                return (
                  <div key={task.key} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200">{task.label}</p>
                      <p className="text-[11px] text-gray-500">{task.desc}</p>
                    </div>
                    <button
                      onClick={() => handleToggleTask(task.key)}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${active ? 'bg-octagon-teal' : 'bg-octagon-border'}`}
                      aria-label={`Toggle ${task.label}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {hired === null ? (
          <p className="text-sm text-gray-400">Memuat...</p>
        ) : hired.length === 0 ? (
          <div className="rounded-lg border border-dashed border-octagon-border bg-octagon-card p-6 text-center text-sm text-gray-400">
            Belum ada staf yang direkrut.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {hired.map((member) => {
              const isAssistantManager = gym.assistant_manager_id === member.id
              return (
                <div key={member.id} className={`rounded-lg border bg-octagon-card p-4 ${isAssistantManager ? 'border-octagon-teal/50' : 'border-octagon-border'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">{member.name}</h3>
                    <Stars rating={member.rating} />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {member.role} · {member.specialty}
                  </p>
                  {isAssistantManager && (
                    <p className="mt-1 inline-block rounded border border-octagon-teal/40 bg-octagon-teal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-octagon-teal">
                      👔 Asisten Manajer
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-xs text-gray-400">Gaji/minggu</span>
                    <span className="font-medium text-white">{formatCurrency(member.salary)}</span>
                  </div>
                  <button
                    onClick={() => handleToggleAssistantManager(member)}
                    disabled={busyId === member.id}
                    className={`mt-3 w-full rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isAssistantManager
                        ? 'border-octagon-teal/50 text-octagon-teal hover:border-octagon-red hover:text-octagon-red'
                        : 'border-octagon-border text-gray-300 hover:border-octagon-teal hover:text-octagon-teal'
                    }`}
                  >
                    {busyId === member.id ? 'Memproses...' : isAssistantManager ? 'Lepas Jabatan Asisten Manajer' : 'Jadikan Asisten Manajer'}
                  </button>
                  <button
                    onClick={() => handleFire(member)}
                    disabled={busyId === member.id}
                    className="mt-2 w-full rounded-md border border-octagon-border px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-octagon-red hover:text-octagon-red disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyId === member.id ? 'Memproses...' : 'Pecat'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Kandidat Staf</h2>
        {pool.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-octagon-border bg-octagon-card py-12 text-center">
            <p className="text-gray-400">Semua kandidat sudah direkrut.</p>
            <button onClick={handleRefresh} className="mt-3 text-sm font-medium text-octagon-amber hover:underline">
              Cari kandidat baru →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pool.map((candidate) => {
              const canAfford = gym.balance >= candidate.cost
              return (
                <div key={candidate.id} className="rounded-lg border border-octagon-border bg-octagon-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">{candidate.name}</h3>
                    <Stars rating={candidate.rating} />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {candidate.role} · {candidate.specialty}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-xs text-gray-400">Gaji/minggu</span>
                    <span className="font-medium text-white">{formatCurrency(candidate.salary)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-xs text-gray-400">Biaya kontrak</span>
                    <span className="font-semibold text-octagon-amber">{formatCurrency(candidate.cost)}</span>
                  </div>
                  <button
                    onClick={() => handleHire(candidate)}
                    disabled={!canAfford || busyId === candidate.id}
                    className="mt-3 w-full rounded-md bg-octagon-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-octagon-red/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyId === candidate.id ? 'Memproses...' : 'Rekrut'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
