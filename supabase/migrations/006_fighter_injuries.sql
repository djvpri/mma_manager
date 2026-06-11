-- Sistem cedera: tambah kolom untuk melacak sisa minggu pemulihan,
-- dan update advance_week supaya cedera berkurang tiap minggu (dipercepat oleh recovery room)
-- lalu fighter kembali aktif ('training') saat sembuh.

alter table fighters add column if not exists injury_weeks_left integer;

create or replace function advance_week(p_gym_id uuid)
returns void language plpgsql security definer as $$
declare
  v_recovery_level integer;
begin
  select coalesce((rooms->'recovery'->>'level')::integer, 0) into v_recovery_level
  from gyms where id = p_gym_id;

  -- Increment week, apply income/expense
  update gyms set
    season_week = season_week + 1,
    balance = balance + monthly_income - monthly_expense
  where id = p_gym_id
    and auth.uid() = user_id;

  -- Training load recovery, boosted by recovery room level
  update fighters set
    training_load = greatest(10, training_load - 5 - (v_recovery_level * 2))
  where gym_id = p_gym_id
    and status = 'training';

  -- Kurangi sisa minggu cedera, dipercepat oleh recovery room
  update fighters set
    injury_weeks_left = greatest(0, injury_weeks_left - 1 - v_recovery_level)
  where gym_id = p_gym_id
    and status = 'injured'
    and injury_weeks_left is not null;

  -- Fighter yang sudah sembuh kembali ke status training
  update fighters set
    status = 'training',
    injury = null,
    injury_weeks_left = null
  where gym_id = p_gym_id
    and status = 'injured'
    and coalesce(injury_weeks_left, 0) <= 0;
end;
$$;
