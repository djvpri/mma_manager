import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'

export default async function Home() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: gym } = await supabase.from('gyms').select('id').eq('user_id', user.id).maybeSingle()

  redirect(gym ? '/game/roster' : '/onboarding')
}
