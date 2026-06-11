-- Sistem Bagi Hasil Purse (Fase 5): kontrak fighter kini punya komponen
-- profit-sharing, bukan hanya gaji tetap. Tiap pertandingan, fighter
-- menerima persentase dari purse sesuai klausul kontraknya.
--   - purse_share_pct dinegosiasikan saat rekrutmen (lib/negotiation.ts)
--     bersama Base Purse dan Win Bonus.
--   - Dipotong dari saldo gym tiap pertandingan di app/game/fight/page.tsx,
--     terlepas dari menang/kalah.
-- Fighter yang sudah ada diberi nilai default 10% sebagai titik awal yang wajar.

alter table fighters add column if not exists purse_share_pct integer not null default 10;
