-- Pool 300 free agent fighters persisten (mirip database FM)
-- gym_id = NULL = free agent, belum bergabung gym manapun
-- Tersedia untuk direkrut lewat halaman Rekrutmen

-- 1. Izinkan gym_id = NULL (free agent)
ALTER TABLE fighters ALTER COLUMN gym_id DROP NOT NULL;

-- 2. Update RLS fighters: pemain bisa baca fighter miliknya ATAU pool (gym_id IS NULL)
DROP POLICY IF EXISTS "Users manage own fighters" ON fighters;

CREATE POLICY "fighters_select" ON fighters
  FOR SELECT USING (
    gym_id IS NULL OR
    gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid())
  );

CREATE POLICY "fighters_insert" ON fighters
  FOR INSERT WITH CHECK (
    gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid())
  );

CREATE POLICY "fighters_update" ON fighters
  FOR UPDATE USING (
    gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid())
  );

CREATE POLICY "fighters_delete" ON fighters
  FOR DELETE USING (
    gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid())
  );

-- 3. Tabel scouting: gym mana sudah scout fighter mana
CREATE TABLE IF NOT EXISTS scouted_fighters (
  gym_id     uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  fighter_id uuid NOT NULL REFERENCES fighters(id) ON DELETE CASCADE,
  PRIMARY KEY (gym_id, fighter_id)
);
ALTER TABLE scouted_fighters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scouted_fighters_owner" ON scouted_fighters
  FOR ALL USING (gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid()));

-- 4. Fungsi recruit: pindahkan free agent ke gym (SECURITY DEFINER untuk bypass RLS pool)
CREATE OR REPLACE FUNCTION recruit_pool_fighter(
  p_fighter_id       uuid,
  p_gym_id           uuid,
  p_salary           bigint,
  p_win_bonus        bigint,
  p_purse_share_pct  integer,
  p_contract_fights  integer,
  p_buyout_clause    bigint,
  p_title_shot_clause boolean,
  p_signing_bonus    bigint
)
RETURNS fighters LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fighter fighters;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM gyms WHERE id = p_gym_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE fighters SET
    gym_id              = p_gym_id,
    status              = 'training',
    training_load       = 0,
    salary_monthly      = p_salary,
    win_bonus           = p_win_bonus,
    purse_share_pct     = p_purse_share_pct,
    contract_fights_left = p_contract_fights,
    buyout_clause       = p_buyout_clause,
    title_shot_clause   = p_title_shot_clause,
    morale              = 70,
    win_streak          = 0,
    title_shot_pending  = false,
    weekly_schedule     = '{"mon":"striking","tue":"grappling","wed":"cardio","thu":"sparring","fri":"mental","sat":"rest"}'::jsonb,
    training_intensity  = 'medium'
  WHERE id = p_fighter_id AND gym_id IS NULL
  RETURNING * INTO v_fighter;

  IF v_fighter IS NULL THEN
    RAISE EXCEPTION 'Fighter tidak tersedia (sudah direkrut)';
  END IF;

  UPDATE gyms SET
    balance         = balance - p_signing_bonus,
    monthly_expense = monthly_expense + p_salary
  WHERE id = p_gym_id;

  RETURN v_fighter;
END;
$$;

