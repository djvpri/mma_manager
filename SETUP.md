# MMA Manager — Setup Guide

## Prerequisites
- Node.js 18+
- npm atau pnpm
- Akun Supabase (gratis): https://supabase.com
- Akun Google AI Studio (untuk AI / Gemini): https://aistudio.google.com

---

## Step 1 — Clone & Install

```bash
# Masuk ke folder project
cd mma-manager

# Install dependencies
npm install
```

---

## Step 2 — Setup Supabase

### 2a. Buat project baru di Supabase
1. Buka https://supabase.com/dashboard
2. Klik **New project**
3. Isi nama: `mma-manager`, pilih region terdekat (Singapore)
4. Simpan password database

### 2b. Jalankan migration SQL
1. Buka **SQL Editor** di Supabase dashboard
2. Copy seluruh isi file `supabase/migrations/001_initial_schema.sql`
3. Paste dan klik **Run**

### 2c. Aktifkan Google Auth (opsional)
1. Buka **Authentication → Providers → Google**
2. Ikuti panduan untuk Client ID & Secret
3. Atau gunakan **Email/Password** saja (sudah aktif by default)

### 2d. Dapatkan API keys
1. Buka **Settings → API**
2. Copy **Project URL** dan **anon public key**

---

## Step 3 — Setup Environment Variables

Edit file `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
GEMINI_API_KEY=AIza...
```

**Cara dapat Gemini API key:**
1. Buka https://aistudio.google.com/app/apikey
2. Klik **Create API Key**
3. Copy dan paste ke `.env.local`

---

## Step 4 — Jalankan Dev Server

```bash
npm run dev
```

Buka http://localhost:3000

---

## Struktur Folder

```
mma-manager/
├── app/
│   ├── api/
│   │   ├── ai-corner/route.ts    ← AI corner advice endpoint
│   │   └── ai-scout/route.ts     ← AI scouting report endpoint
│   ├── auth/login/               ← Login page
│   └── game/
│       ├── roster/               ← Fighter roster screen
│       ├── fight/                ← Fight night screen
│       ├── gym/                  ← Gym management screen
│       ├── schedule/             ← Training schedule
│       └── recruit/              ← Fighter recruitment
├── components/
│   ├── ui/                       ← Shared UI components
│   ├── roster/                   ← Roster-specific components
│   ├── fight/                    ← Fight night components
│   ├── gym/                      ← Gym management components
│   └── avatar/                   ← Procedural avatar generator
├── lib/
│   ├── supabase.ts               ← Supabase browser client
│   ├── supabase-server.ts        ← Supabase server client (RSC)
│   ├── fight-engine.ts           ← Fight simulation logic
│   ├── ai-corner.ts              ← AI corner advice calls
│   └── avatar.ts                 ← Procedural avatar SVG generator
├── store/
│   └── game-store.ts             ← Zustand global state
├── types/
│   └── index.ts                  ← TypeScript types
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql ← Database schema + RLS policies
```

---

## Database Schema (ringkasan)

| Tabel           | Isi                                      |
|-----------------|------------------------------------------|
| `gyms`          | Data gym player (1 per user)             |
| `fighters`      | Semua fighter yang dikontrak             |
| `staff`         | Pelatih & staf gym                       |
| `fight_results` | Histori pertarungan lengkap              |
| `leaderboard`   | Skor publik (reputasi + total menang)    |

Semua tabel menggunakan **Row Level Security (RLS)** — setiap user hanya bisa akses data miliknya sendiri.

---

## AI Features

| Feature              | Endpoint              | Trigger                     |
|---------------------|-----------------------|-----------------------------|
| Corner advice        | `POST /api/ai-corner` | Jeda antar ronde            |
| Narasi pertarungan   | `POST /api/ai-corner` | Setelah tiap ronde selesai  |
| Scouting report      | `POST /api/ai-scout`  | Tombol di detail fighter    |
| Program latihan      | `POST /api/ai-corner` | Tombol di detail fighter    |

---

## Lanjutan (roadmap)

- [x] Auth dengan Email/Password (Google OAuth opsional, belum diaktifkan)
- [x] Onboarding: buat nama gym & pilih kota awal
- [x] Seed data fighter awal (6 fighter default per gym baru)
- [x] Navigasi utama (sidebar / bottom nav)
- [x] Sistem rekrutmen fighter baru
- [x] Advance week / simulasi waktu
- [x] Hasil pertarungan tersimpan (rekor, purse, reputasi, riwayat)
- [x] Masa pemulihan fighter pasca-tanding (jadwal siap bertanding per minggu)
- [x] Leaderboard multiplayer (peringkat reputasi & total menang antar gym)
- [x] Sistem cedera fighter (peluang cedera pasca-tanding, pemulihan tiap minggu)
- [x] Manajemen staf gym (rekrut/pecat, mempengaruhi pengeluaran bulanan)
- [x] Perkembangan atribut fighter (fokus latihan mingguan, dipercepat ruangan & staf)
- [x] Sistem kontrak fighter (gaji masuk pengeluaran bulanan, perpanjangan kontrak, risiko pensiun)
- [x] Sistem usia fighter (umur bertambah tiap 12 minggu, pensiun alami di usia veteran)
- [x] Laporan mingguan setelah Advance Week (perkembangan atribut, cedera sembuh, pensiun, kontrak)
- [x] Efek spesialisasi staf: Manajer Pertarungan (purse), Fisioterapis (risiko & pemulihan cedera), Ahli Gizi (pemulihan training load)
