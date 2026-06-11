-- Tandai apakah gym sudah menerima 6 fighter starter. Mencegah roster kosong
-- permanen jika insert fighter starter saat onboarding sebelumnya gagal —
-- game layout akan mengisi ulang sekali untuk gym yang belum ditandai.
alter table gyms add column if not exists starters_seeded boolean not null default false;

update gyms set starters_seeded = true
where exists (select 1 from fighters where fighters.gym_id = gyms.id);
