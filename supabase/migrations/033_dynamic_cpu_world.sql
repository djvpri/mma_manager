-- Dunia CPU dinamis: 50 CPU gym dapat roster fighter nyata (bukan cuma snapshot JSON)
-- agar leaderboard, ranking fighter, dan champion belt bisa berubah dari waktu ke waktu.

-- 1. Penanda fighter milik roster CPU gym
ALTER TABLE fighters ADD COLUMN IF NOT EXISTS is_cpu boolean NOT NULL DEFAULT false;

-- 2. CPU gym tidak punya row di tabel gyms -> lepas FK agar gym_id bisa diisi CPU gym id
ALTER TABLE fighters DROP CONSTRAINT IF EXISTS fighters_gym_id_fkey;
ALTER TABLE championships DROP CONSTRAINT IF EXISTS championships_champion_gym_id_fkey;

-- 3. RLS: roster CPU bisa dibaca semua user (read-only, mutasi via SECURITY DEFINER functions)
DROP POLICY IF EXISTS "fighters_select" ON fighters;
CREATE POLICY "fighters_select" ON fighters
  FOR SELECT USING (
    gym_id IS NULL
    OR is_cpu = true
    OR gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid())
  );

-- 4. Tracker global: kapan terakhir CPU world disimulasikan
CREATE TABLE IF NOT EXISTS cpu_world_meta (
  last_sim_week integer NOT NULL DEFAULT 0
);
INSERT INTO cpu_world_meta (last_sim_week)
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM cpu_world_meta);

-- 5. Seed roster: 3 fighter nyata per CPU gym, dari top_fighters yang sudah ada
DO $$
DECLARE
  wc_arr   weight_class[] := enum_range(NULL::weight_class);
  pe_arr   text[] := ARRAY['Disciplined','Hardworker','Perfectionist','Veteran','Raw Talent','Calculated'];
  nk_arr   text[] := ARRAY['Singa','Elang','Macan','Kobra','Petir','Badai','Garuda','Naga','Hiu','Banteng','Serigala','Harimau','Rajawali','Baja','Guntur','Pendekar','Jawara','Kilat','Panther','Wolf'];
  ht_arr   text[] := ARRAY['Jakarta','Bandung','Surabaya','Medan','Makassar','Semarang','Palembang','Balikpapan','Manado','Pontianak','Denpasar','Yogyakarta','Bogor','Malang','Batam','Padang','Pekanbaru','Samarinda','Solo','Cirebon'];

  r        record;
  tf       jsonb;
  i        integer := 0;
  v_wc     weight_class;
  v_base   integer;
  v_pot    integer;
  v_age    integer;
BEGIN
  IF EXISTS (SELECT 1 FROM fighters WHERE is_cpu = true) THEN RETURN; END IF;

  FOR r IN
    SELECT gym_id, reputation, top_fighters FROM leaderboard
    WHERE gym_id NOT IN (SELECT id FROM gyms)
    ORDER BY reputation DESC, gym_name
  LOOP
    i := i + 1;
    v_wc := wc_arr[1 + ((i - 1) % 8)];

    v_base := CASE
      WHEN r.reputation >= 80 THEN 75 + floor(random() * 16)::int
      WHEN r.reputation >= 60 THEN 65 + floor(random() * 16)::int
      WHEN r.reputation >= 40 THEN 55 + floor(random() * 16)::int
      WHEN r.reputation >= 25 THEN 45 + floor(random() * 16)::int
      ELSE                          35 + floor(random() * 16)::int
    END;
    v_pot := LEAST(95, v_base + 5 + floor(random() * 15)::int);

    FOR tf IN SELECT * FROM jsonb_array_elements(r.top_fighters)
    LOOP
      v_age := 21 + floor(random() * 12)::int;

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
        r.gym_id, true, tf->>'name',
        nk_arr[1 + floor(random() * array_length(nk_arr, 1))::int],
        v_age,
        ht_arr[1 + floor(random() * array_length(ht_arr, 1))::int],
        v_wc, 'active', (tf->>'specialty')::fighter_specialty,
        pe_arr[1 + floor(random() * array_length(pe_arr, 1))::int]::fighter_personality,
        jsonb_build_object(
          'punch_power',      GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'kick_power',       GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'accuracy',         GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'striking_defense', GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'takedowns',        GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'takedown_defense', GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'ground_control',   GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'submission',       GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'cardio',           GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'chin',             GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'durability',       GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'recovery',         GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'speed',            GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'fight_iq',         GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int)),
          'mental',           GREATEST(30,LEAST(99,v_base+floor(random()*21-10)::int))
        ),
        jsonb_build_object(
          'w', GREATEST(0, COALESCE(NULLIF(split_part(tf->>'record','-',1), '')::int, 0)),
          'l', GREATEST(0, COALESCE(NULLIF(split_part(tf->>'record','-',2), '')::int, 0)),
          'd', 0
        ),
        v_pot,
        0, NULL, 'medium',
        0, 0, 0,
        10, false, 0,
        0, false, 50,
        (10000+floor(random()*90000))::int,
        NULL, NULL, NULL, NULL
      );
    END LOOP;
  END LOOP;
END $$;
