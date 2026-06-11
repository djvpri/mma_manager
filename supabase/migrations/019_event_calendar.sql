-- Kalender event MMA bulanan: gym.events menyimpan daftar event yang
-- fighter bisa didaftarkan (atau tidak) untuk minggu tertentu.
alter table gyms add column if not exists events jsonb not null default '[]'::jsonb;
