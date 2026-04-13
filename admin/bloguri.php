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

function fetch_page_html(string $url): string|false {
    if (!function_exists('curl_init')) return false;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => ['Accept: text/html'],
    ]);
    $html = curl_exec($ch);
    curl_close($ch);
    return $html;
}

function extract_og_image(string $html, string $baseUrl): string {
    // og:image
    if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\'][^>]*>/i', $html, $m) ||
        preg_match('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\'][^>]*>/i', $html, $m)) {
        return resolve_url(trim($m[1]), $baseUrl);
    }
    // twitter:image
    if (preg_match('/<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\'][^>]*>/i', $html, $m) ||
        preg_match('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image["\'][^>]*>/i', $html, $m)) {
        return resolve_url(trim($m[1]), $baseUrl);
    }
    return '';
}

function resolve_url(string $url, string $base): string {
    if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) return $url;
    $p = parse_url($base);
    if (str_starts_with($url, '//')) return ($p['scheme'] ?? 'https') . ':' . $url;
    if (str_starts_with($url, '/')) return ($p['scheme'] ?? 'https') . '://' . $p['host'] . $url;
    return rtrim($base, '/') . '/' . $url;
}

function download_image(string $imageUrl, string $uploadDir): ?string {
    if (!function_exists('curl_init') || $imageUrl === '') return null;
    $ch = curl_init($imageUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible)',
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $data  = curl_exec($ch);
    $ctype = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $code  = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($data === false || $code !== 200 || !str_contains($ctype, 'image/') || strlen($data) < 1024) return null;
    $ext = str_contains($ctype, 'png') ? 'png' : (str_contains($ctype, 'gif') ? 'gif' : 'jpg');
    $filename = bin2hex(random_bytes(8)) . '.' . $ext;
    file_put_contents($uploadDir . '/' . $filename, $data);
    return $filename;
}

function microlink_screenshot(string $pageUrl, string $uploadDir): ?string {
    if (!function_exists('curl_init')) return null;
    // Step 1: get screenshot URL from Microlink JSON API
    $apiUrl = 'https://api.microlink.io/?' . http_build_query([
        'url'        => $pageUrl,
        'screenshot' => 'true',
        'meta'       => 'false',
    ]);
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible)',
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
    if (!$body) return null;
    $json = json_decode($body, true);
    $imgUrl = $json['data']['screenshot']['url'] ?? null;
    if (!$imgUrl) return null;
    // Step 2: download the actual image
    return download_image($imgUrl, $uploadDir);
}

function grab_image(string $pageUrl, string $uploadDir, string|false $html = false): ?string {
    if ($html === false) $html = fetch_page_html($pageUrl);

    // 1. Try og:image / twitter:image
    if ($html !== false) {
        $ogUrl = extract_og_image($html, $pageUrl);
        $result = download_image($ogUrl, $uploadDir);
        if ($result) return $result;
    }

    // 2. Fallback: Microlink screenshot API
    return microlink_screenshot($pageUrl, $uploadDir);
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        http_response_code(400); exit('CSRF invalid');
    }

    if (isset($_POST['delete_id'])) {
        $stmt = $db->prepare('SELECT screenshot_filename FROM blogs WHERE id = :id');
        $stmt->bindValue(':id', (int)$_POST['delete_id'], SQLITE3_INTEGER);
        $row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        if ($row && $row['screenshot_filename'] && is_file($uploadDir . '/' . $row['screenshot_filename'])) {
            @unlink($uploadDir . '/' . $row['screenshot_filename']);
        }
        $del = $db->prepare('DELETE FROM blogs WHERE id = :id');
        $del->bindValue(':id', (int)$_POST['delete_id'], SQLITE3_INTEGER);
        $del->execute();
        header('Location: /admin/bloguri.php'); exit;
    }

    $rawUrl = trim($_POST['url'] ?? '');
    if ($rawUrl !== '') {
        if (!str_starts_with($rawUrl, 'http://') && !str_starts_with($rawUrl, 'https://')) {
            $rawUrl = 'https://' . $rawUrl;
        }
        $url = filter_var($rawUrl, FILTER_VALIDATE_URL);
        if (!$url) {
            $error = 'URL invalid.';
        } else {
            $html = fetch_page_html($url);
            $name = '';
            if ($html !== false) {
                if (preg_match('/<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\'][^>]*>/i', $html, $m) ||
                    preg_match('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\'][^>]*>/i', $html, $m)) {
                    $name = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                } elseif (preg_match('/<title[^>]*>\s*(.*?)\s*<\/title>/si', $html, $m)) {
                    $name = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
                }
            }
            if ($name === '') $name = parse_url($url, PHP_URL_HOST) ?: $url;

            // Fetch og:image immediately on add
            $imgFile = ($html !== false) ? grab_image($url, $uploadDir, $html) : null;

            $stmt = $db->prepare('INSERT OR IGNORE INTO blogs (url, name, screenshot_filename, created_at) VALUES (:url, :name, :ss, :ts)');
            $stmt->bindValue(':url', $url, SQLITE3_TEXT);
            $stmt->bindValue(':name', $name, SQLITE3_TEXT);
            $stmt->bindValue(':ss', $imgFile, $imgFile ? SQLITE3_TEXT : SQLITE3_NULL);
            $stmt->bindValue(':ts', date('Y-m-d H:i:s'), SQLITE3_TEXT);
            $stmt->execute();

            if ($db->changes() === 0) $error = 'Blogul există deja.';
            header('Location: /admin/bloguri.php' . ($error ? '?err=' . urlencode($error) : '')); exit;
        }
    }
}

