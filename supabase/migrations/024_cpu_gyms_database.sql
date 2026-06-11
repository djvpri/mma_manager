-- Database 50 CPU gym untuk leaderboard (mirip database FM)
-- Tersebar di kota-kota Indonesia, bervariasi dari pemula hingga elite
-- UUID deterministik via md5() agar aman di-re-run (ON CONFLICT DO NOTHING)

-- Drop foreign key constraint agar leaderboard bisa menampung CPU gym
-- yang tidak memiliki entri di tabel gyms
ALTER TABLE leaderboard DROP CONSTRAINT IF EXISTS leaderboard_gym_id_fkey;

INSERT INTO leaderboard (id, gym_id, gym_name, player_name, reputation, total_wins, top_fighters)
VALUES

-- ═══════════════════════════════════════════════
-- ELITE TIER (reputasi 80–95, menang 50–80)
-- ═══════════════════════════════════════════════
(md5('cpu_lb_001')::uuid, md5('cpu_gid_001')::uuid,
 'Jakarta Warriors MMA', 'Jakarta Warriors MMA', 92, 78,
 '[{"name":"Rizky Firmansyah","record":"15-2","specialty":"Striker","wins":15},{"name":"Carlos Silva","record":"12-4","specialty":"All-rounder","wins":12},{"name":"Bagas Nugroho","record":"11-3","specialty":"Grappler","wins":11}]'),

(md5('cpu_lb_002')::uuid, md5('cpu_gid_002')::uuid,
 'Surabaya Iron FC', 'Surabaya Iron FC', 88, 65,
 '[{"name":"Viktor Volkov","record":"14-1","specialty":"Wrestler","wins":14},{"name":"Dimas Pratama","record":"11-3","specialty":"Striker","wins":11},{"name":"Kenji Yamamoto","record":"10-4","specialty":"Grappler","wins":10}]'),

(md5('cpu_lb_003')::uuid, md5('cpu_gid_003')::uuid,
 'Bali Dragon Elite', 'Bali Dragon Elite', 85, 61,
 '[{"name":"Rodrigo Lima","record":"13-2","specialty":"All-rounder","wins":13},{"name":"Guntur Adiputra","record":"10-3","specialty":"Counter Fighter","wins":10},{"name":"Satria Ramadhan","record":"9-4","specialty":"Striker","wins":9}]'),

(md5('cpu_lb_004')::uuid, md5('cpu_gid_004')::uuid,
 'Medan Wolves Combat', 'Medan Wolves Combat', 82, 57,
 '[{"name":"Aryo Situmorang","record":"13-3","specialty":"Wrestler","wins":13},{"name":"Diego Santos","record":"10-2","specialty":"Grappler","wins":10},{"name":"Wahyu Tampubolon","record":"9-5","specialty":"Striker","wins":9}]'),

(md5('cpu_lb_005')::uuid, md5('cpu_gid_005')::uuid,
 'Makassar Cobra Team', 'Makassar Cobra Team', 80, 53,
 '[{"name":"Bima Kurniawan","record":"12-2","specialty":"Striker","wins":12},{"name":"Ryota Tanaka","record":"10-4","specialty":"All-rounder","wins":10},{"name":"Fauzan Hidayat","record":"9-3","specialty":"Counter Fighter","wins":9}]'),

-- ═══════════════════════════════════════════════
-- HIGH TIER (reputasi 60–79, menang 22–50)
-- ═══════════════════════════════════════════════
(md5('cpu_lb_006')::uuid, md5('cpu_gid_006')::uuid,
 'Bandung Panther MMA', 'Bandung Panther MMA', 77, 48,
 '[{"name":"Hendra Setiawan","record":"11-3","specialty":"Grappler","wins":11},{"name":"Rian Saputra","record":"9-4","specialty":"Striker","wins":9},{"name":"Felipe Ferreira","record":"8-3","specialty":"Wrestler","wins":8}]'),

(md5('cpu_lb_007')::uuid, md5('cpu_gid_007')::uuid,
 'Yogyakarta Thunder MMA', 'Yogyakarta Thunder MMA', 74, 44,
 '[{"name":"Galih Prasetyo","record":"10-3","specialty":"Counter Fighter","wins":10},{"name":"Andika Sanjaya","record":"9-4","specialty":"Striker","wins":9},{"name":"Takeshi Watanabe","record":"7-3","specialty":"Grappler","wins":7}]'),

