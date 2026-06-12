-- Rivalry system: catat identitas lawan di fight_results agar rematch bisa terdeteksi.

ALTER TABLE fight_results ADD COLUMN opponent_id uuid;
