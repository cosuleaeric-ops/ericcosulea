<?php
declare(strict_types=1);

function config(): array {
    return require __DIR__ . '/config.php';
}

// ── TOTP / 2FA ────────────────────────────────────────────────────────────────

const TOTP_SECRET_FILE  = __DIR__ . '/../data/totp_secret.txt';
const TOTP_LASTUSE_FILE = __DIR__ . '/../data/totp_lastused.txt';
const BACKUP_CODES_FILE = __DIR__ . '/../data/totp_backup_codes.json';

function is_2fa_setup(): bool {
    return file_exists(TOTP_SECRET_FILE) && trim((string)file_get_contents(TOTP_SECRET_FILE)) !== '';
}

function get_totp_secret(): string {
    if (!file_exists(TOTP_SECRET_FILE)) return '';
    return trim((string)file_get_contents(TOTP_SECRET_FILE));
}

function save_totp_secret(string $secret): void {
    file_put_contents(TOTP_SECRET_FILE, $secret, LOCK_EX);
    @chmod(TOTP_SECRET_FILE, 0600);
}

function totp_base32_decode(string $base32): string {
    $alpha  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $base32 = strtoupper(preg_replace('/[\s=]/', '', $base32) ?? '');
    $bits   = '';
    foreach (str_split($base32) as $char) {
        $pos = strpos($alpha, $char);
        if ($pos === false) continue;
        $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 8) as $chunk) {
        if (strlen($chunk) === 8) $out .= chr((int)bindec($chunk));
    }
    return $out;
}

function totp_base32_encode(string $bytes): string {
    $alpha  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits   = '';
    for ($i = 0, $len = strlen($bytes); $i < $len; $i++) {
        $bits .= str_pad(decbin(ord($bytes[$i])), 8, '0', STR_PAD_LEFT);
    }
    $padded = str_pad($bits, (int)(ceil(strlen($bits) / 5) * 5), '0');
    $out    = '';
    foreach (str_split($padded, 5) as $chunk) {
        $out .= $alpha[(int)bindec($chunk)];
    }
    return $out;
}

function totp_generate_secret(): string {
    return totp_base32_encode(random_bytes(20)); // 160-bit → 32 char base32
}

function totp_compute(string $secret, int $counter): string {
    $key    = totp_base32_decode($secret);
    $msg    = pack('N*', 0) . pack('N*', $counter); // 8-byte big-endian counter
    $hash   = hash_hmac('sha1', $msg, $key, true);
    $offset = ord($hash[19]) & 0x0F;
    $code   = (
        ((ord($hash[$offset])     & 0x7F) << 24) |
        ((ord($hash[$offset + 1]) & 0xFF) << 16) |
        ((ord($hash[$offset + 2]) & 0xFF) <<  8) |
        ( ord($hash[$offset + 3]) & 0xFF)
    ) % 1_000_000;
    return str_pad((string)$code, 6, '0', STR_PAD_LEFT);
}

// Verifică codul TOTP (±1 interval = 30s toleranță clock drift) cu anti-replay.
function totp_verify(string $code): bool {
    $secret = get_totp_secret();
    if ($secret === '') return false;

    $code = preg_replace('/\s+/', '', $code) ?? '';
    if (!preg_match('/^\d{6}$/', $code)) return false;

    $t       = (int)floor(time() / 30);
    $lastUsed = file_exists(TOTP_LASTUSE_FILE)
        ? (int)trim((string)file_get_contents(TOTP_LASTUSE_FILE))
        : 0;

    for ($i = -1; $i <= 1; $i++) {
        $counter = $t + $i;
        if ($counter <= $lastUsed) continue; // anti-replay
        if (hash_equals(totp_compute($secret, $counter), $code)) {
            file_put_contents(TOTP_LASTUSE_FILE, (string)$counter, LOCK_EX);
            return true;
        }
    }
    return false;
}

// Generează 8 coduri de backup unice și salvează hash-urile bcrypt.
// Returnează codurile în clar (afișate o singură dată).
function totp_generate_backup_codes(): array {
    $plain  = [];
    $hashed = [];
    for ($i = 0; $i < 8; $i++) {
        $raw    = strtoupper(bin2hex(random_bytes(4))); // 8 hex chars
        $fmt    = substr($raw, 0, 4) . '-' . substr($raw, 4, 4);
        $plain[]  = $fmt;
        $hashed[] = password_hash($raw, PASSWORD_BCRYPT);
    }
    file_put_contents(BACKUP_CODES_FILE, json_encode($hashed, JSON_PRETTY_PRINT), LOCK_EX);
    @chmod(BACKUP_CODES_FILE, 0600);
    return $plain;
}

// Verifică și invalidează un cod de backup (one-time use).
function totp_verify_backup_code(string $input): bool {
    if (!file_exists(BACKUP_CODES_FILE)) return false;

    // Normalizare: acceptă XXXX-XXXX și XXXXXXXX
    $raw = strtoupper(preg_replace('/[\s\-]/', '', $input) ?? '');
    if (!preg_match('/^[0-9A-F]{8}$/', $raw)) return false;

    $hashes = json_decode((string)file_get_contents(BACKUP_CODES_FILE), true);
    if (!is_array($hashes)) return false;

    foreach ($hashes as $i => $hash) {
        if (password_verify($raw, (string)$hash)) {
            unset($hashes[$i]);
            file_put_contents(BACKUP_CODES_FILE, json_encode(array_values($hashes), JSON_PRETTY_PRINT), LOCK_EX);
            return true;
        }
    }
    return false;
}