(md5('cpu_lb_008')::uuid, md5('cpu_gid_008')::uuid,
 'Semarang Force MMA', 'Semarang Force MMA', 72, 42,
 '[{"name":"Irfan Permana","record":"10-4","specialty":"Wrestler","wins":10},{"name":"Niko Hartanto","record":"8-3","specialty":"All-rounder","wins":8},{"name":"Rendi Gunawan","record":"7-4","specialty":"Striker","wins":7}]'),

(md5('cpu_lb_009')::uuid, md5('cpu_gid_009')::uuid,
 'Batam Strike Team', 'Batam Strike Team', 70, 39,
 '[{"name":"Surya Wibowo","record":"9-3","specialty":"Striker","wins":9},{"name":"Ivan Sokolov","record":"8-4","specialty":"Wrestler","wins":8},{"name":"Hafiz Perdana","record":"7-3","specialty":"Counter Fighter","wins":7}]'),

(md5('cpu_lb_010')::uuid, md5('cpu_gid_010')::uuid,
 'Balikpapan Storm MMA', 'Balikpapan Storm MMA', 68, 36,
 '[{"name":"Fajar Raharjo","record":"9-4","specialty":"Grappler","wins":9},{"name":"Gustavo Almeida","record":"7-2","specialty":"Striker","wins":7},{"name":"Lutfi Susanto","record":"7-5","specialty":"All-rounder","wins":7}]'),

(md5('cpu_lb_011')::uuid, md5('cpu_gid_011')::uuid,
 'Pontianak Eagle MMA', 'Pontianak Eagle MMA', 66, 33,
 '[{"name":"Raka Wahyudi","record":"8-3","specialty":"Counter Fighter","wins":8},{"name":"Hiroshi Nakamura","record":"7-4","specialty":"Grappler","wins":7},{"name":"Agus Lesmana","record":"6-3","specialty":"Striker","wins":6}]'),

(md5('cpu_lb_012')::uuid, md5('cpu_gid_012')::uuid,
 'Manado Predator FC', 'Manado Predator FC', 65, 31,
 '[{"name":"Gilang Firdaus","record":"8-4","specialty":"Wrestler","wins":8},{"name":"Park Jae-won","record":"7-3","specialty":"Counter Fighter","wins":7},{"name":"Sandy Mulyono","record":"6-4","specialty":"Striker","wins":6}]'),

(md5('cpu_lb_013')::uuid, md5('cpu_gid_013')::uuid,
 'Palembang Tiger FC', 'Palembang Tiger FC', 63, 28,
 '[{"name":"Evan Ardiansyah","record":"7-3","specialty":"All-rounder","wins":7},{"name":"Bruno Carvalho","record":"6-2","specialty":"Grappler","wins":6},{"name":"Hasan Effendi","record":"6-4","specialty":"Striker","wins":6}]'),

(md5('cpu_lb_014')::uuid, md5('cpu_gid_014')::uuid,
 'Lombok Warrior MMA', 'Lombok Warrior MMA', 61, 25,
 '[{"name":"Yanuar Purnama","record":"7-4","specialty":"Striker","wins":7},{"name":"Yuki Ishida","record":"6-3","specialty":"Wrestler","wins":6},{"name":"Taufik Maulana","record":"5-3","specialty":"Counter Fighter","wins":5}]'),

(md5('cpu_lb_015')::uuid, md5('cpu_gid_015')::uuid,
 'Pekanbaru Beast MMA', 'Pekanbaru Beast MMA', 60, 23,
 '[{"name":"Kevin Chandra","record":"7-5","specialty":"Grappler","wins":7},{"name":"Marcus Johnson","record":"6-3","specialty":"Striker","wins":6},{"name":"Zainal Budiman","record":"5-4","specialty":"All-rounder","wins":5}]'),

