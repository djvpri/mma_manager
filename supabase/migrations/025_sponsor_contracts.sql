-- Sistem kontrak sponsor realistis: kontrak berdurasi, passive income mingguan,
-- win bonus per kemenangan, satisfaction yang turun saat kalah.
-- Max 3 kontrak aktif (1 per kategori eksklusif: apparel/energy/supplement + local).

CREATE TABLE IF NOT EXISTS sponsor_contracts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id           uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  brand_name       text NOT NULL,
  category         text NOT NULL CHECK (category IN ('apparel','energy','supplement','local')),
  weekly_income    integer NOT NULL DEFAULT 0,
  win_bonus        integer NOT NULL DEFAULT 0,
  duration_weeks   integer NOT NULL,
  weeks_remaining  integer NOT NULL,
  satisfaction     integer NOT NULL DEFAULT 70 CHECK (satisfaction BETWEEN 0 AND 100),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE sponsor_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sponsor_contracts_owner" ON sponsor_contracts
  FOR ALL USING (
    gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid())
  );

-- Perbarui advance_week() untuk memproses kontrak sponsor
CREATE OR REPLACE FUNCTION advance_week(p_gym_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_recovery_level integer;
  v_rooms          jsonb;
  v_staff_specialties text[];
  v_season_week    integer;
  r                record;
  v_days           text[] := ARRAY['mon','tue','wed','thu','fri','sat'];
  v_day            text;
  v_session        text;
  v_attrs_for_session text[];
  v_target_attr    text;
  v_current        int;
  v_room_key       text;
  v_specialty      text;
  v_room_level     int;
  v_chance         numeric;
  v_amount         int;
  v_intensity_mult numeric;
  v_injury_roll    numeric;
  v_in_fight_camp  boolean;
  v_sponsor_income integer;
  v_injury_names   text[] := ARRAY[
    'Sprain ringan','Memar otot','Kelelahan','Strain ligamen','Cedera bahu ringan'
  ];
BEGIN
  SELECT rooms,
         COALESCE((rooms->'recovery'->>'level')::integer, 0),
         season_week
    INTO v_rooms, v_recovery_level, v_season_week
  FROM gyms WHERE id = p_gym_id;

  SELECT COALESCE(array_agg(specialty), '{}') INTO v_staff_specialties
  FROM staff WHERE gym_id = p_gym_id AND is_hired = true;

  -- Hitung total pemasukan sponsor aktif minggu ini
  SELECT COALESCE(SUM(weekly_income), 0) INTO v_sponsor_income
  FROM sponsor_contracts
  WHERE gym_id = p_gym_id AND status = 'active';

  -- Increment week, apply income/expense + sponsor income
  UPDATE gyms SET
    season_week = season_week + 1,
    balance     = balance + monthly_income - monthly_expense + v_sponsor_income
  WHERE id = p_gym_id
    AND auth.uid() = user_id;

  -- Kurangi sisa minggu kontrak sponsor
  UPDATE sponsor_contracts
  SET weeks_remaining = weeks_remaining - 1
  WHERE gym_id = p_gym_id AND status = 'active';

  -- Tandai kontrak yang habis masa berlakunya
  UPDATE sponsor_contracts
  SET status = 'expired'
  WHERE gym_id = p_gym_id AND status = 'active' AND weeks_remaining <= 0;

  -- Batalkan kontrak dengan satisfaction sangat rendah (30% chance jika < 20)
  UPDATE sponsor_contracts
  SET status = 'cancelled'
  WHERE gym_id = p_gym_id
    AND status = 'active'
    AND satisfaction < 20
    AND random() < 0.30;

  -- Training load base recovery, boosted by recovery room
  UPDATE fighters SET
    training_load = GREATEST(10, training_load - 5 - (v_recovery_level * 2))
  WHERE gym_id = p_gym_id AND status = 'training';

  -- Tambah fatigue berdasarkan intensitas
  UPDATE fighters SET
    training_load = LEAST(100,
      training_load + CASE training_intensity
        WHEN 'high'   THEN 15
        WHEN 'medium' THEN 5
        ELSE 0
      END
    )
  WHERE gym_id = p_gym_id AND status = 'training';

  -- Kurangi sisa minggu cedera
  UPDATE fighters SET
    injury_weeks_left = GREATEST(0, injury_weeks_left - 1 - v_recovery_level)
  WHERE gym_id = p_gym_id AND status = 'injured' AND injury_weeks_left IS NOT NULL;

  -- Fighter sembuh kembali ke training
  UPDATE fighters SET
    status = 'training', injury = null, injury_weeks_left = null
  WHERE gym_id = p_gym_id AND status = 'injured' AND COALESCE(injury_weeks_left, 0) <= 0;

  -- Perkembangan atribut berdasarkan weekly_schedule + intensitas + fight camp
  FOR r IN
    SELECT id, attrs, potential, weekly_schedule, training_intensity, next_fight_week
    FROM fighters
    WHERE gym_id = p_gym_id AND status = 'training' AND weekly_schedule IS NOT NULL
  LOOP
    v_in_fight_camp := (
      r.next_fight_week IS NOT NULL AND
      (r.next_fight_week - v_season_week) BETWEEN 1 AND 4
    );

    v_intensity_mult := CASE r.training_intensity
      WHEN 'high' THEN 1.20 WHEN 'low' THEN 0.70 ELSE 1.00
    END;

    v_injury_roll := CASE r.training_intensity
      WHEN 'high' THEN 0.15 WHEN 'medium' THEN 0.05 ELSE 0.0
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
        injury = v_injury_names[1 + FLOOR(RANDOM() * ARRAY_LENGTH(v_injury_names,1))::int],
        injury_weeks_left = 1 + FLOOR(RANDOM() * 3)::int
      WHERE id = r.id;
      CONTINUE;
    END IF;

    FOREACH v_day IN ARRAY v_days LOOP
      v_session := r.weekly_schedule->>v_day;
      IF v_session IS NULL OR v_session = 'rest' THEN CONTINUE; END IF;

      CASE v_session
        WHEN 'striking'  THEN v_attrs_for_session := ARRAY['punch_power','kick_power','accuracy','striking_defense']; v_room_key := 'striking';  v_specialty := 'Striking';
        WHEN 'grappling' THEN v_attrs_for_session := ARRAY['takedowns','takedown_defense','ground_control','submission'];  v_room_key := 'grappling'; v_specialty := 'Grappling';
        WHEN 'cardio'    THEN v_attrs_for_session := ARRAY['cardio','chin','durability','recovery','speed']; v_room_key := 'cardio';    v_specialty := 'Cardio';
        WHEN 'analytics' THEN v_attrs_for_session := ARRAY['fight_iq']; v_room_key := 'analytics'; v_specialty := 'Strategi & Mental';
        WHEN 'mental'    THEN v_attrs_for_session := ARRAY['mental'];    v_room_key := 'locker';    v_specialty := 'Strategi & Mental';
        WHEN 'sparring'  THEN v_attrs_for_session := ARRAY['fight_iq','mental','punch_power','kick_power','takedowns']; v_room_key := 'striking'; v_specialty := 'Striking';
        ELSE CONTINUE;
      END CASE;

      v_target_attr := v_attrs_for_session[1 + FLOOR(RANDOM() * ARRAY_LENGTH(v_attrs_for_session,1))::int];

      SELECT (attrs->>v_target_attr)::int INTO v_current FROM fighters WHERE id = r.id;

      IF v_current < r.potential THEN
        v_room_level := COALESCE((v_rooms->v_room_key->>'level')::int, 0);
        v_chance     := LEAST(0.95, (0.25 + v_room_level * 0.05) * v_intensity_mult);
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

  -- Penurunan atribut veteran (umur >= 32)
  FOR r IN
    SELECT id, attrs, age FROM fighters
    WHERE gym_id = p_gym_id AND status IN ('training','active') AND age >= 32
  LOOP
    IF RANDOM() < 0.12 THEN
      DECLARE
        v_keys text[] := ARRAY['punch_power','kick_power','accuracy','striking_defense','takedowns','takedown_defense','ground_control','submission','cardio','chin','durability','recovery','speed','fight_iq','mental'];
        v_key  text   := v_keys[1 + FLOOR(RANDOM() * ARRAY_LENGTH(v_keys,1))::int];
        v_val  int    := (r.attrs->>v_key)::int;
      BEGIN
        IF v_val > 30 THEN
          UPDATE fighters SET attrs = jsonb_set(attrs, ARRAY[v_key], to_jsonb(v_val-1)) WHERE id = r.id;
        END IF;
      END;
    END IF;
  END LOOP;
END;
$$;
