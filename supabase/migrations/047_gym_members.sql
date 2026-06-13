-- 047: Sistem member gym — pemasukan dinamis berbasis reputasi & prestasi

ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS member_fee   bigint  NOT NULL DEFAULT 350000;

CREATE OR REPLACE FUNCTION process_gym_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_room_levels  integer;
  v_recent_wins  integer;
  v_target       integer;
  v_fee_mult     numeric;
  v_drift        integer;
  v_income       bigint;
BEGIN
  IF NEW.season_week <= OLD.season_week THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM((value->>'level')::int), 0) INTO v_room_levels
  FROM jsonb_each(NEW.rooms);

  SELECT COUNT(*) INTO v_recent_wins
  FROM fight_results
  WHERE gym_id = NEW.id
    AND overall_winner = 'my'
    AND created_at > now() - interval '28 days';

  v_fee_mult := GREATEST(0.5, LEAST(1.5, 350000.0 / NULLIF(NEW.member_fee, 0)));

  v_target := GREATEST(20, ROUND(
    (40 + NEW.reputation * 3 + v_room_levels * 8 + v_recent_wins * 15)
    * v_fee_mult
  ));

  v_drift := ROUND((v_target - NEW.member_count) * 0.15)
             + (FLOOR(RANDOM() * 11) - 5)::int;
  NEW.member_count := GREATEST(10, NEW.member_count + v_drift);

  v_income := (NEW.member_count::bigint * NEW.member_fee) / 4;
  NEW.balance := NEW.balance + v_income;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gym_members ON gyms;
CREATE TRIGGER trg_gym_members
  BEFORE UPDATE OF season_week ON gyms
  FOR EACH ROW EXECUTE FUNCTION process_gym_members();
