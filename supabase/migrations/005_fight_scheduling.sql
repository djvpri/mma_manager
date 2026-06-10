-- Ganti next_fight_date (date, tidak pernah dipakai) dengan next_fight_week (integer)
-- supaya bisa dibandingkan langsung dengan gyms.season_week untuk masa pemulihan fighter.
alter table fighters drop column if exists next_fight_date;
alter table fighters add column if not exists next_fight_week integer;
