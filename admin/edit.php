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

function markdown_inline(string $text): string {
    $text = preg_replace_callback('/`([^`]+)`/', fn($m) => '<code>' . $m[1] . '</code>', $text);
    $text = preg_replace('/\\*\\*([^*]+)\\*\\*/', '<strong>$1</strong>', $text);
    $text = preg_replace('/\\*([^*]+)\\*/', '<em>$1</em>', $text);
    $text = preg_replace('/\\[([^\\]]+)\\]\\(([^)]+)\\)/', '<a href="$2">$1</a>', $text);
    return $text;
}

function markdown_to_html(string $text): string {
    $escaped = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    $lines = preg_split("/\\r\\n|\\n|\\r/", $escaped);
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

        if (preg_match('/^###\\s+(.+)/', $line, $m)) {
            if ($inList) { $out[] = '</ul>'; $inList = false; }
            $out[] = '<h3>' . markdown_inline($m[1]) . '</h3>';
            continue;
        }
        if (preg_match('/^##\\s+(.+)/', $line, $m)) {
            if ($inList) { $out[] = '</ul>'; $inList = false; }
            $out[] = '<h2>' . markdown_inline($m[1]) . '</h2>';
            continue;
        }
        if (preg_match('/^#\\s+(.+)/', $line, $m)) {
            if ($inList) { $out[] = '</ul>'; $inList = false; }
            $out[] = '<h1>' . markdown_inline($m[1]) . '</h1>';
            continue;
        }
        if (preg_match('/^-\\s+(.+)/', $line, $m)) {
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

    return implode(\"\\n\", $out);
}

function slugify(string $text): string {
    $map = [
        'ă' => 'a', 'â' => 'a', 'î' => 'i', 'ș' => 's', 'ș' => 's', 'ţ' => 't', 'ț' => 't',
        'Ă' => 'a', 'Â' => 'a', 'Î' => 'i', 'Ș' => 's', 'Ţ' => 't', 'Ț' => 't',
    ];
    $text = strtr($text, $map);
    $text = strtolower($text);
    $text = preg_replace('/[^a-z0-9]+/i', '-', $text);
    $text = trim($text ?? '', '-');
    return $text;
}

function unique_slug(SQLite3 $db, string $slug, ?int $ignoreId = null): string {
    $base = $slug;
    $i = 2;
    while (true) {
        $stmt = $db->prepare('SELECT id FROM posts WHERE slug = :slug LIMIT 1');
        $stmt->bindValue(':slug', $slug, SQLITE3_TEXT);
        $row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        if (!$row || ($ignoreId !== null && (int)$row['id'] === $ignoreId)) {
            return $slug;
        }
        $slug = $base . '-' . $i;
        $i++;
    }
}

$id = isset($_GET['id']) ? (int)$_GET['id'] : null;
$post = null;
if ($id) {
    $stmt = $db->prepare('SELECT id, slug, title, content_html, content_md, excerpt, published_at FROM posts WHERE id = :id');
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $post = $stmt->execute()->fetchArray(SQLITE3_ASSOC) ?: null;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        http_response_code(400);
        exit('CSRF invalid');
    }
    $title = trim($_POST['title'] ?? '');
    $slug = trim($_POST['slug'] ?? '');
    $contentMd = trim($_POST['content_markdown'] ?? '');
    $publishedAt = trim($_POST['published_at'] ?? '');
    $excerpt = trim($_POST['excerpt'] ?? '');

    if ($title === '' || $contentMd === '' || $publishedAt === '') {
        $error = 'Titlu, continut si data sunt obligatorii.';
    } else {
        $contentHtml = markdown_to_html($contentMd);
        if ($slug === '') {
            $slug = slugify($title);
        } else {
            $slug = slugify($slug);
        }
        $slug = unique_slug($db, $slug, $id);

        if ($id) {
            $stmt = $db->prepare('UPDATE posts SET slug = :slug, title = :title, content_html = :content_html, content_md = :content_md, excerpt = :excerpt, published_at = :published_at WHERE id = :id');
            $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        } else {
            $stmt = $db->prepare('INSERT INTO posts (slug, title, content_html, content_md, excerpt, published_at) VALUES (:slug, :title, :content_html, :content_md, :excerpt, :published_at)');
        }
        $stmt->bindValue(':slug', $slug, SQLITE3_TEXT);
        $stmt->bindValue(':title', $title, SQLITE3_TEXT);
        $stmt->bindValue(':content_html', $contentHtml, SQLITE3_TEXT);
        $stmt->bindValue(':content_md', $contentMd, SQLITE3_TEXT);
        $stmt->bindValue(':excerpt', $excerpt, SQLITE3_TEXT);
        $stmt->bindValue(':published_at', $publishedAt, SQLITE3_TEXT);
        $stmt->execute();

        header('Location: /admin/');
        exit;
    }
}

$defaultDate = $post ? $post['published_at'] : date('Y-m-d H:i:s');
$defaultContent = $post['content_md'] ?? $post['content_html'] ?? '';
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?php echo $post ? 'Editeaza articol' : 'Articol nou'; ?></title>
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
    .row { display: flex; gap: 16px; }
    .row > div { flex: 1; }
    .btn { margin-top: 16px; background: #d7c2a5; color: #3f2d1b; border: 1px solid rgba(143, 111, 74, 0.18); border-radius: 999px; padding: 10px 16px; font-size: 16px; font-family: "Crimson Pro", serif; font-weight: 600; letter-spacing: 0.01em; text-transform: lowercase; }
    .link { text-decoration: none; color: #111; }
    .err { background: #fdecec; border: 1px solid #f3caca; padding: 10px 12px; border-radius: 8px; margin-bottom: 10px; }
  </style>
</head>
<body class="admin">
  <div class="wrap">
    <a class="link" href="/admin/">← inapoi</a>
    <div class="card">
      <h1><?php echo $post ? 'Editeaza articol' : 'Articol nou'; ?></h1>
      <?php if ($error): ?>
        <div class="err"><?php echo h($error); ?></div>
      <?php endif; ?>
      <form method="post">
        <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
        <label for="title">Titlu</label>
        <input type="text" id="title" name="title" value="<?php echo h($post['title'] ?? ($_POST['title'] ?? '')); ?>" required>

        <div class="row">
          <div>
            <label for="slug">Slug (URL)</label>
            <input type="text" id="slug" name="slug" value="<?php echo h($post['slug'] ?? ($_POST['slug'] ?? '')); ?>" placeholder="titlu-articol">
          </div>
          <div>
            <label for="published_at">Data publicarii</label>
            <input type="text" id="published_at" name="published_at" value="<?php echo h($post['published_at'] ?? ($_POST['published_at'] ?? $defaultDate)); ?>" placeholder="YYYY-MM-DD HH:MM:SS" required>
          </div>
        </div>

        <label for="excerpt">Excerpt (optional)</label>
        <input type="text" id="excerpt" name="excerpt" value="<?php echo h($post['excerpt'] ?? ($_POST['excerpt'] ?? '')); ?>">

        <label for="content_markdown">Continut (Markdown)</label>
        <div class="toolbar">
          <button type="button" data-md="bold"><strong>B</strong></button>
          <button type="button" data-md="italic"><em>I</em></button>
          <button type="button" data-md="link">Link</button>
          <button type="button" data-md="h2">H2</button>
          <button type="button" data-md="list">Lista</button>
        </div>
        <textarea id="content_markdown" name="content_markdown" required><?php echo h($defaultContent !== '' ? $defaultContent : ($_POST['content_markdown'] ?? '')); ?></textarea>

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
