-- 051: Pengaturan tugas Asisten Manajer — toggle per tugas, bukan on/off global.
-- Default sponsor & event_registration = true (sama seperti perilaku sebelumnya).
-- scouting = false (opsional, baru tersedia setelah ada Talent Scout).

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS assistant_tasks jsonb NOT NULL DEFAULT '{
  "sponsor": true,
  "event_registration": true,
  "scouting": false
}'::jsonb;
