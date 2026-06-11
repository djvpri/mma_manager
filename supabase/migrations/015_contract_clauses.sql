-- Sistem negosiasi kontrak lanjutan: pisahkan gaji jadi Base Purse (salary_monthly)
-- vs Win Bonus (dibayar tiap kemenangan), plus klausul opsional:
--   - title_shot_clause: jika true dan fighter menang 3x beruntun (win_streak >= 3),
--     fighter berhak menuntut laga title shot (title_shot_pending = true).
--   - buyout_clause: biaya yang harus dibayar gym jika memutus kontrak fighter
--     ini sebelum kontrak berakhir (contract_fights_left > 0).

alter table fighters add column if not exists win_bonus bigint not null default 0;
alter table fighters add column if not exists title_shot_clause boolean not null default false;
alter table fighters add column if not exists buyout_clause bigint not null default 0;
alter table fighters add column if not exists win_streak integer not null default 0;
alter table fighters add column if not exists title_shot_pending boolean not null default false;
