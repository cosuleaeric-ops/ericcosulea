<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

$root = realpath(__DIR__ . '/..');
$uploadsRoot = $root . '/uploads/files';

function h(string $v): string { return htmlspecialchars($v, ENT_QUOTES, 'UTF-8'); }

function sanitize_rel_path(string $path): string {
    $path = str_replace('\\', '/', $path);
    $path = ltrim($path, '/');
    $path = preg_replace('/\.+\//', '', $path);
    return $path;
}

function choose_destination(string $name, string $root, string $uploadsRoot): string {
    $rel = sanitize_rel_path($name);
    if ($rel === '' || $rel === '.' || $rel === '..') {
        return $uploadsRoot . '/file';
    }

    // If user provides a folder prefix, honor admin/assets/uploads only.
    if (strpos($rel, '/') !== false) {
        [$folder, $file] = explode('/', $rel, 2);
        if (in_array($folder, ['admin', 'assets', 'uploads'], true)) {
            return $root . '/' . $folder . '/' . basename($file);
        }
        return $uploadsRoot . '/' . basename($file);
    }

    $basename = basename($rel);
    $ext = strtolower(pathinfo($basename, PATHINFO_EXTENSION));

    if ($basename === '.htaccess') {
        return $root . '/.htaccess';
    }
    if (preg_match('/^admin[-_](.+)$/i', $basename, $m)) {
        return $root . '/admin/' . $m[1];
    }
    if (preg_match('/^assets[-_](.+)$/i', $basename, $m)) {
        return $root . '/assets/' . $m[1];
    }
    if (preg_match('/^uploads[-_](.+)$/i', $basename, $m)) {
        return $root . '/uploads/' . $m[1];
    }
    if (in_array($ext, ['php', 'html', 'css', 'js', 'json', 'xml', 'txt', 'md', 'map'], true)) {
        return $root . '/' . $basename;
    }
    if (in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico', 'avif'], true)) {
        return $root . '/assets/' . $basename;
    }
    if (in_array($ext, ['woff', 'woff2', 'ttf', 'otf'], true)) {
        return $root . '/assets/' . $basename;
    }

    return $uploadsRoot . '/' . $basename;
}

$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        http_response_code(400);
        exit('CSRF invalid');
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        $error = 'Incarcarea a esuat.';
    } else {
        $orig = $_FILES['file']['name'] ?? '';
        $dest = choose_destination($orig, $root, $uploadsRoot);
        $destDir = dirname($dest);
        if (!is_dir($destDir)) {
            @mkdir($destDir, 0755, true);
        }
        $tmp = $_FILES['file']['tmp_name'];
        if (!move_uploaded_file($tmp, $dest)) {
            $error = 'Nu am putut salva fisierul.';
        } else {
            $message = 'Fisier actualizat: ' . sanitize_rel_path($orig);
        }
    }
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Upload fisiere</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Crimson Pro", serif; background: #FFFDF7; color: #1c1c1c; }
    .wrap { max-width: 820px; margin: 60px auto; padding: 24px; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 16px; padding: 24px; }
    label { display: block; margin: 12px 0 6px; font-weight: 600; }
    input[type=file] { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #d9d0c2; font-size: 16px; }
    .btn { margin-top: 16px; background: #111; color: #fff; border: 0; border-radius: 10px; padding: 10px 16px; font-size: 16px; }
    .link { text-decoration: none; color: #111; }
    .msg { margin: 12px 0; padding: 10px 12px; border-radius: 8px; }
    .ok { background: #eef8ee; border: 1px solid #cfe8cf; }
    .err { background: #fdecec; border: 1px solid #f3caca; }
  </style>
</head>
<body class="admin">
  <div class="wrap">
    <a class="link" href="/admin/">← inapoi</a>
    <div class="card">
      <h1>Upload fisiere</h1>
      <p>Urca un fisier. Sistemul il plaseaza automat in public_html, admin sau assets.</p>
      <?php if ($message): ?><div class="msg ok"><?php echo h($message); ?></div><?php endif; ?>
      <?php if ($error): ?><div class="msg err"><?php echo h($error); ?></div><?php endif; ?>
      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
        <label for="file">Incarca fisier</label>
        <input id="file" type="file" name="file" required>
        <button class="btn" type="submit">Uploadeaza</button>
      </form>
      <p>Tipuri: .php/.html/.css/.js → root, imagini/fonturi → assets, restul → uploads/files.</p>
      <p>Pentru admin/ si assets/ poti folosi prefix in nume: admin-index.php, assets-logo.png.</p>
    </div>
  </div>
</body>
</html>
