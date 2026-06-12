-- Hall of Fame: snapshot karier fighter saat pensiun (untuk halaman Legenda di Leaderboard).

CREATE TABLE hall_of_fame (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id             uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  fighter_id         uuid NOT NULL,
  name               text NOT NULL,
  nickname           text,
  avatar_url         text,
  weight_class       weight_class NOT NULL,
  specialty          text NOT NULL,
  personality        text NOT NULL,
  age_at_retirement  integer NOT NULL,
  record             jsonb NOT NULL,
  attrs              jsonb NOT NULL,
  was_champion       boolean NOT NULL DEFAULT false,
  retired_at_week    integer NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hall_of_fame ENABLE ROW LEVEL SECURITY;

CREATE POLICY hall_of_fame_select ON hall_of_fame FOR SELECT
  USING (gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid()));

CREATE POLICY hall_of_fame_insert ON hall_of_fame FOR INSERT
  WITH CHECK (gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid()));
