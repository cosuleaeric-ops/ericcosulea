<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';

$error = '';
$version = 'login-v4';
$redirect = $_GET['redirect'] ?? ($_POST['redirect'] ?? '/admin/');

if (!is_string($redirect) || $redirect === '' || $redirect[0] !== '/') {
    $redirect = '/admin/';
}

if (isset($_GET['token']) && $_GET['token'] !== '') {
    if (force_login_with_token($_GET['token'])) {
        header('Location: ' . $redirect);
        exit;
    }
    $error = 'Token invalid.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = $_POST['password'] ?? '';
    if (login_with_password($password)) {
        header('Location: ' . $redirect);
        exit;
    }
    $error = 'Parola incorecta.';
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Crimson Pro", serif; background: #FFFDF7; color: #1c1c1c; }
    .wrap { max-width: 520px; margin: 80px auto; padding: 24px; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 16px; padding: 24px; }
    h1 { margin-top: 0; }
    input[type=password] { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #d9d0c2; font-size: 16px; }
    button { margin-top: 14px; background: #111; color: #fff; border: 0; border-radius: 10px; padding: 10px 16px; font-size: 16px; }
    .err { background: #fdecec; border: 1px solid #f3caca; padding: 10px 12px; border-radius: 8px; margin-bottom: 10px; }
    .ver { margin-top: 10px; font-size: 12px; color: #8a847a; }
  </style>
</head>
<body class="admin">
  <div class="wrap">
    <div class="card">
      <h1>Admin</h1>
      <?php if ($error): ?>
        <div class="err"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
      <?php endif; ?>
      <form method="post">
        <input type="hidden" name="redirect" value="<?php echo htmlspecialchars($redirect, ENT_QUOTES, 'UTF-8'); ?>">
        <label for="password">Parola</label>
        <input type="password" id="password" name="password" required>
        <button type="submit">Intra</button>
      </form>
      <div class="ver"><?php echo $version; ?></div>
    </div>
  </div>
</body>
</html>
