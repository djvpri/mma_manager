import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import GameShell from '@/components/ui/GameShell'
import { STARTER_FIGHTERS } from '@/lib/seed-fighters'
import type { Fighter, Gym } from '@/types'

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: gym } = await supabase.from('gyms').select('*').eq('user_id', user.id).maybeSingle()

  if (!gym) redirect('/onboarding')

  let { data: fighters } = await supabase
    .from('fighters')
    .select('*')
    .eq('gym_id', gym.id)
    .order('created_at')

  // Jaga-jaga: kalau insert fighter starter saat onboarding sebelumnya gagal,
  // roster bisa kosong permanen. Isi ulang sekali untuk gym yang belum ditandai.
  if ((fighters ?? []).length === 0 && gym.starters_seeded === false) {
    const { data: seeded } = await supabase
      .from('fighters')
      .insert(STARTER_FIGHTERS.map((f) => ({ ...f, gym_id: gym.id })))
      .select()

    if (seeded) {
      fighters = seeded
      await supabase.from('gyms').update({ starters_seeded: true }).eq('id', gym.id)
      gym.starters_seeded = true
    }
  }

  return (
    <GameShell gym={gym as Gym} fighters={(fighters ?? []) as Fighter[]}>
      {children}
    </GameShell>
  )
}
