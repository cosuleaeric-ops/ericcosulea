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
    $contentHtml = trim($_POST['content_html'] ?? '');

    if ($contentHtml === '') {
        $error = 'Continutul este obligatoriu.';
    } else {
        if ($page) {
            $stmt = $db->prepare('UPDATE pages SET title = :title, content_html = :content_html, content_md = :content_md, updated_at = :updated_at WHERE slug = :slug');
        } else {
            $stmt = $db->prepare('INSERT INTO pages (slug, title, content_html, content_md, updated_at) VALUES (:slug, :title, :content_html, :content_md, :updated_at)');
        }
        $stmt->bindValue(':slug', $slug, SQLITE3_TEXT);
        $stmt->bindValue(':title', $title, SQLITE3_TEXT);
        $stmt->bindValue(':content_html', $contentHtml, SQLITE3_TEXT);
        $stmt->bindValue(':content_md', null, SQLITE3_NULL);
        $stmt->bindValue(':updated_at', date('Y-m-d H:i:s'), SQLITE3_TEXT);
        $stmt->execute();

        header('Location: /tools');
        exit;
    }
}

$defaultContent = $_POST['content_html'] ?? ($page['content_html'] ?? "<h2>lista</h2><ul><li>Cloudflare — securitate site-uri</li><li>Hostico — hosting si achizitie domenii</li><li>Elementor — tema WordPress</li><li>Imagify — optimizare imagini</li><li>Kit — Email Marketing</li><li>Notion — organizare</li><li>Semrush — keyword research, optimizare SEO, analiza competitorilor</li><li>Skillshare — cursuri online</li><li>Tomighty — Pomodoro minimalist pentru desktop</li><li>VWO — A/B testing</li><li>WP Rocket — optimizare viteza</li></ul>");
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
  <link rel="stylesheet" href="/styles.css">
  <style>
    .wrap { max-width: 980px; margin: 48px auto; padding: 24px; }
    .card { background: #fffaf2; border: 1px solid #efe6d6; border-radius: 22px; padding: 28px; box-shadow: 0 18px 44px rgba(90, 67, 39, 0.08); }
    label { display: block; margin: 12px 0 6px; font-weight: 600; }
    input[type=text] { width: 100%; padding: 12px 14px; border-radius: 14px; border: 1px solid #d9d0c2; font-size: 16px; background: #fffefb; }
    .toolbar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 10px 0 0;
      padding: 12px;
      border: 1px solid #e5d8c5;
      border-bottom: 0;
      border-radius: 18px 18px 0 0;
      background: linear-gradient(180deg, #fbf4e8 0%, #f7eddf 100%);
    }
    .toolbar button, .toolbar select {
      border: 1px solid #d7c8b1;
      background: rgba(255,255,255,0.86);
      border-radius: 999px;
      padding: 7px 12px;
      cursor: pointer;
      font-family: "Crimson Pro", serif;
      font-size: 15px;
      color: #3f2d1b;
    }
    .btn { margin-top: 16px; }
    .link { text-decoration: none; color: #111; }
    .err { background: #fdecec; border: 1px solid #f3caca; padding: 10px 12px; border-radius: 8px; margin-bottom: 10px; }
    .editor-shell { border: 1px solid #e5d8c5; border-radius: 0 0 18px 18px; background: #fffefb; overflow: hidden; }
    .editor {
      min-height: 460px;
      padding: 22px;
      font-size: 20px;
      line-height: 1.75;
      outline: none;
    }
    .editor:empty:before {
      content: attr(data-placeholder);
      color: #a09282;
    }
    .editor p, .editor ul, .editor ol, .editor blockquote, .editor h2, .editor h3 { margin-top: 0; }
    .editor h2 { font-size: 32px; line-height: 1.2; }
    .editor h3 { font-size: 26px; line-height: 1.25; }
    .editor blockquote {
      margin-left: 0;
      padding-left: 18px;
      border-left: 3px solid #d9c4a2;
      color: #6d6255;
      font-style: italic;
    }
    .editor-toolbar-note { margin: 10px 0 0; font-size: 14px; color: #8a7b68; }
    .editor-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 16px; }
    @media (max-width: 720px) {
      .wrap { margin: 24px auto; padding: 16px; }
      .card { padding: 18px; border-radius: 18px; }
      .editor { min-height: 340px; padding: 18px; font-size: 18px; }
    }
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
    <a class="link" href="/tools">← inapoi</a>
    <div class="card">
      <h1>Editeaza tools</h1>
      <?php if ($error): ?>
        <div class="err"><?php echo h($error); ?></div>
      <?php endif; ?>
      <form method="post">
        <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
        <input type="hidden" id="content_html" name="content_html" value="<?php echo h($defaultContent); ?>">
        <label for="title">Titlu</label>
        <input type="text" id="title" name="title" value="<?php echo h($page['title'] ?? 'tools'); ?>" required>

        <label for="editor">Continut</label>
        <div class="toolbar">
          <select id="formatBlock" aria-label="Format paragraf">
            <option value="P">paragraf</option>
            <option value="H2">heading mare</option>
            <option value="H3">heading mic</option>
          </select>
          <button type="button" data-command="bold"><strong>B</strong></button>
          <button type="button" data-command="italic"><em>I</em></button>
          <button type="button" data-command="insertUnorderedList">lista</button>
          <button type="button" data-command="insertOrderedList">1. 2. 3.</button>
          <button type="button" data-command="formatBlock" data-value="blockquote">quote</button>
          <button type="button" data-action="link">link</button>
          <button type="button" data-action="unlink">scoate link</button>
        </div>
        <div class="editor-shell">
          <div
            id="editor"
            class="editor"
            contenteditable="true"
            data-placeholder="scrie aici exact cum vrei sa apara pagina..."
          ><?php echo $defaultContent; ?></div>
        </div>
        <p class="editor-toolbar-note">poti scrie direct in editor, selectezi textul si folosesti butoanele de sus pentru formatare.</p>

        <div class="editor-actions">
          <button class="btn" type="submit">Salveaza</button>
        </div>
      </form>
    </div>
  </div>
<script>
  const form = document.querySelector('form');
  const editor = document.getElementById('editor');
  const contentInput = document.getElementById('content_html');
  const toolbar = document.querySelector('.toolbar');
  const formatBlock = document.getElementById('formatBlock');

  const syncEditor = () => {
    if (!editor || !contentInput) return;
    contentInput.value = editor.innerHTML.trim();
  };

  if (toolbar && editor && contentInput) {
    toolbar.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      event.preventDefault();
      editor.focus();

      const action = button.getAttribute('data-action');
      const command = button.getAttribute('data-command');
      const value = button.getAttribute('data-value');

      if (action === 'link') {
        const url = window.prompt('link-ul pe care vrei sa-l adaugi');
        if (url) {
          document.execCommand('createLink', false, url);
        }
      } else if (action === 'unlink') {
        document.execCommand('unlink');
      } else if (command === 'formatBlock') {
        document.execCommand('formatBlock', false, value);
      } else if (command) {
        document.execCommand(command, false, value || null);
      }

      syncEditor();
    });

    formatBlock.addEventListener('change', () => {
      editor.focus();
      document.execCommand('formatBlock', false, formatBlock.value);
      syncEditor();
    });

    editor.addEventListener('input', syncEditor);
    form.addEventListener('submit', syncEditor);
  }
</script>
</body>
</html>
