-- 058: Bikin fighter CPU lebih "hidup".
--
-- (1) RPC record_cpu_fight_result: saat pemain mengalahkan/dikalahkan/seri
--     dengan fighter dari pool (CPU atau prospek), record & win_streak fighter
--     itu di tabel `fighters` ikut diperbarui. Pakai SECURITY DEFINER karena
--     fighter lawan biasanya milik gym lain (RLS "Users manage own fighters"
--     akan blok update langsung dari klien pemain).
--
-- (2) World news: trigger tambahan (additive, BEFORE UPDATE OF season_week
--     ON gyms, sama pola dengan trigger member/operational income/scouting)
--     yang mengirim berita ke fighter_news untuk:
--       - perebutan sabuk juara oleh fighter CPU
--       - win streak CPU mencapai kelipatan 5
--       - fighter CPU resmi pensiun
--     Kolom penanda ditambahkan supaya tiap kejadian hanya diberitakan sekali.

-- ── (1) RPC hasil fight vs fighter pool/CPU ────────────────────────────────
CREATE OR REPLACE FUNCTION record_cpu_fight_result(
  p_opponent_id uuid,
  p_player_won  boolean,
  p_draw        boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_opponent_id IS NULL THEN RETURN; END IF;

  IF p_draw THEN
    UPDATE fighters SET
      record = jsonb_set(record, '{d}', to_jsonb(COALESCE((record->>'d')::int, 0) + 1))
    WHERE id = p_opponent_id;
  ELSIF p_player_won THEN
    -- Pemain menang -> lawan kalah, win streak lawan putus
    UPDATE fighters SET
      record = jsonb_set(record, '{l}', to_jsonb(COALESCE((record->>'l')::int, 0) + 1)),
      win_streak = 0
    WHERE id = p_opponent_id;
  ELSE
    -- Pemain kalah -> lawan menang, win streak lawan bertambah
    UPDATE fighters SET
      record = jsonb_set(record, '{w}', to_jsonb(COALESCE((record->>'w')::int, 0) + 1)),
      win_streak = win_streak + 1
    WHERE id = p_opponent_id;
  END IF;
END;
$$;

-- ── (2) World news: penanda agar tiap kejadian hanya diberitakan sekali ───
ALTER TABLE championships ADD COLUMN IF NOT EXISTS news_announced_week integer;
ALTER TABLE fighters       ADD COLUMN IF NOT EXISTS last_streak_news integer NOT NULL DEFAULT 0;
ALTER TABLE fighters       ADD COLUMN IF NOT EXISTS retirement_announced boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION process_cpu_world_news()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r record;
BEGIN
  IF NEW.season_week <= OLD.season_week THEN RETURN NEW; END IF;

  -- Perebutan sabuk juara oleh fighter CPU
  FOR r IN
    SELECT c.weight_class, c.champion_name, c.won_at_week
    FROM championships c
    JOIN fighters f ON f.id = c.champion_fighter_id
    WHERE f.is_cpu = true
      AND c.won_at_week IS NOT NULL
      AND (c.news_announced_week IS NULL OR c.news_announced_week < c.won_at_week)
    LIMIT 2
  LOOP
    INSERT INTO fighter_news (gym_id, season_week, message)
    VALUES (NEW.id, NEW.season_week, '🏆 ' || r.champion_name || ' merebut sabuk juara ' || r.weight_class || '! Persaingan kelas ini kini makin sengit.');

    UPDATE championships SET news_announced_week = r.won_at_week WHERE weight_class = r.weight_class;
  END LOOP;

  -- Win streak CPU mencapai kelipatan 5
  FOR r IN
    SELECT id, name, weight_class, win_streak,
           (win_streak / 5) * 5 AS milestone
    FROM fighters
    WHERE is_cpu = true AND status = 'active'
      AND win_streak >= 5
      AND win_streak >= last_streak_news + 5
    LIMIT 2
  LOOP
    INSERT INTO fighter_news (gym_id, season_week, message)
    VALUES (NEW.id, NEW.season_week, '🔥 ' || r.name || ' (' || r.weight_class || ') mencatat win streak ke-' || r.milestone || ', salah satu fighter CPU paling panas saat ini!');

    UPDATE fighters SET last_streak_news = r.milestone WHERE id = r.id;
  END LOOP;

  -- Fighter CPU resmi pensiun
  FOR r IN
    SELECT id, name, weight_class, record
    FROM fighters
    WHERE is_cpu = true AND status = 'retired' AND retirement_announced = false
    LIMIT 2
  LOOP
    INSERT INTO fighter_news (gym_id, season_week, message)
    VALUES (NEW.id, NEW.season_week, '👋 ' || r.name || ' (' || r.weight_class || ') resmi pensiun dengan rekor ' || (r.record->>'w') || '-' || (r.record->>'l') || '-' || (r.record->>'d') || '.');

    UPDATE fighters SET retirement_announced = true WHERE id = r.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cpu_world_news ON gyms;
CREATE TRIGGER trg_cpu_world_news
  BEFORE UPDATE OF season_week ON gyms
  FOR EACH ROW EXECUTE FUNCTION process_cpu_world_news();
