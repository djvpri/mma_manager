import type { Fighter } from '@/types'

export async function getPreFightInterview(
  fighter: Fighter,
  opponentName: string,
  opponentSpecialty: string,
  eventName: string
): Promise<string> {
  const prompt = `Kamu adalah jurnalis MMA. Tulis kutipan wawancara pra-pertandingan dalam Bahasa Indonesia dari sudut pandang fighter berikut, menjelang pertandingan besar.

Fighter: ${fighter.name} "${fighter.nickname}" (${fighter.specialty}, kepribadian ${fighter.personality})
Rekor: ${fighter.record.w}-${fighter.record.l}-${fighter.record.d}
Lawan: ${opponentName} (${opponentSpecialty})
Event: ${eventName}

Format: 1 paragraf kutipan langsung (gaya bicara sesuai kepribadian fighter), maks 60 kata. Jangan tambahkan narasi pembuka/penutup, langsung kutipan.`

  try {
    const res = await fetch('/api/ai-corner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json()
    return data.text || `"Saya sudah siap. Saya akan membuktikan diri di ${eventName}."`
  } catch {
    return `"Saya sudah siap. Saya akan membuktikan diri di ${eventName}."`
  }
}
