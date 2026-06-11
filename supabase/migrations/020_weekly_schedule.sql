-- Sistem jadwal latihan mingguan per fighter (6 sesi: Senin-Sabtu)
-- Menggantikan training_focus tunggal dengan jadwal harian yang bisa dikustomisasi
-- Setiap sesi menargetkan grup atribut berbeda; sesi 'rest' memberikan bonus recovery

ALTER TABLE fighters ADD COLUMN IF NOT EXISTS weekly_schedule JSONB DEFAULT '{
  "mon":"striking","tue":"grappling","wed":"cardio",
  "thu":"sparring","fri":"mental","sat":"rest"
}'::jsonb;

-- Backfill jadwal default untuk fighter yang sudah ada
UPDATE fighters
SET weekly_schedule = '{
  "mon":"striking","tue":"grappling","wed":"cardio",
  "thu":"sparring","fri":"mental","sat":"rest"
}'::jsonb
WHERE weekly_schedule IS NULL;

-- Perbarui advance_week(): gunakan weekly_schedule untuk perkembangan atribut
CREATE OR REPLACE FUNCTION advance_week(p_gym_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_recovery_level integer;
  v_rooms jsonb;
  v_staff_specialties text[];
  r record;
  v_days text[] := ARRAY['mon','tue','wed','thu','fri','sat'];
  v_day text;
  v_session text;
  v_attrs_for_session text[];
  v_target_attr text;
  v_current int;
  v_room_key text;
  v_specialty text;
  v_room_level int;
  v_chance numeric;
  v_amount int;
BEGIN
  SELECT rooms, COALESCE((rooms->'recovery'->>'level')::integer, 0)
    INTO v_rooms, v_recovery_level
  FROM gyms WHERE id = p_gym_id;

  SELECT COALESCE(array_agg(specialty), '{}') INTO v_staff_specialties
  FROM staff WHERE gym_id = p_gym_id AND is_hired = true;

  -- Increment week, apply income/expense
  UPDATE gyms SET
    season_week = season_week + 1,
    balance = balance + monthly_income - monthly_expense
  WHERE id = p_gym_id
    AND auth.uid() = user_id;

  -- Training load recovery, boosted by recovery room level
  UPDATE fighters SET
    training_load = GREATEST(10, training_load - 5 - (v_recovery_level * 2))
  WHERE gym_id = p_gym_id
    AND status = 'training';

  -- Kurangi sisa minggu cedera, dipercepat oleh recovery room
  UPDATE fighters SET
    injury_weeks_left = GREATEST(0, injury_weeks_left - 1 - v_recovery_level)
  WHERE gym_id = p_gym_id
    AND status = 'injured'
    AND injury_weeks_left IS NOT NULL;

  -- Fighter yang sudah sembuh kembali ke status training
  UPDATE fighters SET
    status = 'training',
    injury = null,
    injury_weeks_left = null
  WHERE gym_id = p_gym_id
    AND status = 'injured'
    AND COALESCE(injury_weeks_left, 0) <= 0;

  -- Perkembangan atribut berdasarkan weekly_schedule (6 sesi per minggu)
  -- Setiap sesi = 1 roll pada 1 atribut acak dari grup sesi tersebut
  -- Peluang per sesi: 0.25 + (room_level * 0.05), total seminggu ~mirip sistem lama
  FOR r IN
    SELECT id, attrs, potential, weekly_schedule
    FROM fighters
    WHERE gym_id = p_gym_id
      AND status = 'training'
      AND weekly_schedule IS NOT NULL
  LOOP
    FOREACH v_day IN ARRAY v_days LOOP
      v_session := r.weekly_schedule->>v_day;

      IF v_session IS NULL OR v_session = 'rest' THEN
        CONTINUE;
      END IF;

      CASE v_session
        WHEN 'striking' THEN
          v_attrs_for_session := ARRAY['punch_power','kick_power','accuracy','striking_defense'];
          v_room_key := 'striking';
          v_specialty := 'Striking';
        WHEN 'grappling' THEN
          v_attrs_for_session := ARRAY['takedowns','takedown_defense','ground_control','submission'];
          v_room_key := 'grappling';
          v_specialty := 'Grappling';
        WHEN 'cardio' THEN
          v_attrs_for_session := ARRAY['cardio','chin','durability','recovery','speed'];
          v_room_key := 'cardio';
          v_specialty := 'Cardio';
        WHEN 'analytics' THEN
          v_attrs_for_session := ARRAY['fight_iq'];
          v_room_key := 'analytics';
          v_specialty := 'Strategi & Mental';
        WHEN 'mental' THEN
          v_attrs_for_session := ARRAY['mental'];
          v_room_key := 'locker';
          v_specialty := 'Strategi & Mental';
        WHEN 'sparring' THEN
          -- Sparring meningkatkan fight_iq, mental, dan atribut teknikal secara acak
          v_attrs_for_session := ARRAY['fight_iq','mental','punch_power','kick_power','takedowns'];
          v_room_key := 'striking';
          v_specialty := 'Striking';
        ELSE
          CONTINUE;
      END CASE;

      -- Pilih satu atribut acak dari grup sesi
      v_target_attr := v_attrs_for_session[
        1 + FLOOR(RANDOM() * ARRAY_LENGTH(v_attrs_for_session, 1))::int
      ];

      -- Baca nilai saat ini langsung dari DB agar update berantai dalam minggu yang sama akurat
      SELECT (attrs->>v_target_attr)::int INTO v_current
      FROM fighters WHERE id = r.id;

      IF v_current < r.potential THEN
        v_room_level := COALESCE((v_rooms->v_room_key->>'level')::int, 0);
        v_chance := LEAST(0.95, 0.25 + v_room_level * 0.05);

        IF v_specialty = ANY(v_staff_specialties) THEN
          v_chance := LEAST(0.95, v_chance + 0.10);
        END IF;

        IF RANDOM() < v_chance THEN
          v_amount := 1 + (CASE WHEN RANDOM() < 0.15 THEN 1 ELSE 0 END);
          UPDATE fighters
            SET attrs = jsonb_set(
              attrs,
              ARRAY[v_target_attr],
              to_jsonb(LEAST(r.potential, v_current + v_amount))
            )
          WHERE id = r.id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Penurunan atribut alami untuk fighter veteran (umur >= 32)
  FOR r IN
    SELECT id, attrs, age
    FROM fighters
    WHERE gym_id = p_gym_id AND status IN ('training', 'active') AND age >= 32
  LOOP
    IF RANDOM() < 0.12 THEN
      DECLARE
        v_keys text[] := ARRAY[
          'punch_power','kick_power','accuracy','striking_defense',
          'takedowns','takedown_defense','ground_control','submission',
          'cardio','chin','durability','recovery',
          'speed','fight_iq','mental'
        ];
        v_key text := v_keys[1 + FLOOR(RANDOM() * ARRAY_LENGTH(v_keys,1))::int];
        v_val int := (r.attrs->>v_key)::int;
      BEGIN
        IF v_val > 30 THEN
          UPDATE fighters SET attrs = jsonb_set(attrs, ARRAY[v_key], to_jsonb(v_val - 1)) WHERE id = r.id;
        END IF;
      END;
    END IF;
  END LOOP;
END;
$$;
