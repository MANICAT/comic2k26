<?php
/* ═══════════════════════════════════════════════════════════
   COMIC 2026 — API SERVER (PHP + MySQL)
   Semua aturan lomba dicek ULANG di sini, jadi tidak bisa
   dibypass lewat inspect element / edit JavaScript.
   ═══════════════════════════════════════════════════════════ */

require __DIR__ . '/config.php';

date_default_timezone_set('Asia/Jakarta');
if (function_exists('mb_internal_encoding')) { mb_internal_encoding('UTF-8'); }

const MAX_FILE  = 15728640; // 15 MB
const MULTI_OK  = ['Rangking 1', 'Olimpiade'];
const LEVELS    = ['TK/RA', 'SD/MI', 'SMP/MTs', 'SMA/MA', 'Umum'];
const FILE_KEYS = ['surat', 'ig1', 'ig2', 'pay'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

/* ───────────── helper dasar ───────────── */
function out($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function fail($code, $msg, $http = 400) {
  out(['error' => ['code' => $code, 'msg' => $msg]], $http);
}

set_exception_handler(function ($e) {
  error_log('[COMIC] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
  $msg = 'Terjadi kesalahan di server. Coba lagi beberapa saat.';
  if (DEBUG) { $msg .= ' [' . $e->getMessage() . ']'; }
  fail('SERVER', $msg, 500);
});

/* ───────────── session ───────────── */
$IS_HTTPS = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
         || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
ini_set('session.gc_maxlifetime', '604800');
ini_set('session.use_strict_mode', '1');
session_name('COMICSESS');
session_set_cookie_params([
  'lifetime' => 604800,
  'path'     => '/',
  'secure'   => $IS_HTTPS,
  'httponly' => true,
  'samesite' => 'Lax',
]);
session_start();

/* ───────────── database ───────────── */
function db() {
  static $pdo = null;
  if ($pdo === null) {
    $pdo = new PDO(
      'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
      DB_USER, DB_PASS,
      [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
      ]
    );
  }
  return $pdo;
}

/* ───────────── input & guard ───────────── */
function input() {
  $ct = $_SERVER['CONTENT_TYPE'] ?? '';
  if (stripos($ct, 'application/json') !== false) {
    $j = json_decode(file_get_contents('php://input'), true);
    return is_array($j) ? $j : [];
  }
  return $_POST;
}

function need_post() {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail('METHOD', 'Metode harus POST.', 405);
  }
  // Header kustom ini tidak bisa dikirim form dari situs lain (perlindungan CSRF)
  if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') {
    fail('CSRF', 'Permintaan ditolak.', 403);
  }
  $ct = $_SERVER['CONTENT_TYPE'] ?? '';
  if (stripos($ct, 'multipart/form-data') !== false
      && empty($_POST) && empty($_FILES)
      && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    fail('TOO_BIG', 'Total ukuran file terlalu besar untuk server. Kecilkan ukuran file lalu coba lagi.', 413);
  }
}

/* ───────────── pembatas percobaan ───────────── */
function throttle_key($bucket) {
  return hash('sha256', $bucket . '|' . ($_SERVER['REMOTE_ADDR'] ?? ''));
}
function throttle_check($bucket, $max, $window) {
  $st = db()->prepare('SELECT COUNT(*) FROM rate_limits WHERE k = ? AND t > ?');
  $st->execute([throttle_key($bucket), time() - $window]);
  if ((int)$st->fetchColumn() >= $max) {
    fail('RATE', 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.', 429);
  }
}
function throttle_hit($bucket) {
  db()->prepare('INSERT INTO rate_limits (k, t) VALUES (?, ?)')->execute([throttle_key($bucket), time()]);
  if (mt_rand(1, 50) === 1) {
    db()->prepare('DELETE FROM rate_limits WHERE t < ?')->execute([time() - 86400]);
  }
}

/* ───────────── user ───────────── */
function current_user() {
  static $cache = false;
  if ($cache !== false) { return $cache; }
  if (empty($_SESSION['uid'])) { $cache = null; return null; }
  $st = db()->prepare('SELECT id, name, email, school, level FROM users WHERE id = ?');
  $st->execute([(int)$_SESSION['uid']]);
  $row = $st->fetch();
  $cache = $row ? $row : null;
  return $cache;
}
function require_user() {
  $u = current_user();
  if (!$u) { fail('AUTH', 'Silakan login dulu.', 401); }
  return $u;
}
function public_user($u) {
  return ['name' => $u['name'], 'email' => $u['email'], 'school' => $u['school'], 'level' => $u['level']];
}
function require_admin() {
  if (empty($_SESSION['admin'])) { fail('ADMIN_ONLY', 'Login admin diperlukan.', 401); }
}

/* ───────────── aturan lomba (harus sama dengan pendaftaran.js) ───────────── */
function lombas() {
  $T = function ($total) { return ['min' => $total - 1, 'max' => $total - 1, 'total' => $total]; };
  return [
    'Mewarnai'      => ['price' => 20000,  'levels' => ['TK/RA'],   'team' => null,  'quota' => null],
    'Fashion Show'  => ['price' => 20000,  'levels' => ['TK/RA'],   'team' => null,  'quota' => null],
    'Tahfizh'       => ['price' => 20000,  'levels' => ['SD/MI'],   'team' => null,  'quota' => null],
    'Mendongeng'    => ['price' => 20000,  'levels' => ['SD/MI'],   'team' => null,  'quota' => null],
    'Vocal Solo'    => ['price' => 50000,  'levels' => ['SMP/MTs'], 'team' => null,  'quota' => 30,   'oneSchool' => true],
    'Story Telling' => ['price' => 20000,  'levels' => ['SMP/MTs'], 'team' => null,  'quota' => null],
    'Rangking 1'    => ['price' => 15000,  'levels' => ['SMP/MTs'], 'team' => null,  'quota' => null],
    'Volly'         => ['price' => 150000, 'levels' => ['SMA/MA'],  'team' => $T(10), 'quota' => 16,  'oneSchool' => true],
    'Badminton'     => ['price' => 90000,  'levels' => ['SMA/MA'],  'team' => null,  'quota' => 16,   'oneSchool' => true],
    'Syarhil'       => ['price' => 75000,  'levels' => ['SMA/MA'],  'team' => $T(3), 'quota' => null],
    'Essay'         => ['price' => 30000,  'levels' => ['SMA/MA'],  'team' => null,  'quota' => null, 'needAddress' => true],
    'E-Sport'       => ['price' => 100000, 'levels' => ['SMA/MA'],  'team' => $T(5), 'quota' => 32,  'oneSchool' => true],
    'Hitung Cepat'  => ['price' => 15000,  'levels' => ['SD/MI', 'SMP/MTs', 'SMA/MA'], 'team' => null, 'quota' => null],
    'Olimpiade'     => ['price' => 20000,  'levels' => ['SD/MI', 'SMP/MTs'],           'team' => null, 'quota' => null],
    'CC SD'         => ['price' => 75000,  'levels' => ['SD/MI'],   'team' => $T(3), 'quota' => 16,  'oneSchool' => true],
    'CC SMP'        => ['price' => 75000,  'levels' => ['SMP/MTs'], 'team' => $T(3), 'quota' => 16,  'oneSchool' => true],
    'CC SMA'        => ['price' => 75000,  'levels' => ['SMA/MA'],  'team' => $T(3), 'quota' => 16,  'oneSchool' => true],
    'Fotografi'     => ['price' => 30000,  'levels' => ['Umum'],    'team' => null,  'quota' => null],
  ];
}

function norm_school($s) {
  return trim(preg_replace('/[^a-z0-9]+/', ' ', strtolower((string)$s)));
}
function valid_phone($p) {
  $s = preg_replace('/[\s\-\(\)]/', '', (string)$p);
  return (bool)preg_match('/^(\+?62|0)8[1-9]\d{6,11}$/', $s);
}
function norm_phone($p) {
  $s = preg_replace('/[^\d+]/', '', (string)$p);
  $s = preg_replace('/^\+?62/', '0', $s);
  return $s;
}
function iso($dt) {
  if (!$dt) { return null; }
  $ts = strtotime($dt);
  return $ts ? date('c', $ts) : $dt;
}

/* ───────────── bentuk data yang dikirim ke browser ───────────── */
function reg_public($r) {
  $members = json_decode((string)$r['team_members'], true);
  return [
    'reg_code'     => $r['reg_code'],
    'email'        => $r['email'],
    'name'         => $r['name'],
    'school'       => $r['school'],
    'level'        => $r['level'],
    'lomba'        => $r['lomba'],
    'lomba_price'  => (int)$r['lomba_price'],
    'is_team'      => (int)$r['is_team'],
    'nisn'         => $r['nisn'],
    'phone'        => $r['phone'],
    'address'      => (string)$r['address'],
    'team_name'    => $r['team_name'],
    'team_members' => is_array($members) ? $members : [],
    'team_size'    => (int)$r['team_size'],
    'status'       => $r['status'],
    'created_at'   => iso($r['created_at']),
  ];
}

/* ═══════════════════════════════════════════════════════════
   AKUN
   ═══════════════════════════════════════════════════════════ */
function act_register() {
  need_post();
  throttle_check('register', 40, 3600);
  $d = input();
  $name   = trim((string)($d['name'] ?? ''));
  $email  = strtolower(trim((string)($d['email'] ?? '')));
  $pass   = (string)($d['password'] ?? '');
  $school = trim((string)($d['school'] ?? ''));
  $level  = (string)($d['level'] ?? '');

  if ($name === '' || $email === '' || $pass === '' || $school === '' || $level === '') {
    fail('VALIDATION', 'Semua kolom wajib diisi.');
  }
  if (mb_strlen($name) < 3 || mb_strlen($name) > 120) { fail('VALIDATION', 'Nama lengkap 3–120 karakter.'); }
  if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) { fail('VALIDATION', 'Format email tidak valid.'); }
  if (strlen($pass) < 6 || strlen($pass) > 200) { fail('VALIDATION', 'Password minimal 6 karakter.'); }
  if (mb_strlen($school) < 3 || mb_strlen($school) > 150) { fail('VALIDATION', 'Nama sekolah 3–150 karakter.'); }
  if (!in_array($level, LEVELS, true)) { fail('VALIDATION', 'Jenjang tidak valid.'); }

  try {
    db()->prepare('INSERT INTO users (name, email, password_hash, school, level, created_at) VALUES (?, ?, ?, ?, ?, ?)')
       ->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), $school, $level, date('Y-m-d H:i:s')]);
  } catch (PDOException $e) {
    if ((string)$e->getCode() === '23000') { fail('EMAIL', 'Email sudah terdaftar.', 409); }
    throw $e;
  }
  $id = (int)db()->lastInsertId();
  throttle_hit('register');

  session_regenerate_id(true);
  $_SESSION['uid'] = $id;
  out(['ok' => true, 'user' => ['name' => $name, 'email' => $email, 'school' => $school, 'level' => $level]]);
}

