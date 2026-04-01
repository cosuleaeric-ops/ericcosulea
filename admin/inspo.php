<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

$dbPath = __DIR__ . '/../data/blog.sqlite';
$uploadDir = __DIR__ . '/../uploads/inspo';
$publicBase = '/uploads/inspo';

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$db = new SQLite3($dbPath);
$db->exec('CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    original_name TEXT,
    created_at TEXT NOT NULL
);');

$message = '';
$error = '';
function safe_redirect(string $value): string {
    if ($value === '/inspo' || $value === '/admin/inspo.php') {
        return $value;
    }
    return '/admin/inspo.php';
}

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        http_response_code(400);
        exit('CSRF invalid');
    }

    if (isset($_POST['delete_id'])) {
        $id = (int)$_POST['delete_id'];
        $stmt = $db->prepare('SELECT filename FROM images WHERE id = :id');
        $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        if ($row) {
            $filePath = $uploadDir . '/' . $row['filename'];
            if (is_file($filePath)) {
                @unlink($filePath);
            }
            $del = $db->prepare('DELETE FROM images WHERE id = :id');
            $del->bindValue(':id', $id, SQLITE3_INTEGER);
            $del->execute();
        }
        $redirect = safe_redirect($_POST['redirect_to'] ?? '');
        header('Location: ' . $redirect);
        exit;
    }

    if (isset($_FILES['image'])) {
        if ($_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            $error = 'Incarcarea a esuat.';
        } else {
            $tmp = $_FILES['image']['tmp_name'];
            $name = $_FILES['image']['name'] ?? 'image';
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
            if (!in_array($ext, $allowed, true)) {
                $error = 'Format invalid. Foloseste jpg, png, webp sau gif.';
            } else {
                $safeName = bin2hex(random_bytes(8)) . '-' . time() . '.' . $ext;
                $dest = $uploadDir . '/' . $safeName;
                if (!move_uploaded_file($tmp, $dest)) {
                    $error = 'Nu am putut salva imaginea.';
                } else {
                    $stmt = $db->prepare('INSERT INTO images (filename, original_name, created_at) VALUES (:filename, :original_name, :created_at)');
                    $stmt->bindValue(':filename', $safeName, SQLITE3_TEXT);
                    $stmt->bindValue(':original_name', $name, SQLITE3_TEXT);
                    $stmt->bindValue(':created_at', date('Y-m-d H:i:s'), SQLITE3_TEXT);
                    $stmt->execute();
                    $message = 'Imagine incarcata.';
                }
            }
        }
    }
}

$result = $db->query('SELECT id, filename, original_name, created_at FROM images ORDER BY created_at DESC');
$images = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
    $images[] = $row;
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inspo Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Crimson Pro", serif; background: #FFFDF7; color: #1c1c1c; }
    .wrap { max-width: 900px; margin: 60px auto; padding: 24px; }
    .top { display: flex; justify-content: space-between; align-items: center; }
    .btn { min-height: 28px; background: #d7c2a5; color: #3f2d1b; border: 1px solid rgba(143, 111, 74, 0.18); border-radius: 999px; padding: 5px 12px; font-size: 15px; font-family: "Crimson Pro", serif; font-weight: 600; letter-spacing: 0.01em; text-decoration: none; text-transform: lowercase; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 16px; padding: 24px; margin-top: 16px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
    .thumb { position: relative; }
    .thumb img { width: 100%; height: 150px; object-fit: cover; border-radius: 12px; display: block; }
    .thumb form { position: absolute; top: 8px; right: 8px; }
    .danger { background: #f4d6d6; border: 0; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
    .msg { margin: 12px 0; padding: 10px 12px; border-radius: 8px; }
    .ok { background: #eef8ee; border: 1px solid #cfe8cf; }
    .err { background: #fdecec; border: 1px solid #f3caca; }
    @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  </style>
</head>
<body class="admin">
  <div class="wrap">
    <div class="top">
      <h1>Inspo</h1>
      <a class="btn" href="/admin/">Inapoi</a>
    </div>
    <div class="card">
      <h2>Incarca imagine</h2>
      <?php if ($message): ?><div class="msg ok"><?php echo h($message); ?></div><?php endif; ?>
      <?php if ($error): ?><div class="msg err"><?php echo h($error); ?></div><?php endif; ?>
      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
        <input type="hidden" name="redirect_to" value="/admin/inspo.php">
        <label class="upload-label">
          <span>Alege imagine</span>
          <input type="file" name="image" accept="image/*" required>
        </label>
      </form>
    </div>

    <div class="card">
      <h2>Imagini</h2>
      <div class="grid">
        <?php foreach ($images as $img): ?>
          <div class="thumb">
            <img src="<?php echo h($publicBase . '/' . $img['filename']); ?>" alt="">
            <form method="post" onsubmit="return confirm('Stergi imaginea?');">
              <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
              <input type="hidden" name="redirect_to" value="/admin/inspo.php">
              <input type="hidden" name="delete_id" value="<?php echo (int)$img['id']; ?>">
              <button class="danger" type="submit">Sterge</button>
            </form>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
  <script>
    document.querySelectorAll('input[type="file"][name="image"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.files && input.files.length > 0) {
          input.form.submit();
        }
      });
    });
  </script>
</body>
</html>
