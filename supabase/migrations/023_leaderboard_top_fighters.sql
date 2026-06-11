-- Tambah kolom top_fighters ke leaderboard untuk menampilkan petarung terbaik per gym
-- Format: [{ name, record, specialty, wins }] — top 3 fighter berdasarkan menang

ALTER TABLE leaderboard
  ADD COLUMN IF NOT EXISTS top_fighters JSONB NOT NULL DEFAULT '[]'::jsonb;
