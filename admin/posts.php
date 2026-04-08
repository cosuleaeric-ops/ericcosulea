<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

$dbPath = __DIR__ . '/../data/blog.sqlite';
$db = new SQLite3($dbPath);

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id'])) {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) { http_response_code(400); exit('CSRF invalid'); }
    $stmt = $db->prepare('DELETE FROM posts WHERE id = :id');
    $stmt->bindValue(':id', (int)$_POST['delete_id'], SQLITE3_INTEGER);
    $stmt->execute();
    header('Location: /admin/posts.php');
    exit;
}

$result = $db->query('SELECT id, slug, title, published_at FROM posts ORDER BY published_at DESC');
$posts = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) $posts[] = $row;
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Articole — Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <style>
    .wrap { max-width: 820px; margin: 60px auto; padding: 24px; }
    .page-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .page-header h1 { margin: 0; }
    .btn-new { background: #1c1c1c; color: #fff; text-decoration: none; padding: 8px 18px; border-radius: 10px; font-size: 14px; font-family: inherit; transition: opacity 0.15s; }
    .btn-new:hover { opacity: 0.8; }
    .list { display: flex; flex-direction: column; gap: 10px; }
    .item { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 12px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .item a { color: #111; text-decoration: none; font-weight: 600; font-size: 15px; }
    .item a:hover { text-decoration: underline; }
    .meta { color: #6d6a64; font-size: 13px; margin-top: 3px; }
    .danger { background: #f4d6d6; border: 0; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; flex-shrink: 0; }
    .danger:hover { background: #edbbbb; }
    .empty { color: #6d6a64; font-size: 16px; padding: 32px 0; text-align: center; }
    @media (max-width: 720px) { .wrap { margin: 28px auto; padding: 18px; } }
  </style>
</head>
<body>
  <div class="admin-bar">
    <div class="admin-bar-inner">
      <a class="btn" href="/admin/">← Admin</a>
      <a class="btn" href="/blog">Blog</a>
      <a class="btn" href="/admin/edit.php">Articol nou</a>
      <a class="btn" href="/admin/logout.php" style="margin-left:auto">Logout</a>
    </div>
  </div>

  <div class="wrap">
    <div class="page-header">
      <h1>articole (<?php echo count($posts); ?>)</h1>
      <a class="btn-new" href="/admin/edit.php">+ articol nou</a>
    </div>

    <?php if (empty($posts)): ?>
    <p class="empty">Niciun articol publicat încă.</p>
    <?php else: ?>
    <div class="list">
      <?php foreach ($posts as $p): ?>
      <div class="item">
        <div>
          <a href="/admin/edit.php?id=<?php echo (int)$p['id']; ?>"><?php echo h($p['title']); ?></a>
          <div class="meta">/<?php echo h($p['slug']); ?> &middot; <?php echo h(date('j F Y', strtotime($p['published_at']))); ?></div>
        </div>
        <form method="post" onsubmit="return confirm('Ștergi acest articol?');">
          <input type="hidden" name="delete_id" value="<?php echo (int)$p['id']; ?>">
          <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
          <button class="danger" type="submit">Șterge</button>
        </form>
      </div>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
  </div>
</body>
</html>
