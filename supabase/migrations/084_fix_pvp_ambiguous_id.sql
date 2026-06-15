-- 084: Fix "column reference id is ambiguous" pada pvp_my_matches(),
-- pvp_get_match(), dan pvp_list_open_rooms().
--
-- Root cause: ketiga fungsi ini punya RETURNS TABLE(id uuid, ...) -- kolom
-- pertama bernama `id`. Di dalam fungsi, `SELECT id INTO v_gym_id FROM gyms
-- WHERE user_id = auth.uid()` jadi ambigu: `id` bisa merujuk ke kolom tabel
-- `gyms.id` ATAU ke kolom return `id` (yang diperlakukan PL/pgSQL seperti
-- variabel OUT). Akibatnya fungsi SELALU error saat dipanggil dengan
-- auth.uid() valid (dari app), dan fetchMyPvpMatches/fetchOpenRooms di
-- frontend menangkap error lalu diam-diam return [] -- sehingga room
-- 'waiting' yang sudah ada tidak pernah muncul di UI, walau pvp_create_room
-- (RETURNS uuid, tidak ambigu) tetap mendeteksi room itu ada.
--
-- Fix: alias tabel gyms (`gyms g`, `g.id`) supaya tidak ambigu dengan kolom
-- return `id`.

CREATE OR REPLACE FUNCTION pvp_my_matches()
RETURNS TABLE (
  id uuid,
  challenger_gym_id uuid,
  opponent_gym_id uuid,
  challenger_gym_name text,
  opponent_gym_name text,
  challenger_fighter_id uuid,
  opponent_fighter_id uuid,
  challenger_fighter_name text,
  opponent_fighter_name text,
  status text,
  current_round integer,
  challenger_game_plan text,
  opponent_game_plan text,
  challenger_corner text,
  opponent_corner text,
  round_results jsonb,
  challenger_hp integer,
  opponent_hp integer,
  challenger_stamina integer,
  opponent_stamina integer,
  challenger_mental integer,
  opponent_mental integer,
  winner_gym_id uuid,
  finish_method text,
  created_at timestamptz,
  updated_at timestamptz,
  my_side text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_gym_id uuid;
BEGIN
  SELECT g.id INTO v_gym_id FROM gyms g WHERE g.user_id = auth.uid();

  RETURN QUERY
  SELECT
    m.id, m.challenger_gym_id, m.opponent_gym_id,
    cg.name, og.name,
    m.challenger_fighter_id, m.opponent_fighter_id,
    cf.name, opf.name,
    m.status, m.current_round,
    m.challenger_game_plan, m.opponent_game_plan,
    m.challenger_corner, m.opponent_corner,
    m.round_results,
    m.challenger_hp, m.opponent_hp,
    m.challenger_stamina, m.opponent_stamina,
    m.challenger_mental, m.opponent_mental,
    m.winner_gym_id, m.finish_method,
    m.created_at, m.updated_at,
    CASE WHEN m.challenger_gym_id = v_gym_id THEN 'challenger' ELSE 'opponent' END
  FROM pvp_matches m
  JOIN gyms cg ON cg.id = m.challenger_gym_id
  LEFT JOIN gyms og ON og.id = m.opponent_gym_id
  LEFT JOIN fighters cf ON cf.id = m.challenger_fighter_id
  LEFT JOIN fighters opf ON opf.id = m.opponent_fighter_id
  WHERE m.challenger_gym_id = v_gym_id OR m.opponent_gym_id = v_gym_id
  ORDER BY m.updated_at DESC;
END;
$$;


CREATE OR REPLACE FUNCTION pvp_get_match(p_match_id uuid)
RETURNS TABLE (
  id uuid,
  challenger_gym_id uuid,
  opponent_gym_id uuid,
  challenger_gym_name text,
  opponent_gym_name text,
  challenger_fighter_id uuid,
  opponent_fighter_id uuid,
  challenger_fighter_name text,
  opponent_fighter_name text,
  status text,
  current_round integer,
  challenger_game_plan text,
  opponent_game_plan text,
  challenger_corner text,
  opponent_corner text,
  round_results jsonb,
  challenger_hp integer,
  opponent_hp integer,
  challenger_stamina integer,
  opponent_stamina integer,
  challenger_mental integer,
  opponent_mental integer,
  winner_gym_id uuid,
  finish_method text,
  created_at timestamptz,
  updated_at timestamptz,
  my_side text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_gym_id uuid;
BEGIN
  SELECT g.id INTO v_gym_id FROM gyms g WHERE g.user_id = auth.uid();

  RETURN QUERY
  SELECT
    m.id, m.challenger_gym_id, m.opponent_gym_id,
    cg.name, og.name,
    m.challenger_fighter_id, m.opponent_fighter_id,
    cf.name, opf.name,
    m.status, m.current_round,
    m.challenger_game_plan, m.opponent_game_plan,
    m.challenger_corner, m.opponent_corner,
    m.round_results,
    m.challenger_hp, m.opponent_hp,
    m.challenger_stamina, m.opponent_stamina,
    m.challenger_mental, m.opponent_mental,
    m.winner_gym_id, m.finish_method,
    m.created_at, m.updated_at,
    CASE WHEN m.challenger_gym_id = v_gym_id THEN 'challenger' ELSE 'opponent' END
  FROM pvp_matches m
  JOIN gyms cg ON cg.id = m.challenger_gym_id
  LEFT JOIN gyms og ON og.id = m.opponent_gym_id
  LEFT JOIN fighters cf ON cf.id = m.challenger_fighter_id
  LEFT JOIN fighters opf ON opf.id = m.opponent_fighter_id
  WHERE m.id = p_match_id
    AND (m.challenger_gym_id = v_gym_id OR m.opponent_gym_id = v_gym_id);
END;
$$;


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
  SELECT gg.id INTO v_gym_id FROM gyms gg WHERE gg.user_id = auth.uid();

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
