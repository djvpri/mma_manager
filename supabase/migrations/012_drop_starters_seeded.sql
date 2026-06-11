-- Roster awal sekarang sengaja kosong (pemain wajib merekrut sendiri),
-- jadi flag starters_seeded dari migration 011 tidak diperlukan lagi.
alter table gyms drop column if exists starters_seeded;
