-- 079b: RPC buat room publik & lihat daftar room yang terbuka (lobby).

CREATE OR REPLACE FUNCTION pvp_create_room(p_fighter_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_gym_id   uuid;
  v_match_id uuid;
BEGIN
  SELECT id INTO v_gym_id FROM gyms WHERE user_id = auth.uid();
  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'Gym tidak ditemukan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM fighters WHERE id = p_fighter_id AND gym_id = v_gym_id AND status IN ('training','active')) THEN
    RAISE EXCEPTION 'Fighter tidak valid';
  END IF;

  -- Hanya boleh punya 1 room terbuka pada satu waktu
  IF EXISTS (SELECT 1 FROM pvp_matches WHERE challenger_gym_id = v_gym_id AND status = 'waiting') THEN
    RAISE EXCEPTION 'Kamu sudah punya room terbuka';
  END IF;

  INSERT INTO pvp_matches (challenger_gym_id, challenger_fighter_id, status)
  VALUES (v_gym_id, p_fighter_id, 'waiting')
  RETURNING id INTO v_match_id;

  RETURN v_match_id;
END;
$$;

-- Daftar room terbuka milik gym lain (lobby publik)
CREATE OR REPLACE FUNCTION pvp_list_open_rooms()
RETURNS TABLE (
  id uuid,
  challenger_gym_id uuid,
  challenger_gym_name text,
  challenger_fighter_id uuid,
  challenger_fighter_name text,
  challenger_weight_class text,
  created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_gym_id uuid;
BEGIN
  SELECT id INTO v_gym_id FROM gyms WHERE user_id = auth.uid();

  RETURN QUERY
  SELECT m.id, m.challenger_gym_id, g.name, m.challenger_fighter_id, f.name, f.weight_class::text, m.created_at
  FROM pvp_matches m
  JOIN gyms g ON g.id = m.challenger_gym_id
  JOIN fighters f ON f.id = m.challenger_fighter_id
  WHERE m.status = 'waiting' AND m.challenger_gym_id != v_gym_id
  ORDER BY m.created_at DESC
  LIMIT 50;
END;
$$;
