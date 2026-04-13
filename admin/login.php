<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';

$redirect = $_GET['redirect'] ?? ($_POST['redirect'] ?? '/admin/');
if (!is_string($redirect) || $redirect === '' || $redirect[0] !== '/') {
    $redirect = '/admin/';
}

ensure_session();

// ── Deja logat complet ────────────────────────────────────────────────────────
if (!empty($_SESSION['admin_logged_in'])) {
    header('Location: ' . $redirect);
    exit;
}

$error = '';
$step  = 1; // 1 = parolă, 2 = TOTP

// ── Determină pasul curent ────────────────────────────────────────────────────
if (!empty($_SESSION['2fa_pending'])) {
    $step = 2;
} elseif (is_2fa_setup() && verify_remember_cookie()) {
    // Remember-me valid + 2FA activ → sari parola, cere TOTP direct
    session_regenerate_id(true);
    $_SESSION['2fa_pending']  = true;
    $_SESSION['2fa_attempts'] = 0;
    $step = 2;
}

// ── Token login (URL) ─────────────────────────────────────────────────────────
if ($step === 1 && isset($_GET['token']) && $_GET['token'] !== '') {
    if (force_login_with_token($_GET['token'])) {
        if (is_2fa_setup()) {
            // Avansează la pasul 2
            $q = http_build_query(['redirect' => $redirect]);
            header('Location: /admin/login.php?' . $q);
            exit;
        }
        header('Location: ' . $redirect);
        exit;
    }
    $error = 'Token invalid.';
}

// ── POST handler ──────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    if ($step === 1) {
        // --- Pasul 1: verificare parolă ---
        $password = $_POST['password'] ?? '';
        if (login_with_password($password)) {
            if (is_2fa_setup()) {
                $q = http_build_query(['redirect' => $redirect]);
                header('Location: /admin/login.php?' . $q);
                exit;
            }
            header('Location: ' . $redirect);
            exit;
        }
        $error = 'Parola incorecta.';

    } elseif ($step === 2) {
        // --- Pasul 2: verificare TOTP ---

        // Rata de încercări: max 5, după care resetăm la pasul 1
        $attempts = (int)($_SESSION['2fa_attempts'] ?? 0);
        if ($attempts >= 5) {
            unset($_SESSION['2fa_pending'], $_SESSION['2fa_attempts']);
            $step  = 1;
            $error = 'Prea multe incercari. Te rugam sa te autentifici din nou.';
        } else {
            $code = trim($_POST['totp_code'] ?? '');
            $_SESSION['2fa_attempts'] = $attempts + 1;

            $ok = totp_verify($code) || totp_verify_backup_code($code);

            if ($ok) {
                complete_2fa_login();
                header('Location: ' . $redirect);
                exit;
            }
            $error = 'Cod invalid. Mai ai ' . (4 - $attempts) . ' incercari.';
        }
    }
}

$version = 'login-v5-2fa';
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin Login</title>
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Crimson Pro", serif; background: #FFFDF7; color: #1c1c1c; }
    .wrap { max-width: 520px; margin: 80px auto; padding: 24px; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 16px; padding: 24px; }
    h1 { margin-top: 0; }
    input[type=password],
    input[type=text] { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #d9d0c2; font-size: 16px; box-sizing: border-box; }
    button { margin-top: 14px; min-height: 28px; background: #d7c2a5; color: #3f2d1b; border: 1px solid rgba(143,111,74,0.18); border-radius: 999px; padding: 5px 12px; font-size: 15px; font-family: "Crimson Pro", serif; font-weight: 600; letter-spacing: 0.01em; text-transform: lowercase; cursor: pointer; }
    .err { background: #fdecec; border: 1px solid #f3caca; padding: 10px 12px; border-radius: 8px; margin-bottom: 10px; }
    .hint { margin-top: 10px; font-size: 14px; color: #8a847a; }
    .ver { margin-top: 10px; font-size: 12px; color: #8a847a; }
    .back { display: inline-block; margin-top: 12px; font-size: 14px; color: #8a847a; text-decoration: none; }
    .back:hover { color: #3f2d1b; }
  </style>
</head>
<body class="admin">
  <div class="wrap">
    <div class="card">

      <?php if ($step === 1): ?>

        <h1>Admin</h1>
        <?php if ($error): ?>
          <div class="err"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
        <?php endif; ?>
        <form method="post">
          <input type="hidden" name="redirect" value="<?= htmlspecialchars($redirect, ENT_QUOTES, 'UTF-8') ?>">
          <label for="password">Parola</label>
          <input type="password" id="password" name="password" required autofocus>
          <button type="submit">Intra</button>
        </form>

      <?php else: ?>

        <h1>Autentificare in doi pasi</h1>
        <?php if ($error): ?>
          <div class="err"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
        <?php endif; ?>
        <p class="hint">Introdu codul de 6 cifre din aplicatia Authenticator<br>sau un cod de backup.</p>
        <form method="post">
          <input type="hidden" name="redirect" value="<?= htmlspecialchars($redirect, ENT_QUOTES, 'UTF-8') ?>">
          <label for="totp_code">Cod</label>
          <input type="text" id="totp_code" name="totp_code"
                 inputmode="numeric" pattern="\d{6}|[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}"
                 maxlength="9" autocomplete="one-time-code" required autofocus>
          <button type="submit">Verifica</button>
        </form>
        <a href="/admin/login.php" class="back">← Inapoi la parola</a>

      <?php endif; ?>

      <div class="ver"><?= $version ?></div>
    </div>
  </div>
</body>
</html>
