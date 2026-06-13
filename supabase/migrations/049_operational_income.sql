-- 049: Pemasukan operasional gym dirincikan dari level fasilitas
-- (mengganti "bonus reputasi" & "bonus roster" yang tidak realistis).
--
-- Kolom monthly_income sebelumnya tidak pernah dihitung ulang sejak
-- migration 020 (statis sejak gym dibuat). Trigger ini menghitung ulang
-- monthly_income setiap minggu dari level fasilitas:
--   Day-pass & drop-in : 600.000 x (1 + level Locker Room)
--   Sewa fasilitas&alat: 200.000 x total level semua ruangan
--   Kantin & vending   : 600.000 flat
--
-- advance_week() menambahkan (monthly_income LAMA - monthly_expense) ke saldo
-- menggunakan nilai SEBELUM trigger ini jalan. Trigger mengoreksi selisih
-- antara monthly_income baru vs lama, lalu menyimpan nilai baru untuk
-- minggu berikutnya.

CREATE OR REPLACE FUNCTION process_operational_income()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_locker_level integer;
  v_total_levels integer;
  v_new_income   bigint;
BEGIN
  IF NEW.season_week <= OLD.season_week THEN RETURN NEW; END IF;

  v_locker_level := COALESCE((NEW.rooms->'locker'->>'level')::int, 0);

  SELECT COALESCE(SUM((value->>'level')::int), 0) INTO v_total_levels
  FROM jsonb_each(NEW.rooms);

  v_new_income := 600000 * (1 + v_locker_level)
                + 200000 * v_total_levels
                + 600000;

  -- Koreksi selisih dari monthly_income lama yang sudah terpakai di advance_week()
  NEW.balance := NEW.balance + (v_new_income - OLD.monthly_income);
  NEW.monthly_income := v_new_income;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gym_operational_income ON gyms;
CREATE TRIGGER trg_gym_operational_income
  BEFORE UPDATE OF season_week ON gyms
  FOR EACH ROW EXECUTE FUNCTION process_operational_income();
