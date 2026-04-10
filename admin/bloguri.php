<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

function h(string $v): string {
    return htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
}

$dbPath = __DIR__ . '/../data/blog.sqlite';
$db = new SQLite3($dbPath);
$db->exec('CREATE TABLE IF NOT EXISTS blogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    screenshot_filename TEXT,
    created_at TEXT NOT NULL
);');

$uploadDir = __DIR__ . '/../uploads/bloguri';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        http_response_code(400);
        exit('CSRF invalid');
    }

    if (isset($_POST['delete_id'])) {
        $stmt = $db->prepare('SELECT screenshot_filename FROM blogs WHERE id = :id');
        $stmt->bindValue(':id', (int)$_POST['delete_id'], SQLITE3_INTEGER);
        $row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        if ($row && $row['screenshot_filename']) {
            $file = $uploadDir . '/' . $row['screenshot_filename'];
            if (is_file($file)) {
                @unlink($file);
            }
        }
        $del = $db->prepare('DELETE FROM blogs WHERE id = :id');
        $del->bindValue(':id', (int)$_POST['delete_id'], SQLITE3_INTEGER);
        $del->execute();
        header('Location: /admin/bloguri.php');
        exit;
    }

    $rawUrl = trim($_POST['url'] ?? '');
    if ($rawUrl === '') {
        $error = 'Introdu un URL.';
    } else {
        // Normalize URL
        if (!str_starts_with($rawUrl, 'http://') && !str_starts_with($rawUrl, 'https://')) {
            $rawUrl = 'https://' . $rawUrl;
        }
        $url = filter_var($rawUrl, FILTER_VALIDATE_URL);
        if (!$url) {
            $error = 'URL invalid.';
        } else {
            // Extract title from page
            $name = '';
            $ctx = stream_context_create(['http' => [
                'timeout' => 8,
                'user_agent' => 'Mozilla/5.0 (compatible; EricBot/1.0)',
                'follow_location' => 1,
            ]]);
            $html = @file_get_contents($url, false, $ctx);
            if ($html !== false) {
                if (preg_match('/<title[^>]*>\s*(.*?)\s*<\/title>/si', $html, $m)) {
                    $name = html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    $name = preg_replace('/\s+/', ' ', $name);
                    $name = trim($name);
                }
            }
            if ($name === '') {
                $name = parse_url($url, PHP_URL_HOST) ?: $url;
            }

            $stmt = $db->prepare('INSERT OR IGNORE INTO blogs (url, name, screenshot_filename, created_at) VALUES (:url, :name, NULL, :created_at)');
            $stmt->bindValue(':url', $url, SQLITE3_TEXT);
            $stmt->bindValue(':name', $name, SQLITE3_TEXT);
            $stmt->bindValue(':created_at', date('Y-m-d H:i:s'), SQLITE3_TEXT);
            $stmt->execute();

            if ($db->changes() === 0) {
                $error = 'Blogul există deja.';
            } else {
                $success = 'Blog adăugat: ' . $name;
            }
            header('Location: /admin/bloguri.php' . ($error ? '?err=' . urlencode($error) : ''));
            exit;
        }
    }
}

$error = $error ?: urldecode($_GET['err'] ?? '');
$result = $db->query('SELECT id, url, name, screenshot_filename, created_at FROM blogs ORDER BY created_at ASC');
$blogs = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
    $blogs[] = $row;
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bloguri — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <style>
    .wrap { max-width: 820px; margin: 60px auto; padding: 24px; }
    h1 { margin: 0 0 24px; text-transform: lowercase; }
    .add-form { display: flex; gap: 10px; margin-bottom: 32px; }
    .add-form input[type=url] {
      flex: 1; padding: 10px 14px; border: 1px solid #ded5c8; border-radius: 10px;
      font-family: inherit; font-size: 16px; background: #fffaf2; color: #1c1c1c;
    }
    .add-form input[type=url]:focus { outline: 2px solid #c9a97b; outline-offset: 1px; }
    .btn-add {
      padding: 10px 20px; border: none; border-radius: 10px; background: #3f2d1b;
      color: #fff; font-family: inherit; font-size: 16px; cursor: pointer;
    }
    .btn-add:hover { background: #5a3f26; }
    .error { color: #c0392b; margin-bottom: 16px; font-size: 15px; }
    .blog-list { display: flex; flex-direction: column; gap: 14px; }
    .blog-row {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 14px; border: 1px solid #ede5d5; border-radius: 14px; background: #fffaf2;
    }
    .blog-row img { width: 80px; height: 45px; object-fit: cover; object-position: top; border-radius: 6px; background: #f0ebe0; }
    .blog-row-info { flex: 1; min-width: 0; }
    .blog-row-name { font-weight: 500; font-size: 17px; }
    .blog-row-url { font-size: 13px; color: #8a7b68; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .btn-del {
      padding: 6px 14px; border: 1px solid #d4c4ae; border-radius: 8px;
      background: transparent; font-family: inherit; font-size: 14px; cursor: pointer; color: #7a4f2e;
    }
    .btn-del:hover { background: #f5ede0; }
    .empty { color: #8a7b68; font-size: 17px; }
    @media (max-width: 600px) {
      .add-form { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="admin-bar">
    <div class="admin-bar-inner">
      <a class="btn" href="/admin/">← admin</a>
      <a class="btn" href="/bloguri" target="_blank">vezi pagina</a>
      <a class="btn" href="/admin/logout.php" style="margin-left:auto">logout</a>
    </div>
  </div>
  <div class="wrap">
    <h1>bloguri</h1>

    <?php if ($error): ?>
      <p class="error"><?php echo h($error); ?></p>
    <?php endif; ?>

    <form class="add-form" method="post" action="/admin/bloguri.php">
      <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
      <input type="url" name="url" placeholder="https://exemplu.com/" required>
      <button class="btn-add" type="submit">adaugă</button>
    </form>

    <?php if (empty($blogs)): ?>
      <p class="empty">Nicio intrare încă.</p>
    <?php else: ?>
      <div class="blog-list">
        <?php foreach ($blogs as $b): ?>
          <div class="blog-row">
            <img src="https://image.thum.io/get/width/400/crop/225/<?php echo h($b['url']); ?>" alt="" loading="lazy" style="flex-shrink:0;">
            <div class="blog-row-info">
              <div class="blog-row-name"><?php echo h($b['name']); ?></div>
              <div class="blog-row-url"><?php echo h($b['url']); ?></div>
            </div>
            <form method="post" action="/admin/bloguri.php" onsubmit="return confirm('Stergi blogul?');">
              <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
              <input type="hidden" name="delete_id" value="<?php echo (int)$b['id']; ?>">
              <button class="btn-del" type="submit">sterge</button>
            </form>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
