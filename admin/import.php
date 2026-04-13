<?php
declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();

$dbPath = __DIR__ . '/../data/blog.sqlite';
$message = '';
$error = '';

if (!extension_loaded('sqlite3')) {
    $error = 'SQLite3 nu este disponibil pe server. Contacteaza suportul Hostico pentru activare.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$error) {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        $error = 'Sesiune invalida. Reincarca pagina si incearca din nou.';
    } elseif (!isset($_FILES['wxr']) || $_FILES['wxr']['error'] !== UPLOAD_ERR_OK) {
        $error = 'Incarcarea fisierului a esuat.';
    } else {
        $tmp = $_FILES['wxr']['tmp_name'];
        $xml = simplexml_load_file($tmp, 'SimpleXMLElement', LIBXML_NOCDATA);
        if (!$xml) {
            $error = 'Fisierul XML nu este valid.';
        } else {
            $xml->registerXPathNamespace('wp', 'http://wordpress.org/export/1.2/');
            $xml->registerXPathNamespace('content', 'http://purl.org/rss/1.0/modules/content/');
            $xml->registerXPathNamespace('excerpt', 'http://wordpress.org/export/1.2/excerpt/');

            $db = new SQLite3($dbPath);
            $db->exec('PRAGMA journal_mode=WAL;');
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
            $db->exec('DELETE FROM posts;');

            $stmt = $db->prepare('INSERT INTO posts (slug, title, content_html, content_md, excerpt, published_at) VALUES (:slug, :title, :content_html, :content_md, :excerpt, :published_at)');

            $count = 0;
            foreach ($xml->channel->item as $item) {
                $wp = $item->children('wp', true);
                $postType = (string)$wp->post_type;
                $status = (string)$wp->status;
                if ($postType !== 'post' || $status !== 'publish') {
                    continue;
                }

                $slug = trim((string)$wp->post_name);
                if ($slug === '') {
                    continue;
                }

                $content = (string)$item->children('content', true)->encoded;
                $excerpt = (string)$item->children('excerpt', true)->encoded;
                $title = (string)$item->title;
                $date = (string)$wp->post_date;

                $stmt->bindValue(':slug', $slug, SQLITE3_TEXT);
                $stmt->bindValue(':title', $title, SQLITE3_TEXT);
                $stmt->bindValue(':content_html', $content, SQLITE3_TEXT);
                $stmt->bindValue(':content_md', null, SQLITE3_NULL);
                $stmt->bindValue(':excerpt', $excerpt, SQLITE3_TEXT);
                $stmt->bindValue(':published_at', $date, SQLITE3_TEXT);
                $stmt->execute();
                $count++;
            }

            $message = "Import finalizat. Articole importate: {$count}.";
        }
    }
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Import WordPress</title>
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Crimson Pro", serif; background: #FFFDF7; color: #1c1c1c; }
    .wrap { max-width: 620px; margin: 60px auto; padding: 24px; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 16px; padding: 24px; }
    h1 { margin-top: 0; }
    input[type=file] { margin: 12px 0 18px; }
    button { min-height: 28px; background: #d7c2a5; color: #3f2d1b; border: 1px solid rgba(143, 111, 74, 0.18); border-radius: 999px; padding: 5px 12px; font-size: 15px; font-family: "Crimson Pro", serif; font-weight: 600; letter-spacing: 0.01em; text-transform: lowercase; }
    .msg { margin: 12px 0; padding: 10px 12px; border-radius: 8px; }
    .ok { background: #eef8ee; border: 1px solid #cfe8cf; }
    .err { background: #fdecec; border: 1px solid #f3caca; }
  </style>
</head>
<body class="admin">
  <div class="wrap">
    <div class="card">
      <h1>Import WordPress</h1>
      <p>Incarca fisierul exportat din WordPress (WXR .xml). Importul rescrie articolele existente.</p>
      <?php if ($message): ?>
        <div class="msg ok"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
      <?php endif; ?>
      <?php if ($error): ?>
        <div class="msg err"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
      <?php endif; ?>
      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
        <input type="file" name="wxr" accept=".xml" required>
        <div>
          <button type="submit">Importa</button>
        </div>
      </form>
      <p>Dupa import, sterge acest fisier pentru siguranta.</p>
    </div>
  </div>
</body>
</html>
