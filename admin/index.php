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
}

$result = $db->query('SELECT id, slug, title, published_at FROM posts ORDER BY published_at DESC');
$posts = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
    $posts[] = $row;
}

$postCount = count($posts);
$latestPost = $posts[0] ?? null;
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
  <link rel="stylesheet" href="/styles.css">
  <style>
    .wrap { max-width: 820px; margin: 60px auto; padding: 24px; }
    .top { display: block; }
    .top h1 { margin: 0; }
    .intro { margin-top: 18px; color: #6d6a64; font-size: 18px; }
    .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 22px; }
    .quick-card { display: block; padding: 20px; background: #fffaf2; border: 1px solid #efe6d6; border-radius: 18px; text-decoration: none; color: #1c1c1c; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
    .quick-card:hover { transform: translateY(-2px); border-color: #dcc9aa; box-shadow: 0 12px 28px rgba(90, 67, 39, 0.08); }
    .quick-card-kicker { display: block; font-size: 13px; text-transform: lowercase; letter-spacing: 0.04em; color: #8a7b68; margin-bottom: 8px; }
    .quick-card h2 { margin: 0; font-size: 32px; font-weight: 600; line-height: 0.95; text-transform: lowercase; }
    .quick-card p { margin: 10px 0 0; color: #6d6a64; font-size: 16px; }
    .section-title { margin: 28px 0 12px; font-size: 28px; font-weight: 600; text-transform: lowercase; }
    .list { margin-top: 0; display: flex; flex-direction: column; gap: 10px; }
    .item { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 12px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: baseline; }
    .item a { color: #111; text-decoration: none; font-weight: 600; }
    .meta { color: #6d6a64; font-size: 14px; }
    .link { text-decoration: none; color: #111; font-size: 14px; }
    .danger { background: #f4d6d6; border: 0; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
    .logout-row { display: flex; justify-content: flex-end; margin-top: 24px; }
    @media (max-width: 720px) {
      .wrap { margin: 28px auto; padding: 18px; }
      .quick-grid { grid-template-columns: 1fr; }
      .quick-card h2 { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="admin-bar">
    <div class="admin-bar-inner">
      <a class="btn" href="/">Website</a>
      <a class="btn" href="/admin/page.php?slug=tools">Tools</a>
      <a class="btn" href="/admin/tracking.php">Tracking</a>
      <a class="btn" href="/admin/edit.php">Articol nou</a>
      <a class="btn" href="/admin/logout.php" style="margin-left:auto">Logout</a>
    </div>
  </div>
  <div class="wrap">
    <div class="top">
      <h1>Admin</h1>
    </div>
    <p class="intro">hub-ul tau intern pentru scris, organizare si sprinturi scurte de lucru.</p>

    <section class="quick-grid" aria-label="Actiuni rapide">
      <a class="quick-card" href="/">
        <span class="quick-card-kicker">public</span>
        <h2>website</h2>
        <p>vezi homepage-ul live si editezi direct in paginile publice cat timp esti logat.</p>
      </a>
      <a class="quick-card" href="/admin/edit.php">
        <span class="quick-card-kicker">scris</span>
        <h2>articol nou</h2>
        <p>deschide editorul si porneste direct un draft nou.</p>
      </a>
    </section>

    <section>
      <h2 class="section-title">overview</h2>
      <div class="quick-grid">
        <a class="quick-card" href="/blog">
          <span class="quick-card-kicker">public</span>
          <h2><?php echo h((string)$postCount); ?> articole</h2>
          <p><?php echo $latestPost ? 'ultimul: ' . h($latestPost['title']) : 'inca nu ai publicat nimic.'; ?></p>
        </a>
        <a class="quick-card" href="/admin/page.php?slug=tools">
          <span class="quick-card-kicker">pagina</span>
          <h2>tools</h2>
          <p>actualizezi rapid pagina publica cu tool-urile si resursele tale.</p>
        </a>
      </div>
    </section>

    <section style="margin-top:28px">
      <h2 class="section-title">cursuri la pahar</h2>
      <a class="quick-card" href="/clp/" style="display:inline-flex;align-items:center;gap:10px;padding:16px 22px;margin-top:0;text-decoration:none">
        <span style="font-size:20px">🍷</span>
        <span>
          <strong style="font-size:16px;display:block;text-transform:lowercase">dashboard CLP</strong>
          <span style="font-size:13px;color:#6d6a64">P&amp;L, analizor bilete și tooluri viitoare</span>
        </span>
      </a>
    </section>

    <section>
      <h2 class="section-title">articole recente</h2>
    </section>
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

  </div>
</body>
</html>
