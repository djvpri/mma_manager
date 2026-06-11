-- Pool maintenance + personality effects:
-- 1. Pool fighter aging setiap 12 minggu (via pool_meta global tracker)
-- 2. Pool regeneration: jika pool < 250, tambah max 5 prospect per advance
-- 3. Personality effects: Hardworker +15% growth, Raw Talent +25% < 24th / -5% >= 28th

-- Tabel untuk tracking kapan terakhir pool fighter di-age (global, lintas user)
CREATE TABLE IF NOT EXISTS pool_meta (
  last_aging_week integer NOT NULL DEFAULT 0
);
INSERT INTO pool_meta (last_aging_week) VALUES (0) ON CONFLICT DO NOTHING;

-- ─── Fungsi generate satu pool prospect ──────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_pool_prospect()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  id_fn  text[] := ARRAY['Andi','Bayu','Candra','Dimas','Eko','Fajar','Gilang','Hendra','Irfan','Joko','Kevin','Lukman','Maulana','Naufal','Putra','Rizal','Surya','Taufik','Wahyu','Adhitya','Bima','Evan','Ferry','Galih','Hafiz','Ivan','Jaka','Karim','Leo','Niko','Raka','Sandy','Teguh','Vino','Wisnu','Yanuar','Zainal','Reza','Akbar','Arya','Dafa','Hendi','Irwan','Kemal','Rian','Ridho'];
  id_ln  text[] := ARRAY['Saputra','Pratama','Wijaya','Kusuma','Santoso','Hidayat','Nugraha','Setiawan','Permana','Gunawan','Ramadhan','Firmansyah','Raharjo','Hartanto','Wibowo','Lesmana','Ardiansyah','Firdaus','Budiman','Chandra','Effendi','Fadillah','Kurniawan','Iskandar','Sanjaya','Adiputra','Purnama','Susanto','Mulyono','Wardhana','Rasyid','Marsudi','Latief','Pramono'];
  int_fn text[] := ARRAY['Carlos Silva','Diego Santos','Rodrigo Lima','Felipe Ferreira','Kenji Yamamoto','Viktor Volkov','Marcus Johnson','Tyler Brooks','Park Jae-won'];
  nk_arr text[] := ARRAY['Singa','Elang','Macan','Kobra','Petir','Badai','Garuda','Naga','Hiu','Banteng','Serigala','Harimau','Rajawali','Baja','Guntur','Pendekar','Jawara','Kilat','Panther','Wolf'];
  wc_arr text[] := ARRAY['Strawweight','Flyweight','Bantamweight','Featherweight','Lightweight','Welterweight','Middleweight','Heavyweight'];
  sp_arr text[] := ARRAY['Striker','Grappler','All-rounder','Counter Fighter','Wrestler'];
  pe_arr text[] := ARRAY['Disciplined','Hardworker','Perfectionist','Veteran','Raw Talent','Calculated'];
  ht_arr text[] := ARRAY['Jakarta','Bandung','Surabaya','Medan','Makassar','Semarang','Palembang','Balikpapan','Manado','Pontianak','Denpasar','Yogyakarta','Bogor','Malang','Batam','Padang','Pekanbaru','Samarinda','Solo','Cirebon'];

  v_age  integer := 18 + floor(random()*5)::int;
  v_base integer := 42 + floor(random()*16)::int;
  v_pot  integer := GREATEST(50, LEAST(92, 65 + floor(random()*28)::int));
  v_name text;
BEGIN
  IF random() < 0.2 THEN
    v_name := int_fn[1+floor(random()*array_length(int_fn,1))::int];
  ELSE
    v_name := id_fn[1+floor(random()*array_length(id_fn,1))::int] || ' ' ||
              id_ln[1+floor(random()*array_length(id_ln,1))::int];
  END IF;

  INSERT INTO fighters (
    gym_id, name, nickname, age, hometown,
    weight_class, status, specialty, personality,
    attrs, record, potential,
    training_load, training_focus, training_intensity,
    contract_fights_left, salary_monthly, win_bonus,
    purse_share_pct, title_shot_clause, buyout_clause,
    win_streak, title_shot_pending, morale,
    avatar_seed, avatar_url, next_fight_week,
    weekly_schedule, injury_weeks_left
  ) VALUES (
    NULL, v_name,
    nk_arr[1+floor(random()*array_length(nk_arr,1))::int],
    v_age,
    ht_arr[1+floor(random()*array_length(ht_arr,1))::int],
    wc_arr[1+(floor(random()*8))::int]::weight_class,
    'prospect'::fighter_status,
    sp_arr[1+floor(random()*array_length(sp_arr,1))::int]::fighter_specialty,
    pe_arr[1+floor(random()*array_length(pe_arr,1))::int]::fighter_personality,
    jsonb_build_object(
      'punch_power',      GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'kick_power',       GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'accuracy',         GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'striking_defense', GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'takedowns',        GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'takedown_defense', GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'ground_control',   GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'submission',       GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'cardio',           GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'chin',             GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'durability',       GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'recovery',         GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'speed',            GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'fight_iq',         GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int)),
      'mental',           GREATEST(35,LEAST(92,v_base+floor(random()*21-10)::int))
    ),
    jsonb_build_object('w', floor(random()*4)::int, 'l', floor(random()*2)::int, 'd', 0),
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

-- ─── advance_week() dengan pool maintenance + personality effects ─────────────
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
    UPDATE pool_meta SET last_aging_week = v_season_week;
    -- Tambah usia semua pool fighter
    UPDATE fighters SET age = age + 1
    WHERE gym_id IS NULL AND status = 'prospect';
    -- Hapus pool fighter yang sudah terlalu tua (umur >= 38, 30% chance)
    DELETE FROM fighters
    WHERE gym_id IS NULL AND status = 'prospect' AND age >= 38 AND RANDOM() < 0.30;
  END IF;

  -- ── Pool regeneration: jika pool < 250, tambah max 5 prospect baru ────────
  SELECT COUNT(*) INTO v_pool_count FROM fighters WHERE gym_id IS NULL AND status = 'prospect';
  IF v_pool_count < 250 THEN
    FOR i IN 1..LEAST(5, 300 - v_pool_count) LOOP
      PERFORM generate_pool_prospect();
    END LOOP;
  END IF;

END;
$$;
