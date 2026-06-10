import type { Fighter, RoundResult, GamePlan } from '@/types'

export async function getAICornerAdvice(
  roundNum: number,
  roundResults: RoundResult[],
  gamePlan: GamePlan,
  myFighter: Fighter,
  oppName: string,
  oppSpecialty: string
): Promise<string> {
  const myWins = roundResults.filter((r) => r.winner === 'my').length
  const oppWins = roundResults.filter((r) => r.winner === 'opp').length
  const last = roundResults[roundResults.length - 1]

  const prompt = `Kamu adalah corner man MMA. Berikan instruksi corner yang tajam dan spesifik dalam Bahasa Indonesia (maks 3 kalimat, langsung ke intinya seperti trainer sungguhan).

Situasi:
- Fighter: ${myFighter.name} (${myFighter.specialty}, STK ${myFighter.attrs.striking}, GRP ${myFighter.attrs.grappling})
- Lawan: ${oppName} (${oppSpecialty})
- Ronde baru selesai: ${roundNum}
- Skor: kita ${myWins} – ${oppWins} lawan
- Game plan: ${gamePlan}
- Dominasi ronde terakhir: ${last.winner === 'my' ? 'kita' : 'lawan'} (${last.my_pct}% vs ${last.opp_pct}%)

Instruksi corner (3 kalimat, langsung, tanpa basa-basi):`

  try {
    const res = await fetch('/api/ai-corner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json()
    return data.text || 'Tetap fokus, jalankan game plan!'
  } catch {
    return 'Tetap fokus, jalankan game plan!'
  }
}

export async function getAINarration(
  roundNum: number,
  result: RoundResult,
  myName: string,
  oppName: string,
  gamePlan: GamePlan
): Promise<string> {
  const prompt = `Komentator MMA Bahasa Indonesia. Narasi ronde ${roundNum} (2-3 kalimat, dramatis dan hidup).
${myName} vs ${oppName}. Game plan: ${gamePlan}.
Hasil: ${result.winner === 'my' ? myName : oppName} dominan (${result.my_pct}%–${result.opp_pct}%)${result.finish ? `, diakhiri ${result.finish.toUpperCase()}!` : '.'}`

  try {
    const res = await fetch('/api/ai-corner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json()
    return data.text || ''
  } catch {
    return ''
  }
}
