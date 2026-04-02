<?php
declare(strict_types=1);

function config(): array {
    return require __DIR__ . '/config.php';
}

function ensure_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        $lifetime = 60 * 60 * 24 * 30; // 30 zile
        ini_set('session.gc_maxlifetime', (string)$lifetime);
        session_set_cookie_params($lifetime);
        session_start();
    }
}

function is_logged_in(): bool {
    ensure_session();
    return !empty($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
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
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['admin_logged_in_at'] = time();
    return true;
}

function login_with_password(string $password): bool {
    if (!verify_password($password)) {
        return false;
    }
    ensure_session();
    session_regenerate_id(true);
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['admin_logged_in_at'] = time();
    return true;
}

function logout_admin(): void {
    ensure_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
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
