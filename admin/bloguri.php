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

function grab_screenshot(string $url, string $uploadDir): ?string {
    if (!function_exists('curl_init')) {
        return null;
    }
    $screenshotUrl = 'https://image.thum.io/get/width/1200/crop/630/' . $url;
    $ch = curl_init($screenshotUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => ['Accept: image/webp,image/jpeg,image/*,*/*'],
    ]);
    $data     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $ctype    = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($data === false || $httpCode !== 200 || !str_contains((string)$ctype, 'image/')) {
        return null;
    }
    $filename = bin2hex(random_bytes(8)) . '.jpg';
    file_put_contents($uploadDir . '/' . $filename, $data);
    return $filename;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        http_response_code(400);
        exit('CSRF invalid');
    }

    // Delete
    if (isset($_POST['delete_id'])) {
        $stmt = $db->prepare('SELECT screenshot_filename FROM blogs WHERE id = :id');
        $stmt->bindValue(':id', (int)$_POST['delete_id'], SQLITE3_INTEGER);
        $row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        if ($row && $row['screenshot_filename']) {
            $f = $uploadDir . '/' . $row['screenshot_filename'];
            if (is_file($f)) @unlink($f);
        }
        $del = $db->prepare('DELETE FROM blogs WHERE id = :id');
        $del->bindValue(':id', (int)$_POST['delete_id'], SQLITE3_INTEGER);
        $del->execute();
        header('Location: /admin/bloguri.php');
        exit;
    }

    // Regenerate screenshot
    if (isset($_POST['screenshot_id'])) {
        $stmt = $db->prepare('SELECT id, url, screenshot_filename FROM blogs WHERE id = :id');
        $stmt->bindValue(':id', (int)$_POST['screenshot_id'], SQLITE3_INTEGER);
        $row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        if ($row) {
            // Delete old
            if ($row['screenshot_filename'] && is_file($uploadDir . '/' . $row['screenshot_filename'])) {
                @unlink($uploadDir . '/' . $row['screenshot_filename']);
            }
            $newFile = grab_screenshot($row['url'], $uploadDir);
            $upd = $db->prepare('UPDATE blogs SET screenshot_filename = :ss WHERE id = :id');
            $upd->bindValue(':ss', $newFile, $newFile ? SQLITE3_TEXT : SQLITE3_NULL);
            $upd->bindValue(':id', (int)$row['id'], SQLITE3_INTEGER);
            $upd->execute();
        }
        header('Location: /admin/bloguri.php');
        exit;
    }

    // Add new blog
    $rawUrl = trim($_POST['url'] ?? '');
    if ($rawUrl === '') {
        $error = 'Introdu un URL.';
    } else {
        if (!str_starts_with($rawUrl, 'http://') && !str_starts_with($rawUrl, 'https://')) {
            $rawUrl = 'https://' . $rawUrl;
        }
        $url = filter_var($rawUrl, FILTER_VALIDATE_URL);
        if (!$url) {
            $error = 'URL invalid.';
        } else {
            // Extract title
            $name = '';
            $ctx  = stream_context_create(['http' => [
                'timeout'         => 8,
                'user_agent'      => 'Mozilla/5.0 (compatible; EricBot/1.0)',
                'follow_location' => 1,
            ]]);
            $html = @file_get_contents($url, false, $ctx);
            if ($html !== false && preg_match('/<title[^>]*>\s*(.*?)\s*<\/title>/si', $html, $m)) {
                $name = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
            }
            if ($name === '') {
                $name = parse_url($url, PHP_URL_HOST) ?: $url;
            }

            // Screenshot
            $screenshotFilename = grab_screenshot($url, $uploadDir);

            $stmt = $db->prepare('INSERT OR IGNORE INTO blogs (url, name, screenshot_filename, created_at) VALUES (:url, :name, :ss, :ts)');
            $stmt->bindValue(':url', $url, SQLITE3_TEXT);
            $stmt->bindValue(':name', $name, SQLITE3_TEXT);
            $stmt->bindValue(':ss', $screenshotFilename, $screenshotFilename ? SQLITE3_TEXT : SQLITE3_NULL);
            $stmt->bindValue(':ts', date('Y-m-d H:i:s'), SQLITE3_TEXT);
            $stmt->execute();

            if ($db->changes() === 0) {
                $error = 'Blogul există deja.';
                header('Location: /admin/bloguri.php?err=' . urlencode($error));
            } else {
                header('Location: /admin/bloguri.php');
            }
            exit;
        }
    }
}

$error = $error ?: urldecode($_GET['err'] ?? '');
$result = $db->query('SELECT id, url, name, screenshot_filename FROM blogs ORDER BY created_at ASC');
$blogs  = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) $blogs[] = $row;
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
    .blog-row-thumb {
      width: 80px; height: 45px; object-fit: cover; object-position: top;
      border-radius: 6px; background: #f0ebe0; flex-shrink: 0;
    }
    .blog-row-no-thumb {
      width: 80px; height: 45px; border-radius: 6px; background: #f0ebe0;
      flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      font-size: 11px; color: #aaa;
    }
    .blog-row-info { flex: 1; min-width: 0; }
    .blog-row-name { font-weight: 500; font-size: 17px; }
    .blog-row-url { font-size: 13px; color: #8a7b68; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .blog-row-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .btn-sm {
      padding: 6px 14px; border: 1px solid #d4c4ae; border-radius: 8px;
      background: transparent; font-family: inherit; font-size: 14px; cursor: pointer; color: #7a4f2e;
    }
    .btn-sm:hover { background: #f5ede0; }
    .empty { color: #8a7b68; font-size: 17px; }
    @media (max-width: 600px) { .add-form { flex-direction: column; } }
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
            <?php if ($b['screenshot_filename']): ?>
              <img class="blog-row-thumb" src="/uploads/bloguri/<?php echo h($b['screenshot_filename']); ?>" alt="">
            <?php else: ?>
              <div class="blog-row-no-thumb">no img</div>
            <?php endif; ?>
            <div class="blog-row-info">
              <div class="blog-row-name"><?php echo h($b['name']); ?></div>
              <div class="blog-row-url"><?php echo h($b['url']); ?></div>
            </div>
            <div class="blog-row-actions">
              <form method="post" action="/admin/bloguri.php">
                <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
                <input type="hidden" name="screenshot_id" value="<?php echo (int)$b['id']; ?>">
                <button class="btn-sm" type="submit" title="descarcă screenshot din nou">↻</button>
              </form>
              <form method="post" action="/admin/bloguri.php" onsubmit="return confirm('Ștergi blogul?');">
                <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
                <input type="hidden" name="delete_id" value="<?php echo (int)$b['id']; ?>">
                <button class="btn-sm" type="submit">șterge</button>
              </form>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
