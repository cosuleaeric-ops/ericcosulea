<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

$dbPath = __DIR__ . '/../data/blog.sqlite';
$db = new SQLite3($dbPath);
$db->exec('CREATE TABLE IF NOT EXISTS site_texts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text_key TEXT UNIQUE NOT NULL,
    text_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);');

function h(string $v): string {
    return htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
}

$error = '';
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        http_response_code(400);
        exit('CSRF invalid');
    }
    $code = $_POST['tracking_head'] ?? '';
    $stmt = $db->prepare('INSERT INTO site_texts (text_key, text_value, updated_at) VALUES (:key, :val, :at)
        ON CONFLICT(text_key) DO UPDATE SET text_value = :val, updated_at = :at');
    $stmt->bindValue(':key', 'tracking_head', SQLITE3_TEXT);
    $stmt->bindValue(':val', $code, SQLITE3_TEXT);
    $stmt->bindValue(':at', gmdate('c'), SQLITE3_TEXT);
    $stmt->execute();
    $success = true;
}

$stmt = $db->prepare('SELECT text_value FROM site_texts WHERE text_key = :key LIMIT 1');
$stmt->bindValue(':key', 'tracking_head', SQLITE3_TEXT);
$row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
$current = $row ? $row['text_value'] : '';
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tracking</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <style>
    .wrap { max-width: 820px; margin: 60px auto; padding: 24px; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 22px; padding: 28px; box-shadow: 0 18px 44px rgba(90,67,39,0.08); }
    label { display: block; margin: 12px 0 6px; font-weight: 600; }
    textarea { width: 100%; padding: 12px 14px; border-radius: 14px; border: 1px solid #d9d0c2; font-size: 14px; font-family: monospace; background: #fffefb; resize: vertical; min-height: 200px; box-sizing: border-box; }
    .note { font-size: 14px; color: #8a7b68; margin: 6px 0 0; }
    .success { background: #e8f5e9; border: 1px solid #a5d6a7; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }
    .link { text-decoration: none; color: #111; }
    .btn { margin-top: 16px; }
  </style>
</head>
<body>
  <div class="admin-bar">
    <div class="admin-bar-inner">
      <a class="btn" href="/">Website</a>
      <a class="btn" href="/admin/page.php?slug=tools">Tools</a>
      <a class="btn" href="/admin/edit.php">Articol nou</a>
    </div>
  </div>
  <div class="wrap">
    <a class="link" href="/admin/">← inapoi</a>
    <div class="card">
      <h1>Tracking</h1>
      <?php if ($success): ?>
        <div class="success">Salvat. Codul apare pe site doar pentru vizitatori (nu si pentru tine cand esti logat).</div>
      <?php endif; ?>
      <form method="post">
        <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
        <label for="tracking_head">Coduri de tracking (HTML — se injecteaza in &lt;head&gt;)</label>
        <textarea id="tracking_head" name="tracking_head" placeholder="<!-- Umami -->&#10;<script defer src=&quot;...&quot;></script>&#10;&#10;<!-- Google Analytics -->&#10;<script async src=&quot;...&quot;></script>"><?php echo h($current); ?></textarea>
        <p class="note">Lipeste aici scripturile de la Umami, Google Analytics sau orice alt tool. Sesiunile tale de admin nu vor fi niciodata trackuite.</p>
        <button class="btn" type="submit">Salveaza</button>
      </form>
    </div>
  </div>
</body>
</html>