-- ═══════════════════════════════════════════════
-- MID TIER (reputasi 40–59, menang 10–22)
-- ═══════════════════════════════════════════════
(md5('cpu_lb_016')::uuid, md5('cpu_gid_016')::uuid,
 'Bogor Hunter MMA', 'Bogor Hunter MMA', 58, 22,
 '[{"name":"Adhitya Wardhana","record":"6-3","specialty":"Striker","wins":6},{"name":"Nanda Iskandar","record":"5-2","specialty":"Wrestler","wins":5},{"name":"Dmitri Petrov","record":"5-4","specialty":"Grappler","wins":5}]'),

(md5('cpu_lb_017')::uuid, md5('cpu_gid_017')::uuid,
 'Malang Steel MMA', 'Malang Steel MMA', 56, 20,
 '[{"name":"Bobby Darwis","record":"6-4","specialty":"Counter Fighter","wins":6},{"name":"Ridho Fadillah","record":"5-3","specialty":"Striker","wins":5},{"name":"Eduardo Costa","record":"4-2","specialty":"All-rounder","wins":4}]'),

(md5('cpu_lb_018')::uuid, md5('cpu_gid_018')::uuid,
 'Cirebon Sting MMA', 'Cirebon Sting MMA', 54, 19,
 '[{"name":"Doni Hakim","record":"6-5","specialty":"Grappler","wins":6},{"name":"Prayoga Anggara","record":"5-3","specialty":"Striker","wins":5},{"name":"Kim Sung-min","record":"4-3","specialty":"Wrestler","wins":4}]'),

(md5('cpu_lb_019')::uuid, md5('cpu_gid_019')::uuid,
 'Depok Thunder MMA', 'Depok Thunder MMA', 52, 18,
 '[{"name":"Reza Haryanto","record":"5-3","specialty":"Striker","wins":5},{"name":"Vino Arifin","record":"5-4","specialty":"Counter Fighter","wins":5},{"name":"Tyler Brooks","record":"4-3","specialty":"Grappler","wins":4}]'),

(md5('cpu_lb_020')::uuid, md5('cpu_gid_020')::uuid,
 'Solo Samurai MMA', 'Solo Samurai MMA', 51, 17,
 '[{"name":"Arya Supriyadi","record":"5-3","specialty":"All-rounder","wins":5},{"name":"Hendi Suhendra","record":"5-5","specialty":"Striker","wins":5},{"name":"Topan Rohman","record":"4-3","specialty":"Wrestler","wins":4}]'),

(md5('cpu_lb_021')::uuid, md5('cpu_gid_021')::uuid,
 'Palu Black Bear MMA', 'Palu Black Bear MMA', 49, 16,
 '[{"name":"Akbar Rasyid","record":"5-4","specialty":"Striker","wins":5},{"name":"Mohammed Al-Rashid","record":"4-2","specialty":"Grappler","wins":4},{"name":"Sigit Usman","record":"4-4","specialty":"Counter Fighter","wins":4}]'),

(md5('cpu_lb_022')::uuid, md5('cpu_gid_022')::uuid,
 'Samarinda Wild MMA', 'Samarinda Wild MMA', 48, 15,
 '[{"name":"Eko Pramono","record":"5-5","specialty":"Wrestler","wins":5},{"name":"Ferry Andika","record":"4-3","specialty":"Striker","wins":4},{"name":"Leo Kristanto","record":"4-4","specialty":"All-rounder","wins":4}]'),

(md5('cpu_lb_023')::uuid, md5('cpu_gid_023')::uuid,
 'Kupang Titan MMA', 'Kupang Titan MMA', 47, 14,
 '[{"name":"Wisnu Yusuf","record":"5-6","specialty":"Grappler","wins":5},{"name":"Novan Latief","record":"4-3","specialty":"Striker","wins":4},{"name":"Jake Anderson","record":"3-2","specialty":"Wrestler","wins":3}]'),

(md5('cpu_lb_024')::uuid, md5('cpu_gid_024')::uuid,
 'Ambon Warrior FC', 'Ambon Warrior FC', 46, 13,
 '[{"name":"Jaka Purnama","record":"4-3","specialty":"Counter Fighter","wins":4},{"name":"Zain Marsudi","record":"4-4","specialty":"Striker","wins":4},{"name":"Arief Santoso","record":"3-3","specialty":"All-rounder","wins":3}]'),

