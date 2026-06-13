// @ts-nocheck — file ini untuk Deno (Supabase Edge Function), bukan Next.js.
// Next.js type-checker tidak mengenal specifier 'npm:' meski folder ini sudah
// di-exclude di tsconfig.json. Type-checking sesungguhnya dilakukan oleh Deno
// saat `supabase functions deploy`.
//
// Edge Function: pvp-resolve-round
// Dipanggil client (challenger atau opponent, siapapun yang lebih dulu) setelah
// keduanya submit corner advice ronde berjalan. Menghitung hasil ronde
// SEKALI secara otoritatif (server-side, fight-engine yang sama dengan
// single-player), lalu update baris pvp_matches. Idempotent: kalau ronde
// sudah diproses pihak lain duluan, panggilan kedua no-op.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { simulateRound, calculateFightResult, EXCHANGE_TICKS } from './fight-engine.ts'
import type { EdgeFighter, GamePlan, CornerAdvice, RoundResult } from './types.ts'

Deno.serve(async (req) => {
  try {
    const { match_id } = await req.json()
    if (!match_id) {
      return new Response(JSON.stringify({ error: 'match_id wajib diisi' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: match, error: matchErr } = await supabase
      .from('pvp_matches')
      .select('*')
      .eq('id', match_id)
      .single()

    if (matchErr || !match) {
      return new Response(JSON.stringify({ error: 'Match tidak ditemukan' }), { status: 404 })
    }

    if (match.status !== 'active') {
      return new Response(JSON.stringify({ skipped: true, reason: `status=${match.status}` }), { status: 200 })
    }

    if (!match.challenger_corner || !match.opponent_corner) {
      return new Response(JSON.stringify({ skipped: true, reason: 'menunggu kedua corner advice' }), { status: 200 })
    }

    const [{ data: cFighter }, { data: oFighter }] = await Promise.all([
      supabase.from('fighters').select('name, attrs, specialty').eq('id', match.challenger_fighter_id).single(),
      supabase.from('fighters').select('name, attrs, specialty').eq('id', match.opponent_fighter_id).single(),
    ])

    if (!cFighter || !oFighter) {
      return new Response(JSON.stringify({ error: 'Data fighter tidak ditemukan' }), { status: 404 })
    }

    const result: RoundResult = simulateRound({
      myFighter: cFighter as EdgeFighter,
      opponent: oFighter as EdgeFighter,
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

    // deno-lint-ignore no-explicit-any
    const updates: Record<string, any> = {
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
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 })
    }

    if (!updated || updated.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'sudah diproses pihak lain' }), { status: 200 })
    }

    return new Response(JSON.stringify({ ok: true, round: result, finished: isOver }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
