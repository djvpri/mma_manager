-- Tambah total_losses ke leaderboard untuk hitung win rate
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS total_losses integer NOT NULL DEFAULT 0;

-- Update CPU gyms dengan estimasi losses dari top_fighters records
UPDATE leaderboard SET total_losses = (
  SELECT COALESCE(SUM(
    CASE
      WHEN split_part(f->>'record', '-', 2) ~ '^\d+$'
      THEN (split_part(f->>'record', '-', 2))::int
      ELSE 0
    END
  ), 0)
  FROM jsonb_array_elements(top_fighters) AS f
)
WHERE total_losses = 0 AND jsonb_array_length(top_fighters) > 0;
