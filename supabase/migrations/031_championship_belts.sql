-- Sistem gelar juara (championship belt) per weight class, bersifat global/shared antar gym

create table championships (
  weight_class        weight_class primary key,
  champion_fighter_id uuid references fighters(id) on delete set null,
  champion_gym_id     uuid references gyms(id) on delete set null,
  champion_gym_name   text,
  champion_name       text,
  title_defenses      integer not null default 0,
  won_at_week         integer,
  updated_at          timestamptz not null default now()
);

alter table championships enable row level security;

create policy "Championships public read" on championships for select using (true);

create policy "Users claim championship for own gym" on championships for update
  using (true)
  with check (
    champion_gym_id is null
    or auth.uid() = (select user_id from gyms where id = champion_gym_id)
  );

-- Seed: 8 weight class, semua vacant di awal
insert into championships (weight_class) values
  ('Strawweight'), ('Flyweight'), ('Bantamweight'), ('Featherweight'),
  ('Lightweight'), ('Welterweight'), ('Middleweight'), ('Heavyweight')
on conflict (weight_class) do nothing;
