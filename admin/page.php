<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

$dbPath = __DIR__ . '/../data/blog.sqlite';
$db = new SQLite3($dbPath);
$db->exec('CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content_html TEXT NOT NULL,
    content_md TEXT,
    updated_at TEXT NOT NULL
);');

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function markdown_inline(string $text): string {
    $text = preg_replace_callback('/`([^`]+)`/', fn($m) => '<code>' . $m[1] . '</code>', $text);
    $text = preg_replace('/\*\*([^*]+)\*\*/', '<strong>$1</strong>', $text);
    $text = preg_replace('/\*([^*]+)\*/', '<em>$1</em>', $text);
    $text = preg_replace('/\[([^\]]+)\]\(([^)]+)\)/', '<a href="$2">$1</a>', $text);
    return $text;
}

function markdown_to_html(string $text): string {
    $escaped = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    $lines = preg_split("/\r\n|\n|\r/", $escaped);
    $out = [];
    $inList = false;

    foreach ($lines as $line) {
        $line = rtrim($line);
        if ($line === '') {
            if ($inList) {
                $out[] = '</ul>';
                $inList = false;
            }
            continue;
        }

        if (preg_match('/^###\s+(.+)/', $line, $m)) {
            if ($inList) { $out[] = '</ul>'; $inList = false; }
            $out[] = '<h3>' . markdown_inline($m[1]) . '</h3>';
            continue;
        }
        if (preg_match('/^##\s+(.+)/', $line, $m)) {
            if ($inList) { $out[] = '</ul>'; $inList = false; }
            $out[] = '<h2>' . markdown_inline($m[1]) . '</h2>';
            continue;
        }
        if (preg_match('/^#\s+(.+)/', $line, $m)) {
            if ($inList) { $out[] = '</ul>'; $inList = false; }
            $out[] = '<h1>' . markdown_inline($m[1]) . '</h1>';
            continue;
        }
        if (preg_match('/^-\s+(.+)/', $line, $m)) {
            if (!$inList) {
                $out[] = '<ul>';
                $inList = true;
            }
            $out[] = '<li>' . markdown_inline($m[1]) . '</li>';
            continue;
        }

        if ($inList) {
            $out[] = '</ul>';
            $inList = false;
        }
        $out[] = '<p>' . markdown_inline($line) . '</p>';
    }

    if ($inList) {
        $out[] = '</ul>';
    }

    return implode("\n", $out);
}

$slug = $_GET['slug'] ?? 'tools';
if ($slug !== 'tools') {
    $slug = 'tools';
}

$stmt = $db->prepare('SELECT id, slug, title, content_html, content_md, updated_at FROM pages WHERE slug = :slug');
$stmt->bindValue(':slug', $slug, SQLITE3_TEXT);
$page = $stmt->execute()->fetchArray(SQLITE3_ASSOC) ?: null;

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        http_response_code(400);
        exit('CSRF invalid');
    }

    $title = trim($_POST['title'] ?? 'tools');
    $contentMd = trim($_POST['content_markdown'] ?? '');

    if ($contentMd === '') {
        $error = 'Continutul este obligatoriu.';
    } else {
        $contentHtml = markdown_to_html($contentMd);
        if ($page) {
            $stmt = $db->prepare('UPDATE pages SET title = :title, content_html = :content_html, content_md = :content_md, updated_at = :updated_at WHERE slug = :slug');
        } else {
            $stmt = $db->prepare('INSERT INTO pages (slug, title, content_html, content_md, updated_at) VALUES (:slug, :title, :content_html, :content_md, :updated_at)');
        }
        $stmt->bindValue(':slug', $slug, SQLITE3_TEXT);
        $stmt->bindValue(':title', $title, SQLITE3_TEXT);
        $stmt->bindValue(':content_html', $contentHtml, SQLITE3_TEXT);
        $stmt->bindValue(':content_md', $contentMd, SQLITE3_TEXT);
        $stmt->bindValue(':updated_at', date('Y-m-d H:i:s'), SQLITE3_TEXT);
        $stmt->execute();

        header('Location: /tools');
        exit;
    }
}

$defaultContent = $page['content_md'] ?? "## lista\n- Cloudflare — securitate site-uri\n- Hostico — hosting si achizitie domenii\n- Elementor — tema WordPress\n- Imagify — optimizare imagini\n- Kit — Email Marketing\n- Notion — organizare\n- Semrush — keyword research, optimizare SEO, analiza competitorilor\n- Skillshare — cursuri online\n- Tomighty — Pomodoro minimalist pentru desktop\n- VWO — A/B testing\n- WP Rocket — optimizare viteza\n";
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Editeaza tools</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Crimson Pro", serif; background: #FFFDF7; color: #1c1c1c; }
    .wrap { max-width: 820px; margin: 60px auto; padding: 24px; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 16px; padding: 24px; }
    label { display: block; margin: 12px 0 6px; font-weight: 600; }
    input[type=text], textarea { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #d9d0c2; font-size: 16px; }
    textarea { min-height: 280px; font-family: inherit; }
    .toolbar { display: flex; gap: 8px; margin: 8px 0 6px; }
    .toolbar button { border: 1px solid #d9d0c2; background: #fff; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
    .btn { margin-top: 16px; background: #111; color: #fff; border: 0; border-radius: 10px; padding: 10px 16px; font-size: 16px; }
    .link { text-decoration: none; color: #111; }
    .err { background: #fdecec; border: 1px solid #f3caca; padding: 10px 12px; border-radius: 8px; margin-bottom: 10px; }
  </style>
</head>
<body class="admin">
  <div class="wrap">
    <a class="link" href="/tools">← inapoi</a>
    <div class="card">
      <h1>Editeaza tools</h1>
      <?php if ($error): ?>
        <div class="err"><?php echo h($error); ?></div>
      <?php endif; ?>
      <form method="post">
        <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
        <label for="title">Titlu</label>
        <input type="text" id="title" name="title" value="<?php echo h($page['title'] ?? 'tools'); ?>" required>

        <label for="content_markdown">Continut (Markdown)</label>
        <div class="toolbar">
          <button type="button" data-md="bold"><strong>B</strong></button>
          <button type="button" data-md="italic"><em>I</em></button>
          <button type="button" data-md="link">Link</button>
          <button type="button" data-md="h2">H2</button>
          <button type="button" data-md="list">Lista</button>
        </div>
        <textarea id="content_markdown" name="content_markdown" required><?php echo h($page['content_md'] ?? $defaultContent); ?></textarea>

        <button class="btn" type="submit">Salveaza</button>
      </form>
    </div>
  </div>
<script>
  const toolbar = document.querySelector('.toolbar');
  const textarea = document.getElementById('content_markdown');
  if (toolbar && textarea) {
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-md]');
      if (!btn) return;
      const type = btn.getAttribute('data-md');
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end);
      const wrap = (before, after) => {
        const text = before + (selected || '') + after;
        textarea.setRangeText(text, start, end, 'end');
      };
      if (type === 'bold') wrap('**', '**');
      if (type === 'italic') wrap('*', '*');
      if (type === 'link') wrap('[', '](https://)');
      if (type === 'h2') wrap('## ', '');
      if (type === 'list') wrap('- ', '');
      textarea.focus();
    });
  }
</script>
</body>
</html>
</html>