// ── Cheie secretă derivată din parola bcrypt ─────────────────────────────────
// Dacă parola se schimbă, toate tokenele existente devin automat invalide.
function token_key(): string {
    $cfg = config();
    return hash_hmac('sha256', $cfg['password_bcrypt'], 'admin_rm_v1');
}

// ── Remember-me cookie (token HMAC semnat, fără DB) ──────────────────────────
const REMEMBER_COOKIE = 'admin_rm';
const REMEMBER_DAYS   = 30;

function set_remember_cookie(): void {
    $exp     = time() + REMEMBER_DAYS * 86400;
    $payload = base64_encode((string)$exp);
    $sig     = hash_hmac('sha256', $payload, token_key());
    $value   = $payload . '.' . $sig;

    setcookie(REMEMBER_COOKIE, $value, [
        'expires'  => $exp,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_remember_cookie(): void {
    setcookie(REMEMBER_COOKIE, '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function verify_remember_cookie(): bool {
    $raw = $_COOKIE[REMEMBER_COOKIE] ?? '';
    if (!$raw) return false;

    $parts = explode('.', $raw, 2);
    if (count($parts) !== 2) return false;

    [$payload, $sig] = $parts;

    // Verifică semnătura
    $expected = hash_hmac('sha256', $payload, token_key());
    if (!hash_equals($expected, $sig)) return false;

    // Verifică expiry
    $exp = (int)base64_decode($payload);
    return $exp > time();
}

// ── Sesiune ──────────────────────────────────────────────────────────────────
function ensure_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        ini_set('session.gc_maxlifetime', '86400');
        session_set_cookie_params(86400);
        session_start();
    }
}

function try_remember_login(): bool {
    if (!verify_remember_cookie()) return false;

    // Cu 2FA activ, remember-me nu acordă login complet — userul trebuie
    // să confirme cu codul TOTP. Login.php va prelua fluxul.
    if (is_2fa_setup()) return false;

    ensure_session();
    session_regenerate_id(true);
    $_SESSION['admin_logged_in']    = true;
    $_SESSION['admin_logged_in_at'] = time();

    // Reîmprospătează cookie-ul (extinde expiry)
    set_remember_cookie();
    return true;
}

// ── API public ───────────────────────────────────────────────────────────────
function is_logged_in(): bool {
    ensure_session();
    if (!empty($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
        return true;
    }
    return try_remember_login();
}

function require_login(): void {
    if (!is_logged_in()) {
        header('Location: /admin/login.php');
        exit;
    }
}

function verify_password(string $password): bool {
    $cfg = config();
    return password_verify($password, $cfg['password_bcrypt']);
}

function force_login_with_token(string $token): bool {
    $cfg = config();
    if (!password_verify($token, $cfg['password_bcrypt'])) {
        return false;
    }
    ensure_session();
    if (is_2fa_setup()) {
        session_regenerate_id(true);
        $_SESSION['2fa_pending']    = true;
        $_SESSION['2fa_attempts']   = 0;
        return true; // Parola OK — mai trebuie codul TOTP
    }
    session_regenerate_id(true);
    $_SESSION['admin_logged_in']    = true;
    $_SESSION['admin_logged_in_at'] = time();
    set_remember_cookie();
    return true;
}

function login_with_password(string $password): bool {
    if (!verify_password($password)) {
        return false;
    }
    ensure_session();
    if (is_2fa_setup()) {
        session_regenerate_id(true);
        $_SESSION['2fa_pending']    = true;
        $_SESSION['2fa_attempts']   = 0;
        return true; // Parola OK — mai trebuie codul TOTP
    }
    session_regenerate_id(true);
    $_SESSION['admin_logged_in']    = true;
    $_SESSION['admin_logged_in_at'] = time();
    set_remember_cookie();
    return true;
}

// Finalizează loginul după verificarea cu succes a codului TOTP.
function complete_2fa_login(): void {
    ensure_session();
    unset($_SESSION['2fa_pending'], $_SESSION['2fa_attempts']);
    session_regenerate_id(true);
    $_SESSION['admin_logged_in']    = true;
    $_SESSION['admin_logged_in_at'] = time();
    set_remember_cookie();
}

function logout_admin(): void {
    clear_remember_cookie();
    ensure_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

function csrf_token(): string {
    ensure_session();
    if (empty($_SESSION['csrf_token'])) {
        $rm = $_COOKIE[REMEMBER_COOKIE] ?? '';
        // Dacă există remember cookie, derivăm CSRF din el — rămâne consistent
        // chiar dacă sesiunea moare și e restaurată (token-ul JS continuă să fie valid)
        $_SESSION['csrf_token'] = $rm
            ? substr(hash_hmac('sha256', $rm, 'csrf_v1'), 0, 32)
            : bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf(string $token): bool {
    ensure_session();
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}
