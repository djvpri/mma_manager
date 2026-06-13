// lib/scouting-report.ts
// Laporan intel pra-fight — manfaat dari upgrade room Analytics gym.
import { getCategoryAverages } from './attrs'
import { matchupMult } from './fight-engine'
import type { FighterAttrs } from '@/types'

export interface ScoutingReport {
  level: number
  insights: string[]
}

export function generateScoutingReport(
  mySpecialty: string,
  myAttrs: FighterAttrs,
  oppSpecialty: string,
  oppAttrs: FighterAttrs,
  analyticsLevel: number
): ScoutingReport {
  const insights: string[] = []
  if (analyticsLevel <= 0) {
    return { level: 0, insights: [] }
  }

  const oppCats = getCategoryAverages(oppAttrs)
  const sorted = [...oppCats].sort((a, b) => b.value - a.value)
  const strongest = sorted[0]
  const weakest = sorted[sorted.length - 1]

  insights.push(`Kekuatan utama lawan: ${strongest.label} (${strongest.value}) — waspadai area ini.`)

  if (analyticsLevel >= 2) {
    insights.push(`Titik lemah lawan: ${weakest.label} (${weakest.value}) — area ini bisa dieksploitasi.`)
  }

  if (analyticsLevel >= 3) {
    const myAdvantage = matchupMult(mySpecialty, oppSpecialty)
    const oppAdvantage = matchupMult(oppSpecialty, mySpecialty)
    if (myAdvantage > 1) {
      insights.push(`Matchup gaya menguntungkanmu (${mySpecialty} vs ${oppSpecialty}) — manfaatkan dengan game plan agresif.`)
    } else if (oppAdvantage > 1) {
      insights.push(`Matchup gaya menguntungkan lawan (${oppSpecialty} vs ${mySpecialty}) — pertimbangkan game plan Defensive atau Counter.`)
    } else {
      insights.push(`Matchup gaya cukup seimbang — keunggulan akan ditentukan oleh eksekusi dan stamina.`)
    }
  }

  return { level: analyticsLevel, insights }
}
