<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';

// ── Acces ─────────────────────────────────────────────────────────────────────
// Dacă 2FA e deja configurat → trebuie login complet (parolă + TOTP).
// Dacă 2FA nu e configurat    → trebuie doar parola (chicken-and-egg).

$already_setup = is_2fa_setup();

if ($already_setup && empty($_SESSION['admin_logged_in'] ?? false)) {
    ensure_session();
    if (empty($_SESSION['admin_logged_in'])) {
        header('Location: /admin/login.php?redirect=' . urlencode('/admin/setup-2fa.php'));
        exit;
    }
}

// Dacă 2FA nu e configurat, verificăm parola local înainte de a arăta secretul
$password_ok = !$already_setup && !empty($_SESSION['setup_password_ok']);

if (!$already_setup && !$password_ok) {
    ensure_session();
    $pw_error = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['unlock_password'])) {
        if (verify_password($_POST['unlock_password'] ?? '')) {
            $_SESSION['setup_password_ok'] = true;
            header('Location: /admin/setup-2fa.php');
            exit;
        }
        $pw_error = 'Parola incorecta.';
    }
    ?>
    <!doctype html>
    <html lang="ro">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Setup 2FA</title>
      <link rel="icon" type="image/png" href="/assets/Logo3.png">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: "Crimson Pro", serif; background: #FFFDF7; color: #1c1c1c; }
        .wrap { max-width: 520px; margin: 80px auto; padding: 24px; }
        .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 16px; padding: 24px; }
        h1 { margin-top: 0; }
        input[type=password] { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #d9d0c2; font-size: 16px; box-sizing: border-box; }
        button { margin-top: 14px; background: #d7c2a5; color: #3f2d1b; border: 1px solid rgba(143,111,74,0.18); border-radius: 999px; padding: 5px 12px; font-size: 15px; font-family: "Crimson Pro", serif; font-weight: 600; cursor: pointer; }
        .err { background: #fdecec; border: 1px solid #f3caca; padding: 10px 12px; border-radius: 8px; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="wrap"><div class="card">
        <h1>Configurare 2FA</h1>
        <p>Introdu parola pentru a continua.</p>
        <?php if ($pw_error): ?>
          <div class="err"><?= htmlspecialchars($pw_error, ENT_QUOTES, 'UTF-8') ?></div>
        <?php endif; ?>
        <form method="post">
          <input type="password" name="unlock_password" required autofocus placeholder="Parola admin">
          <button type="submit">Continua</button>
        </form>
      </div></div>
    </body>
    </html>
    <?php
    exit;
}

// ── Stare sesiune pentru setup ────────────────────────────────────────────────
ensure_session();

$new_secret     = null;
$backup_codes   = null;
$verify_error   = '';
$setup_done     = false;
$regen_done     = false;

// Generăm un secret temporar în sesiune (dacă nu există deja)
if (!isset($_SESSION['setup_secret'])) {
    $_SESSION['setup_secret'] = totp_generate_secret();
}
$temp_secret = $_SESSION['setup_secret'];

// ── POST handlers ─────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // --- Confirmare setup inițial ---
    if (isset($_POST['action']) && $_POST['action'] === 'confirm_setup') {
        $code = trim($_POST['verify_code'] ?? '');

        // Verificăm codul față de secretul temporar
        $t = (int)floor(time() / 30);
        $valid = false;
        for ($i = -1; $i <= 1; $i++) {
            if (hash_equals(totp_compute($temp_secret, $t + $i), $code)) {
                $valid = true;
                break;
            }
        }

        if (!$valid || !preg_match('/^\d{6}$/', $code)) {
            $verify_error = 'Cod incorect. Verifica ora dispozitivului si incearca din nou.';
        } else {
            // Salvăm secretul și generăm codurile de backup
            save_totp_secret($temp_secret);
            $backup_codes = totp_generate_backup_codes();
            unset($_SESSION['setup_secret'], $_SESSION['setup_password_ok']);
            $setup_done = true;
        }
    }

    // --- Regenerare coduri de backup ---
    if (isset($_POST['action']) && $_POST['action'] === 'regen_backup' && $already_setup) {
        $backup_codes = totp_generate_backup_codes();
        $regen_done   = true;
    }
}

// URI pentru QR code (generat client-side)
$issuer   = 'ericcosulea.ro';
$account  = 'admin';
$otp_uri  = 'otpauth://totp/' . rawurlencode($issuer . ':' . $account)
          . '?secret=' . $temp_secret
          . '&issuer=' . rawurlencode($issuer)
          . '&algorithm=SHA1&digits=6&period=30';
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Setup 2FA</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Crimson Pro", serif; background: #FFFDF7; color: #1c1c1c; margin: 0; }
    .wrap { max-width: 560px; margin: 60px auto; padding: 24px; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 16px; padding: 28px; }
    h1 { margin-top: 0; font-size: 24px; }
    h2 { font-size: 18px; margin-top: 28px; border-top: 1px solid #efe6d6; padding-top: 20px; }
    p { line-height: 1.6; }
    .secret-box { font-family: monospace; font-size: 18px; letter-spacing: 0.08em; background: #f5f0e8; border: 1px solid #d9d0c2; border-radius: 10px; padding: 12px 16px; display: inline-block; word-break: break-all; }
    #qr-canvas { margin: 16px 0; display: block; }
    input[type=text], input[type=password] { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #d9d0c2; font-size: 16px; }
    button { margin-top: 12px; background: #d7c2a5; color: #3f2d1b; border: 1px solid rgba(143,111,74,0.18); border-radius: 999px; padding: 6px 16px; font-size: 15px; font-family: "Crimson Pro", serif; font-weight: 600; cursor: pointer; }
    button.danger { background: #f5dada; color: #7a1c1c; border-color: rgba(180,60,60,0.2); }
    .err { background: #fdecec; border: 1px solid #f3caca; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; }
    .ok { background: #edfaed; border: 1px solid #b5e0b5; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; }
    .backup-codes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
    .backup-codes code { font-family: monospace; font-size: 16px; background: #f5f0e8; border: 1px solid #d9d0c2; border-radius: 8px; padding: 8px 12px; text-align: center; }
    .warn { background: #fff8e6; border: 1px solid #f0dc8c; border-radius: 8px; padding: 10px 12px; margin: 12px 0; font-size: 14px; }
    a.back { display: inline-block; margin-top: 20px; font-size: 14px; color: #8a847a; text-decoration: none; }
    a.back:hover { color: #3f2d1b; }
    ol { padding-left: 20px; line-height: 1.8; }
    label { display: block; margin-top: 12px; margin-bottom: 4px; }
  </style>
</head>
<body>
<div class="wrap"><div class="card">

<?php if ($setup_done): ?>

  <h1>2FA activat</h1>
  <div class="ok">Autentificarea in doi pasi a fost configurata cu succes.</div>

  <h2>Coduri de backup</h2>
  <div class="warn">Salveaza aceste coduri intr-un loc sigur. Fiecare cod poate fi folosit o singura data daca pierzi accesul la telefon.</div>
  <div class="backup-codes">
    <?php foreach ($backup_codes as $c): ?>
      <code><?= htmlspecialchars($c, ENT_QUOTES, 'UTF-8') ?></code>
    <?php endforeach; ?>
  </div>
  <a href="/admin/" class="back">← Inapoi la admin</a>

<?php elseif ($regen_done): ?>

  <h1>Coduri de backup regenerate</h1>
  <div class="ok">Codurile anterioare au fost invalidate.</div>

  <div class="warn">Salveaza aceste coduri intr-un loc sigur. Fiecare cod poate fi folosit o singura data.</div>
  <div class="backup-codes">
    <?php foreach ($backup_codes as $c): ?>
      <code><?= htmlspecialchars($c, ENT_QUOTES, 'UTF-8') ?></code>
    <?php endforeach; ?>
  </div>
  <a href="/admin/" class="back">← Inapoi la admin</a>

<?php elseif ($already_setup): ?>

  <h1>Gestionare 2FA</h1>
  <div class="ok">2FA este activ pe acest cont.</div>

  <h2>Regenerare coduri de backup</h2>
  <p>Daca ai pierdut codurile de backup, le poti regenera. Codurile vechi vor fi invalidate.</p>
  <form method="post">
    <input type="hidden" name="action" value="regen_backup">
    <button type="submit" class="danger">Regenereaza codurile de backup</button>
  </form>
  <a href="/admin/" class="back">← Inapoi la admin</a>

<?php else: ?>

  <h1>Configurare 2FA</h1>
  <p>Urmeaza pasii de mai jos pentru a activa autentificarea in doi pasi cu Google Authenticator, Authy sau orice aplicatie TOTP.</p>

  <ol>
    <li>Instaleaza o aplicatie Authenticator pe telefon</li>
    <li>Scaneaza codul QR de mai jos sau adauga manual secretul</li>
    <li>Introdu codul de 6 cifre generat de aplicatie pentru confirmare</li>
  </ol>

  <div id="qr-canvas"></div>

  <p><strong>Secret manual:</strong><br>
  <span class="secret-box" id="secret-text"><?= htmlspecialchars($temp_secret, ENT_QUOTES, 'UTF-8') ?></span></p>

  <?php if ($verify_error): ?>
    <div class="err"><?= htmlspecialchars($verify_error, ENT_QUOTES, 'UTF-8') ?></div>
  <?php endif; ?>

  <form method="post">
    <input type="hidden" name="action" value="confirm_setup">
    <label for="verify_code">Cod de confirmare (6 cifre)</label>
    <input type="text" id="verify_code" name="verify_code"
           inputmode="numeric" pattern="\d{6}" maxlength="6"
           autocomplete="one-time-code" required autofocus
           placeholder="123456">
    <button type="submit">Activeaza 2FA</button>
  </form>

  <a href="/admin/" class="back">← Anuleaza</a>

  <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  <script>
    try {
      new QRCode(document.getElementById('qr-canvas'), {
        text: <?= json_encode($otp_uri) ?>,
        width: 200, height: 200,
        colorDark: '#1c1c1c', colorLight: '#fffaf2',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch(e) {
      document.getElementById('qr-canvas').textContent = 'QR indisponibil — foloseste secretul manual.';
    }
  </script>

<?php endif; ?>

</div></div>
</body>
</html>
