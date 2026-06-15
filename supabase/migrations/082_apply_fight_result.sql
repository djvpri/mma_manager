-- 082: RPC apply_fight_result -- konsolidasi update gyms (balance/reputation/
-- events) & fighters (record/training_load/dll) hasil Fight Night jadi satu
-- transaksi SECURITY DEFINER.
--
-- Sebelumnya app/game/fight/page.tsx menghitung `newBalance = gym.balance + ...`
-- di client lalu langsung UPDATE gyms SET balance = newBalance. Karena policy
-- RLS gyms ("Users manage own gym") hanya cek auth.uid() = user_id tanpa
-- validasi nilai kolom, payload UPDATE bisa dimodifikasi (devtools/network)
-- jadi balance berapapun -- exploit farming uang langsung.
--
-- Fix: balance diupdate via DELTA (balance = balance + p_balance_delta) supaya
-- atomic (tidak ada lost-update race), dan delta/reputation_change divalidasi
-- ke rentang wajar berdasar formula purse di saveFightResult (purse maksimum
-- ~185jt untuk skenario tier internasional + main event + title fight + juara
-- turnamen, reputationChange maksimum ~32). Nilai di luar rentang ini ditolak.

CREATE OR REPLACE FUNCTION apply_fight_result(
  p_gym_id              uuid,
  p_fighter_id          uuid,
  p_balance_delta       bigint,
  p_reputation_change   integer,
  p_new_record          jsonb,
  p_training_load       integer,
  p_contract_fights_left integer,
  p_next_fight_week     integer,
  p_win_streak          integer,
  p_morale              integer,
  p_injury_name         text,
  p_injury_weeks        integer,
  p_events              jsonb
)
RETURNS TABLE(gym_row gyms, fighter_row fighters)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM gyms WHERE id = p_gym_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM fighters WHERE id = p_fighter_id AND gym_id = p_gym_id) THEN
    RAISE EXCEPTION 'Fighter tidak ditemukan';
  END IF;

  IF p_balance_delta < -30000000 OR p_balance_delta > 250000000 THEN
    RAISE EXCEPTION 'balance_delta di luar rentang wajar: %', p_balance_delta;
  END IF;

  IF p_reputation_change < -15 OR p_reputation_change > 40 THEN
    RAISE EXCEPTION 'reputation_change di luar rentang wajar: %', p_reputation_change;
  END IF;

  UPDATE gyms SET
    balance    = balance + p_balance_delta,
    reputation = GREATEST(0, LEAST(100, reputation + p_reputation_change)),
    events     = p_events
  WHERE id = p_gym_id;

  UPDATE fighters SET
    record               = p_new_record,
    training_load        = p_training_load,
    contract_fights_left = p_contract_fights_left,
    next_fight_week      = p_next_fight_week,
    win_streak           = p_win_streak,
    morale               = p_morale,
    status               = CASE WHEN p_injury_name IS NOT NULL THEN 'injured'::fighter_status ELSE status END,
    injury               = CASE WHEN p_injury_name IS NOT NULL THEN p_injury_name ELSE injury END,
    injury_weeks_left    = CASE WHEN p_injury_name IS NOT NULL THEN p_injury_weeks ELSE injury_weeks_left END
  WHERE id = p_fighter_id;

  RETURN QUERY
  SELECT g, f FROM gyms g, fighters f WHERE g.id = p_gym_id AND f.id = p_fighter_id;
END;
$$;
