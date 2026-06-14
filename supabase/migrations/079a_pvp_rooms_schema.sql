-- 079a: Room PvP publik (model "lobby") -- siapa saja bisa buat room dan
-- siapa saja bisa join, tidak harus teman. opponent_gym_id jadi nullable
-- selama status='waiting' (room dibuat, menunggu lawan).

ALTER TABLE pvp_matches ALTER COLUMN opponent_gym_id DROP NOT NULL;

ALTER TABLE pvp_matches DROP CONSTRAINT IF EXISTS pvp_matches_status_check;
ALTER TABLE pvp_matches ADD CONSTRAINT pvp_matches_status_check
  CHECK (status IN ('waiting','pending','gameplan','active','finished','declined','cancelled'));

-- Room 'waiting' bisa dilihat siapa saja yang login (untuk lobby publik),
-- selain itu hanya 2 gym yang terlibat.
DROP POLICY IF EXISTS pvp_matches_select ON pvp_matches;
CREATE POLICY pvp_matches_select ON pvp_matches FOR SELECT
  USING (
    status = 'waiting'
    OR challenger_gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid())
    OR opponent_gym_id IN (SELECT id FROM gyms WHERE user_id = auth.uid())
  );
