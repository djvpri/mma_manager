-- Reset event lama yang menggunakan struktur fighter_ids (tidak kompatibel)
-- Event baru menggunakan structure: promotion, weight_class, slots[]
-- Akan di-generate ulang otomatis saat user buka halaman Events

UPDATE gyms SET events = '[]'::jsonb;
