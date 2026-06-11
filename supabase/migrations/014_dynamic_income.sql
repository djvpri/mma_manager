-- Pemasukan bulanan gym (monthly_income) sebelumnya statis (default 20jt) terlepas
-- dari kondisi gym. Sekarang dihitung ulang tiap advance_week() berdasarkan
-- reputasi gym dan jumlah fighter aktif di roster:
--   monthly_income = 5.000.000 + (reputasi * 250.000) + (jumlah fighter non-pensiun * 2.000.000)
-- Pada kondisi awal (reputasi 40, roster kosong) hasilnya 15.000.000, sama dengan
-- monthly_expense default, sehingga net mingguan = 0 sebelum gym punya fighter.

alter table gyms alter column monthly_income set default 15000000;

create or replace function advance_week(p_gym_id uuid)
returns void language plpgsql security definer as $$
declare
  v_recovery_level integer;
  v_rooms jsonb;
  v_staff_specialties text[];
  v_nutrisi_bonus integer;
  v_fisio_bonus integer;
  v_season_week integer;
  v_new_week integer;
  v_age_tick boolean;
  v_reputation integer;
  v_active_fighters integer;
  v_new_income bigint;
  r record;
  v_focus text;
  v_current int;
  v_room_key text;
  v_specialty text;
  v_room_level int;
  v_chance numeric;
  v_amount int;
  v_retired_salaries bigint := 0;
  v_sum bigint;
begin
  select rooms, season_week, reputation, coalesce((rooms->'recovery'->>'level')::integer, 0)
    into v_rooms, v_season_week, v_reputation, v_recovery_level
  from gyms where id = p_gym_id;

  v_new_week := v_season_week + 1;
  v_age_tick := (v_new_week % 12 = 0);

  select coalesce(array_agg(specialty), '{}') into v_staff_specialties
  from staff where gym_id = p_gym_id and is_hired = true;

  select count(*) into v_active_fighters
  from fighters where gym_id = p_gym_id and status <> 'retired';

  v_new_income := 5000000 + v_reputation * 250000 + v_active_fighters * 2000000;

  v_nutrisi_bonus := case when 'Nutrisi' = any(v_staff_specialties) then 3 else 0 end;
  v_fisio_bonus := case when 'Pemulihan Cedera' = any(v_staff_specialties) then 1 else 0 end;

  -- Increment week, hitung ulang pemasukan, terapkan income/expense
  update gyms set
    season_week = v_new_week,
    monthly_income = v_new_income,
    balance = balance + v_new_income - monthly_expense
  where id = p_gym_id
    and auth.uid() = user_id;

  -- Training load recovery, boosted by recovery room level & Ahli Gizi
  update fighters set
    training_load = greatest(10, training_load - 5 - (v_recovery_level * 2) - v_nutrisi_bonus)
  where gym_id = p_gym_id
    and status = 'training';

  -- Kurangi sisa minggu cedera, dipercepat oleh recovery room & Fisioterapis
  update fighters set
    injury_weeks_left = greatest(0, injury_weeks_left - 1 - v_recovery_level - v_fisio_bonus)
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

  -- Perkembangan atribut sesuai fokus latihan (15 atribut granular)
  for r in
    select id, attrs, potential, training_focus
    from fighters
    where gym_id = p_gym_id and status = 'training' and training_focus is not null
  loop
    v_focus := r.training_focus;
    v_current := (r.attrs->>v_focus)::int;

    if v_current < r.potential then
      v_room_key := case v_focus
        when 'punch_power' then 'striking'
        when 'kick_power' then 'striking'
        when 'accuracy' then 'striking'
        when 'striking_defense' then 'striking'
        when 'takedowns' then 'grappling'
        when 'takedown_defense' then 'grappling'
        when 'ground_control' then 'grappling'
        when 'submission' then 'grappling'
        when 'cardio' then 'cardio'
        when 'chin' then 'cardio'
        when 'durability' then 'cardio'
        when 'recovery' then 'cardio'
        when 'speed' then 'cardio'
        when 'fight_iq' then 'analytics'
        when 'mental' then 'locker'
        else 'cardio'
      end;

      v_specialty := case v_room_key
        when 'striking' then 'Striking'
        when 'grappling' then 'Grappling'
        when 'cardio' then 'Cardio'
        else 'Strategi & Mental'
      end;

      v_room_level := coalesce((v_rooms->v_room_key->>'level')::int, 0);
      v_chance := least(0.95, 0.5 + v_room_level * 0.1);

      if v_specialty = any(v_staff_specialties) then
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
        v_keys text[] := array[
          'punch_power','kick_power','accuracy','striking_defense',
          'takedowns','takedown_defense','ground_control','submission',
          'cardio','chin','durability','recovery',
          'speed','fight_iq','mental'
        ];
        v_key text := v_keys[1 + floor(random() * array_length(v_keys,1))::int];
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
