-- Sistem usia: tiap 12 minggu (1 tahun in-game), umur semua fighter aktif bertambah 1.
-- Fighter yang sudah berumur >= 38 punya peluang pensiun alami tiap tahun,
-- terlepas dari sisa kontrak. Gaji fighter yang pensiun dikurangi dari monthly_expense.

create or replace function advance_week(p_gym_id uuid)
returns void language plpgsql security definer as $$
declare
  v_recovery_level integer;
  v_rooms jsonb;
  v_staff_specialties text[];
  v_season_week integer;
  v_new_week integer;
  v_age_tick boolean;
  r record;
  v_focus text;
  v_current int;
  v_room_level int;
  v_chance numeric;
  v_amount int;
  v_retired_salaries bigint := 0;
  v_sum bigint;
begin
  select rooms, season_week, coalesce((rooms->'recovery'->>'level')::integer, 0)
    into v_rooms, v_season_week, v_recovery_level
  from gyms where id = p_gym_id;

  v_new_week := v_season_week + 1;
  v_age_tick := (v_new_week % 12 = 0);

  select coalesce(array_agg(specialty), '{}') into v_staff_specialties
  from staff where gym_id = p_gym_id and is_hired = true;

  -- Increment week, apply income/expense
  update gyms set
    season_week = v_new_week,
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

  -- Tiap 12 minggu: umur fighter aktif bertambah 1
  if v_age_tick then
    update fighters set age = age + 1
    where gym_id = p_gym_id and status <> 'retired';
  end if;

  -- Kontrak habis & tidak diperpanjang: peluang fighter pensiun, gaji dikurangi dari pengeluaran
  with retired as (
    update fighters set status = 'retired'
    where gym_id = p_gym_id
      and status in ('training', 'active', 'prospect')
      and contract_fights_left <= 0
      and random() < 0.3
    returning salary_monthly
  )
  select coalesce(sum(salary_monthly), 0) into v_sum from retired;
  v_retired_salaries := v_retired_salaries + v_sum;

  -- Fighter veteran (umur >= 38): peluang pensiun alami tiap tahun in-game
  if v_age_tick then
    with retired_age as (
      update fighters set status = 'retired'
      where gym_id = p_gym_id
        and status in ('training', 'active', 'prospect')
        and age >= 38
        and random() < 0.25
      returning salary_monthly
    )
    select coalesce(sum(salary_monthly), 0) into v_sum from retired_age;
    v_retired_salaries := v_retired_salaries + v_sum;
  end if;

  if v_retired_salaries > 0 then
    update gyms set monthly_expense = greatest(0, monthly_expense - v_retired_salaries)
    where id = p_gym_id;
  end if;

  -- Perkembangan atribut sesuai fokus latihan
  for r in
    select id, attrs, potential, training_focus
    from fighters
    where gym_id = p_gym_id and status = 'training' and training_focus is not null
  loop
    v_focus := r.training_focus;
    v_current := (r.attrs->>v_focus)::int;

    if v_current < r.potential then
      v_room_level := case v_focus
        when 'striking' then coalesce((v_rooms->'striking'->>'level')::int, 0)
        when 'grappling' then coalesce((v_rooms->'grappling'->>'level')::int, 0)
        when 'cardio' then coalesce((v_rooms->'cardio'->>'level')::int, 0)
        when 'fight_iq' then coalesce((v_rooms->'analytics'->>'level')::int, 0)
        when 'mental' then coalesce((v_rooms->'locker'->>'level')::int, 0)
        else 0
      end;

      v_chance := least(0.95, 0.5 + v_room_level * 0.1);

      if (v_focus = 'striking' and 'Striking' = any(v_staff_specialties))
        or (v_focus = 'grappling' and 'Grappling' = any(v_staff_specialties))
        or (v_focus = 'cardio' and 'Cardio' = any(v_staff_specialties))
        or (v_focus in ('fight_iq', 'mental') and 'Strategi & Mental' = any(v_staff_specialties))
      then
        v_chance := least(0.95, v_chance + 0.15);
      end if;

      if random() < v_chance then
        v_amount := 1 + (case when random() < 0.2 then 1 else 0 end);
        update fighters
          set attrs = jsonb_set(attrs, array[v_focus], to_jsonb(least(r.potential, v_current + v_amount)))
          where id = r.id;
      end if;
    end if;
  end loop;

  -- Penurunan atribut alami untuk fighter veteran (umur >= 32)
  for r in
    select id, attrs, age
    from fighters
    where gym_id = p_gym_id and status in ('training', 'active') and age >= 32
  loop
    if random() < 0.12 then
      declare
        v_keys text[] := array['striking','grappling','cardio','fight_iq','mental'];
        v_key text := v_keys[1 + floor(random() * 5)::int];
        v_val int := (r.attrs->>v_key)::int;
      begin
        if v_val > 30 then
          update fighters set attrs = jsonb_set(attrs, array[v_key], to_jsonb(v_val - 1)) where id = r.id;
        end if;
      end;
    end if;
  end loop;
end;
$$;
