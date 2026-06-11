import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import GameShell from '@/components/ui/GameShell'
import type { Fighter, Gym } from '@/types'

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: gym } = await supabase.from('gyms').select('*').eq('user_id', user.id).maybeSingle()

  if (!gym) redirect('/onboarding')

  const { data: fighters } = await supabase
    .from('fighters')
    .select('*')
    .eq('gym_id', gym.id)
    .order('created_at')

  return (
    <GameShell gym={gym as Gym} fighters={(fighters ?? []) as Fighter[]}>
      {children}
    </GameShell>
  )
}
