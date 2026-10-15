<?php
/* ═══════════════════════════════════════════════════════════
   COMIC 2026 — KONFIGURASI
   Edit 5 nilai di bawah ini, lalu simpan.
   File ini hanya dibaca server, tidak pernah dikirim ke pengunjung.
   ═══════════════════════════════════════════════════════════ */

// 1-3) Data database MySQL (dibuat di cPanel → "MySQL® Databases").
//      Di Rumahweb nama database & user otomatis diawali nama akun cPanel,
//      contoh: abcd1234_comic  (tulis LENGKAP dengan awalannya).
define('DB_HOST', 'localhost');
define('DB_NAME', 'GANTI_NAMA_DATABASE');
define('DB_USER', 'GANTI_USER_DATABASE');
define('DB_PASS', 'GANTI_PASSWORD_DATABASE');

// 4) Password panel admin (admin.html). Minimal 10 karakter, jangan pakai
//    password yang sama dengan akun lain. Selama masih "GANTI..." admin tidak bisa login.
define('ADMIN_PASSWORD', 'DUARIBUDUAPULUHENAM');

// 5) Folder penyimpanan berkas upload (surat, screenshot, bukti transfer).
//    Default: di LUAR public_html (/home/USERCPANEL/comic_uploads) supaya
//    tidak bisa dibuka lewat URL. Folder dibuat otomatis.
define('UPLOAD_DIR', dirname(__DIR__, 2) . '/comic_uploads');

// Isi true HANYA saat mencari penyebab error (pesan error asli ditampilkan).
// Setelah beres, kembalikan ke false.
define('DEBUG', false);