$error = $error ?: urldecode($_GET['err'] ?? '');

// Reset screenshot_filename if file missing or not a valid image (e.g. old corrupt thum.io files)
$allBlogs = $db->query('SELECT id, screenshot_filename FROM blogs WHERE screenshot_filename IS NOT NULL');
while ($b = $allBlogs->fetchArray(SQLITE3_ASSOC)) {
    $path = $uploadDir . '/' . $b['screenshot_filename'];
    if (!is_file($path) || @getimagesize($path) === false) {
        if (is_file($path)) @unlink($path);
        $db->exec('UPDATE blogs SET screenshot_filename = NULL WHERE id = ' . (int)$b['id']);
    }
}

// Auto-fetch one missing image per page load
$r = $db->querySingle('SELECT id, url FROM blogs WHERE screenshot_filename IS NULL LIMIT 1', true);
if ($r) {
    $newFile = grab_image($r['url'], $uploadDir);
    $upd = $db->prepare('UPDATE blogs SET screenshot_filename = :ss WHERE id = :id');
    $upd->bindValue(':ss', $newFile, $newFile ? SQLITE3_TEXT : SQLITE3_NULL);
    $upd->bindValue(':id', (int)$r['id'], SQLITE3_INTEGER);
    $upd->execute();
    if ($newFile) {
        header('Location: /admin/bloguri.php'); exit;
    }
}

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
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="admin-bar">
    <div class="admin-bar-inner">
      <a class="btn" href="/admin/">← admin</a>
      <a class="btn" href="/admin/logout.php" style="margin-left:auto">logout</a>
    </div>
  </div>

  <main class="page page-wide">
    <section class="section">
      <h1 class="page-title" style="margin-top:1rem;">bloguri</h1>

      <?php if ($error): ?>
        <p style="color:#c0392b; margin-bottom:1rem; font-size:15px;"><?php echo h($error); ?></p>
      <?php endif; ?>

      <form class="bloguri-add" method="post" action="/admin/bloguri.php">
        <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
        <input type="url" name="url" placeholder="https://exemplu.com/" required>
        <button type="submit">adaugă</button>
      </form>

      <?php if (empty($blogs)): ?>
        <p>Nicio intrare încă.</p>
      <?php else: ?>
        <div class="blog-grid">
          <?php foreach ($blogs as $b): ?>
            <div class="blog-card-wrap">
              <a class="blog-card" href="<?php echo h($b['url']); ?>" target="_blank" rel="noopener noreferrer">
                <?php if ($b['screenshot_filename']): ?>
                  <img class="blog-card-thumb" src="/uploads/bloguri/<?php echo h($b['screenshot_filename']); ?>" alt="<?php echo h($b['name']); ?>" loading="lazy">
                <?php else: ?>
                  <div class="blog-card-thumb blog-card-thumb--empty"></div>
                <?php endif; ?>
                <div class="blog-card-body">
                  <p class="blog-card-name"><?php echo h($b['name']); ?></p>
                  <p class="blog-card-url"><?php echo h(parse_url($b['url'], PHP_URL_HOST) ?: $b['url']); ?></p>
                </div>
              </a>
              <div class="blog-card-actions">
                <form method="post" action="/admin/bloguri.php" onsubmit="return confirm('Ștergi blogul?');">
                  <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
                  <input type="hidden" name="delete_id" value="<?php echo (int)$b['id']; ?>">
                  <button type="submit" title="șterge">×</button>
                </form>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </section>
  </main>
</body>
</html>
