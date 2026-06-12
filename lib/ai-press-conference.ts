import type { Fighter, HypeStyle } from '@/types'

const STYLE_DESC: Record<HypeStyle, string> = {
  confident: 'percaya diri dan optimis akan menang, tanpa menjatuhkan lawan',
  provoke: 'provokatif dan sedikit meremehkan lawan untuk memanaskan suasana',
  respect: 'sopan, menghormati lawan, dan menonjolkan sportivitas',
  focus: 'singkat, to-the-point, fokus pada strategi tanding tanpa banyak basa-basi',
}

async function askAI(prompt: string): Promise<string | null> {
  try {
    const res = await fetch('/api/ai-corner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json()
    return data.text || null
  } catch {
    return null
  }
}

/** Konferensi pers dua arah: kutipan dari fighter sendiri + reaksi lawan. */
export async function getPressConferenceQuotes(
  fighter: Fighter,
  opponentName: string,
  opponentSpecialty: string,
  eventName: string,
  style: HypeStyle,
  outcome: string
): Promise<{ myQuote: string; opponentQuote: string }> {
  const myPrompt = `Kamu adalah jurnalis MMA. Tulis kutipan dari fighter berikut saat konferensi pers menjelang pertandingan, dengan gaya bicara ${STYLE_DESC[style]}.

Fighter: ${fighter.name} "${fighter.nickname}" (${fighter.specialty}, kepribadian ${fighter.personality})
Rekor: ${fighter.record.w}-${fighter.record.l}-${fighter.record.d}
Lawan: ${opponentName} (${opponentSpecialty})
Event: ${eventName}

Format: 1 paragraf kutipan langsung dalam Bahasa Indonesia, maks 50 kata. Jangan tambahkan narasi pembuka/penutup, langsung kutipan.`

  const oppPrompt = `Kamu adalah jurnalis MMA. Tulis kutipan reaksi dari fighter ${opponentName} (${opponentSpecialty}) saat konferensi pers, merespons gaya lawannya ${fighter.name} yang ${STYLE_DESC[style]}.

Konteks reaksi: ${outcome}
Event: ${eventName}

Format: 1 paragraf kutipan langsung dalam Bahasa Indonesia, maks 50 kata, sesuai konteks reaksi di atas. Jangan tambahkan narasi pembuka/penutup, langsung kutipan.`

  const [myQuote, opponentQuote] = await Promise.all([askAI(myPrompt), askAI(oppPrompt)])

  return {
    myQuote: myQuote || `"Saya sudah siap menghadapi ${opponentName} di ${eventName}."`,
    opponentQuote: opponentQuote || `"Saya juga sudah siap. Lihat saja nanti di atas oktagon."`,
  }
}