(md5('cpu_lb_025')::uuid, md5('cpu_gid_025')::uuid,
 'Padang Rhino MMA', 'Padang Rhino MMA', 45, 13,
 '[{"name":"Karim Effendi","record":"4-3","specialty":"Grappler","wins":4},{"name":"Dafa Supriyadi","record":"4-4","specialty":"Striker","wins":4},{"name":"Andi Nugroho","record":"3-3","specialty":"Wrestler","wins":3}]'),

(md5('cpu_lb_026')::uuid, md5('cpu_gid_026')::uuid,
 'Kediri Force MMA', 'Kediri Force MMA', 44, 12,
 '[{"name":"Heri Santoso","record":"4-3","specialty":"Striker","wins":4},{"name":"Saleh Kusuma","record":"3-2","specialty":"Counter Fighter","wins":3},{"name":"Kiki Permana","record":"3-3","specialty":"All-rounder","wins":3}]'),

(md5('cpu_lb_027')::uuid, md5('cpu_gid_027')::uuid,
 'Tangerang Rush MMA', 'Tangerang Rush MMA', 43, 11,
 '[{"name":"Imam Wahyudi","record":"4-4","specialty":"Grappler","wins":4},{"name":"Aris Firmansyah","record":"3-3","specialty":"Striker","wins":3},{"name":"Rendy Wibowo","record":"3-4","specialty":"Wrestler","wins":3}]'),

(md5('cpu_lb_028')::uuid, md5('cpu_gid_028')::uuid,
 'Bekasi Power MMA', 'Bekasi Power MMA', 42, 11,
 '[{"name":"Fendi Arman","record":"4-5","specialty":"Counter Fighter","wins":4},{"name":"Rama Setiawan","record":"3-3","specialty":"Striker","wins":3},{"name":"Wahyudi Prasetyo","record":"3-4","specialty":"Grappler","wins":3}]'),

(md5('cpu_lb_029')::uuid, md5('cpu_gid_029')::uuid,
 'Sorong Viper MMA', 'Sorong Viper MMA', 41, 10,
 '[{"name":"Yogi Ramadhan","record":"3-3","specialty":"All-rounder","wins":3},{"name":"Teguh Wijaya","record":"3-4","specialty":"Striker","wins":3},{"name":"David Putra","record":"3-4","specialty":"Wrestler","wins":3}]'),

(md5('cpu_lb_030')::uuid, md5('cpu_gid_030')::uuid,
 'Kendari Fury MMA', 'Kendari Fury MMA', 40, 10,
 '[{"name":"Arman Hakim","record":"3-3","specialty":"Grappler","wins":3},{"name":"Rino Sanjaya","record":"3-4","specialty":"Striker","wins":3},{"name":"Okta Gunawan","record":"2-2","specialty":"Counter Fighter","wins":2}]'),

-- ═══════════════════════════════════════════════
-- LOW TIER (reputasi 25–39, menang 4–10)
-- ═══════════════════════════════════════════════
(md5('cpu_lb_031')::uuid, md5('cpu_gid_031')::uuid,
 'Pekalongan Fighter', 'Pekalongan Fighter', 38, 9,
 '[{"name":"Wahyu Raharjo","record":"3-4","specialty":"Striker","wins":3},{"name":"Gilang Maulana","record":"2-2","specialty":"Grappler","wins":2},{"name":"Niko Saputra","record":"2-3","specialty":"All-rounder","wins":2}]'),

(md5('cpu_lb_032')::uuid, md5('cpu_gid_032')::uuid,
 'Tarakan Brawler MMA', 'Tarakan Brawler MMA', 36, 8,
 '[{"name":"Ridho Kurniawan","record":"3-5","specialty":"Wrestler","wins":3},{"name":"Bima Lesmana","record":"2-3","specialty":"Striker","wins":2},{"name":"Sandy Darwis","record":"2-3","specialty":"Counter Fighter","wins":2}]'),

(md5('cpu_lb_033')::uuid, md5('cpu_gid_033')::uuid,
 'Gorontalo Wild MMA', 'Gorontalo Wild MMA', 34, 7,
 '[{"name":"Evan Firdaus","record":"3-6","specialty":"Striker","wins":3},{"name":"Hendra Budiman","record":"2-3","specialty":"Grappler","wins":2},{"name":"Fajar Ardiansyah","record":"2-4","specialty":"All-rounder","wins":2}]'),

