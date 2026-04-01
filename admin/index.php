<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

$dbPath = __DIR__ . '/../data/blog.sqlite';
$db = new SQLite3($dbPath);
$db->exec('CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content_html TEXT NOT NULL,
    content_md TEXT,
    excerpt TEXT,
    published_at TEXT NOT NULL
);');
@$db->exec('ALTER TABLE posts ADD COLUMN content_md TEXT;');

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

$root = realpath(__DIR__ . '/..');
$uploadsRoot = $root . '/uploads/files';

$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['delete_id'])) {
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            http_response_code(400);
            exit('CSRF invalid');
        }
        $stmt = $db->prepare('DELETE FROM posts WHERE id = :id');
        $stmt->bindValue(':id', (int)$_POST['delete_id'], SQLITE3_INTEGER);
        $stmt->execute();
        header('Location: /admin/');
        exit;
    }

    if (isset($_FILES['files'])) {
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            http_response_code(400);
            exit('CSRF invalid');
        }

        $target = $_POST['target'] ?? 'root';
        $count = 0;
        $total = is_array($_FILES['files']['name']) ? count($_FILES['files']['name']) : 0;
        for ($i = 0; $i < $total; $i++) {
            if ($_FILES['files']['error'][$i] !== UPLOAD_ERR_OK) {
                continue;
            }
            $orig = basename($_FILES['files']['name'][$i] ?? 'file');
            $destDir = $root;
            if ($target === 'assets') {
                $destDir = $root . '/assets';
            } elseif ($target === 'admin') {
                $destDir = $root . '/admin';
            } elseif ($target === 'inspo') {
                $destDir = $root . '/uploads/inspo';
            } elseif ($target === 'uploads') {
                $destDir = $uploadsRoot;
            }
            if (!is_dir($destDir)) {
                @mkdir($destDir, 0755, true);
            }
            $dest = $destDir . '/' . $orig;
            $tmp = $_FILES['files']['tmp_name'][$i];
            if (move_uploaded_file($tmp, $dest)) {
                $count++;
            }
        }
        if ($count > 0) {
            $message = 'Fisiere actualizate: ' . $count;
        } else {
            $error = 'Incarcarea a esuat.';
        }
    }
}

$result = $db->query('SELECT id, slug, title, published_at FROM posts ORDER BY published_at DESC');
$posts = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
    $posts[] = $row;
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Crimson Pro", serif; background: #FFFDF7; color: #1c1c1c; }
    body:has(.admin-bar) { padding-top: 86px; }
    .admin-bar {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      width: min(720px, calc(100% - 24px));
    }
    .wrap { max-width: 820px; margin: 60px auto; padding: 24px; }
    .top { display: block; }
    .top h1 { margin: 0; }
    .admin-bar-inner {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
      padding: 8px;
      border: 1px solid rgba(143, 111, 74, 0.18);
      border-radius: 20px;
      background:
        linear-gradient(180deg, rgba(219, 204, 181, 0.96) 0%, rgba(206, 187, 160, 0.98) 100%);
      box-shadow:
        0 18px 44px rgba(90, 67, 39, 0.18),
        inset 0 1px 0 rgba(255, 250, 242, 0.5);
      backdrop-filter: blur(12px);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 5px 12px;
      background: rgba(108, 82, 51, 0.08);
      color: #3f2d1b;
      border: 1px solid rgba(108, 82, 51, 0.12);
      border-radius: 999px;
      font-size: 15px;
      text-decoration: none;
      line-height: 1;
      transition:
        background 160ms ease,
        transform 160ms ease,
        border-color 160ms ease,
        color 160ms ease;
    }
    .btn:hover { background: rgba(108, 82, 51, 0.14); border-color: rgba(108, 82, 51, 0.2); transform: translateY(-1px); }
    .list { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
    .item { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 12px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: baseline; }
    .item a { color: #111; text-decoration: none; font-weight: 600; }
    .meta { color: #6d6a64; font-size: 14px; }
    .link { text-decoration: none; color: #111; font-size: 14px; }
    .danger { background: #f4d6d6; border: 0; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 16px; padding: 24px; margin-top: 18px; }
    label { display: block; margin: 12px 0 6px; font-weight: 600; }
    input[type=file], select { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #d9d0c2; font-size: 16px; }
    .msg { margin: 12px 0; padding: 10px 12px; border-radius: 8px; }
    .ok { background: #eef8ee; border: 1px solid #cfe8cf; }
    .err { background: #fdecec; border: 1px solid #f3caca; }
    .logout-row { display: flex; justify-content: flex-end; margin-top: 24px; }
    @media (max-width: 720px) {
      body:has(.admin-bar) { padding-top: 116px; }
      .admin-bar {
        top: 12px;
        width: calc(100% - 20px);
      }
      .wrap { margin: 28px auto; padding: 18px; }
      .admin-bar-inner {
        justify-content: flex-start;
      }
    }
  </style>
</head>
<body class="admin">
  <div class="admin-bar">
    <div class="admin-bar-inner">
      <a class="btn" href="/deep-work/">Deep work</a>
      <a class="btn" href="/elite-deux/">EliteDeux</a>
      <a class="btn" href="/admin/inspo.php">Inspo</a>
      <a class="btn" href="/admin/page.php?slug=tools">Tools</a>
      <a class="btn" href="/admin/edit.php">Articol nou</a>
      <a class="btn" href="/">Website</a>
    </div>
  </div>
  <div class="wrap">
    <div class="top">
      <h1>Admin</h1>
    </div>

    <div class="card">
      <h2>Upload fisiere</h2>
      <p>Urca unul sau mai multe fisiere si alege unde se salveaza.</p>
      <?php if ($message): ?><div class="msg ok"><?php echo h($message); ?></div><?php endif; ?>
      <?php if ($error): ?><div class="msg err"><?php echo h($error); ?></div><?php endif; ?>
      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
        <label for="target">Destinatie</label>
        <select id="target" name="target" required>
          <option value="root">public_html</option>
          <option value="assets">assets</option>
          <option value="admin">admin</option>
          <option value="inspo">uploads/inspo</option>
          <option value="uploads">uploads/files</option>
        </select>
        <label for="files">Incarca fisiere</label>
        <input id="files" type="file" name="files[]" multiple required>
        <button class="btn" type="submit">Uploadeaza</button>
      </form>
    </div>

    <div class="list">
      <?php foreach ($posts as $p): ?>
        <div class="item">
          <div>
            <a href="/admin/edit.php?id=<?php echo (int)$p['id']; ?>"><?php echo h($p['title']); ?></a>
            <div class="meta">/<?php echo h($p['slug']); ?> · <?php echo h(date('j F Y', strtotime($p['published_at']))); ?></div>
          </div>
          <form method="post" onsubmit="return confirm('Stergi acest articol?');">
            <input type="hidden" name="delete_id" value="<?php echo (int)$p['id']; ?>">
            <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
            <button class="danger" type="submit">Sterge</button>
          </form>
        </div>
      <?php endforeach; ?>
    </div>

    <div class="logout-row">
      <a class="link" href="/admin/logout.php">Logout</a>
    </div>
  </div>
</body>
</html>
