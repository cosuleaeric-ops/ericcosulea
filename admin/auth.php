<?php
declare(strict_types=1);

function config(): array {
    return require __DIR__ . '/config.php';
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
    session_regenerate_id(true);
    $_SESSION['admin_logged_in']    = true;
    $_SESSION['admin_logged_in_at'] = time();
    set_remember_cookie();
    return true;
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
