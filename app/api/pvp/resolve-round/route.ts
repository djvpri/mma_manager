import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { simulateRound, calculateFightResult, EXCHANGE_TICKS } from '@/lib/fight-engine'
import type { Fighter, FighterAttrs, GamePlan, CornerAdvice, RoundResult } from '@/types'

/** Dipanggil client (challenger atau opponent, siapapun yang lebih dulu) setelah
 *  keduanya submit corner advice ronde berjalan. Menghitung hasil ronde SEKALI
 *  secara otoritatif (server-side, fight-engine yang sama dengan single-player),
 *  lalu update baris pvp_matches. Idempotent: kalau ronde sudah diproses pihak
 *  lain duluan, panggilan kedua no-op. */
export async function POST(req: NextRequest) {
  try {
    const { match_id } = await req.json()
    if (!match_id) {
      return NextResponse.json({ error: 'match_id wajib diisi' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: match, error: matchErr } = await supabase
      .from('pvp_matches')
      .select('*')
      .eq('id', match_id)
      .single()

    if (matchErr || !match) {
      return NextResponse.json({ error: 'Match tidak ditemukan' }, { status: 404 })
    }

    if (match.status !== 'active') {
      return NextResponse.json({ skipped: true, reason: `status=${match.status}` })
    }

    if (!match.challenger_corner || !match.opponent_corner) {
      return NextResponse.json({ skipped: true, reason: 'menunggu kedua corner advice' })
    }

    const [{ data: cFighter }, { data: oFighter }] = await Promise.all([
      supabase.from('fighters').select('name, attrs, specialty').eq('id', match.challenger_fighter_id).single(),
      supabase.from('fighters').select('name, attrs, specialty').eq('id', match.opponent_fighter_id).single(),
    ])

    if (!cFighter || !oFighter) {
      return NextResponse.json({ error: 'Data fighter tidak ditemukan' }, { status: 404 })
    }

    const result: RoundResult = simulateRound({
      myFighter: cFighter as unknown as Fighter,
      opponent: oFighter as unknown as { name: string; attrs: FighterAttrs; specialty: string },
      gamePlan: match.challenger_game_plan as GamePlan,
      cornerAdvice: match.challenger_corner as CornerAdvice,
      oppGamePlan: match.opponent_game_plan as GamePlan,
      oppCornerAdvice: match.opponent_corner as CornerAdvice,
      roundNum: match.current_round,
      myStamina: match.challenger_stamina,
      oppStamina: match.opponent_stamina,
      myMental: match.challenger_mental,
      oppMental: match.opponent_mental,
      myHP: match.challenger_hp,
      oppHP: match.opponent_hp,
      exchangeTicks: EXCHANGE_TICKS,
    })

    const dmgToChallenger = (result.ticks ?? []).reduce((sum, t) => sum + t.my_dmg, 0)
    const dmgToOpponent = (result.ticks ?? []).reduce((sum, t) => sum + t.opp_dmg, 0)

    const newChallengerHP = Math.max(0, match.challenger_hp - dmgToChallenger)
    const newOpponentHP = Math.max(0, match.opponent_hp - dmgToOpponent)

    const roundResults: RoundResult[] = [...(match.round_results ?? []), result]
    const isOver = result.finish !== null || match.current_round >= 3 || newChallengerHP <= 0 || newOpponentHP <= 0

    const updates: Record<string, unknown> = {
      round_results: roundResults,
      challenger_hp: newChallengerHP,
      opponent_hp: newOpponentHP,
      challenger_stamina: result.my_stamina,
      opponent_stamina: result.opp_stamina,
      challenger_mental: result.my_mental,
      opponent_mental: result.opp_mental,
      challenger_corner: null,
      opponent_corner: null,
      updated_at: new Date().toISOString(),
    }

    if (isOver) {
      const fightResult = calculateFightResult(roundResults)
      updates.status = 'finished'
      updates.finish_method = fightResult.method
      updates.winner_gym_id =
        fightResult.winner === 'my' ? match.challenger_gym_id :
        fightResult.winner === 'opp' ? match.opponent_gym_id :
        null
    } else {
      updates.current_round = match.current_round + 1
    }

    // Optimistic lock via current_round: kalau pihak lain sudah memproses
    // ronde ini lebih dulu, current_round sudah berubah -> 0 baris terupdate.
    const { data: updated, error: updateErr } = await supabase
      .from('pvp_matches')
      .update(updates)
      .eq('id', match_id)
      .eq('current_round', match.current_round)
      .select()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'sudah diproses pihak lain' })
    }

    return NextResponse.json({ ok: true, round: result, finished: isOver })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
