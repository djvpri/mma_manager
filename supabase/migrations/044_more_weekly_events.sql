-- Tambah 10 variasi kejadian acak mingguan baru (31-40) ke
-- generate_random_fighter_events(): sponsor/brand, fan, cuaca, cedera lama,
-- live streaming, dan kontroversi media sosial negatif untuk gym.

CREATE OR REPLACE FUNCTION generate_random_fighter_events(p_gym_id uuid, p_season_week integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r              record;
  v_idx          integer;
  v_msg          text;
  v_amt          integer;
  v_key          text;
  v_cur          integer;
  v_num_events   integer;
  v_gym_name     text;
  v_phys_attrs   text[] := ARRAY['punch_power','kick_power','takedowns','cardio','speed','durability'];
  v_gymwide_idx  integer[] := ARRAY[19,20,21,22,29,38];
BEGIN
  SELECT name INTO v_gym_name FROM gyms WHERE id = p_gym_id;

  -- Bersihkan berita lama (lebih dari 8 minggu)
  DELETE FROM fighter_news WHERE gym_id = p_gym_id AND season_week < p_season_week - 8;

  v_num_events := CASE
    WHEN random() < 0.45 THEN 0
    WHEN random() < 0.90 THEN 1
    ELSE 2
  END;

  FOR i IN 1..v_num_events LOOP
    SELECT id, name, attrs, potential, status, injury_weeks_left
    INTO r
    FROM fighters
    WHERE gym_id = p_gym_id AND status IN ('training','active')
    ORDER BY random() LIMIT 1;

    v_idx := 1 + floor(random() * 40)::int;
    IF r.id IS NULL AND NOT (v_idx = ANY (v_gymwide_idx)) THEN
      v_idx := v_gymwide_idx[1 + floor(random() * array_length(v_gymwide_idx, 1))::int];
    END IF;

    CASE v_idx
      WHEN 1 THEN -- Motivasi tinggi
        UPDATE fighters SET morale = LEAST(100, morale + 8) WHERE id = r.id;
        v_msg := '💪 ' || r.name || ' terlihat sangat termotivasi minggu ini, moral meningkat.';

      WHEN 2 THEN -- Wawancara media
        UPDATE fighters SET morale = LEAST(100, morale + 3) WHERE id = r.id;
        UPDATE gyms SET reputation = LEAST(99, reputation + 1) WHERE id = p_gym_id;
        v_msg := '📰 ' || r.name || ' diwawancarai media lokal. Reputasi gym sedikit naik.';

      WHEN 3 THEN -- Rayakan momen kecil
        UPDATE fighters SET morale = LEAST(100, morale + 5) WHERE id = r.id;
        v_msg := '🎉 ' || r.name || ' merayakan momen kecil bersama tim, moral naik.';

      WHEN 4 THEN -- Kurang motivasi
        UPDATE fighters SET morale = GREATEST(0, morale - 8) WHERE id = r.id;
        v_msg := '😞 ' || r.name || ' terlihat kurang bersemangat minggu ini.';

      WHEN 5 THEN -- Terkilir jogging
        IF r.status != 'injured' THEN
          UPDATE fighters SET status = 'injured', injury = 'Terkilir ringan',
            injury_weeks_left = 1 + floor(random() * 2)::int
          WHERE id = r.id;
          v_msg := '🤕 ' || r.name || ' terkilir saat jogging pagi dan butuh istirahat singkat.';
        ELSE
          UPDATE fighters SET morale = LEAST(100, morale + 3) WHERE id = r.id;
          v_msg := '🙂 ' || r.name || ' tetap semangat memantau latihan tim meski masih pemulihan.';
        END IF;

      WHEN 6 THEN -- Belajar strategi baru
        v_cur := (r.attrs->>'fight_iq')::int;
        IF v_cur < r.potential THEN
          UPDATE fighters SET attrs = jsonb_set(attrs, '{fight_iq}', to_jsonb(v_cur + 1)) WHERE id = r.id;
        END IF;
        v_msg := '📚 ' || r.name || ' belajar trik baru dari rekan setim, fight IQ meningkat.';

      WHEN 7 THEN -- Pola makan baru
        v_cur := (r.attrs->>'cardio')::int;
        IF v_cur < r.potential THEN
          UPDATE fighters SET attrs = jsonb_set(attrs, '{cardio}', to_jsonb(v_cur + 1)) WHERE id = r.id;
        END IF;
        v_msg := '🥗 ' || r.name || ' mencoba pola makan baru, staminanya membaik.';

      WHEN 8 THEN -- Kurang istirahat
        UPDATE fighters SET training_load = LEAST(100, training_load + 10) WHERE id = r.id;
        v_msg := '😴 ' || r.name || ' kurang istirahat minggu ini, beban latihannya bertambah.';

      WHEN 9 THEN -- Latihan ekstra
        v_key := v_phys_attrs[1 + floor(random() * array_length(v_phys_attrs, 1))::int];
        v_cur := (r.attrs->>v_key)::int;
        IF v_cur < r.potential THEN
          UPDATE fighters SET attrs = jsonb_set(attrs, ARRAY[v_key], to_jsonb(v_cur + 1)) WHERE id = r.id;
        END IF;
        UPDATE fighters SET training_load = LEAST(100, training_load + 5) WHERE id = r.id;
        v_msg := '🏋️ ' || r.name || ' menambah sesi latihan ekstra di luar jadwal.';

      WHEN 10 THEN -- Bertemu fan
        UPDATE fighters SET morale = LEAST(100, morale + 5) WHERE id = r.id;
        v_msg := '🤝 ' || r.name || ' bertemu fan setia di gym, semangatnya bertambah.';

      WHEN 11 THEN -- Bonus sponsor kecil
        v_amt := 200000 + floor(random() * 300000)::int;
        UPDATE gyms SET balance = balance + v_amt WHERE id = p_gym_id;
        v_msg := '💰 Sponsor lokal memberi bonus kecil untuk ' || r.name || '.';

      WHEN 12 THEN -- Video viral
        UPDATE fighters SET morale = LEAST(100, morale + 5) WHERE id = r.id;
        UPDATE gyms SET reputation = LEAST(99, reputation + 2) WHERE id = p_gym_id;
        v_msg := '🎥 Video latihan ' || r.name || ' viral di media sosial!';

      WHEN 13 THEN -- Perdebatan kecil
        UPDATE fighters SET morale = GREATEST(0, morale - 5) WHERE id = r.id;
        v_msg := '⚠️ ' || r.name || ' terlibat perdebatan kecil dengan rekan setim.';

      WHEN 14 THEN -- Sesi meditasi
        v_cur := (r.attrs->>'mental')::int;
        IF v_cur < r.potential THEN
          UPDATE fighters SET attrs = jsonb_set(attrs, '{mental}', to_jsonb(v_cur + 1)) WHERE id = r.id;
        END IF;
        v_msg := '🧘 ' || r.name || ' mengikuti sesi meditasi, mentalnya makin tenang.';

      WHEN 15 THEN -- Cedera ringan sparring
        IF r.status != 'injured' THEN
          UPDATE fighters SET status = 'injured', injury = 'Memar ringan',
            injury_weeks_left = 1
          WHERE id = r.id;
          v_msg := '🚑 ' || r.name || ' mengalami cedera ringan saat sparring tambahan.';
        ELSE
          UPDATE fighters SET morale = LEAST(100, morale + 3) WHERE id = r.id;
          v_msg := '🙂 ' || r.name || ' tetap berlatih ringan meski masih pemulihan.';
        END IF;

      WHEN 16 THEN -- Menang kompetisi internal
        v_cur := (r.attrs->>'mental')::int;
        IF v_cur < r.potential THEN
          UPDATE fighters SET attrs = jsonb_set(attrs, '{mental}', to_jsonb(v_cur + 1)) WHERE id = r.id;
        END IF;
        UPDATE fighters SET morale = LEAST(100, morale + 5) WHERE id = r.id;
        v_msg := '🏆 ' || r.name || ' memenangkan kompetisi internal gym, kepercayaan dirinya naik.';

      WHEN 17 THEN -- Masalah pribadi
        UPDATE fighters SET morale = GREATEST(0, morale - 10) WHERE id = r.id;
        v_msg := '📉 ' || r.name || ' menghadapi masalah pribadi, performanya sedikit menurun.';

      WHEN 18 THEN -- Hadiah sponsor
        v_amt := 100000 + floor(random() * 200000)::int;
        UPDATE fighters SET morale = LEAST(100, morale + 3) WHERE id = r.id;
        UPDATE gyms SET balance = balance + v_amt WHERE id = p_gym_id;
        v_msg := '🎁 ' || r.name || ' menerima hadiah kecil dari sponsor, semangatnya naik.';

      WHEN 19 THEN -- Sorotan media positif (gym)
        UPDATE gyms SET reputation = LEAST(99, reputation + 1) WHERE id = p_gym_id;
        v_msg := '🏢 Gym mendapat sorotan media positif minggu ini, reputasi sedikit naik.';

      WHEN 20 THEN -- Biaya perawatan tak terduga
        v_amt := 150000 + floor(random() * 350000)::int;
        UPDATE gyms SET balance = balance - v_amt WHERE id = p_gym_id;
        v_msg := '🔧 Ada biaya perawatan fasilitas tak terduga minggu ini.';

      WHEN 21 THEN -- Calon sponsor tertarik
        UPDATE gyms SET reputation = LEAST(99, reputation + 1) WHERE id = p_gym_id;
        v_msg := '🌟 Reputasi gym menarik perhatian calon sponsor baru.';

      WHEN 22 THEN -- Donasi peralatan
        v_amt := 100000 + floor(random() * 400000)::int;
        UPDATE gyms SET balance = balance + v_amt WHERE id = p_gym_id;
        v_msg := '📦 Gym menerima donasi peralatan latihan dari komunitas lokal.';

      -- ── Gosip & media sosial ───────────────────────────────────────────────
      WHEN 23 THEN -- Rumor transfer
        UPDATE fighters SET morale = GREATEST(0, morale - 2) WHERE id = r.id;
        v_msg := '🐦 @MMAInsiderID: Beredar rumor ' || r.name || ' didekati gym rival musim depan. Manajemen belum berkomentar.';

      WHEN 24 THEN -- Foto hangout viral
        UPDATE fighters SET morale = LEAST(100, morale + 2) WHERE id = r.id;
        v_msg := '🐦 @GosipTarung: Foto ' || r.name || ' lagi santai bareng rekan fighter lain viral, netizen heboh di kolom komentar.';

      WHEN 25 THEN -- Trash talk calon lawan
        UPDATE fighters SET morale = LEAST(100, morale + 4) WHERE id = r.id;
        v_msg := '🐦 @RivalArena: "Gampang lah ladenin ' || r.name || '" — cuitan ini bikin geger linimasa MMA dan memantik amarah fans.';

      WHEN 26 THEN -- Meme viral
        UPDATE fighters SET morale = LEAST(100, morale + 3) WHERE id = r.id;
        UPDATE gyms SET reputation = LEAST(99, reputation + 1) WHERE id = p_gym_id;
        v_msg := '🐦 @MemeTarungID: Meme ' || r.name || ' jadi trending topic, bikin ngakak seluruh linimasa MMA.';

      WHEN 27 THEN -- Kontroversi media
        UPDATE fighters SET morale = GREATEST(0, morale - 5) WHERE id = r.id;
        v_msg := '📰 Pengamat MMA mengkritik performa latihan ' || r.name || ' di kolom analisisnya minggu ini.';

      WHEN 28 THEN -- Podcast
        UPDATE fighters SET morale = LEAST(100, morale + 3) WHERE id = r.id;
        UPDATE gyms SET reputation = LEAST(99, reputation + 1) WHERE id = p_gym_id;
        v_msg := '🎙️ ' || r.name || ' tampil di podcast MMA ternama, ceritanya menginspirasi banyak fans baru.';

      WHEN 29 THEN -- Investor gym (gym-wide)
        UPDATE gyms SET reputation = LEAST(99, reputation + 1) WHERE id = p_gym_id;
        v_msg := '🐦 @BisnisTarung: Kabar perkembangan ' || v_gym_name || ' menarik perhatian calon investor MMA nasional.';

      WHEN 30 THEN -- Hujatan netizen
        UPDATE fighters SET morale = GREATEST(0, morale - 6) WHERE id = r.id;
        v_msg := '🐦 @NetizenKeras: Komentar pedas warganet soal ' || r.name || ' di media sosial bikin moralnya turun.';

      -- ── Tambahan baru ────────────────────────────────────────────────────
      WHEN 31 THEN -- Sesi foto sponsor
        UPDATE fighters SET morale = LEAST(100, morale + 4) WHERE id = r.id;
        v_amt := 150000 + floor(random() * 250000)::int;
        UPDATE gyms SET balance = balance + v_amt WHERE id = p_gym_id;
        v_msg := '📸 ' || r.name || ' tampil di sesi foto kampanye sponsor, gym kebagian bayaran tambahan.';

      WHEN 32 THEN -- Live training bareng influencer
        UPDATE fighters SET morale = LEAST(100, morale + 3) WHERE id = r.id;
        UPDATE gyms SET reputation = LEAST(99, reputation + 1) WHERE id = p_gym_id;
        v_msg := '📱 ' || r.name || ' latihan bareng influencer olahraga, klip-nya ramai ditonton dan menaikkan reputasi gym.';

      WHEN 33 THEN -- Lupa jadwal wajib
        UPDATE fighters SET morale = GREATEST(0, morale - 3), training_load = LEAST(100, training_load + 5) WHERE id = r.id;
        v_msg := '😬 ' || r.name || ' kesiangan dan melewatkan sesi latihan wajib, ditegur pelatih.';

      WHEN 34 THEN -- Diet ketat menjelang fight
        v_cur := (r.attrs->>'durability')::int;
        IF v_cur < r.potential THEN
          UPDATE fighters SET attrs = jsonb_set(attrs, '{durability}', to_jsonb(v_cur + 1)) WHERE id = r.id;
        END IF;
        v_msg := '🍱 ' || r.name || ' menjalani program diet ketat, kondisi fisiknya makin solid.';

      WHEN 35 THEN -- Hujan deras ganggu latihan outdoor
        UPDATE fighters SET training_load = GREATEST(10, training_load - 5), morale = LEAST(100, morale + 2) WHERE id = r.id;
        v_msg := '🌧️ Hujan deras membatalkan sesi lari pagi ' || r.name || ', jadi hari istirahat tak terduga.';

      WHEN 36 THEN -- Dukungan fan club lokal
        UPDATE fighters SET morale = LEAST(100, morale + 5) WHERE id = r.id;
        v_msg := '📣 Fan club lokal mengadakan acara dukungan untuk ' || r.name || ', moralnya melonjak.';

      WHEN 37 THEN -- Cedera lama kambuh ringan
        IF r.status != 'injured' THEN
          UPDATE fighters SET status = 'injured', injury = 'Cedera lama kambuh ringan',
            injury_weeks_left = 1 + floor(random() * 2)::int
          WHERE id = r.id;
          v_msg := '🩹 Cedera lama ' || r.name || ' sedikit kambuh, butuh waktu pemulihan singkat.';
        ELSE
          UPDATE fighters SET morale = LEAST(100, morale + 3) WHERE id = r.id;
          v_msg := '🙂 ' || r.name || ' menjaga kondisi dengan baik selama masa pemulihan.';
        END IF;

      WHEN 38 THEN -- Kolaborasi brand lokal (gym-wide)
        v_amt := 250000 + floor(random() * 500000)::int;
        UPDATE gyms SET balance = balance + v_amt, reputation = LEAST(99, reputation + 1) WHERE id = p_gym_id;
        v_msg := '🤝 ' || v_gym_name || ' menjalin kolaborasi dengan brand olahraga lokal, dapat suntikan dana dan reputasi naik.';

      WHEN 39 THEN -- Live streaming sesi sparring
        UPDATE fighters SET morale = LEAST(100, morale + 3) WHERE id = r.id;
        UPDATE gyms SET reputation = LEAST(99, reputation + 1) WHERE id = p_gym_id;
        v_msg := '🔴 Sesi sparring ' || r.name || ' di-live streaming dan ditonton ribuan fans, reputasi gym naik.';

      ELSE -- 40: Kesalahan kecil di media sosial (gym-wide negatif)
        UPDATE fighters SET morale = GREATEST(0, morale - 4) WHERE id = r.id;
        UPDATE gyms SET reputation = GREATEST(0, reputation - 1) WHERE id = p_gym_id;
        v_msg := '📵 Unggahan kontroversial dari akun gym memicu kritik netizen, reputasi ' || v_gym_name || ' sedikit turun.';
    END CASE;

    INSERT INTO fighter_news (gym_id, season_week, message) VALUES (p_gym_id, p_season_week, v_msg);
  END LOOP;
END;
$$;
