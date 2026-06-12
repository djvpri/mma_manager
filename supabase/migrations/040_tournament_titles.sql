-- Trofi permanen untuk juara "Turnamen 8 Besar": menang 3 pertarungan beruntun
-- (Quarterfinal -> Semifinal -> Final) dalam satu fight night.

create table tournament_titles (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  fighter_id uuid references fighters not null,
  fighter_name text not null,
  weight_class text not null,
  season_week integer not null,
  created_at timestamptz not null default now()
);

alter table tournament_titles enable row level security;
create policy "Users manage own tournament titles" on tournament_titles
  using (auth.uid() = (select user_id from gyms where id = tournament_titles.gym_id));