function act_login() {
  need_post();
  throttle_check('login', 15, 900);
  $d = input();
  $email = strtolower(trim((string)($d['email'] ?? '')));
  $pass  = (string)($d['password'] ?? '');
  if ($email === '' || $pass === '') { fail('VALIDATION', 'Email dan password wajib diisi.'); }

  $st = db()->prepare('SELECT * FROM users WHERE email = ?');
  $st->execute([$email]);
  $u = $st->fetch();
  if (!$u || !password_verify($pass, $u['password_hash'])) {
    throttle_hit('login');
    fail('AUTH', 'Email atau password salah.', 401);
  }
  session_regenerate_id(true);
  $_SESSION['uid'] = (int)$u['id'];
  out(['ok' => true, 'user' => public_user($u)]);
}

function act_logout() {
  need_post();
  unset($_SESSION['uid']);
  out(['ok' => true]);
}

function act_me() {
  $u = current_user();
  out(['user' => $u ? public_user($u) : null, 'admin' => !empty($_SESSION['admin'])]);
}

/* ═══════════════════════════════════════════════════════════
   PENDAFTARAN
   ═══════════════════════════════════════════════════════════ */

/* Untuk hitung kuota di browser. Data pribadi orang lain TIDAK dikirim. */
function act_registry() {
  $u = require_user();
  $rows = db()->query('SELECT * FROM registrations')->fetchAll();
  $all = [];
  foreach ($rows as $r) {
    if ((int)$r['user_id'] === (int)$u['id']) {
      $all[] = reg_public($r);
    } elseif ($r['status'] !== 'rejected') {
      $all[] = [
        'lomba'   => $r['lomba'],
        'school'  => $r['school'],
        'status'  => $r['status'],
        'email'   => '',
        'nisn'    => '',
        'is_team' => (int)$r['is_team'],
      ];
    }
  }
  out(['all' => $all]);
}