-- 5. Seed 300 free agent fighters
DO $$
DECLARE
  id_fn  text[] := ARRAY['Andi','Bayu','Candra','Dimas','Eko','Fajar','Gilang','Hendra','Irfan','Joko','Kevin','Lukman','Maulana','Naufal','Oscar','Putra','Rizal','Surya','Taufik','Wahyu','Adhitya','Bima','Dani','Evan','Ferry','Galih','Hafiz','Ivan','Jaka','Karim','Leo','Niko','Raka','Sandy','Teguh','Vino','Wisnu','Yanuar','Zainal','Reza','Akbar','Bobby','Calvin','David','Fendi','Guntur','Heri','Imam','Kiki','Lutfi','Arya','Dafa','Hendi','Topan','Irwan','Jarwo','Kemal','Rian','Novan','Ridho'];
  id_ln  text[] := ARRAY['Saputra','Pratama','Wijaya','Kusuma','Santoso','Hidayat','Nugraha','Setiawan','Permana','Gunawan','Ramadhan','Firmansyah','Raharjo','Hartanto','Wibowo','Lesmana','Supriyadi','Ardiansyah','Firdaus','Budiman','Chandra','Darwis','Effendi','Fadillah','Kurniawan','Iskandar','Sanjaya','Adiputra','Purnama','Susanto','Mulyono','Wardhana','Rasyid','Anggara','Situmorang','Tampubolon','Marsudi','Latief','Pramono','Wahyudi'];
  int_fn text[] := ARRAY['Carlos Silva','Diego Santos','Rodrigo Lima','Felipe Ferreira','Gustavo Almeida','Kenji Yamamoto','Ryota Tanaka','Takeshi Watanabe','Viktor Volkov','Dmitri Petrov','Ivan Sokolov','Marcus Johnson','Tyler Brooks','Park Jae-won','Eduardo Costa'];
  nk_arr text[] := ARRAY['Singa','Elang','Macan','Kobra','Petir','Badai','Ronin','Garuda','Naga','Hiu','Banteng','Serigala','Harimau','Rajawali','Baja','Api','Guntur','Pendekar','Jawara','Cakar','Kilat','Badak','Panther','Dragon','Wolf'];
  wc_arr text[] := ARRAY['Strawweight','Flyweight','Bantamweight','Featherweight','Lightweight','Welterweight','Middleweight','Heavyweight'];
  sp_arr text[] := ARRAY['Striker','Grappler','All-rounder','Counter Fighter','Wrestler'];
  pe_arr text[] := ARRAY['Disciplined','Hardworker','Perfectionist','Veteran','Raw Talent','Calculated'];
  ht_arr text[] := ARRAY['Jakarta','Bandung','Surabaya','Medan','Makassar','Semarang','Palembang','Balikpapan','Manado','Pontianak','Denpasar','Yogyakarta','Bogor','Malang','Batam','Padang','Pekanbaru','Samarinda','Solo','Cirebon','Kediri','Palu','Kupang','Ambon','Jayapura'];

  i        integer;
  v_tier   integer;
  v_age    integer;
  v_base   integer;
  v_pot    integer;
  v_wins   integer;
  v_losses integer;
  v_attrs  jsonb;
  v_name   text;
  v_wc     text;
BEGIN
  IF (SELECT COUNT(*) FROM fighters WHERE gym_id IS NULL) > 0 THEN RETURN; END IF;

  FOR i IN 1..300 LOOP
    IF    i <= 90  THEN v_tier := 1;  -- Young Prospect 18-22
    ELSIF i <= 180 THEN v_tier := 2;  -- Rising Star 23-27
    ELSIF i <= 255 THEN v_tier := 3;  -- Established 28-32
    ELSE                v_tier := 4;  -- Veteran 33-38
    END IF;

    v_age := CASE v_tier
      WHEN 1 THEN 18 + floor(random()*5)::int
      WHEN 2 THEN 23 + floor(random()*5)::int
      WHEN 3 THEN 28 + floor(random()*5)::int
      ELSE        33 + floor(random()*6)::int
    END;

    v_base := CASE v_tier
      WHEN 1 THEN 42 + floor(random()*16)::int
      WHEN 2 THEN 55 + floor(random()*18)::int
      WHEN 3 THEN 65 + floor(random()*18)::int
      ELSE        68 + floor(random()*15)::int
    END;

    v_pot := GREATEST(50, LEAST(92, CASE v_tier
      WHEN 1 THEN 65 + floor(random()*28)::int
      WHEN 2 THEN 58 + floor(random()*23)::int
      WHEN 3 THEN 62 + floor(random()*14)::int
      ELSE        62 + floor(random()*10)::int
    END));

    v_wins := CASE v_tier
      WHEN 1 THEN floor(random()*5)::int
      WHEN 2 THEN 3  + floor(random()*12)::int
      WHEN 3 THEN 8  + floor(random()*17)::int
      ELSE        12 + floor(random()*18)::int
    END;
    v_losses := CASE v_tier
      WHEN 1 THEN floor(random()*3)::int
      WHEN 2 THEN floor(random()*5)::int
      WHEN 3 THEN 1 + floor(random()*7)::int
      ELSE        2 + floor(random()*9)::int
    END;

    v_attrs := jsonb_build_object(
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
    );

    v_wc := wc_arr[1 + (i % 8)];

    IF random() < 0.2 THEN
      v_name := int_fn[1 + floor(random()*array_length(int_fn,1))::int];
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
      v_wc::weight_class,
      'prospect'::fighter_status,
      sp_arr[1+floor(random()*array_length(sp_arr,1))::int]::fighter_specialty,
      pe_arr[1+floor(random()*array_length(pe_arr,1))::int]::fighter_personality,
      v_attrs,
      jsonb_build_object('w',v_wins,'l',v_losses,'d',0),
      v_pot,
      0, NULL, 'medium',
      0, 0, 0,
      10, false, 0,
      0, false, 50,
      (10000+floor(random()*90000))::int,
      NULL, NULL, NULL, NULL
    );
  END LOOP;
END $$;
