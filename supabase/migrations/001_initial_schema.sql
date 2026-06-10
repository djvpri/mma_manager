-- Enable RLS
alter default privileges revoke execute on functions from public;

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

create type weight_class as enum (
  'Strawweight','Flyweight','Bantamweight','Featherweight',
  'Lightweight','Welterweight','Middleweight','Heavyweight'
);
create type fighter_status as enum ('active','training','injured','prospect','retired');
create type fighter_specialty as enum ('Striker','Grappler','All-rounder','Counter Fighter','Wrestler');
create type fighter_personality as enum ('Disciplined','Hardworker','Perfectionist','Veteran','Raw Talent','Calculated');
create type game_plan as enum ('pressure','counter','grapple','technical');
create type corner_advice as enum ('push','patient','takedown','striking');
create type finish_method as enum ('ko','tko','submission','decision');

-- ─── GYMS ────────────────────────────────────────────────────────────────────

create table gyms (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users not null unique,
  name           text not null default 'Garuda MMA',
  city           text not null default 'Jakarta',
  reputation     integer not null default 40 check (reputation between 0 and 100),
  balance        bigint not null default 50000000,
  monthly_income bigint not null default 20000000,
  monthly_expense bigint not null default 15000000,
  season_week    integer not null default 1,
  rooms          jsonb not null default '{
    "striking":  {"level":1,"max_level":4},
    "grappling": {"level":1,"max_level":4},
    "cardio":    {"level":1,"max_level":4},
    "recovery":  {"level":0,"max_level":3},
    "locker":    {"level":1,"max_level":3},
    "analytics": {"level":0,"max_level":3}
  }'::jsonb,
  created_at     timestamptz not null default now()
);

alter table gyms enable row level security;
create policy "Users manage own gym" on gyms
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── FIGHTERS ────────────────────────────────────────────────────────────────

create table fighters (
  id                   uuid primary key default gen_random_uuid(),
  gym_id               uuid references gyms not null,
  name                 text not null,
  nickname             text not null,
  age                  integer not null check (age between 18 and 45),
  hometown             text not null,
  weight_class         weight_class not null,
  status               fighter_status not null default 'training',
  specialty            fighter_specialty not null,
  personality          fighter_personality not null,
  attrs                jsonb not null default '{"striking":70,"grappling":70,"cardio":70,"fight_iq":70,"mental":70}'::jsonb,
  record               jsonb not null default '{"w":0,"l":0,"d":0}'::jsonb,
  potential            integer not null check (potential between 50 and 100),
  training_load        integer not null default 60 check (training_load between 0 and 100),
  injury               text,
  contract_fights_left integer not null default 3 check (contract_fights_left >= 0),
  salary_monthly       bigint not null default 3000000,
  avatar_seed          integer not null default floor(random()*99999),
  next_fight_date      date,
  created_at           timestamptz not null default now()
);

alter table fighters enable row level security;
create policy "Users manage own fighters" on fighters
  using (auth.uid() = (select user_id from gyms where id = fighters.gym_id))
  with check (auth.uid() = (select user_id from gyms where id = fighters.gym_id));

create index fighters_gym_id_idx on fighters(gym_id);

-- ─── STAFF ───────────────────────────────────────────────────────────────────

create table staff (
  id        uuid primary key default gen_random_uuid(),
  gym_id    uuid references gyms not null,
  name      text not null,
  role      text not null,
  specialty text not null,
  salary    bigint not null,
  rating    integer not null check (rating between 1 and 5),
  is_hired  boolean not null default false,
  created_at timestamptz not null default now()
);

alter table staff enable row level security;
create policy "Users manage own staff" on staff
  using (auth.uid() = (select user_id from gyms where id = staff.gym_id))
  with check (auth.uid() = (select user_id from gyms where id = staff.gym_id));

-- ─── FIGHT RESULTS ───────────────────────────────────────────────────────────

create table fight_results (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid references gyms not null,
  fighter_id       uuid references fighters not null,
  opponent_name    text not null,
  opponent_record  jsonb not null,
  round_results    jsonb not null default '[]'::jsonb,
  overall_winner   text not null check (overall_winner in ('my','opp','draw')),
  finish_method    finish_method not null,
  finish_round     integer,
  scorecard        text,
  game_plan_used   game_plan not null,
  fight_date       date not null default now(),
  created_at       timestamptz not null default now()
);

alter table fight_results enable row level security;
create policy "Users view own fight results" on fight_results
  using (auth.uid() = (select user_id from gyms where id = fight_results.gym_id));

create index fight_results_fighter_id_idx on fight_results(fighter_id);

-- ─── LEADERBOARD (public) ─────────────────────────────────────────────────────

create table leaderboard (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid references gyms not null unique,
  gym_name    text not null,
  player_name text not null,
  reputation  integer not null default 0,
  total_wins  integer not null default 0,
  season      integer not null default 1,
  updated_at  timestamptz not null default now()
);

alter table leaderboard enable row level security;
create policy "Leaderboard is public read" on leaderboard for select using (true);
create policy "Users update own leaderboard" on leaderboard
  using (auth.uid() = (select user_id from gyms where id = leaderboard.gym_id))
  with check (auth.uid() = (select user_id from gyms where id = leaderboard.gym_id));

-- ─── SEED: default staff pool ─────────────────────────────────────────────────

-- Staff will be seeded per-gym on gym creation via Edge Function
-- Schema only here

-- ─── FUNCTION: advance week ──────────────────────────────────────────────────

create or replace function advance_week(p_gym_id uuid)
returns void language plpgsql security definer as $$
begin
  -- Increment week
  update gyms set
    season_week = season_week + 1,
    balance = balance + monthly_income - monthly_expense
  where id = p_gym_id
    and auth.uid() = user_id;

  -- Reduce injury timers (stored in fighter injury text as weeks)
  -- Training load recovery
  update fighters set
    training_load = greatest(20, training_load - 5)
  where gym_id = p_gym_id
    and status = 'training';
end;
$$;
