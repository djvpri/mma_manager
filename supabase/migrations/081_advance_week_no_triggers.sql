-- 081: Hapus total mekanisme trigger BEFORE/AFTER UPDATE OF season_week ON gyms
-- (047, 049, 050, 058, 065, 068, dan konversi AFTER dari 080) -- migration 080
-- TERNYATA TIDAK CUKUP: dua trigger AFTER (065 player_achievements & 068
-- title_contention) masih bisa melakukan nested UPDATE fighters ke baris yang
-- sama dalam SATU command (cascade dari UPDATE gyms SET season_week=...),
-- yang tetap memicu "tuple to be updated was already modified by an
-- operation triggered by the current command".
--
-- Fix permanen: jadikan semua side-effect ini fungsi BIASA yang dipanggil
-- SEKUENSIAL dari advance_week() (pola yang sudah dipakai
-- generate_random_fighter_events). Statement sekuensial dalam satu function
-- body tidak pernah memicu error ini.

-- ── Hapus semua trigger lama ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_gym_members ON gyms;
DROP TRIGGER IF EXISTS trg_gym_operational_income ON gyms;
DROP TRIGGER IF EXISTS trg_scout_missions ON gyms;
DROP TRIGGER IF EXISTS trg_cpu_world_news ON gyms;
DROP TRIGGER IF EXISTS trg_player_achievements ON gyms;
DROP TRIGGER IF EXISTS trg_title_contention ON gyms;

