-- 080: Fix "tuple to be updated was already modified by an operation
-- triggered by the current command" saat advance_week().
--
-- advance_week() mengupdate gyms.season_week, yang memicu beberapa trigger
-- BEFORE UPDATE OF season_week ON gyms. Sebagian trigger (065 player
-- achievements, 068 title contention) sama-sama melakukan nested UPDATE ke
-- tabel fighters untuk baris yang sama (mis. champion yang juga mencapai
-- milestone kemenangan) -- dua trigger BEFORE yang nested-update baris yang
-- sama dalam satu command dilarang Postgres dan memicu error di atas.
--
-- Trigger yang HANYA melakukan side-effect ke tabel lain (tidak memodifikasi
-- NEW pada gyms) diubah dari BEFORE menjadi AFTER, sesuai hint resmi Postgres:
-- "Consider using an AFTER trigger instead of a BEFORE trigger to propagate
-- changes to other rows." trg_gym_members & trg_gym_operational_income TETAP
-- BEFORE karena memodifikasi NEW.balance/member_count/monthly_income.

DROP TRIGGER IF EXISTS trg_scout_missions ON gyms;
CREATE TRIGGER trg_scout_missions
  AFTER UPDATE OF season_week ON gyms
  FOR EACH ROW EXECUTE FUNCTION process_scout_missions();

DROP TRIGGER IF EXISTS trg_cpu_world_news ON gyms;
CREATE TRIGGER trg_cpu_world_news
  AFTER UPDATE OF season_week ON gyms
  FOR EACH ROW EXECUTE FUNCTION process_cpu_world_news();

DROP TRIGGER IF EXISTS trg_player_achievements ON gyms;
CREATE TRIGGER trg_player_achievements
  AFTER UPDATE OF season_week ON gyms
  FOR EACH ROW EXECUTE FUNCTION process_player_achievements();

DROP TRIGGER IF EXISTS trg_title_contention ON gyms;
CREATE TRIGGER trg_title_contention
  AFTER UPDATE OF season_week ON gyms
  FOR EACH ROW EXECUTE FUNCTION process_title_contention();
