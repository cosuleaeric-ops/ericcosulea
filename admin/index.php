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

$result = $db->query('SELECT id, slug, title, published_at FROM posts ORDER BY published_at DESC');
$posts = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) $posts[] = $row;
$postCount  = count($posts);
$latestPost = $posts[0] ?? null;
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin</title>
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <style>
    .wrap { max-width: 820px; margin: 0 auto; padding: 24px; }
    .top h1 { margin: 0; }
    .intro { margin-top: 18px; color: #6d6a64; font-size: 18px; }
    .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 22px; }
    .quick-card { display: block; padding: 20px; background: #fffaf2; border: 1px solid #efe6d6; border-radius: 18px; text-decoration: none; color: #1c1c1c; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
    .quick-card:hover { transform: translateY(-2px); border-color: #dcc9aa; box-shadow: 0 12px 28px rgba(90, 67, 39, 0.08); }
    .quick-card-kicker { display: block; font-size: 13px; text-transform: lowercase; letter-spacing: 0.04em; color: #8a7b68; margin-bottom: 8px; }
    .quick-card h2 { margin: 0; font-size: 32px; font-weight: 600; line-height: 0.95; text-transform: lowercase; }
    .quick-card p { margin: 10px 0 0; color: #6d6a64; font-size: 16px; }
    .section-title { margin: 36px 0 0; font-size: 28px; font-weight: 600; text-transform: lowercase; }
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
      <a class="btn" href="/admin/logout.php" style="margin-left:auto">Logout</a>
    </div>
  </div>

  <div class="wrap">
    <div class="top">
      <h1>Admin</h1>
    </div>
    <p class="intro">hub-ul tau intern pentru scris, organizare si sprinturi scurte de lucru.</p>

    <!-- ── Tooluri personale ── -->
    <h2 class="section-title">tooluri personale</h2>
    <section class="quick-grid" aria-label="Tooluri personale">
      <a class="quick-card" href="/pnlpersonal/">
        <h2>💰 p&amp;l personal</h2>
        <p>cheltuieli, venituri și portofel — cash, ING, Revolut, Trading212.</p>
      </a>
      <a class="quick-card" href="/dogu/">
        <h2>🍜 dogu</h2>
        <p>reviews, comenzi și vânzări restaurant — Bolt, Glovo, Breeze.</p>
      </a>
      <a class="quick-card" href="/elite-deux/">
        <h2>⚡ elite deux</h2>
        <p>task grid săptămânal cu teme, coloane configurabile și export.</p>
      </a>
      <a class="quick-card" href="/deep-work/">
        <h2>🎯 deep work</h2>
        <p>timer de focus cu calendar heatmap și integrare wip.co.</p>
      </a>
      <a class="quick-card" href="/admin/journal.php">
        <h2>📓 journal</h2>
        <p>reflecții săptămânale — wins, challenges și lecții învățate.</p>
      </a>
    </section>

    <!-- ── Website ── -->
    <h2 class="section-title">website</h2>
    <section class="quick-grid" aria-label="Website">
      <a class="quick-card" href="/admin/proiecte.php">
        <h2>🚀 proiecte</h2>
        <p>adaugă, editează și șterge proiectele afișate pe pagina principală.</p>
      </a>
    </section>

    <!-- ── Overview blog ── -->
    <h2 class="section-title">overview blog</h2>
    <section class="quick-grid" aria-label="Blog">
      <a class="quick-card" href="/admin/posts.php">
        <h2><?php echo h((string)$postCount); ?> articole</h2>
        <p><?php echo $latestPost ? 'ultimul: ' . h($latestPost['title']) : 'inca nu ai publicat nimic.'; ?></p>
      </a>
      <a class="quick-card" href="/admin/edit.php">
        <h2>articol nou</h2>
        <p>deschide editorul și pornește direct un draft nou.</p>
      </a>
      <a class="quick-card" href="/admin/page.php?slug=tools">
        <h2>tools</h2>
        <p>actualizezi rapid pagina publică cu tool-urile și resursele tale.</p>
      </a>
      <a class="quick-card" href="/admin/bloguri.php">
        <h2>bloguri</h2>
        <p>adaugi și gestionezi lista de bloguri recomandate.</p>
      </a>
    </section>

  </div>
</body>
</html>
