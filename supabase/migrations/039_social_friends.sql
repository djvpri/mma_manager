-- Tab Sosial: kode gym unik untuk terhubung dengan teman + lihat info gym mereka.

ALTER TABLE gyms ADD COLUMN friend_code text UNIQUE;

-- Generate kode unik 6 karakter (hex uppercase) untuk gym yang sudah ada.
DO $$
DECLARE
  r record;
  v_code text;
BEGIN
  FOR r IN SELECT id FROM gyms WHERE friend_code IS NULL LOOP
    LOOP
      v_code := upper(substr(md5(random()::text || r.id::text), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM gyms WHERE friend_code = v_code);
    END LOOP;
    UPDATE gyms SET friend_code = v_code WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE gyms ALTER COLUMN friend_code SET NOT NULL;

-- Generate kode otomatis untuk gym baru.
CREATE OR REPLACE FUNCTION set_gym_friend_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_code text;
BEGIN
  IF NEW.friend_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    v_code := upper(substr(md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM gyms WHERE friend_code = v_code);
  END LOOP;
  NEW.friend_code := v_code;
  RETURN NEW;
END;
$$;

CREATE TRIGGER gyms_set_friend_code
  BEFORE INSERT ON gyms
  FOR EACH ROW EXECUTE FUNCTION set_gym_friend_code();

-- ─── Koneksi teman ────────────────────────────────────────────────────────────

CREATE TABLE gym_friends (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  friend_gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, friend_gym_id),
  CHECK (gym_id != friend_gym_id)
);

ALTER TABLE gym_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_friends_select ON gym_friends FOR SELECT
  USING (gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid()));

-- Tambah teman lewat kode gym (saling terhubung dua arah).
CREATE OR REPLACE FUNCTION add_gym_friend(p_friend_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_gym_id        uuid;
  v_friend_gym_id uuid;
BEGIN
  SELECT id INTO v_gym_id FROM gyms WHERE user_id = auth.uid();
  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'Gym tidak ditemukan';
  END IF;

  SELECT id INTO v_friend_gym_id FROM gyms WHERE friend_code = upper(p_friend_code);
  IF v_friend_gym_id IS NULL THEN
    RAISE EXCEPTION 'Kode gym tidak ditemukan';
  END IF;

  IF v_friend_gym_id = v_gym_id THEN
    RAISE EXCEPTION 'Tidak bisa menambahkan gym sendiri';
  END IF;

  INSERT INTO gym_friends (gym_id, friend_gym_id) VALUES (v_gym_id, v_friend_gym_id)
  ON CONFLICT DO NOTHING;
  INSERT INTO gym_friends (gym_id, friend_gym_id) VALUES (v_friend_gym_id, v_gym_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Ambil daftar teman + info gym & rekor pertandingan mereka.
CREATE OR REPLACE FUNCTION get_friend_gyms()
RETURNS TABLE (
  gym_id      uuid,
  name        text,
  city        text,
  reputation  integer,
  season_week integer,
  friend_code text,
  wins        bigint,
  losses      bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_gym_id uuid;
BEGIN
  SELECT id INTO v_gym_id FROM gyms WHERE user_id = auth.uid();
  IF v_gym_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    g.id, g.name, g.city, g.reputation, g.season_week, g.friend_code,
    COALESCE((SELECT COUNT(*) FROM fight_results fr WHERE fr.gym_id = g.id AND fr.overall_winner = 'my'), 0),
    COALESCE((SELECT COUNT(*) FROM fight_results fr WHERE fr.gym_id = g.id AND fr.overall_winner = 'opp'), 0)
  FROM gyms g
  JOIN gym_friends gf ON gf.friend_gym_id = g.id
  WHERE gf.gym_id = v_gym_id
  ORDER BY g.reputation DESC;
END;
$$;
