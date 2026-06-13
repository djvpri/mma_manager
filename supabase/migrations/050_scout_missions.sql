-- 050: Sistem Scouting — fog of war untuk pool rekrutmen.
-- Fighter di pool yang belum di-scout hanya menampilkan rating bintang kasar
-- (kemampuan & potensi), bukan atribut/persona detail. Misi scouting butuh
-- staf "Talent Scout" (specialty 'Scouting') dan berjalan tiap advance_week.

CREATE TABLE IF NOT EXISTS scout_missions (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid references gyms not null,
  fighter_id      uuid references fighters not null,
  weeks_total     integer not null,
  weeks_remaining integer not null,
  status          text not null default 'in_progress' check (status in ('in_progress','completed')),
  created_at      timestamptz not null default now(),
  unique(gym_id, fighter_id)
);

ALTER TABLE scout_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scout missions" ON scout_missions
  USING (auth.uid() = (SELECT user_id FROM gyms WHERE id = scout_missions.gym_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM gyms WHERE id = scout_missions.gym_id));

CREATE INDEX IF NOT EXISTS scout_missions_gym_id_idx ON scout_missions(gym_id);

-- Setiap advance_week: kurangi weeks_remaining, selesaikan misi yang habis waktunya
CREATE OR REPLACE FUNCTION process_scout_missions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.season_week <= OLD.season_week THEN RETURN NEW; END IF;

  UPDATE scout_missions
    SET weeks_remaining = weeks_remaining - 1
    WHERE gym_id = NEW.id AND status = 'in_progress' AND weeks_remaining > 0;

  UPDATE scout_missions
    SET status = 'completed', weeks_remaining = 0
    WHERE gym_id = NEW.id AND status = 'in_progress' AND weeks_remaining <= 0;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scout_missions ON gyms;
CREATE TRIGGER trg_scout_missions
  BEFORE UPDATE OF season_week ON gyms
  FOR EACH ROW EXECUTE FUNCTION process_scout_missions();
