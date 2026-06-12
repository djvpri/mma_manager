-- Asisten Manajer: salah satu staf bisa ditugaskan untuk otomatis mengelola sponsor tiap minggu.

ALTER TABLE gyms ADD COLUMN assistant_manager_id uuid REFERENCES staff(id) ON DELETE SET NULL;