-- ── 047: member gym -> hitung member_count baru + pemasukan member ─────────
CREATE OR REPLACE FUNCTION process_gym_members(p_gym_id uuid)
RETURNS TABLE(new_member_count integer, member_income bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rooms        jsonb;
  v_reputation   integer;
  v_member_count integer;
  v_member_fee   bigint;
  v_room_levels  integer;
  v_recent_wins  integer;
  v_target       integer;
  v_fee_mult     numeric;
  v_drift        integer;
BEGIN
  SELECT rooms, reputation, member_count, member_fee
    INTO v_rooms, v_reputation, v_member_count, v_member_fee
  FROM gyms WHERE id = p_gym_id;

  SELECT COALESCE(SUM((value->>'level')::int), 0) INTO v_room_levels
  FROM jsonb_each(v_rooms);

  SELECT COUNT(*) INTO v_recent_wins
  FROM fight_results
  WHERE gym_id = p_gym_id
    AND overall_winner = 'my'
    AND created_at > now() - interval '28 days';

  v_fee_mult := GREATEST(0.5, LEAST(1.5, 350000.0 / NULLIF(v_member_fee, 0)));

  v_target := GREATEST(20, ROUND(
    (40 + v_reputation * 3 + v_room_levels * 8 + v_recent_wins * 15)
    * v_fee_mult
  ));

  v_drift := ROUND((v_target - v_member_count) * 0.15)
             + (FLOOR(RANDOM() * 11) - 5)::int;

  new_member_count := GREATEST(10, v_member_count + v_drift);
  member_income    := (new_member_count::bigint * v_member_fee) / 4;
  RETURN NEXT;
END;
$$;

-- ── 049: pemasukan operasional -> hitung monthly_income baru ───────────────
CREATE OR REPLACE FUNCTION process_operational_income(p_gym_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rooms        jsonb;
  v_locker_level integer;
  v_total_levels integer;
BEGIN
  SELECT rooms INTO v_rooms FROM gyms WHERE id = p_gym_id;

  v_locker_level := COALESCE((v_rooms->'locker'->>'level')::int, 0);

  SELECT COALESCE(SUM((value->>'level')::int), 0) INTO v_total_levels
  FROM jsonb_each(v_rooms);

  RETURN 600000 * (1 + v_locker_level) + 200000 * v_total_levels + 600000;
END;
$$;

-- ── 050: scout missions -> kurangi weeks_remaining, selesaikan yang habis ──
CREATE OR REPLACE FUNCTION process_scout_missions(p_gym_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE scout_missions
    SET weeks_remaining = weeks_remaining - 1
    WHERE gym_id = p_gym_id AND status = 'in_progress' AND weeks_remaining > 0;

  UPDATE scout_missions
    SET status = 'completed', weeks_remaining = 0
    WHERE gym_id = p_gym_id AND status = 'in_progress' AND weeks_remaining <= 0;
END;
$$;

-- ── 058: world news CPU (rebut sabuk, win streak, retirement) ──────────────
CREATE OR REPLACE FUNCTION process_cpu_world_news(p_gym_id uuid, p_season_week integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r record;
BEGIN
  -- Perebutan sabuk juara oleh fighter CPU
  FOR r IN
    SELECT c.weight_class, c.champion_name, c.won_at_week
    FROM championships c
    JOIN fighters f ON f.id = c.champion_fighter_id
    WHERE f.is_cpu = true
      AND c.won_at_week IS NOT NULL
      AND (c.news_announced_week IS NULL OR c.news_announced_week < c.won_at_week)
    LIMIT 2
  LOOP
    INSERT INTO fighter_news (gym_id, season_week, message)
    VALUES (p_gym_id, p_season_week, '🏆 ' || r.champion_name || ' merebut sabuk juara ' || r.weight_class || '! Persaingan kelas ini kini makin sengit.');

    UPDATE championships SET news_announced_week = r.won_at_week WHERE weight_class = r.weight_class;
  END LOOP;

  -- Win streak CPU mencapai kelipatan 5
  FOR r IN
    SELECT id, name, weight_class, win_streak,
           (win_streak / 5) * 5 AS milestone
    FROM fighters
    WHERE is_cpu = true AND status = 'active'
      AND win_streak >= 5
      AND win_streak >= last_streak_news + 5
    LIMIT 2
  LOOP
    INSERT INTO fighter_news (gym_id, season_week, message)
    VALUES (p_gym_id, p_season_week, '🔥 ' || r.name || ' (' || r.weight_class || ') mencatat win streak ke-' || r.milestone || ', salah satu fighter CPU paling panas saat ini!');

    UPDATE fighters SET last_streak_news = r.milestone WHERE id = r.id;
  END LOOP;

  -- Fighter CPU resmi pensiun
  FOR r IN
    SELECT id, name, weight_class, record
    FROM fighters
    WHERE is_cpu = true AND status = 'retired' AND retirement_announced = false
    LIMIT 2
  LOOP
    INSERT INTO fighter_news (gym_id, season_week, message)
    VALUES (p_gym_id, p_season_week, '👋 ' || r.name || ' (' || r.weight_class || ') resmi pensiun dengan rekor ' || (r.record->>'w') || '-' || (r.record->>'l') || '-' || (r.record->>'d') || '.');

    UPDATE fighters SET retirement_announced = true WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 065: achievement/milestone fighter milik pemain ────────────────────────
CREATE OR REPLACE FUNCTION process_player_achievements(p_gym_id uuid, p_season_week integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r record;
BEGIN
  -- Win streak kelipatan 5
  FOR r IN
    SELECT id, name, win_streak, (win_streak / 5) * 5 AS milestone
    FROM fighters
    WHERE gym_id = p_gym_id AND is_cpu IS NOT TRUE AND status <> 'retired'
      AND win_streak >= 5 AND win_streak >= last_streak_news + 5
    LIMIT 2
  LOOP
    INSERT INTO fighter_news (gym_id, season_week, message)
    VALUES (p_gym_id, p_season_week, '🏅 ' || r.name || ' mencatat win streak ke-' || r.milestone || '! Pencapaian baru untuk gym.');

    UPDATE fighters SET last_streak_news = r.milestone WHERE id = r.id;
  END LOOP;

  -- Total kemenangan karier kelipatan 10
  FOR r IN
    SELECT id, name, (record->>'w')::int AS wins, ((record->>'w')::int / 10) * 10 AS milestone
    FROM fighters
    WHERE gym_id = p_gym_id AND is_cpu IS NOT TRUE AND status <> 'retired'
      AND (record->>'w')::int >= 10 AND (record->>'w')::int >= last_wins_milestone + 10
    LIMIT 2
  LOOP
    INSERT INTO fighter_news (gym_id, season_week, message)
    VALUES (p_gym_id, p_season_week, '🏅 ' || r.name || ' mencapai ' || r.milestone || ' kemenangan karier! Legenda baru sedang dibentuk.');

    UPDATE fighters SET last_wins_milestone = r.milestone WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 068: title shot berbasis ranking top 5 weight class ────────────────────
CREATE OR REPLACE FUNCTION process_title_contention(p_gym_id uuid, p_season_week integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r record;
  v_score numeric;
  v_rank integer;
  v_champion_id uuid;
BEGIN
  FOR r IN
    SELECT id, name, weight_class, attrs, win_streak, record, title_shot_pending
    FROM fighters
    WHERE gym_id = p_gym_id AND status IN ('training','active')
  LOOP
    v_score := fighter_rank_score(r.attrs, r.win_streak, r.record);

    SELECT COUNT(*) + 1 INTO v_rank
    FROM fighters f2
    WHERE f2.gym_id IS NOT NULL
      AND f2.weight_class = r.weight_class
      AND f2.status IN ('training','active')
      AND f2.id <> r.id
      AND fighter_rank_score(f2.attrs, f2.win_streak, f2.record) > v_score;

    SELECT champion_fighter_id INTO v_champion_id
    FROM championships WHERE weight_class = r.weight_class;

    IF v_rank <= 5 AND r.id IS DISTINCT FROM v_champion_id THEN
      IF NOT r.title_shot_pending THEN
        UPDATE fighters SET title_shot_pending = true WHERE id = r.id;
        INSERT INTO fighter_news (gym_id, season_week, message)
        VALUES (p_gym_id, p_season_week, '🎯 ' || r.name || ' kini masuk top 5 kontender ' || r.weight_class || ' (rank #' || v_rank || ') dan berhak atas title shot!');
      END IF;
    ELSE
      IF r.title_shot_pending THEN
        UPDATE fighters SET title_shot_pending = false WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- ── advance_week(): panggil semua di atas secara sekuensial ────────────────
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
  v_new_member_count  integer;
  v_member_income     bigint;
  v_new_monthly_income bigint;
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

  -- Member gym & pemasukan operasional (dihitung sebelum update season_week)
  SELECT new_member_count, member_income INTO v_new_member_count, v_member_income
  FROM process_gym_members(p_gym_id);
  v_new_monthly_income := process_operational_income(p_gym_id);

  -- Increment week + income
  UPDATE gyms SET
    season_week    = season_week + 1,
    balance        = balance + v_new_monthly_income - monthly_expense + v_sponsor_income + v_member_income,
    monthly_income = v_new_monthly_income,
    member_count   = v_new_member_count
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

  -- ── Ulang tahun fighter (moral naik + bertambah usia 1 tahun, dibatasi 45) ─
  UPDATE fighters SET morale = LEAST(100, morale + 5), age = LEAST(45, age + 1)
  WHERE gym_id = p_gym_id AND status != 'retired'
    AND (v_season_week + 1) % 52 = birth_week % 52;

  -- ── Kejadian acak mingguan ─────────────────────────────────────────────────
  PERFORM generate_random_fighter_events(p_gym_id, v_season_week + 1);

  -- ── Side-effect mingguan lain (sebelumnya trigger BEFORE/AFTER on gyms) ────
  PERFORM process_scout_missions(p_gym_id);
  PERFORM process_cpu_world_news(p_gym_id, v_season_week + 1);
  PERFORM process_player_achievements(p_gym_id, v_season_week + 1);
  PERFORM process_title_contention(p_gym_id, v_season_week + 1);

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
    -- Tambah usia semua pool fighter (dibatasi 45)
    UPDATE fighters SET age = LEAST(45, age + 1)
    WHERE gym_id IS NULL AND status = 'prospect';
    -- Hapus pool fighter yang sudah terlalu tua (umur >= 38, 30% chance)
    DELETE FROM fighters
    WHERE gym_id IS NULL AND status = 'prospect' AND age >= 38 AND RANDOM() < 0.30;

    -- ── CPU fighter aging + retirement/replacement (dibatasi 45) ────────────
    UPDATE fighters SET age = LEAST(45, age + 1) WHERE is_cpu = true AND status = 'active';

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