(md5('cpu_lb_034')::uuid, md5('cpu_gid_034')::uuid,
 'Jayapura Eagle MMA', 'Jayapura Eagle MMA', 33, 7,
 '[{"name":"Surya Mulyono","record":"3-5","specialty":"Counter Fighter","wins":3},{"name":"Rian Effendi","record":"2-3","specialty":"Striker","wins":2},{"name":"Galih Purnama","record":"2-4","specialty":"Wrestler","wins":2}]'),

(md5('cpu_lb_035')::uuid, md5('cpu_gid_035')::uuid,
 'Ternate Combat MMA', 'Ternate Combat MMA', 32, 6,
 '[{"name":"Bagas Hidayat","record":"2-3","specialty":"Grappler","wins":2},{"name":"Dimas Wijaya","record":"2-4","specialty":"Striker","wins":2},{"name":"Aryo Susanto","record":"2-4","specialty":"All-rounder","wins":2}]'),

(md5('cpu_lb_036')::uuid, md5('cpu_gid_036')::uuid,
 'Timika Iron MMA', 'Timika Iron MMA', 30, 6,
 '[{"name":"Lutfi Prasetyo","record":"2-3","specialty":"Striker","wins":2},{"name":"Hafiz Setiawan","record":"2-4","specialty":"Counter Fighter","wins":2},{"name":"Rendi Adiputra","record":"2-5","specialty":"Wrestler","wins":2}]'),

(md5('cpu_lb_037')::uuid, md5('cpu_gid_037')::uuid,
 'Bengkulu Bear MMA', 'Bengkulu Bear MMA', 29, 5,
 '[{"name":"Ivan Hartanto","record":"2-4","specialty":"Grappler","wins":2},{"name":"Leo Permana","record":"2-5","specialty":"Striker","wins":2},{"name":"Zainal Fadillah","record":"1-2","specialty":"All-rounder","wins":1}]'),

(md5('cpu_lb_038')::uuid, md5('cpu_gid_038')::uuid,
 'Jambi Tiger MMA', 'Jambi Tiger MMA', 28, 5,
 '[{"name":"Nanda Chandra","record":"2-4","specialty":"Striker","wins":2},{"name":"Sigit Rohman","record":"2-5","specialty":"Wrestler","wins":2},{"name":"Yanuar Iskandar","record":"1-2","specialty":"Counter Fighter","wins":1}]'),

(md5('cpu_lb_039')::uuid, md5('cpu_gid_039')::uuid,
 'Lampung Striker MMA', 'Lampung Striker MMA', 27, 4,
 '[{"name":"Kevin Wardhana","record":"2-5","specialty":"Grappler","wins":2},{"name":"Adhitya Rasyid","record":"1-2","specialty":"Striker","wins":1},{"name":"Bobby Anggara","record":"1-3","specialty":"All-rounder","wins":1}]'),

(md5('cpu_lb_040')::uuid, md5('cpu_gid_040')::uuid,
 'Banjarbaru Wolf MMA', 'Banjarbaru Wolf MMA', 26, 4,
 '[{"name":"Topan Gunawan","record":"2-6","specialty":"Striker","wins":2},{"name":"Irfan Suhendra","record":"1-2","specialty":"Counter Fighter","wins":1},{"name":"Akbar Usman","record":"1-3","specialty":"Grappler","wins":1}]'),

-- ═══════════════════════════════════════════════
-- BEGINNER TIER (reputasi 10–24, menang 0–5)
-- ═══════════════════════════════════════════════
(md5('cpu_lb_041')::uuid, md5('cpu_gid_041')::uuid,
 'Sukabumi Amateur MMA', 'Sukabumi Amateur MMA', 23, 4,
 '[{"name":"Doni Kristanto","record":"2-5","specialty":"Striker","wins":2},{"name":"Ferry Latief","record":"1-2","specialty":"Wrestler","wins":1},{"name":"Hasan Marsudi","record":"1-3","specialty":"Grappler","wins":1}]'),

