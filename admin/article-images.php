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

require_once __DIR__ . '/../lib/article_images.php';

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

$message = '';
$error = '';
$uploadDir = __DIR__ . '/../uploads/article-images';
$allowedMimeTypes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        $error = 'Sesiune invalida. Reincarca pagina.';
    } else {
        $originalUrl = trim((string)($_POST['original_url'] ?? ''));
        $action = (string)($_POST['action'] ?? 'upload');

        if ($originalUrl === '') {
            $error = 'Lipseste URL-ul original al imaginii.';
        } elseif ($action === 'delete') {
            ensure_article_image_table($db);
            $stmt = $db->prepare('SELECT replacement_url FROM article_image_replacements WHERE original_url = :original_url LIMIT 1');
            $stmt->bindValue(':original_url', $originalUrl, SQLITE3_TEXT);
            $existing = $stmt->execute()->fetchArray(SQLITE3_ASSOC) ?: null;
            if ($existing) {
                $path = __DIR__ . '/..' . parse_url($existing['replacement_url'], PHP_URL_PATH);
                if (is_string($path) && is_file($path)) {
                    @unlink($path);
                }
                $deleteStmt = $db->prepare('DELETE FROM article_image_replacements WHERE original_url = :original_url');
                $deleteStmt->bindValue(':original_url', $originalUrl, SQLITE3_TEXT);
                $deleteStmt->execute();
            }
            $message = 'Imaginea inlocuita a fost stearsa.';
        } else {
            if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
                $error = 'Incarcarea imaginii a esuat.';
            } else {
                if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
                    $error = 'Nu am putut crea folderul pentru imagini.';
                } else {
                    $tmpFile = $_FILES['image']['tmp_name'];
                    $imageInfo = @getimagesize($tmpFile);
                    $mimeType = $imageInfo['mime'] ?? '';
                    $extension = $allowedMimeTypes[$mimeType] ?? null;

                    if ($extension === null) {
                        $error = 'Fisierul trebuie sa fie o imagine jpg, png, webp sau gif.';
                    } else {
                        $baseName = basename(parse_url($originalUrl, PHP_URL_PATH) ?? 'image');
                        $safeBaseName = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $baseName) ?: 'image';
                        $filename = substr(sha1($originalUrl), 0, 12) . '-' . $safeBaseName;
                        $filename = preg_replace('/\.[a-zA-Z0-9]+$/', '', $filename) . '.' . $extension;
                        $targetPath = $uploadDir . '/' . $filename;
                        $replacementUrl = '/uploads/article-images/' . $filename;

                        if (move_uploaded_file($tmpFile, $targetPath)) {
                            chmod($targetPath, 0644);
                            ensure_article_image_table($db);
                            $stmt = $db->prepare('INSERT INTO article_image_replacements (original_url, replacement_url, uploaded_at) VALUES (:original_url, :replacement_url, :uploaded_at)
                                ON CONFLICT(original_url) DO UPDATE SET replacement_url = excluded.replacement_url, uploaded_at = excluded.uploaded_at');
                            $stmt->bindValue(':original_url', $originalUrl, SQLITE3_TEXT);
                            $stmt->bindValue(':replacement_url', $replacementUrl, SQLITE3_TEXT);
                            $stmt->bindValue(':uploaded_at', date('Y-m-d H:i:s'), SQLITE3_TEXT);
                            $stmt->execute();
                            $message = 'Imaginea a fost inlocuita si este live.';
                        } else {
                            $error = 'Nu am putut salva imaginea pe server.';
                        }
                    }
                }
            }
        }
    }
}

