<?php
declare(strict_types=1);

function config(): array {
    return require __DIR__ . '/config.php';
}

// ── DB pentru remember tokens ────────────────────────────────────────────────
function auth_db(): SQLite3 {
    static $db = null;
    if ($db === null) {
        $db = new SQLite3(__DIR__ . '/../data/blog.sqlite');
        $db->busyTimeout(3000);
        $db->exec("CREATE TABLE IF NOT EXISTS remember_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            expires_at TEXT NOT NULL
        )");
    }
    return $db;
}

// ── Sesiune ──────────────────────────────────────────────────────────────────
function ensure_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        ini_set('session.gc_maxlifetime', '86400');
        session_set_cookie_params(86400);
        session_start();
    }
}

// ── Remember me ──────────────────────────────────────────────────────────────
const REMEMBER_COOKIE   = 'admin_rm';
const REMEMBER_DAYS     = 30;

function set_remember_cookie(): void {
    $token      = bin2hex(random_bytes(32));
    $token_hash = hash('sha256', $token);
    $expires_at = date('Y-m-d H:i:s', time() + REMEMBER_DAYS * 86400);

    $db   = auth_db();
    // Curăță tokeni expirați
    $db->exec("DELETE FROM remember_tokens WHERE expires_at < datetime('now')");
    $stmt = $db->prepare("INSERT INTO remember_tokens (token_hash, expires_at) VALUES (:h, :e)");
    $stmt->bindValue(':h', $token_hash);
    $stmt->bindValue(':e', $expires_at);
    $stmt->execute();

    setcookie(REMEMBER_COOKIE, $token, [
        'expires'  => time() + REMEMBER_DAYS * 86400,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_remember_cookie(): void {
    $token = $_COOKIE[REMEMBER_COOKIE] ?? '';
    if ($token) {
        $hash = hash('sha256', $token);
        $stmt = auth_db()->prepare("DELETE FROM remember_tokens WHERE token_hash = :h");
        $stmt->bindValue(':h', $hash);
        $stmt->execute();
    }
    setcookie(REMEMBER_COOKIE, '', time() - 3600, '/');
}

function try_remember_login(): bool {
    $token = $_COOKIE[REMEMBER_COOKIE] ?? '';
    if (!$token) return false;

    $hash = hash('sha256', $token);
    $stmt = auth_db()->prepare(
        "SELECT id FROM remember_tokens WHERE token_hash = :h AND expires_at > datetime('now')"
    );
    $stmt->bindValue(':h', $hash);
    $row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);

    if (!$row) {
        setcookie(REMEMBER_COOKIE, '', time() - 3600, '/');
        return false;
    }

    // Token valid — restaurează sesiunea și rotește tokenul
    ensure_session();
    session_regenerate_id(true);
    $_SESSION['admin_logged_in']    = true;
    $_SESSION['admin_logged_in_at'] = time();

    // Rotire token (șterge vechiul, emite unul nou)
    $del = auth_db()->prepare("DELETE FROM remember_tokens WHERE id = :id");
    $del->bindValue(':id', $row['id']);
    $del->execute();
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
        $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf(string $token): bool {
    ensure_session();
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}
