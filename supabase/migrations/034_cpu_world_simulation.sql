-- Simulasi dunia CPU mingguan: pertarungan CPU vs CPU, growth, aging/retirement,
-- title contention, dan sinkronisasi leaderboard dari roster nyata (is_cpu = true).

-- ─── Generate 1 fighter pengganti untuk CPU gym (dipanggil saat fighter pensiun) ──
CREATE OR REPLACE FUNCTION generate_cpu_replacement(p_gym_id uuid, p_weight_class weight_class, p_base integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  id_fn  text[] := ARRAY['Andi','Bayu','Candra','Dimas','Eko','Fajar','Gilang','Hendra','Irfan','Joko','Kevin','Lukman','Maulana','Naufal','Putra','Rizal','Surya','Taufik','Wahyu','Adhitya','Bima','Evan','Ferry','Galih','Hafiz','Ivan','Jaka','Karim','Leo','Niko','Raka','Sandy','Teguh','Vino','Wisnu','Yanuar','Zainal','Reza','Akbar','Arya','Dafa','Hendi','Irwan','Kemal','Rian','Ridho'];
  id_ln  text[] := ARRAY['Saputra','Pratama','Wijaya','Kusuma','Santoso','Hidayat','Nugraha','Setiawan','Permana','Gunawan','Ramadhan','Firmansyah','Raharjo','Hartanto','Wibowo','Lesmana','Ardiansyah','Firdaus','Budiman','Chandra','Effendi','Fadillah','Kurniawan','Iskandar','Sanjaya','Adiputra','Purnama','Susanto','Mulyono','Wardhana','Rasyid','Marsudi','Latief','Pramono'];
  nk_arr text[] := ARRAY['Singa','Elang','Macan','Kobra','Petir','Badai','Garuda','Naga','Hiu','Banteng','Serigala','Harimau','Rajawali','Baja','Guntur','Pendekar','Jawara','Kilat','Panther','Wolf'];
  ht_arr text[] := ARRAY['Jakarta','Bandung','Surabaya','Medan','Makassar','Semarang','Palembang','Balikpapan','Manado','Pontianak','Denpasar','Yogyakarta','Bogor','Malang','Batam','Padang','Pekanbaru','Samarinda','Solo','Cirebon'];
  pe_arr text[] := ARRAY['Disciplined','Hardworker','Perfectionist','Veteran','Raw Talent','Calculated'];
  sp_arr text[] := ARRAY['Striker','Grappler','All-rounder','Counter Fighter','Wrestler'];

  v_age  integer := 18 + floor(random()*6)::int;
  v_pot  integer := LEAST(95, GREATEST(p_base+5, p_base + 10 + floor(random()*15)::int));
  v_name text;
BEGIN
  v_name := id_fn[1+floor(random()*array_length(id_fn,1))::int] || ' ' ||
            id_ln[1+floor(random()*array_length(id_ln,1))::int];

  INSERT INTO fighters (
    gym_id, is_cpu, name, nickname, age, hometown,
    weight_class, status, specialty, personality,
    attrs, record, potential,
    training_load, training_focus, training_intensity,
    contract_fights_left, salary_monthly, win_bonus,
    purse_share_pct, title_shot_clause, buyout_clause,
    win_streak, title_shot_pending, morale,
    avatar_seed, avatar_url, next_fight_week,
    weekly_schedule, injury_weeks_left
  ) VALUES (
    p_gym_id, true, v_name,
    nk_arr[1+floor(random()*array_length(nk_arr,1))::int],
    v_age,
    ht_arr[1+floor(random()*array_length(ht_arr,1))::int],
    p_weight_class, 'active',
    sp_arr[1+floor(random()*array_length(sp_arr,1))::int]::fighter_specialty,
    pe_arr[1+floor(random()*array_length(pe_arr,1))::int]::fighter_personality,
    jsonb_build_object(
      'punch_power',      GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'kick_power',       GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'accuracy',         GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'striking_defense', GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'takedowns',        GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'takedown_defense', GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'ground_control',   GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'submission',       GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'cardio',           GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'chin',             GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'durability',       GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'recovery',         GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'speed',            GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'fight_iq',         GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int)),
      'mental',           GREATEST(30,LEAST(99,p_base+floor(random()*21-10)::int))
    ),
    jsonb_build_object('w', 0, 'l', 0, 'd', 0),
    v_pot,
    0, NULL, 'medium',
    0, 0, 0,
    10, false, 0,
    0, false, 50,
    (10000+floor(random()*90000))::int,
    NULL, NULL, NULL, NULL
  );