$rows = collect_article_image_rows($db);
$total = count($rows);
$resolved = count(array_filter($rows, fn(array $row): bool => !empty($row['replacement_url'])));
$missing = $total - $resolved;
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Imagini articole</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Crimson Pro", serif; background: #FFFDF7; color: #1c1c1c; }
    .wrap { max-width: 1100px; margin: 48px auto; padding: 24px; }
    .link { text-decoration: none; color: #111; }
    .intro { margin: 14px 0 24px; color: #6d6a64; font-size: 18px; }
    .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .pill { padding: 7px 12px; border-radius: 999px; background: rgba(108, 82, 51, 0.08); border: 1px solid rgba(108, 82, 51, 0.12); font-size: 15px; text-transform: lowercase; }
    .msg { margin: 12px 0; padding: 10px 12px; border-radius: 10px; }
    .ok { background: #eef8ee; border: 1px solid #cfe8cf; }
    .err { background: #fdecec; border: 1px solid #f3caca; }
    .grid { display: grid; gap: 14px; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 18px; padding: 18px; }
    .card-top { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; }
    .card h2 { margin: 0; font-size: 26px; font-weight: 600; text-transform: lowercase; }
    .meta { color: #6d6a64; font-size: 14px; }
    .path { margin: 12px 0; font-size: 14px; word-break: break-all; color: #7b6b57; }
    .preview-row { display: grid; grid-template-columns: repeat(2, minmax(0, 220px)); gap: 18px; align-items: start; margin: 14px 0; }
    .preview-box { background: #f7f1e7; border: 1px solid #eadbc3; border-radius: 16px; padding: 14px; }
    .preview-box strong { display: block; margin-bottom: 10px; text-transform: lowercase; }
    .preview-box img { width: 100%; height: auto; border-radius: 12px; display: block; background: #efe4d3; }
    .preview-empty { color: #8a7b68; font-size: 14px; }
    .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .btn, .file-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 5px 12px;
      background: rgba(108, 82, 51, 0.08);
      color: #3f2d1b;
      border: 1px solid rgba(108, 82, 51, 0.12);
      border-radius: 999px;
      font-family: "Crimson Pro", serif;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.01em;
      text-decoration: none;
      line-height: 1;
      text-transform: lowercase;
      cursor: pointer;
    }
    .file-label { position: relative; overflow: hidden; }
    .file-label input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .delete { background: #f4d6d6; border-color: #e7bbbb; color: #6d2c2c; }
    .helper { color: #8a7b68; font-size: 14px; }
    @media (max-width: 720px) {
      .wrap { margin: 28px auto; padding: 16px; }
      .preview-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body class="admin">
  <div class="wrap">
    <a class="link" href="/admin/">← inapoi</a>
    <h1>imagini articole</h1>
    <p class="intro">aici repari imaginile lipsa din articolele importate. incarci replacement-ul si el apare imediat in articolul live.</p>

    <div class="stats">
      <div class="pill"><?php echo h((string)$total); ?> imagini detectate</div>
      <div class="pill"><?php echo h((string)$resolved); ?> reparate</div>
      <div class="pill"><?php echo h((string)$missing); ?> ramase</div>
    </div>

    <?php if ($message !== ''): ?>
      <div class="msg ok"><?php echo h($message); ?></div>
    <?php endif; ?>
    <?php if ($error !== ''): ?>
      <div class="msg err"><?php echo h($error); ?></div>
    <?php endif; ?>

    <div class="grid">
      <?php foreach ($rows as $row): ?>
        <div class="card">
          <div class="card-top">
            <div>
              <h2><?php echo h($row['title']); ?></h2>
              <div class="meta">/<?php echo h($row['slug']); ?> · <?php echo h($row['basename']); ?></div>
            </div>
            <a class="link" href="/<?php echo h($row['slug']); ?>" target="_blank" rel="noopener noreferrer">vezi articolul</a>
          </div>

          <div class="path"><?php echo h($row['original_url']); ?></div>

          <div class="preview-row">
            <div class="preview-box">
              <strong>url vechi</strong>
              <img src="<?php echo h($row['original_url']); ?>" alt="">
            </div>
            <div class="preview-box">
              <strong>replacement</strong>
              <?php if (!empty($row['replacement_url'])): ?>
                <img src="<?php echo h($row['replacement_url']); ?>" alt="">
              <?php else: ?>
                <div class="preview-empty">inca nu ai incarcat replacement pentru imaginea asta.</div>
              <?php endif; ?>
            </div>
          </div>

          <form class="actions" method="post" enctype="multipart/form-data">
            <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
            <input type="hidden" name="original_url" value="<?php echo h($row['original_url']); ?>">
            <label class="file-label">
              <span>alege imagine</span>
              <input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif" required>
            </label>
            <button class="btn" type="submit">salveaza replacement</button>
          </form>

          <?php if (!empty($row['replacement_url'])): ?>
            <form class="actions" method="post" style="margin-top:10px;">
              <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
              <input type="hidden" name="original_url" value="<?php echo h($row['original_url']); ?>">
              <input type="hidden" name="action" value="delete">
              <button class="btn delete" type="submit">sterge replacement</button>
            </form>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>

    <p class="helper">daca ai gasit uploadurile originale, le poti pune aici treptat fara sa refaci articolele.</p>
  </div>
</body>
</html>
