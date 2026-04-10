<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

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

$seedUrls = [
    'https://thedankoe.com/',
    'https://blog.onerinas.com/',
    'https://www.pawlean.com/',
];

$results = [];

foreach ($seedUrls as $url) {
    // Check already exists
    $check = $db->prepare('SELECT id FROM blogs WHERE url = :url');
    $check->bindValue(':url', $url, SQLITE3_TEXT);
    if ($check->execute()->fetchArray(SQLITE3_ASSOC)) {
        $results[] = ['url' => $url, 'status' => 'already exists'];
        continue;
    }

    // Extract title
    $name = '';
    $ctx = stream_context_create(['http' => [
        'timeout' => 10,
        'user_agent' => 'Mozilla/5.0 (compatible; EricBot/1.0)',
        'follow_location' => 1,
    ]]);
    $html = @file_get_contents($url, false, $ctx);
    if ($html !== false && preg_match('/<title[^>]*>\s*(.*?)\s*<\/title>/si', $html, $m)) {
        $name = html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $name = trim(preg_replace('/\s+/', ' ', $name));
    }
    if ($name === '') {
        $name = parse_url($url, PHP_URL_HOST) ?: $url;
    }

    // Screenshot
    $screenshotFilename = null;
    $ssUrl = 'https://image.thum.io/get/width/1200/crop/630/' . urlencode($url);
    $imgCtx = stream_context_create(['http' => ['timeout' => 20, 'user_agent' => 'Mozilla/5.0']]);
    $imgData = @file_get_contents($ssUrl, false, $imgCtx);
    if ($imgData !== false && strlen($imgData) > 1024) {
        $screenshotFilename = bin2hex(random_bytes(8)) . '.jpg';
        file_put_contents($uploadDir . '/' . $screenshotFilename, $imgData);
    }

    $stmt = $db->prepare('INSERT OR IGNORE INTO blogs (url, name, screenshot_filename, created_at) VALUES (:url, :name, :ss, :ts)');
    $stmt->bindValue(':url', $url, SQLITE3_TEXT);
    $stmt->bindValue(':name', $name, SQLITE3_TEXT);
    $stmt->bindValue(':ss', $screenshotFilename, $screenshotFilename ? SQLITE3_TEXT : SQLITE3_NULL);
    $stmt->bindValue(':ts', date('Y-m-d H:i:s'), SQLITE3_TEXT);
    $stmt->execute();

    $results[] = ['url' => $url, 'status' => 'added', 'name' => $name, 'screenshot' => $screenshotFilename ?? 'none'];
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>Seed Bloguri</title>
  <style>body{font-family:monospace;padding:32px;} pre{background:#f5f5f5;padding:16px;border-radius:8px;}</style>
</head>
<body>
  <h2>Seed complet</h2>
  <pre><?php echo htmlspecialchars(json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); ?></pre>
  <p><a href="/admin/bloguri.php">→ mergi la gestionare bloguri</a></p>
  <p><a href="/bloguri">→ vezi pagina publică</a></p>
</body>
</html>
