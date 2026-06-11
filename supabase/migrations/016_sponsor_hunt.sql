-- Sponsor Hunt mini-game: lacak minggu terakhir pemain melakukan sponsor hunt
-- (gym.season_week saat hunt dilakukan) agar dibatasi sekali per minggu.

alter table gyms add column if not exists last_sponsor_week integer;