(md5('cpu_lb_042')::uuid, md5('cpu_gid_042')::uuid,
 'Madiun Fighter MMA', 'Madiun Fighter MMA', 21, 3,
 '[{"name":"Prayoga Wardhana","record":"1-2","specialty":"Counter Fighter","wins":1},{"name":"Eko Sanjaya","record":"1-3","specialty":"Striker","wins":1},{"name":"Raka Pramono","record":"1-4","specialty":"All-rounder","wins":1}]'),

(md5('cpu_lb_043')::uuid, md5('cpu_gid_043')::uuid,
 'Jember Combat MMA', 'Jember Combat MMA', 20, 3,
 '[{"name":"Arif Nugroho","record":"1-2","specialty":"Grappler","wins":1},{"name":"Karim Supriyadi","record":"1-3","specialty":"Striker","wins":1},{"name":"Dafa Wahyudi","record":"1-4","specialty":"Wrestler","wins":1}]'),

(md5('cpu_lb_044')::uuid, md5('cpu_gid_044')::uuid,
 'Blitar MMA Club', 'Blitar MMA Club', 18, 2,
 '[{"name":"Reza Budiman","record":"1-3","specialty":"Striker","wins":1},{"name":"Arman Kusuma","record":"1-4","specialty":"Counter Fighter","wins":1},{"name":"Hendi Putra","record":"0-2","specialty":"Grappler","wins":0}]'),

(md5('cpu_lb_045')::uuid, md5('cpu_gid_045')::uuid,
 'Probolinggo Strike MMA', 'Probolinggo Strike MMA', 17, 2,
 '[{"name":"Teguh Kurniawan","record":"1-3","specialty":"All-rounder","wins":1},{"name":"Sandy Effendi","record":"1-5","specialty":"Striker","wins":1},{"name":"Niko Hakim","record":"0-2","specialty":"Wrestler","wins":0}]'),

(md5('cpu_lb_046')::uuid, md5('cpu_gid_046')::uuid,
 'Tegal Warrior MMA', 'Tegal Warrior MMA', 16, 1,
 '[{"name":"Imam Darwis","record":"1-4","specialty":"Grappler","wins":1},{"name":"Aris Lesmana","record":"0-2","specialty":"Striker","wins":0},{"name":"Fendi Yusuf","record":"0-3","specialty":"Counter Fighter","wins":0}]'),

(md5('cpu_lb_047')::uuid, md5('cpu_gid_047')::uuid,
 'Purwokerto MMA Club', 'Purwokerto MMA Club', 15, 1,
 '[{"name":"Wahyu Firmansyah","record":"1-5","specialty":"Striker","wins":1},{"name":"Gilang Saputra","record":"0-2","specialty":"Wrestler","wins":0},{"name":"Zain Wibowo","record":"0-3","specialty":"All-rounder","wins":0}]'),

(md5('cpu_lb_048')::uuid, md5('cpu_gid_048')::uuid,
 'Rangkasbitung FC MMA', 'Rangkasbitung FC MMA', 14, 1,
 '[{"name":"Bima Setiawan","record":"1-6","specialty":"Counter Fighter","wins":1},{"name":"Vino Raharjo","record":"0-2","specialty":"Grappler","wins":0},{"name":"Yogi Ramdan","record":"0-3","specialty":"Striker","wins":0}]'),

(md5('cpu_lb_049')::uuid, md5('cpu_gid_049')::uuid,
 'Serang Fighter MMA', 'Serang Fighter MMA', 12, 1,
 '[{"name":"Bayu Mulyono","record":"1-7","specialty":"Wrestler","wins":1},{"name":"Rian Susanto","record":"0-3","specialty":"Striker","wins":0},{"name":"Lutfi Permana","record":"0-4","specialty":"All-rounder","wins":0}]'),

(md5('cpu_lb_050')::uuid, md5('cpu_gid_050')::uuid,
 'Garut Combat MMA', 'Garut Combat MMA', 10, 0,
 '[{"name":"Dimas Gunawan","record":"0-2","specialty":"Striker","wins":0},{"name":"Rizky Hartanto","record":"0-3","specialty":"Grappler","wins":0},{"name":"Fajar Adiputra","record":"0-4","specialty":"Wrestler","wins":0}]')

ON CONFLICT (gym_id) DO NOTHING;