function take_file($key, $label, $allowPdf) {
  if (!isset($_FILES[$key])) { fail('FILE', $label . ' wajib diunggah.'); }
  $f = $_FILES[$key];
  if (is_array($f['error'])) { fail('FILE', $label . ': kiriman tidak valid.'); }
  if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) {
    fail('FILE', $label . ' terlalu besar untuk server (maks 15 MB).', 413);
  }
  if ($f['error'] !== UPLOAD_ERR_OK) { fail('FILE', $label . ' gagal diunggah. Coba lagi.'); }
  if ($f['size'] > MAX_FILE) { fail('FILE', $label . ' melebihi 15 MB.', 413); }
  if ($f['size'] < 1024)     { fail('FILE', $label . ' terlalu kecil / rusak.'); }
  if (!is_uploaded_file($f['tmp_name'])) { fail('FILE', $label . ': kiriman tidak valid.'); }

  $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
  if ($allowPdf) { $allowed['application/pdf'] = 'pdf'; }

  $fi   = new finfo(FILEINFO_MIME_TYPE);
  $mime = $fi->file($f['tmp_name']);
  if (!isset($allowed[$mime])) {
    fail('FILE', $label . ': format tidak didukung (' . ($allowPdf ? 'PDF/JPG/PNG' : 'JPG/PNG') . ').');
  }
  if ($mime !== 'application/pdf' && @getimagesize($f['tmp_name']) === false) {
    fail('FILE', $label . ': bukan gambar yang valid.');
  }

  $orig = preg_replace('/[^A-Za-z0-9._\- ]+/', '_', basename((string)$f['name']));
  $orig = substr($orig, 0, 150);
  if ($orig === '' || $orig === null) { $orig = $key . '.' . $allowed[$mime]; }

  return [
    'tmp'  => $f['tmp_name'],
    'mime' => $mime,
    'ext'  => $allowed[$mime],
    'name' => $orig,
    'hash' => hash_file('sha256', $f['tmp_name']),
  ];
}

