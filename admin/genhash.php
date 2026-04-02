<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

$hash = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['pw'])) {
    $hash = password_hash($_POST['pw'], PASSWORD_BCRYPT);
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <title>Generează hash</title>
  <style>
    body { font-family: sans-serif; max-width: 500px; margin: 60px auto; padding: 0 20px; }
    input[type=password] { width: 100%; padding: 10px; font-size: 16px; margin: 8px 0 16px; box-sizing: border-box; }
    button { padding: 10px 24px; background: #2A7D4F; color: #fff; border: none; font-size: 15px; cursor: pointer; border-radius: 6px; }
    .hash { margin-top: 24px; background: #f5f5f0; padding: 14px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 13px; }
    p { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <h2>Generează bcrypt hash</h2>
  <p>Introdu parola actuală. Hash-ul generat nu îți dezvăluie parola și poate fi trimis public.</p>
  <form method="POST">
    <input type="password" name="pw" placeholder="Parola ta" autofocus required />
    <button type="submit">Generează</button>
  </form>
  <?php if ($hash): ?>
    <div class="hash"><?php echo htmlspecialchars($hash); ?></div>
    <p>Copiază tot textul de mai sus și trimite-l.</p>
  <?php endif; ?>
</body>
</html>
