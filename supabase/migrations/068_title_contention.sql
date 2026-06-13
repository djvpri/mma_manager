-- 068: Title shot sekarang berbasis RANKING (top 5 weight class), bukan klausul
-- kontrak. title_shot_clause sudah tidak dipakai aplikasi (kolom dibiarkan,
-- tidak di-drop demi keamanan).
--
-- Setiap advance_week, untuk fighter milik pemain: hitung skor & rank dalam
-- weight class-nya (mencakup semua fighter aktif/training, termasuk roster
-- CPU). title_shot_pending = true jika rank <= 5 dan dia bukan champion saat
-- ini. Kalau tergeser dari top 5, title_shot_pending kembali false.

-- Skor sederhana: rata-rata semua atribut + bonus win streak + selisih W-L.
CREATE OR REPLACE FUNCTION fighter_rank_score(p_attrs jsonb, p_win_streak integer, p_record jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT
    (SELECT AVG((value)::numeric) FROM jsonb_each_text(p_attrs))
    + COALESCE(p_win_streak, 0) * 1.5
    + (COALESCE((p_record->>'w')::int, 0) - COALESCE((p_record->>'l')::int, 0));
$$;

CREATE OR REPLACE FUNCTION process_title_contention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r record;
  v_score numeric;
  v_rank integer;
  v_champion_id uuid;
BEGIN
  IF NEW.season_week <= OLD.season_week THEN RETURN NEW; END IF;

  FOR r IN
    SELECT id, name, weight_class, attrs, win_streak, record, title_shot_pending
    FROM fighters
    WHERE gym_id = NEW.id AND status IN ('training','active')
  LOOP
    v_score := fighter_rank_score(r.attrs, r.win_streak, r.record);

    SELECT COUNT(*) + 1 INTO v_rank
    FROM fighters f2
    WHERE f2.gym_id IS NOT NULL
      AND f2.weight_class = r.weight_class
      AND f2.status IN ('training','active')
      AND f2.id <> r.id
      AND fighter_rank_score(f2.attrs, f2.win_streak, f2.record) > v_score;

    SELECT champion_fighter_id INTO v_champion_id
    FROM championships WHERE weight_class = r.weight_class;

    IF v_rank <= 5 AND r.id IS DISTINCT FROM v_champion_id THEN
      IF NOT r.title_shot_pending THEN
        UPDATE fighters SET title_shot_pending = true WHERE id = r.id;
        INSERT INTO fighter_news (gym_id, season_week, message)
        VALUES (NEW.id, NEW.season_week, '🎯 ' || r.name || ' kini masuk top 5 kontender ' || r.weight_class || ' (rank #' || v_rank || ') dan berhak atas title shot!');
      END IF;
    ELSE
      IF r.title_shot_pending THEN
        UPDATE fighters SET title_shot_pending = false WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_title_contention ON gyms;
CREATE TRIGGER trg_title_contention
  BEFORE UPDATE OF season_week ON gyms
  FOR EACH ROW EXECUTE FUNCTION process_title_contention();
