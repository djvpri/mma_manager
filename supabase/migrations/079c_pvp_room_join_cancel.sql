-- 079c: RPC join room publik + perluas pvp_cancel_challenge untuk room
-- 'waiting' (batalkan room sendiri sebelum ada yang join).

CREATE OR REPLACE FUNCTION pvp_join_room(p_match_id uuid, p_fighter_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_gym_id uuid;
  v_match  pvp_matches;
BEGIN
  SELECT id INTO v_gym_id FROM gyms WHERE user_id = auth.uid();
  SELECT * INTO v_match FROM pvp_matches WHERE id = p_match_id;

  IF v_match.id IS NULL OR v_match.status != 'waiting' THEN
    RAISE EXCEPTION 'Room tidak tersedia (sudah diambil pemain lain atau dibatalkan)';
  END IF;

  IF v_match.challenger_gym_id = v_gym_id THEN
    RAISE EXCEPTION 'Tidak bisa join room sendiri';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM fighters WHERE id = p_fighter_id AND gym_id = v_gym_id AND status IN ('training','active')) THEN
    RAISE EXCEPTION 'Fighter tidak valid';
  END IF;

  -- Optimistic lock: hanya 1 yang berhasil kalau dua orang join bersamaan
  UPDATE pvp_matches
  SET opponent_gym_id = v_gym_id, opponent_fighter_id = p_fighter_id, status = 'gameplan', updated_at = now()
  WHERE id = p_match_id AND status = 'waiting';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room sudah diambil pemain lain';
  END IF;
END;
$$;

-- pvp_cancel_challenge: izinkan batalkan room 'waiting' juga (bukan cuma 'pending')
CREATE OR REPLACE FUNCTION pvp_cancel_challenge(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_gym_id uuid;
  v_match  pvp_matches;
BEGIN
  SELECT id INTO v_gym_id FROM gyms WHERE user_id = auth.uid();
  SELECT * INTO v_match FROM pvp_matches WHERE id = p_match_id;

  IF v_match.id IS NULL OR v_match.status NOT IN ('pending','waiting')
     OR (v_match.challenger_gym_id != v_gym_id AND (v_match.opponent_gym_id IS NULL OR v_match.opponent_gym_id != v_gym_id)) THEN
    RAISE EXCEPTION 'Match tidak valid';
  END IF;

  UPDATE pvp_matches SET status = 'cancelled', updated_at = now() WHERE id = p_match_id;
END;
$$;
