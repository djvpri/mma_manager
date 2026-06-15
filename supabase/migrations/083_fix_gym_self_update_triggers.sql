-- 083: Fix "tuple to be updated was already modified by an operation
-- triggered by the current command" saat advance_week() menaikkan
-- season_week.
--
-- Root cause: trg_influencer_heat & trg_staff_leveling (trigger BEFORE
-- UPDATE ON gyms, dibuat manual via SQL editor -- tidak ada di migration
-- manapun sebelum ini) melakukan nested `UPDATE gyms SET ... WHERE id =
-- NEW.id` di dalam fungsinya sendiri -- yaitu meng-UPDATE ulang baris gyms
-- yang SAMA yang sedang diproses oleh command UPDATE gyms dari
-- advance_week() (yang menaikkan season_week). Postgres melarang trigger
-- BEFORE ROW meng-update baris yang sedang dikunci oleh command pemicunya
-- sendiri -> persis error di atas, terjadi di SETIAP advance_week() karena
-- process_influencer_heat() melakukan decay media_heat tanpa kondisi.
--
-- (080/081 sebelumnya menangani kasus berbeda: trigger AFTER yang
-- nested-update tabel `fighters`, bukan `gyms`.)
--
-- Fix: ganti nested UPDATE gyms -> assignment NEW.<kolom>, cara yang benar
-- untuk trigger BEFORE ROW memodifikasi baris yang sedang diupdate (nilainya
-- otomatis ikut ditulis oleh command UPDATE pemicu, tanpa command baru).
--
-- Sekaligus fix bug laten process_staff_leveling(): variabel record `s`
-- tidak memuat kolom `salary` (dipakai di blok resign burnout) -- ditambah
-- ke SELECT supaya tidak error "record has no field salary" saat kondisi
-- resign tercapai.

CREATE OR REPLACE FUNCTION public.process_influencer_heat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_heat    integer;
  v_rep     integer;
  v_inj_cnt integer;
  f         record;
  v_inf     text;
  v_msg     text;
BEGIN
  IF NEW.season_week <= OLD.season_week THEN RETURN NEW; END IF;

  v_heat := OLD.media_heat;
  v_rep  := OLD.reputation;

  -- Media heat decay: turun 5/minggu (hype sementara)
  NEW.media_heat := GREATEST(0, OLD.media_heat - 5);

  IF random() >= 0.35 THEN RETURN NEW; END IF; -- 35% chance influencer aktif

  SELECT COUNT(*) INTO v_inj_cnt FROM fighters
  WHERE gym_id = NEW.id AND status = 'injured';

  -- Pilih influencer fiktif
  v_inf := (ARRAY[
    '@MMAKing_ID','@SportsNerd99','@TarungUpdates','@FightLifeIndo',
    '@GarudaFitness','@RingCorner_ID','@KickAndPunch','@MMAAnalyst'
  ])[1 + floor(random()*8)::int];

  -- Positif: fighter on-fire atau heat tinggi
  SELECT name, win_streak INTO f FROM fighters
  WHERE gym_id = NEW.id AND status IN ('training','active') AND win_streak >= 2
  ORDER BY win_streak DESC LIMIT 1;

  IF f.name IS NOT NULL AND (v_heat >= 30 OR f.win_streak >= 3) AND random() < 0.60 THEN
    NEW.reputation := LEAST(99, NEW.reputation + 1);
    NEW.media_heat := LEAST(100, NEW.media_heat + 5);
    v_msg := '📱 ' || v_inf || ': "Gak bisa bohong, ' || f.name ||
      ' lagi HOT banget sekarang 🔥 Siap jadi bintang berikutnya? ' ||
      NEW.name || ' makin solid!" [2.4K likes]';

  -- Negatif: banyak cedera atau reputasi rendah
  ELSIF v_inj_cnt >= 2 AND random() < 0.50 THEN
    NEW.reputation := GREATEST(0, NEW.reputation - 1);
    v_msg := '📱 ' || v_inf || ': "Kenapa fighter ' || NEW.name ||
      ' sering banget cedera? Ada yang salah sama program latihan mereka? 🤔 #MMAIndonesia"' ||
      ' [891 likes, 234 komentar]';

  ELSIF v_rep < 30 AND random() < 0.40 THEN
    v_msg := '📱 ' || v_inf || ': "Jujur aja, ' || NEW.name ||
      ' lagi butuh pembuktian besar. Semua orang nunggu mereka comeback 👀 #GiveMeSomething"' ||
      ' [445 likes]';

  ELSE
    RETURN NEW; -- Tidak ada postingan minggu ini
  END IF;

  INSERT INTO fighter_news (gym_id, season_week, message)
  VALUES (NEW.id, NEW.season_week, v_msg);

  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.process_staff_leveling()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  s            record;
  v_xp_gain    integer;
  v_task_count integer;
  v_roster_size integer;
  v_overloaded boolean;
  v_old_level  integer;
  v_new_level  integer;
BEGIN
  IF NEW.season_week <= OLD.season_week THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_task_count
  FROM jsonb_each_text(COALESCE(NEW.assistant_tasks, '{}'::jsonb))
  WHERE value = 'true';

  SELECT COUNT(*) INTO v_roster_size
  FROM fighters WHERE gym_id = NEW.id AND status IN ('training','active');

  v_overloaded := (v_roster_size >= 6 AND v_task_count >= 6);

  FOR s IN
    SELECT id, name, role, specialty, rating, experience_points, weeks_hired,
           burnout_warning, weeks_overloaded, salary
    FROM staff
    WHERE gym_id = NEW.id AND is_hired = true
  LOOP
    v_old_level := staff_level(s.experience_points);

    v_xp_gain := s.rating * 2 + (CASE WHEN v_overloaded THEN -2 ELSE 0 END);
    v_xp_gain := GREATEST(0, v_xp_gain);

    v_new_level := staff_level(s.experience_points + v_xp_gain);

    UPDATE staff SET
      experience_points = experience_points + v_xp_gain,
      weeks_hired = weeks_hired + 1,
      weeks_overloaded = CASE WHEN v_overloaded THEN weeks_overloaded + 1 ELSE 0 END
    WHERE id = s.id;

    IF v_new_level > v_old_level THEN
      INSERT INTO fighter_news (gym_id, season_week, message)
      VALUES (NEW.id, NEW.season_week,
        '⬆️ ' || s.name || ' (' || s.role || ') naik ke Level ' || v_new_level || '! Efektivitasnya meningkat signifikan.');
    END IF;

    IF v_overloaded AND s.weeks_overloaded >= 4 AND NOT s.burnout_warning THEN
      UPDATE staff SET burnout_warning = true WHERE id = s.id;
      INSERT INTO fighter_news (gym_id, season_week, message)
      VALUES (NEW.id, NEW.season_week,
        '⚠️ ' || s.name || ' menunjukkan tanda kelelahan berat — beban kerja terlalu tinggi terlalu lama. Kurangi tugas sebelum dia resign!');
    END IF;

    IF s.burnout_warning AND v_overloaded AND s.weeks_overloaded >= 6 AND random() < 0.40 THEN
      UPDATE staff SET is_hired = false, burnout_warning = false, weeks_overloaded = 0
      WHERE id = s.id;
      NEW.monthly_expense := GREATEST(0, NEW.monthly_expense - s.salary * 4);
      INSERT INTO fighter_news (gym_id, season_week, message)
      VALUES (NEW.id, NEW.season_week,
        '😤 ' || s.name || ' (' || s.role || ') mengundurkan diri karena kelelahan!');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
