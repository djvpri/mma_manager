-- Saat fighter di-release dari gym, kembali ke pool sebagai free agent
-- (gym_id = NULL, status = 'prospect') alih-alih langsung 'retired'

CREATE OR REPLACE FUNCTION release_fighter_to_pool(
  p_fighter_id  uuid,
  p_gym_id      uuid,
  p_buyout_cost bigint,
  p_salary      bigint
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM gyms WHERE id = p_gym_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Kembalikan fighter ke pool free agent, reset semua field kontrak & training
  UPDATE fighters SET
    gym_id               = NULL,
    status               = 'prospect',
    training_load        = 0,
    contract_fights_left = 0,
    salary_monthly       = 0,
    win_bonus            = 0,
    purse_share_pct      = 10,
    title_shot_clause    = false,
    buyout_clause        = 0,
    title_shot_pending   = false,
    morale               = 50,
    training_focus       = NULL,
    weekly_schedule      = NULL,
    training_intensity   = 'medium',
    next_fight_week      = NULL,
    injury               = NULL,
    injury_weeks_left    = NULL,
    win_streak           = 0
  WHERE id = p_fighter_id AND gym_id = p_gym_id;

  -- Potong buyout + hapus gaji dari pengeluaran gym
  UPDATE gyms SET
    balance         = balance - p_buyout_cost,
    monthly_expense = GREATEST(0, monthly_expense - p_salary)
  WHERE id = p_gym_id;
END;
$$;
