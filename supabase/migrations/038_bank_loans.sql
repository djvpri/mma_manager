-- Pinjaman bank: gym bisa mengajukan pinjaman untuk menambah modal,
-- dicicil otomatis tiap minggu via advance_week().

CREATE TABLE bank_loans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id            uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  principal         bigint NOT NULL,
  interest_rate     numeric NOT NULL,
  total_repayment   bigint NOT NULL,
  weekly_payment    bigint NOT NULL,
  weeks_total       integer NOT NULL,
  weeks_remaining   integer NOT NULL,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid')),
  season_week_taken integer NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bank_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_loans_select ON bank_loans FOR SELECT
  USING (gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid()));

-- ─── Ajukan pinjaman ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION take_bank_loan(p_gym_id uuid, p_principal bigint, p_weeks integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reputation     integer;
  v_season_week    integer;
  v_max_principal  bigint;
  v_base_rate      numeric;
  v_rep_discount   numeric;
  v_rate           numeric;
  v_total          bigint;
  v_weekly         bigint;
BEGIN
  SELECT reputation, season_week INTO v_reputation, v_season_week
  FROM gyms WHERE id = p_gym_id AND user_id = auth.uid();

  IF v_reputation IS NULL THEN
    RAISE EXCEPTION 'Gym tidak ditemukan';
  END IF;

  IF EXISTS (SELECT 1 FROM bank_loans WHERE gym_id = p_gym_id AND status = 'active') THEN
    RAISE EXCEPTION 'Masih ada pinjaman aktif';
  END IF;

  v_max_principal := CASE
    WHEN v_reputation >= 75 THEN 500000000
    WHEN v_reputation >= 50 THEN 250000000
    WHEN v_reputation >= 25 THEN 100000000
    ELSE                         50000000
  END;

  IF p_principal <= 0 OR p_principal > v_max_principal THEN
    RAISE EXCEPTION 'Nominal pinjaman melebihi limit gym';
  END IF;

  IF p_weeks NOT IN (12, 24, 36) THEN
    RAISE EXCEPTION 'Tenor tidak valid';
  END IF;

  v_base_rate := CASE p_weeks WHEN 12 THEN 0.08 WHEN 24 THEN 0.15 ELSE 0.22 END;
  v_rep_discount := CASE
    WHEN v_reputation >= 75 THEN 0.03
    WHEN v_reputation >= 50 THEN 0.015
    ELSE 0
  END;
  v_rate := GREATEST(0.03, v_base_rate - v_rep_discount);

  v_total  := ROUND(p_principal * (1 + v_rate));
  v_weekly := CEIL(v_total::numeric / p_weeks);

  INSERT INTO bank_loans
    (gym_id, principal, interest_rate, total_repayment, weekly_payment, weeks_total, weeks_remaining, season_week_taken)
  VALUES
    (p_gym_id, p_principal, v_rate, v_total, v_weekly, p_weeks, p_weeks, v_season_week);

  UPDATE gyms SET balance = balance + p_principal WHERE id = p_gym_id AND user_id = auth.uid();
END;
$$;

-- ─── advance_week(): tambah cicilan pinjaman bank ─────────────────────────────
CREATE OR REPLACE FUNCTION advance_week(p_gym_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_recovery_level    integer;
  v_rooms             jsonb;
  v_staff_specialties text[];
  v_season_week       integer;
  r                   record;
  v_days              text[] := ARRAY['mon','tue','wed','thu','fri','sat'];
  v_day               text;
  v_session           text;
  v_attrs_for_session text[];
  v_target_attr       text;
  v_current           int;
  v_room_key          text;
  v_specialty         text;
  v_room_level        int;
  v_chance            numeric;
  v_amount            int;
  v_intensity_mult    numeric;
  v_personality_mult  numeric;
  v_injury_roll       numeric;
  v_in_fight_camp     boolean;
  v_sponsor_income    integer;
  v_pool_count        integer;
  v_last_aging_week   integer;
  v_last_sim_week     integer;
  v_cpu_base          integer;
  v_injury_names      text[] := ARRAY['Sprain ringan','Memar otot','Kelelahan','Strain ligamen','Cedera bahu ringan'];
BEGIN
  SELECT rooms, COALESCE((rooms->'recovery'->>'level')::integer, 0), season_week
    INTO v_rooms, v_recovery_level, v_season_week
  FROM gyms WHERE id = p_gym_id;

  SELECT COALESCE(array_agg(specialty), '{}') INTO v_staff_specialties
  FROM staff WHERE gym_id = p_gym_id AND is_hired = true;

  -- Sponsor income
  SELECT COALESCE(SUM(weekly_income), 0) INTO v_sponsor_income
  FROM sponsor_contracts WHERE gym_id = p_gym_id AND status = 'active';

  -- Increment week + income
  UPDATE gyms SET
    season_week = season_week + 1,
    balance     = balance + monthly_income - monthly_expense + v_sponsor_income
  WHERE id = p_gym_id AND auth.uid() = user_id;

  -- ── Cicilan pinjaman bank ──────────────────────────────────────────────────
  UPDATE gyms SET balance = balance - COALESCE(
    (SELECT weekly_payment FROM bank_loans WHERE gym_id = p_gym_id AND status = 'active'), 0
  )
  WHERE id = p_gym_id AND auth.uid() = user_id;

  UPDATE bank_loans SET weeks_remaining = weeks_remaining - 1
  WHERE gym_id = p_gym_id AND status = 'active';

  UPDATE bank_loans SET status = 'paid'
  WHERE gym_id = p_gym_id AND status = 'active' AND weeks_remaining <= 0;

  -- Sponsor contract maintenance
  UPDATE sponsor_contracts SET weeks_remaining = weeks_remaining - 1
  WHERE gym_id = p_gym_id AND status = 'active';
  UPDATE sponsor_contracts SET status = 'expired'
  WHERE gym_id = p_gym_id AND status = 'active' AND weeks_remaining <= 0;
  UPDATE sponsor_contracts SET status = 'cancelled'
  WHERE gym_id = p_gym_id AND status = 'active' AND satisfaction < 20 AND random() < 0.30;

  -- Training load recovery
  UPDATE fighters SET
    training_load = GREATEST(10, training_load - 5 - (v_recovery_level * 2))
  WHERE gym_id = p_gym_id AND status = 'training';

  -- Fatigue dari intensitas
  UPDATE fighters SET
    training_load = LEAST(100, training_load + CASE training_intensity
      WHEN 'high' THEN 15 WHEN 'medium' THEN 5 ELSE 0 END)
  WHERE gym_id = p_gym_id AND status = 'training';

  -- Injury recovery
  UPDATE fighters SET injury_weeks_left = GREATEST(0, injury_weeks_left - 1 - v_recovery_level)
  WHERE gym_id = p_gym_id AND status = 'injured' AND injury_weeks_left IS NOT NULL;
  UPDATE fighters SET status = 'training', injury = null, injury_weeks_left = null
  WHERE gym_id = p_gym_id AND status = 'injured' AND COALESCE(injury_weeks_left, 0) <= 0;

  -- ── Ulang tahun fighter (morale boost kecil) ──────────────────────────────
  UPDATE fighters SET morale = LEAST(100, morale + 5)
  WHERE gym_id = p_gym_id AND status != 'retired'
    AND (v_season_week + 1) % 52 = birth_week % 52;

  -- ── Kejadian acak mingguan ─────────────────────────────────────────────────
  PERFORM generate_random_fighter_events(p_gym_id, v_season_week + 1);

  -- ── Perkembangan atribut + personality effects ────────────────────────────
  FOR r IN
    SELECT id, attrs, potential, weekly_schedule, training_intensity,
           next_fight_week, personality, age
    FROM fighters
    WHERE gym_id = p_gym_id AND status = 'training' AND weekly_schedule IS NOT NULL
  LOOP
    v_in_fight_camp := (
      r.next_fight_week IS NOT NULL AND
      (r.next_fight_week - v_season_week) BETWEEN 1 AND 4
    );

    v_intensity_mult := CASE r.training_intensity
      WHEN 'high' THEN 1.20 WHEN 'low' THEN 0.70 ELSE 1.00 END;

    v_injury_roll := CASE r.training_intensity
      WHEN 'high' THEN 0.15 WHEN 'medium' THEN 0.05 ELSE 0.0 END;

    -- Personality multiplier
    v_personality_mult := CASE r.personality
      WHEN 'Hardworker' THEN 1.15
      WHEN 'Raw Talent'  THEN
        CASE WHEN r.age < 24  THEN 1.25
             WHEN r.age >= 28 THEN 0.95
             ELSE 1.00 END
      ELSE 1.00
    END;

    IF v_in_fight_camp THEN
      v_intensity_mult := v_intensity_mult * 1.10;
      v_injury_roll    := v_injury_roll * 0.50;
      UPDATE fighters SET
        morale        = LEAST(100, morale + 3),
        training_load = GREATEST(10, training_load - 3)
      WHERE id = r.id;
    END IF;

    IF v_injury_roll > 0 AND RANDOM() < v_injury_roll THEN
      UPDATE fighters SET
        status = 'injured',
        injury = v_injury_names[1+FLOOR(RANDOM()*ARRAY_LENGTH(v_injury_names,1))::int],
        injury_weeks_left = 1 + FLOOR(RANDOM()*3)::int
      WHERE id = r.id;
      CONTINUE;
    END IF;

    FOREACH v_day IN ARRAY v_days LOOP
      v_session := r.weekly_schedule->>v_day;
      IF v_session IS NULL OR v_session = 'rest' THEN CONTINUE; END IF;

      CASE v_session
        WHEN 'striking'  THEN v_attrs_for_session := ARRAY['punch_power','kick_power','accuracy','striking_defense']; v_room_key:='striking';  v_specialty:='Striking';
        WHEN 'grappling' THEN v_attrs_for_session := ARRAY['takedowns','takedown_defense','ground_control','submission'];  v_room_key:='grappling'; v_specialty:='Grappling';
        WHEN 'cardio'    THEN v_attrs_for_session := ARRAY['cardio','chin','durability','recovery','speed']; v_room_key:='cardio';    v_specialty:='Cardio';
        WHEN 'analytics' THEN v_attrs_for_session := ARRAY['fight_iq']; v_room_key:='analytics'; v_specialty:='Strategi & Mental';
        WHEN 'mental'    THEN v_attrs_for_session := ARRAY['mental'];    v_room_key:='locker';    v_specialty:='Strategi & Mental';
        WHEN 'sparring'  THEN v_attrs_for_session := ARRAY['fight_iq','mental','punch_power','kick_power','takedowns']; v_room_key:='striking'; v_specialty:='Striking';
        ELSE CONTINUE;
      END CASE;

      v_target_attr := v_attrs_for_session[1+FLOOR(RANDOM()*ARRAY_LENGTH(v_attrs_for_session,1))::int];
      SELECT (attrs->>v_target_attr)::int INTO v_current FROM fighters WHERE id = r.id;

      IF v_current < r.potential THEN
        v_room_level := COALESCE((v_rooms->v_room_key->>'level')::int, 0);
        v_chance     := LEAST(0.95, (0.25 + v_room_level * 0.05) * v_intensity_mult * v_personality_mult);

        IF v_specialty = ANY(v_staff_specialties) THEN
          v_chance := LEAST(0.95, v_chance + 0.10);
        END IF;

        IF RANDOM() < v_chance THEN
          v_amount := 1 + (CASE WHEN RANDOM() < 0.15 THEN 1 ELSE 0 END);
          UPDATE fighters
            SET attrs = jsonb_set(attrs, ARRAY[v_target_attr], to_jsonb(LEAST(r.potential, v_current + v_amount)))
          WHERE id = r.id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- ── Penurunan atribut veteran (umur >= 32) ────────────────────────────────
  FOR r IN
    SELECT id, attrs, age FROM fighters
    WHERE gym_id = p_gym_id AND status IN ('training','active') AND age >= 32
  LOOP
    IF RANDOM() < 0.12 THEN
      DECLARE
        v_keys text[] := ARRAY['punch_power','kick_power','accuracy','striking_defense','takedowns','takedown_defense','ground_control','submission','cardio','chin','durability','recovery','speed','fight_iq','mental'];
        v_key  text   := v_keys[1+FLOOR(RANDOM()*ARRAY_LENGTH(v_keys,1))::int];
        v_val  int    := (r.attrs->>v_key)::int;
      BEGIN
        IF v_val > 30 THEN
          UPDATE fighters SET attrs = jsonb_set(attrs, ARRAY[v_key], to_jsonb(v_val-1)) WHERE id = r.id;
        END IF;
      END;
    END IF;
  END LOOP;

  -- ── Pool fighter aging (global, setiap 12 minggu) ─────────────────────────
  SELECT last_aging_week INTO v_last_aging_week FROM pool_meta LIMIT 1;
  IF v_season_week >= v_last_aging_week + 12 THEN
    UPDATE pool_meta SET last_aging_week = v_season_week WHERE last_aging_week = v_last_aging_week;
    -- Tambah usia semua pool fighter
    UPDATE fighters SET age = age + 1
    WHERE gym_id IS NULL AND status = 'prospect';
    -- Hapus pool fighter yang sudah terlalu tua (umur >= 38, 30% chance)
    DELETE FROM fighters
    WHERE gym_id IS NULL AND status = 'prospect' AND age >= 38 AND RANDOM() < 0.30;

    -- ── CPU fighter aging + retirement/replacement ──────────────────────────
    UPDATE fighters SET age = age + 1 WHERE is_cpu = true AND status = 'active';

    FOR r IN
      SELECT id, gym_id, weight_class FROM fighters
      WHERE is_cpu = true AND status = 'active' AND age >= 36 AND RANDOM() < 0.35
    LOOP
      UPDATE fighters SET status = 'retired' WHERE id = r.id;

      UPDATE championships SET
        champion_fighter_id = NULL, champion_gym_id = NULL,
        champion_gym_name = NULL, champion_name = NULL,
        title_defenses = 0, won_at_week = NULL, updated_at = now()
      WHERE champion_fighter_id = r.id;

      SELECT CASE
        WHEN reputation >= 80 THEN 75 + floor(random()*16)::int
        WHEN reputation >= 60 THEN 65 + floor(random()*16)::int
        WHEN reputation >= 40 THEN 55 + floor(random()*16)::int
        WHEN reputation >= 25 THEN 45 + floor(random()*16)::int
        ELSE                       35 + floor(random()*16)::int
      END INTO v_cpu_base
      FROM leaderboard WHERE gym_id = r.gym_id;

      PERFORM generate_cpu_replacement(r.gym_id, r.weight_class, COALESCE(v_cpu_base, 50));
    END LOOP;
  END IF;

  -- ── Pool regeneration: jika pool < 250, tambah max 5 prospect baru ────────
  SELECT COUNT(*) INTO v_pool_count FROM fighters WHERE gym_id IS NULL AND status = 'prospect';
  IF v_pool_count < 250 THEN
    FOR i IN 1..LEAST(5, 300 - v_pool_count) LOOP
      PERFORM generate_pool_prospect();
    END LOOP;
  END IF;

  -- ── Simulasi dunia CPU (mingguan, global, sekali per season week) ─────────
  SELECT last_sim_week INTO v_last_sim_week FROM cpu_world_meta LIMIT 1;
  IF v_season_week > v_last_sim_week THEN
    UPDATE cpu_world_meta SET last_sim_week = v_season_week WHERE last_sim_week = v_last_sim_week;
    PERFORM simulate_cpu_fights(v_season_week);
    PERFORM sync_cpu_leaderboard();
  END IF;

END;
$$;