END;
$$;

-- ─── Simulasi pertarungan CPU vs CPU per weight class + title contention ──────
CREATE OR REPLACE FUNCTION simulate_cpu_fights(p_season_week integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  wc_arr     weight_class[] := enum_range(NULL::weight_class);
  attr_keys  text[] := ARRAY['punch_power','kick_power','accuracy','striking_defense','takedowns','takedown_defense','ground_control','submission','cardio','chin','durability','recovery','speed','fight_iq','mental'];
  wc         weight_class;
  fighter_ids uuid[];
  i          integer;
  a_id       uuid;
  b_id       uuid;
  a_avg      numeric;
  b_avg      numeric;
  a_pot      integer;
  pwin       numeric;
  winner_id  uuid;
  loser_id   uuid;
  v_key      text;
  v_cur      integer;
  v_champ_fighter_id   uuid;
  v_champ_gym_id       uuid;
  v_champ_is_cpu       boolean;
  v_champ_avg          numeric;
  v_challenger_id      uuid;
  v_challenger_gym_id  uuid;
  v_challenger_name    text;
  v_challenger_avg     numeric;
  v_challenger_gym_name text;
BEGIN
  FOREACH wc IN ARRAY wc_arr LOOP
    SELECT array_agg(id ORDER BY random()) INTO fighter_ids
    FROM fighters WHERE is_cpu = true AND weight_class = wc AND status = 'active';

    IF fighter_ids IS NOT NULL AND array_length(fighter_ids, 1) >= 2 THEN
      i := 1;
      WHILE i < array_length(fighter_ids, 1) LOOP
        a_id := fighter_ids[i];
        b_id := fighter_ids[i+1];

        IF random() < 0.5 THEN
          SELECT (SELECT AVG(value::int) FROM jsonb_each_text(attrs)) INTO a_avg FROM fighters WHERE id = a_id;
          SELECT (SELECT AVG(value::int) FROM jsonb_each_text(attrs)) INTO b_avg FROM fighters WHERE id = b_id;

          pwin := a_avg / NULLIF(a_avg + b_avg, 0);
          pwin := LEAST(0.92, GREATEST(0.08, pwin + (random() * 0.2 - 0.1)));

          IF random() < pwin THEN
            winner_id := a_id; loser_id := b_id;
          ELSE
            winner_id := b_id; loser_id := a_id;
          END IF;

          UPDATE fighters SET
            record = jsonb_set(record, '{w}', to_jsonb(COALESCE((record->>'w')::int, 0) + 1)),
            win_streak = win_streak + 1
          WHERE id = winner_id;

          UPDATE fighters SET
            record = jsonb_set(record, '{l}', to_jsonb(COALESCE((record->>'l')::int, 0) + 1)),
            win_streak = 0
          WHERE id = loser_id;

          -- Growth ringan untuk pemenang (40% chance, 1 attr acak menuju potential)
          IF random() < 0.4 THEN
            v_key := attr_keys[1 + floor(random() * array_length(attr_keys, 1))::int];
            SELECT (attrs->>v_key)::int, potential INTO v_cur, a_pot FROM fighters WHERE id = winner_id;
            IF v_cur < a_pot THEN
              UPDATE fighters SET attrs = jsonb_set(attrs, ARRAY[v_key], to_jsonb(v_cur + 1)) WHERE id = winner_id;
            END IF;
          END IF;
        END IF;

        i := i + 2;
      END LOOP;
    END IF;

    -- ── Title contention ──────────────────────────────────────────────────
    SELECT champion_fighter_id, champion_gym_id INTO v_champ_fighter_id, v_champ_gym_id
    FROM championships WHERE weight_class = wc;

    v_champ_is_cpu := false;
    IF v_champ_fighter_id IS NOT NULL THEN
      SELECT is_cpu INTO v_champ_is_cpu FROM fighters WHERE id = v_champ_fighter_id;
    END IF;

    -- Title pemain tidak bisa direbut otomatis oleh simulasi
    IF v_champ_fighter_id IS NULL OR v_champ_is_cpu THEN
      SELECT id, gym_id, name, (SELECT AVG(value::int) FROM jsonb_each_text(f.attrs))
      INTO v_challenger_id, v_challenger_gym_id, v_challenger_name, v_challenger_avg
      FROM fighters f
      WHERE f.is_cpu = true AND f.weight_class = wc AND f.status = 'active'
        AND f.win_streak >= 3 AND f.id IS DISTINCT FROM v_champ_fighter_id
      ORDER BY f.win_streak DESC, (SELECT AVG(value::int) FROM jsonb_each_text(f.attrs)) DESC
      LIMIT 1;

      IF v_challenger_id IS NOT NULL THEN
        IF v_champ_fighter_id IS NULL THEN
          pwin := 1; -- gelar kosong, challenger otomatis menang
        ELSE
          SELECT (SELECT AVG(value::int) FROM jsonb_each_text(attrs)) INTO v_champ_avg FROM fighters WHERE id = v_champ_fighter_id;
          pwin := v_challenger_avg / NULLIF(v_challenger_avg + v_champ_avg, 0);
          pwin := LEAST(0.85, GREATEST(0.15, pwin + (random() * 0.2 - 0.1)));
        END IF;

        IF random() < pwin THEN
          SELECT gym_name INTO v_challenger_gym_name FROM leaderboard WHERE gym_id = v_challenger_gym_id;
          UPDATE championships SET
            champion_fighter_id = v_challenger_id,
            champion_gym_id     = v_challenger_gym_id,
            champion_gym_name   = v_challenger_gym_name,
            champion_name       = v_challenger_name,
            title_defenses      = 0,
            won_at_week         = p_season_week,
            updated_at          = now()
          WHERE weight_class = wc;
        ELSIF v_champ_fighter_id IS NOT NULL THEN
          UPDATE championships SET title_defenses = title_defenses + 1, updated_at = now()
          WHERE weight_class = wc;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- ─── Sinkronkan leaderboard CPU dari roster fighter nyata ─────────────────────
CREATE OR REPLACE FUNCTION sync_cpu_leaderboard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  WITH ranked AS (
    SELECT
      gym_id, name, specialty, record,
      ROW_NUMBER() OVER (PARTITION BY gym_id ORDER BY (record->>'w')::int DESC, (record->>'l')::int ASC) AS rn
    FROM fighters
    WHERE is_cpu = true AND status != 'retired'
  ),
  top3 AS (
    SELECT gym_id, jsonb_agg(jsonb_build_object(
      'name', name,
      'record', (record->>'w') || '-' || (record->>'l'),
      'specialty', specialty,
      'wins', (record->>'w')::int
    ) ORDER BY rn) AS top_fighters
    FROM ranked WHERE rn <= 3
    GROUP BY gym_id
  ),
  totals AS (
    SELECT gym_id,
      SUM((record->>'w')::int) AS total_wins,
      SUM((record->>'l')::int) AS total_losses,
      AVG((SELECT AVG(value::int) FROM jsonb_each_text(attrs))) AS avg_ovr
    FROM fighters
    WHERE is_cpu = true AND status != 'retired'
    GROUP BY gym_id
  )
  UPDATE leaderboard lb SET
    total_wins   = totals.total_wins,
    total_losses = totals.total_losses,
    top_fighters = top3.top_fighters,
    reputation   = LEAST(99, GREATEST(5, ROUND(totals.avg_ovr * 0.9 + (totals.total_wins - totals.total_losses) * 0.3)::int))
  FROM totals
  JOIN top3 ON top3.gym_id = totals.gym_id
  WHERE lb.gym_id = totals.gym_id;
END;
$$;

-- ─── advance_week(): tambah aging/retirement CPU + trigger simulasi mingguan ──
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