function ensure_upload_dir() {
  $dir = UPLOAD_DIR;
  if (!is_dir($dir)) {
    if (!@mkdir($dir, 0750, true) && !is_dir($dir)) {
      throw new RuntimeException('Folder upload tidak bisa dibuat: ' . $dir);
    }
  }
  $ht = $dir . '/.htaccess';
  if (!file_exists($ht)) {
    @file_put_contents($ht, "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
  }
  if (!is_writable($dir)) { throw new RuntimeException('Folder upload tidak bisa ditulis: ' . $dir); }
  return $dir;
}

function check_rules($pdo, $u, $l, $lombaName, $nisn, $ref, $payHash) {
  // 1 akun = 1 lomba, kecuali Rangking 1 + Olimpiade
  $st = $pdo->prepare("SELECT lomba FROM registrations WHERE user_id = ? AND status <> 'rejected'");
  $st->execute([(int)$u['id']]);
  $mine = $st->fetchAll(PDO::FETCH_COLUMN);
  if (in_array($lombaName, $mine, true)) {
    return ['ALREADY', 'Kamu sudah terdaftar di lomba ' . $lombaName . '.'];
  }
  if (count($mine) > 0) {
    $ok = in_array($lombaName, MULTI_OK, true);
    foreach ($mine as $m) { if (!in_array($m, MULTI_OK, true)) { $ok = false; } }
    if (!$ok) {
      return ['ALREADY', 'Akun ini sudah terdaftar. Satu akun hanya bisa mendaftar satu lomba (kecuali Rangking 1 dan Olimpiade).'];
    }
  }

  // kuota & 1 sekolah 1 peserta/tim
  $st = $pdo->prepare("SELECT school FROM registrations WHERE lomba = ? AND status <> 'rejected'");
  $st->execute([$lombaName]);
  $schools = $st->fetchAll(PDO::FETCH_COLUMN);
  if ($l['quota'] !== null && count($schools) >= $l['quota']) {
    return ['FULL', 'Kuota ' . $lombaName . ' sudah penuh (' . $l['quota'] . '). Pendaftaran lomba ini ditutup.'];
  }
  if (!empty($l['oneSchool'])) {
    $mySchool = norm_school($u['school']);
    foreach ($schools as $s) {
      if (norm_school($s) === $mySchool) {
        $w = $l['team'] ? 'tim' : 'peserta';
        return ['SCHOOL', 'Sekolahmu sudah mendaftarkan ' . $w . ' di ' . $lombaName . '. Aturan: 1 sekolah 1 ' . $w . '.'];
      }
    }
  }

  // NISN unik (individu, bukan jenjang Umum)
  if ($l['team'] === null && $nisn !== '' && $u['level'] !== 'Umum') {
    $st = $pdo->prepare("SELECT 1 FROM registrations WHERE nisn = ? AND user_id <> ? AND status <> 'rejected' LIMIT 1");
    $st->execute([$nisn, (int)$u['id']]);
    if ($st->fetchColumn()) { return ['NISN', 'NISN ini sudah dipakai pada pendaftaran lain.']; }
  }

  // Anti bukti bayar ganda dari akun lain
  $st = $pdo->prepare("SELECT 1 FROM registrations WHERE LOWER(ref) = LOWER(?) AND user_id <> ? AND status <> 'rejected' LIMIT 1");
  $st->execute([$ref, (int)$u['id']]);
  if ($st->fetchColumn()) { return ['REF', 'Nomor referensi transaksi ini sudah dipakai pendaftar lain.']; }

  $st = $pdo->prepare("SELECT 1 FROM registrations WHERE pay_hash = ? AND user_id <> ? AND status <> 'rejected' LIMIT 1");
  $st->execute([$payHash, (int)$u['id']]);
  if ($st->fetchColumn()) { return ['PAYDUP', 'Bukti transfer ini sudah pernah dipakai pendaftar lain.']; }

  return null;
}

function act_submit() {
  need_post();
  $u = require_user();
  $d = $_POST;
  $L = lombas();

  $lombaName = trim((string)($d['lomba'] ?? ''));
  if (!isset($L[$lombaName]) || !in_array($u['level'], $L[$lombaName]['levels'], true)) {
    fail('LOMBA', 'Lomba tidak tersedia untuk jenjangmu.');
  }
  $l      = $L[$lombaName];
  $isTeam = ($l['team'] !== null);

  $phone = trim((string)($d['phone'] ?? ''));
  if (!valid_phone($phone)) { fail('PHONE', 'Nomor HP tidak valid (contoh: 081234567890).'); }

  $nisn = ''; $address = ''; $teamName = ''; $members = [];
  if ($isTeam) {
    $teamName = trim((string)($d['team_name'] ?? ''));
    if ($teamName === '' || mb_strlen($teamName) > 120) { fail('TEAM', 'Nama tim wajib diisi (maks 120 karakter).'); }
    $m = json_decode((string)($d['team_members'] ?? '[]'), true);
    if (!is_array($m)) { $m = []; }
    foreach ($m as $x) { $members[] = trim((string)$x); }
    if (count($members) !== $l['team']['min']) {
      fail('TEAM', 'Tim ' . $lombaName . ' harus berisi tepat ' . $l['team']['total'] . ' orang (ketua + ' . $l['team']['min'] . ' anggota).');
    }
    $lower = [];
    foreach ($members as $x) {
      if ($x === '' || mb_strlen($x) > 120) { fail('TEAM', 'Semua nama anggota wajib diisi (maks 120 karakter).'); }
      $lower[] = mb_strtolower($x);
    }
    if (count(array_unique($lower)) !== count($lower)) { fail('TEAM', 'Nama anggota tidak boleh sama.'); }
    if (in_array(mb_strtolower(trim($u['name'])), $lower, true)) { fail('TEAM', 'Nama ketua tidak perlu diulang di daftar anggota.'); }
  } else {
    $nisn = trim((string)($d['nisn'] ?? ''));
    if (!preg_match('/^\d{10}$/', $nisn)) { fail('NISN_FORMAT', 'NISN harus 10 digit angka.'); }
    if (!empty($l['needAddress'])) {
      $address = trim((string)($d['address'] ?? ''));
      if (mb_strlen($address) < 15) { fail('ADDRESS', 'Alamat rumah wajib diisi lengkap untuk pengiriman hadiah.'); }
      if (mb_strlen($address) > 300) { fail('ADDRESS', 'Alamat maksimal 300 karakter.'); }
    }
  }

  $sender = trim((string)($d['sender'] ?? ''));
  $ref    = trim((string)($d['ref'] ?? ''));
  if (mb_strlen($sender) < 3 || mb_strlen($sender) > 150) { fail('PAY', 'Nama pemilik rekening pengirim wajib diisi.'); }
  if (strlen($ref) < 6 || strlen($ref) > 100)             { fail('PAY', 'Nomor referensi transaksi minimal 6 karakter.'); }

  $files = [
    'surat' => take_file('surat', 'Surat rekomendasi', true),
    'ig1'   => take_file('ig1',   'Screenshot Instagram @icacehtimur', false),
    'ig2'   => take_file('ig2',   'Screenshot Instagram @icat.comic', false),
    'pay'   => take_file('pay',   'Bukti transfer', false),
  ];

  $dir = ensure_upload_dir();
  $pdo = db();

  // Kunci global: dua pendaftaran yang masuk bersamaan diproses satu per satu,
  // jadi kuota tidak bisa "kebobolan".
  $got = (int)$pdo->query("SELECT GET_LOCK('comic_submit', 15)")->fetchColumn();
  if ($got !== 1) { fail('BUSY', 'Server sedang sibuk. Coba kirim lagi.', 503); }

  $saved = [];
  try {
    $problem = check_rules($pdo, $u, $l, $lombaName, $nisn, $ref, $files['pay']['hash']);
    if ($problem) { fail($problem[0], $problem[1], 409); }

    // kode pendaftaran unik
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    do {
      $code = 'COMIC26-';
      for ($i = 0; $i < 6; $i++) { $code .= $alphabet[random_int(0, strlen($alphabet) - 1)]; }
      $st = $pdo->prepare('SELECT 1 FROM registrations WHERE reg_code = ?');
      $st->execute([$code]);
    } while ($st->fetchColumn());

    $stored = [];
    foreach (FILE_KEYS as $k) {
      $fname = bin2hex(random_bytes(16)) . '.' . $files[$k]['ext'];
      $path  = $dir . '/' . $fname;
      if (!move_uploaded_file($files[$k]['tmp'], $path)) {
        throw new RuntimeException('Gagal menyimpan berkas ' . $k);
      }
      @chmod($path, 0640);
      $saved[]     = $path;
      $stored[$k]  = $fname;
    }

    $pdo->prepare('INSERT INTO registrations
      (reg_code, user_id, email, name, school, level, lomba, lomba_price, is_team, nisn, phone, address,
       team_name, team_members, team_size,
       surat_file, surat_name, surat_type, ig1_file, ig1_name, ig1_type,
       ig2_file, ig2_name, ig2_type, pay_file, pay_name, pay_type, pay_hash,
       sender, ref, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?, ?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?)')
    ->execute([
      $code, (int)$u['id'], $u['email'], $u['name'], $u['school'], $u['level'], $lombaName, (int)$l['price'],
      $isTeam ? 1 : 0, $nisn, $phone, $address,
      $teamName, json_encode($members, JSON_UNESCAPED_UNICODE), count($members),
      $stored['surat'], $files['surat']['name'], $files['surat']['mime'],
      $stored['ig1'],   $files['ig1']['name'],   $files['ig1']['mime'],
      $stored['ig2'],   $files['ig2']['name'],   $files['ig2']['mime'],
      $stored['pay'],   $files['pay']['name'],   $files['pay']['mime'], $files['pay']['hash'],
      $sender, $ref, 'pending', date('Y-m-d H:i:s'),
    ]);
  } catch (Throwable $e) {
    foreach ($saved as $p) { @unlink($p); }
    $pdo->query("SELECT RELEASE_LOCK('comic_submit')");
    throw $e;
  }
  $pdo->query("SELECT RELEASE_LOCK('comic_submit')");

  $st = $pdo->prepare('SELECT * FROM registrations WHERE reg_code = ?');
  $st->execute([$code]);
  out(['ok' => true, 'reg_code' => $code, 'registration' => reg_public($st->fetch())]);
}

/* ═══════════════════════════════════════════════════════════
   ADMIN
   ═══════════════════════════════════════════════════════════ */
function act_admin_login() {
  need_post();
  if (strlen(ADMIN_PASSWORD) < 10 || strpos(ADMIN_PASSWORD, 'GANTI_') === 0) {
    fail('CONFIG', 'Password admin di api/config.php belum diatur (minimal 10 karakter).', 500);
  }
  throttle_check('admin', 6, 900);
  $d = input();
  $p = (string)($d['password'] ?? '');
  if (!hash_equals(ADMIN_PASSWORD, $p)) {
    throttle_hit('admin');
    fail('AUTH', 'Password salah.', 401);
  }
  session_regenerate_id(true);
  $_SESSION['admin'] = true;
  out(['ok' => true]);
}

function act_admin_logout() {
  need_post();
  unset($_SESSION['admin']);
  out(['ok' => true]);
}

function act_admin_list() {
  require_admin();
  $rows = db()->query('SELECT * FROM registrations ORDER BY id DESC')->fetchAll();

  // Indeks untuk mendeteksi data mencurigakan (dipakai orang BERBEDA)
  $idx = ['nisn' => [], 'phone' => [], 'ref' => [], 'hash' => []];
  foreach ($rows as $r) {
    if ($r['status'] === 'rejected') { continue; }
    $who = ['code' => $r['reg_code'], 'uid' => (int)$r['user_id']];
    if ($r['nisn'] !== '')  { $idx['nisn'][$r['nisn']][] = $who; }
    $pn = norm_phone($r['phone']);
    if ($pn !== '')         { $idx['phone'][$pn][] = $who; }
    $idx['ref'][strtolower($r['ref'])][] = $who;
    $idx['hash'][$r['pay_hash']][] = $who;
  }
  $others = function ($list, $r) {
    $o = [];
    foreach ($list as $w) { if ($w['uid'] !== (int)$r['user_id']) { $o[] = $w['code']; } }
    return $o;
  };

  $data = [];
  foreach ($rows as $r) {
    $flags = [];
    if ($r['status'] !== 'rejected') {
      $x = $others($idx['nisn'][$r['nisn']] ?? [], $r);                       if ($x) { $flags[] = 'NISN sama dengan ' . implode(', ', $x); }
      $x = $others($idx['phone'][norm_phone($r['phone'])] ?? [], $r);         if ($x) { $flags[] = 'No. HP sama dengan ' . implode(', ', $x); }
      $x = $others($idx['ref'][strtolower($r['ref'])] ?? [], $r);             if ($x) { $flags[] = 'No. referensi bayar sama dengan ' . implode(', ', $x); }
      $x = $others($idx['hash'][$r['pay_hash']] ?? [], $r);                   if ($x) { $flags[] = 'Foto bukti bayar identik dengan ' . implode(', ', $x); }
    }
    $row = reg_public($r);
    $row['id']     = (int)$r['id'];
    $row['sender'] = $r['sender'];
    $row['ref']    = $r['ref'];
    $row['flags']  = $flags;
    $row['files']  = [];
    foreach (FILE_KEYS as $k) {
      $row['files'][$k] = ['name' => $r[$k . '_name'], 'type' => $r[$k . '_type']];
    }
    $data[] = $row;
  }
  out(['rows' => $data]);
}

function act_admin_users() {
  require_admin();
  $rows = db()->query("SELECT u.id, u.name, u.email, u.school, u.level, u.created_at,
      (SELECT COUNT(*) FROM registrations r WHERE r.user_id = u.id AND r.status <> 'rejected') AS reg_count
      FROM users u ORDER BY u.id DESC")->fetchAll();
  foreach ($rows as &$r) {
    $r['id'] = (int)$r['id'];
    $r['reg_count'] = (int)$r['reg_count'];
    $r['created_at'] = iso($r['created_at']);
  }
  unset($r);
  out(['users' => $rows]);
}

function act_admin_status() {
  need_post();
  require_admin();
  $d = input();
  $id = (int)($d['id'] ?? 0);
  $status = (string)($d['status'] ?? '');
  if ($id <= 0 || !in_array($status, ['pending', 'verified', 'rejected'], true)) { fail('VALIDATION', 'Data tidak valid.'); }
  $verifiedAt = ($status === 'verified') ? date('Y-m-d H:i:s') : null;
  $st = db()->prepare('UPDATE registrations SET status = ?, verified_at = ? WHERE id = ?');
  $st->execute([$status, $verifiedAt, $id]);
  out(['ok' => true]);
}

function act_admin_delete_all() {
  need_post();
  require_admin();
  $d = input();
  if (($d['confirm'] ?? '') !== 'HAPUS') { fail('VALIDATION', 'Konfirmasi tidak valid.'); }
  $rows = db()->query('SELECT surat_file, ig1_file, ig2_file, pay_file FROM registrations')->fetchAll();
  db()->exec('DELETE FROM registrations');
  foreach ($rows as $r) {
    foreach (['surat_file', 'ig1_file', 'ig2_file', 'pay_file'] as $c) {
      $p = UPLOAD_DIR . '/' . basename($r[$c]);
      if (is_file($p)) { @unlink($p); }
    }
  }
  out(['ok' => true]);
}

/* Berkas upload hanya bisa dibuka admin */
function act_file() {
  require_admin();
  $id = (int)($_GET['id'] ?? 0);
  $k  = (string)($_GET['k'] ?? '');
  if (!in_array($k, FILE_KEYS, true)) { fail('NOT_FOUND', 'Berkas tidak ada.', 404); }
  $st = db()->prepare('SELECT ' . $k . '_file AS f, ' . $k . '_type AS t, ' . $k . '_name AS n FROM registrations WHERE id = ?');
  $st->execute([$id]);
  $r = $st->fetch();
  if (!$r) { fail('NOT_FOUND', 'Berkas tidak ada.', 404); }
  $path = UPLOAD_DIR . '/' . basename($r['f']);
  if (!is_file($path)) { fail('NOT_FOUND', 'Berkas hilang dari server.', 404); }

  header_remove('Content-Type');
  header('Content-Type: ' . $r['t']);
  header('Content-Length: ' . filesize($path));
  header('Content-Disposition: inline; filename="' . preg_replace('/[^A-Za-z0-9._-]+/', '_', $r['n']) . '"');
  header('Cache-Control: private, max-age=3600');
  readfile($path);
  exit;
}

function csv_safe($v) {
  $s = (string)$v;
  if ($s !== '' && strpos("=+-@\t\r", $s[0]) !== false) { return "'" . $s; }
  return $s;
}

function act_admin_export() {
  require_admin();
  $rows = db()->query('SELECT * FROM registrations ORDER BY id ASC')->fetchAll();
  header_remove('Content-Type');
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="comic2026-pendaftar-' . date('Ymd-His') . '.csv"');
  echo "\xEF\xBB\xBF";
  $o = fopen('php://output', 'w');
  $head = ['Kode', 'Tanggal', 'Status', 'Nama/Ketua', 'Email', 'Sekolah', 'Jenjang', 'Lomba', 'Tipe', 'Biaya',
           'NISN', 'No HP', 'Alamat', 'Nama Tim', 'Anggota', 'Pengirim Transfer', 'No Referensi'];
  fputcsv($o, $head, ',', '"', '\\');
  foreach ($rows as $r) {
    $members = json_decode((string)$r['team_members'], true);
    $line = [
      $r['reg_code'], $r['created_at'], $r['status'], $r['name'], $r['email'], $r['school'], $r['level'],
      $r['lomba'], $r['is_team'] ? 'TIM' : 'INDIVIDU', $r['lomba_price'],
      $r['nisn'], $r['phone'], $r['address'], $r['team_name'],
      is_array($members) ? implode('; ', $members) : '',
      $r['sender'], $r['ref'],
    ];
    fputcsv($o, array_map('csv_safe', $line), ',', '"', '\\');
  }
  fclose($o);
  exit;
}

/* ───────────── router ───────────── */
$routes = [
  'register'         => 'act_register',
  'login'            => 'act_login',
  'logout'           => 'act_logout',
  'me'               => 'act_me',
  'registry'         => 'act_registry',
  'submit'           => 'act_submit',
  'admin_login'      => 'act_admin_login',
  'admin_logout'     => 'act_admin_logout',
  'admin_list'       => 'act_admin_list',
  'admin_users'      => 'act_admin_users',
  'admin_status'     => 'act_admin_status',
  'admin_delete_all' => 'act_admin_delete_all',
  'admin_export'     => 'act_admin_export',
  'file'             => 'act_file',
];
$action = (string)($_GET['action'] ?? '');
if (!isset($routes[$action])) { fail('NOT_FOUND', 'Aksi tidak dikenal.', 404); }
call_user_func($routes[$action]);
