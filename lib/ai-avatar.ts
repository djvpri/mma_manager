import type { Fighter } from '@/types'

export async function generateFighterAvatar(fighter: Fighter): Promise<string> {
  const res = await fetch('/api/ai-avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fighterId: fighter.id,
      name: fighter.name,
      nickname: fighter.nickname,
      weight_class: fighter.weight_class,
      specialty: fighter.specialty,
      personality: fighter.personality,
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Gagal membuat foto fighter')

  return data.avatar_url as string
}
