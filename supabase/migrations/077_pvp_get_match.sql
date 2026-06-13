-- 077: RPC ambil 1 pvp_match (dengan nama gym/fighter via JOIN) untuk initial
-- load halaman laga PvP. Update live selanjutnya via Supabase Realtime pada
-- tabel pvp_matches (kolom mentah tanpa JOIN, di-merge di client).

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
  SELECT id INTO v_gym_id FROM gyms WHERE user_id = auth.uid();

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
  JOIN gyms og ON og.id = m.opponent_gym_id
  LEFT JOIN fighters cf ON cf.id = m.challenger_fighter_id
  LEFT JOIN fighters opf ON opf.id = m.opponent_fighter_id
  WHERE m.id = p_match_id
    AND (m.challenger_gym_id = v_gym_id OR m.opponent_gym_id = v_gym_id);
END;
$$;
