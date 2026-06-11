-- Ekspansi sistem atribut dari 5 (striking/grappling/cardio/fight_iq/mental) menjadi 15
-- atribut granular dalam 5 kategori: Striking (punch_power, kick_power, accuracy,
-- striking_defense), Grappling (takedowns, takedown_defense, ground_control, submission),
-- Fisik (cardio, chin, durability, recovery), Pergerakan (speed), Mental (fight_iq, mental).

-- Backfill attrs lama -> attrs baru untuk fighter yang sudah ada
update fighters set attrs = attrs || jsonb_build_object(
  'punch_power', coalesce((attrs->>'striking')::int, 70),
  'kick_power', coalesce((attrs->>'striking')::int, 70),
  'accuracy', coalesce((attrs->>'striking')::int, 70),
  'striking_defense', coalesce((attrs->>'striking')::int, 70),
  'takedowns', coalesce((attrs->>'grappling')::int, 70),
  'takedown_defense', coalesce((attrs->>'grappling')::int, 70),
  'ground_control', coalesce((attrs->>'grappling')::int, 70),
  'submission', coalesce((attrs->>'grappling')::int, 70),
  'chin', coalesce((attrs->>'mental')::int, 70),
  'durability', coalesce((attrs->>'cardio')::int, 70),
  'recovery', coalesce((attrs->>'cardio')::int, 70),
  'speed', 70
)
where not (attrs ? 'punch_power');

-- Default kolom attrs untuk fighter baru
alter table fighters alter column attrs set default '{
  "punch_power":70,"kick_power":70,"accuracy":70,"striking_defense":70,
  "takedowns":70,"takedown_defense":70,"ground_control":70,"submission":70,
  "cardio":70,"chin":70,"durability":70,"recovery":70,
  "speed":70,"fight_iq":70,"mental":70
}'::jsonb;

-- Remap training_focus lama yang sudah tidak valid ke atribut granular terdekat
update fighters set training_focus = 'accuracy' where training_focus = 'striking';
update fighters set training_focus = 'ground_control' where training_focus = 'grappling';

-- Perbarui constraint training_focus untuk 15 atribut baru
alter table fighters drop constraint if exists fighters_training_focus_check;
alter table fighters add constraint fighters_training_focus_check
  check (training_focus in (
    'punch_power','kick_power','accuracy','striking_defense',
    'takedowns','takedown_defense','ground_control','submission',
    'cardio','chin','durability','recovery',
    'speed','fight_iq','mental'
  ));

-- Perbarui advance_week(): mapping room & spesialisasi staf untuk atribut granular baru
create or replace function advance_week(p_gym_id uuid)
returns void language plpgsql security definer as $$
declare
  v_recovery_level integer;
  v_rooms jsonb;
  v_staff_specialties text[];
  r record;
  v_focus text;
  v_current int;
  v_room_key text;
  v_specialty text;
  v_room_level int;
  v_chance numeric;
  v_amount int;
begin
  select rooms, coalesce((rooms->'recovery'->>'level')::integer, 0)
    into v_rooms, v_recovery_level
  from gyms where id = p_gym_id;

  select coalesce(array_agg(specialty), '{}') into v_staff_specialties
  from staff where gym_id = p_gym_id and is_hired = true;

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
