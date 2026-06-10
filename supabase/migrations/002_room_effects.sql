-- Recovery room level speeds up weekly training_load recovery
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
end;
$$;
