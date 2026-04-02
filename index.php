<?php
declare(strict_types=1);

$dbPath = __DIR__ . '/data/blog.sqlite';

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function ensure_site_texts_table(SQLite3 $db): void {
    $db->exec('CREATE TABLE IF NOT EXISTS site_texts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text_key TEXT UNIQUE NOT NULL,
        text_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );');
}

function fetch_site_text_map(SQLite3 $db): array {
    ensure_site_texts_table($db);
    $result = $db->query('SELECT text_key, text_value FROM site_texts');
    $map = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $map[$row['text_key']] = $row['text_value'];
    }
    return $map;
}

function site_text_value(array $map, string $key, string $default): string {
    return $map[$key] ?? $default;
}

function render_post_content(string $html): array {
    $hasTwitterEmbeds = false;

    $html = preg_replace_callback(
        '~<!--\s*wp:embed\s+\{"url":"(https?://(?:www\.)?(?:twitter\.com|x\.com)/[^"]+)".*?\}\s*-->\s*<figure[^>]*class="wp-block-embed[^"]*"[^>]*>.*?</figure>\s*<!--\s*/wp:embed\s*-->~si',
        static function (array $matches) use (&$hasTwitterEmbeds): string {
            $hasTwitterEmbeds = true;
            $url = htmlspecialchars($matches[1], ENT_QUOTES, 'UTF-8');
            return '<blockquote class="twitter-tweet"><a href="' . $url . '">' . $url . '</a></blockquote>';
        },
        $html
    ) ?? $html;

    return [$html, $hasTwitterEmbeds];
}

$isLoggedIn = false;
if (file_exists(__DIR__ . '/admin/auth.php')) {
    require_once __DIR__ . '/admin/auth.php';
    $isLoggedIn = is_logged_in();
}

function fetch_post(string $slug, string $dbPath): ?array {
    if (!file_exists($dbPath)) {
        return null;
    }
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
    $stmt = $db->prepare('SELECT id, slug, title, content_html, excerpt, published_at FROM posts WHERE slug = :slug LIMIT 1');
    $stmt->bindValue(':slug', $slug, SQLITE3_TEXT);
    $result = $stmt->execute();
    $row = $result->fetchArray(SQLITE3_ASSOC);
    return $row ?: null;
}

function fetch_posts(string $dbPath): array {
    if (!file_exists($dbPath)) {
        return [];
    }
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
    $result = $db->query('SELECT slug, title, excerpt, published_at FROM posts ORDER BY published_at DESC');
    $posts = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $posts[] = $row;
    }
    return $posts;
}

function fetch_page(string $slug, string $dbPath): ?array {
    if (!file_exists($dbPath)) {
        return null;
    }
    $db = new SQLite3($dbPath);
    $db->exec('CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content_html TEXT NOT NULL,
        content_md TEXT,
        updated_at TEXT NOT NULL
    );');
    $stmt = $db->prepare('SELECT slug, title, content_html, content_md, updated_at FROM pages WHERE slug = :slug LIMIT 1');
    $stmt->bindValue(':slug', $slug, SQLITE3_TEXT);
    $result = $stmt->execute();
    $row = $result->fetchArray(SQLITE3_ASSOC);
    return $row ?: null;
}

function fetch_images(string $dbPath, ?int $limit = null): array {
    if (!file_exists($dbPath)) {
        return [];
    }
    $db = new SQLite3($dbPath);
    $db->exec('CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        original_name TEXT,
        created_at TEXT NOT NULL
    );');
    $sql = 'SELECT id, filename, created_at FROM images ORDER BY created_at DESC';
    if ($limit !== null) {
        $sql .= ' LIMIT ' . (int)$limit;
    }
    $result = $db->query($sql);
    $images = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $images[] = $row;
    }
    return $images;
}

function hero_avatar_url(): string {
    $customDir = __DIR__ . '/uploads/profile';
    $extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    foreach ($extensions as $extension) {
        $file = $customDir . '/avatar-current.' . $extension;
        if (file_exists($file)) {
            return '/uploads/profile/avatar-current.' . $extension . '?v=' . filemtime($file);
        }
    }

    $defaultAvatar = __DIR__ . '/assets/avatar.jpeg';
    $version = file_exists($defaultAvatar) ? filemtime($defaultAvatar) : time();
    return '/assets/avatar.jpeg?v=' . $version;
}

function editable_text(bool $isLoggedIn, string $key, string $value, string $tag = 'span', string $class = ''): string {
    $attrs = $class !== '' ? ' class="' . h($class) . '"' : '';
    if ($isLoggedIn) {
        $attrs .= ' data-site-text="' . h($key) . '"';
    }
    return '<' . $tag . $attrs . '>' . h($value) . '</' . $tag . '>';
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$uri = rtrim($uri, '/');
if ($uri === '') {
    $uri = '/';
}

$reserved = ['/', '/index.php', '/styles.css', '/admin', '/admin/import.php', '/tools', '/inspo', '/elite-deux'];
$post = null;
$posts = [];
$images = [];
$toolsPage = null;
$heroAvatarUrl = hero_avatar_url();
$postHasTwitterEmbeds = false;
$siteTextMap = [];

if (file_exists($dbPath)) {
    $siteTextDb = new SQLite3($dbPath);
    $siteTextMap = fetch_site_text_map($siteTextDb);
}

if ($uri === '/blog') {
    $posts = fetch_posts($dbPath);
} elseif ($uri === '/tools') {
    $toolsPage = fetch_page('tools', $dbPath);
} elseif ($uri === '/inspo') {
    if ($isLoggedIn && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            http_response_code(400);
            exit('CSRF invalid');
        }

        $uploadDir = __DIR__ . '/uploads/inspo';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $db = new SQLite3($dbPath);
        $db->exec('CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE NOT NULL,
            original_name TEXT,
            created_at TEXT NOT NULL
        );');

        if (isset($_POST['delete_id'])) {
            $stmt = $db->prepare('SELECT filename FROM images WHERE id = :id');
            $stmt->bindValue(':id', (int)$_POST['delete_id'], SQLITE3_INTEGER);
            $row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            if ($row) {
                $filePath = $uploadDir . '/' . $row['filename'];
                if (is_file($filePath)) {
                    @unlink($filePath);
                }
                $deleteStmt = $db->prepare('DELETE FROM images WHERE id = :id');
                $deleteStmt->bindValue(':id', (int)$_POST['delete_id'], SQLITE3_INTEGER);
                $deleteStmt->execute();
            }
            header('Location: /inspo');
            exit;
        }

        if (isset($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
            $name = $_FILES['image']['name'] ?? 'image';
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
            if (in_array($ext, $allowed, true)) {
                $safeName = bin2hex(random_bytes(8)) . '-' . time() . '.' . $ext;
                $destination = $uploadDir . '/' . $safeName;
                if (move_uploaded_file($_FILES['image']['tmp_name'], $destination)) {
                    $stmt = $db->prepare('INSERT INTO images (filename, original_name, created_at) VALUES (:filename, :original_name, :created_at)');
                    $stmt->bindValue(':filename', $safeName, SQLITE3_TEXT);
                    $stmt->bindValue(':original_name', $name, SQLITE3_TEXT);
                    $stmt->bindValue(':created_at', date('Y-m-d H:i:s'), SQLITE3_TEXT);
                    $stmt->execute();
                }
            }
            header('Location: /inspo');
            exit;
        }
    }

    $images = fetch_images($dbPath);
} elseif (!in_array($uri, $reserved, true) && !str_starts_with($uri, '/assets/') && !str_starts_with($uri, '/uploads/')) {
    $slug = ltrim($uri, '/');
    if (preg_match('/^[a-z0-9\-]+$/i', $slug)) {
        $post = fetch_post($slug, $dbPath);
    }
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?php echo $post ? h($post['title']) . ' - Eric Cosulea' : 'Eric Cosulea'; ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
<?php if (!$isLoggedIn && file_exists($dbPath)): ?>
<?php
  $trackingDb = new SQLite3($dbPath);
  $trackingDb->exec('CREATE TABLE IF NOT EXISTS site_texts (id INTEGER PRIMARY KEY AUTOINCREMENT, text_key TEXT UNIQUE NOT NULL, text_value TEXT NOT NULL, updated_at TEXT NOT NULL);');
  $trackingStmt = $trackingDb->prepare('SELECT text_value FROM site_texts WHERE text_key = :key LIMIT 1');
  $trackingStmt->bindValue(':key', 'tracking_head', SQLITE3_TEXT);
  $trackingRow = $trackingStmt->execute()->fetchArray(SQLITE3_ASSOC);
  $trackingDb->close();
  if ($trackingRow && $trackingRow['text_value']) echo $trackingRow['text_value'] . "\n";
?>
<?php endif; ?>
</head>
<body>
<?php if ($isLoggedIn): ?>
  <div class="admin-bar">
    <div class="admin-bar-inner">
      <a href="/admin/">dashboard</a>
      <a href="/">website</a>
      <button type="button" class="admin-bar-button" data-site-text-toggle>edit text</button>
    </div>
  </div>
<?php endif; ?>
<?php if ($post): ?>
  <?php [$postContentHtml, $postHasTwitterEmbeds] = render_post_content($post['content_html']); ?>
  <main class="page">
    <article class="post">
      <a class="post-back" href="/">← homepage</a>
      <?php if ($isLoggedIn && isset($post['id'])): ?>
        <a class="post-edit" href="/admin/edit.php?id=<?php echo (int)$post['id']; ?>">editeaza</a>
      <?php endif; ?>
      <h1 class="post-title"><?php echo h($post['title']); ?></h1>
      <p class="post-meta"><?php echo h(date('j F Y', strtotime($post['published_at']))); ?></p>
      <div class="post-content">
        <?php echo $postContentHtml; ?>
      </div>
    </article>
  </main>
<?php elseif ($uri === '/tools'): ?>
  <main class="page page-narrow">
    <section class="page-section">
      <a class="post-back" href="/">← homepage</a>
      <?php if ($isLoggedIn): ?>
        <a class="post-edit" href="/admin/page.php?slug=tools">editeaza</a>
      <?php endif; ?>
      <?php echo editable_text($isLoggedIn, 'tools.title', site_text_value($siteTextMap, 'tools.title', 'tools'), 'h1', 'page-title'); ?>
      <?php if ($toolsPage && !empty($toolsPage['content_html'])): ?>
        <div class="post-content">
          <?php echo $toolsPage['content_html']; ?>
        </div>
      <?php else: ?>
        <?php echo editable_text($isLoggedIn, 'tools.lead', site_text_value($siteTextMap, 'tools.lead', 'O colecție de programe/aplicații pe care le folosesc în proiectele mele.'), 'p', 'page-lead'); ?>
        <div class="tool-list">
          <div class="tool-item"><span class="tool-name">Cloudflare</span> — securitate site-uri</div>
          <div class="tool-item"><span class="tool-name">Hostico</span> — hosting și achiziție domenii</div>
          <div class="tool-item"><span class="tool-name">Elementor</span> — temă WordPress</div>
          <div class="tool-item"><span class="tool-name">Imagify</span> — optimizare imagini</div>
          <div class="tool-item"><span class="tool-name">Kit</span> — Email Marketing</div>
          <div class="tool-item"><span class="tool-name">Notion</span> — organizare</div>
          <div class="tool-item"><span class="tool-name">Semrush</span> — keyword research, optimizare SEO, analiza competitorilor</div>
          <div class="tool-item"><span class="tool-name">Skillshare</span> — cursuri online. Site-ul acesta a fost creat de la 0 urmând un curs de pe Skillshare. Am încercat să folosesc ca model acest site</div>
          <div class="tool-item"><span class="tool-name">Tomighty</span> — Pomodoro minimalist pentru desktop</div>
          <div class="tool-item"><span class="tool-name">VWO</span> — A/B testing</div>
          <div class="tool-item"><span class="tool-name">WP Rocket</span> — optimizare viteză</div>
        </div>
      <?php endif; ?>
    </section>
  </main>
<?php elseif ($uri === '/inspo'): ?>
  <main class="page page-wide">
    <section class="page-section">
      <a class="post-back" href="/">← homepage</a>
      <?php echo editable_text($isLoggedIn, 'inspo.title', site_text_value($siteTextMap, 'inspo.title', 'inspo'), 'h1', 'page-title'); ?>
      <?php echo editable_text($isLoggedIn, 'home.inspo_lead', site_text_value($siteTextMap, 'home.inspo_lead', 'imagini salvate pentru zilele alea naspa'), 'p', 'page-lead'); ?>
      <?php if ($isLoggedIn): ?>
        <form class="inspo-upload" method="post" enctype="multipart/form-data" action="/inspo">
          <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
          <label class="inspo-upload-label">
            <span>adauga imagine</span>
            <input type="file" name="image" accept="image/*" required>
          </label>
        </form>
      <?php endif; ?>
      <div class="inspo-grid">
        <?php foreach ($images as $img): ?>
          <div class="inspo-card">
            <button class="inspo-card-open" type="button" data-inspo-open data-inspo-src="<?php echo '/uploads/inspo/' . h($img['filename']); ?>">
              <img src="<?php echo '/uploads/inspo/' . h($img['filename']); ?>" alt="">
            </button>
            <?php if ($isLoggedIn && isset($img['id'])): ?>
              <form class="inspo-card-delete" method="post" action="/inspo" onsubmit="return confirm('Stergi imaginea?');">
                <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
                <input type="hidden" name="delete_id" value="<?php echo (int)$img['id']; ?>">
                <button type="submit" aria-label="sterge imaginea">×</button>
              </form>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>
      <div class="inspo-lightbox" data-inspo-lightbox hidden>
        <button class="inspo-lightbox-close" type="button" aria-label="inchide" data-inspo-close>×</button>
        <img class="inspo-lightbox-image" src="" alt="" data-inspo-image>
      </div>
    </section>
  </main>
<?php elseif ($uri === '/blog'): ?>
  <main class="page">
    <section class="section">
      <?php echo editable_text($isLoggedIn, 'blog.title', site_text_value($siteTextMap, 'blog.title', 'articole'), 'h2'); ?>
      <?php if (empty($posts)): ?>
        <p>Nu exista articole inca.</p>
      <?php else: ?>
        <div class="post-list">
          <?php foreach ($posts as $p): ?>
            <a class="post-item" href="/<?php echo h($p['slug']); ?>">
              <span class="post-item-title"><?php echo h($p['title']); ?></span>
              <span class="post-item-date"><?php echo h(date('j F Y', strtotime($p['published_at']))); ?></span>
            </a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </section>
  </main>
<?php else: ?>
  <main class="page">
    <header class="hero">
      <div class="hero-avatar">
        <img src="<?php echo h($heroAvatarUrl); ?>" alt="Eric Cosulea">
        <?php if ($isLoggedIn): ?>
          <form class="hero-avatar-editor" method="post" enctype="multipart/form-data" action="/admin/avatar.php">
            <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
            <input type="hidden" name="redirect_to" value="/">
            <label class="hero-avatar-input">
              <span aria-hidden="true">+</span>
              <span class="sr-only">schimba poza</span>
              <input type="file" name="avatar" accept="image/png,image/jpeg,image/webp,image/gif" required>
            </label>
          </form>
        <?php endif; ?>
      </div>
      <div class="hero-text">
        <div class="hero-title">
          <?php echo editable_text($isLoggedIn, 'home.hero_name', site_text_value($siteTextMap, 'home.hero_name', 'eric coșulea'), 'h1'); ?>
          <nav class="hero-social" aria-label="social">
            <a href="https://www.linkedin.com/in/eric-cosulea/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">
              <img src="/assets/linkedin.svg" alt="">
            </a>
            <a href="https://www.instagram.com/ericcosulea" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram">
              <img src="/assets/instagram.svg" alt="">
            </a>
            <a href="https://www.facebook.com/eric.cosulea/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook">
              <img src="/assets/facebook.svg" alt="">
            </a>
          </nav>
        </div>
        <?php echo editable_text($isLoggedIn, 'home.hero_sub', site_text_value($siteTextMap, 'home.hero_sub', 'speedrunning failures.'), 'p', 'hero-sub'); ?>
      </div>
    </header>

    <section class="section">
      <?php echo editable_text($isLoggedIn, 'home.projects_title', site_text_value($siteTextMap, 'home.projects_title', 'proiectele mele'), 'h2'); ?>
      <div class="projects">
        <a class="project" href="https://cursurilapahar.ro/" target="_blank" rel="noopener noreferrer">
          <img class="project-icon-img" src="/assets/logo-cursuri.png" alt="">
          <span class="project-text">
            <span class="project-name">cursuri la pahar</span>
            <span class="project-meta">(evenimente)</span>
          </span>
        </a>
        <a class="project" href="https://robotache.ro/" target="_blank" rel="noopener noreferrer">
          <img class="project-icon-img" src="/assets/logo-robotache.png" alt="">
          <span class="project-text">
            <span class="project-name">robotache</span>
            <span class="project-meta">(newsletter AI)</span>
          </span>
        </a>
        <a class="project" href="https://cesaicumpar.ro/" target="_blank" rel="noopener noreferrer">
          <img class="project-icon-img" src="/assets/logo-cumpar.png" alt="">
          <span class="project-text">
            <span class="project-name">ce să‑i cumpăr</span>
            <span class="project-meta">(marketing afiliat)</span>
          </span>
        </a>
        <a class="project" href="https://sportivoo.ro/" target="_blank" rel="noopener noreferrer">
          <img class="project-icon-img" src="/assets/logo-sportivoo.jpg" alt="">
          <span class="project-text">
            <span class="project-name">sportivoo</span>
            <span class="project-meta">(blog fitness)</span>
          </span>
        </a>
        <a class="project" href="https://storyhub.ro/" target="_blank" rel="noopener noreferrer">
          <img class="project-icon-img" src="/assets/logo-storyhub.png" alt="">
          <span class="project-text">
            <span class="project-name">story hub</span>
            <span class="project-meta">(povești antreprenori)</span>
          </span>
        </a>
        <a class="project" href="https://www.instagram.com/capsuladefotbal/" target="_blank" rel="noopener noreferrer">
          <img class="project-icon-img" src="/assets/logo-capsula.png" alt="">
          <span class="project-text">
            <span class="project-name">capsula de fotbal</span>
            <span class="project-meta">(blog fotbal)</span>
          </span>
        </a>
      </div>
    </section>

    <section class="section">
      <?php echo editable_text($isLoggedIn, 'home.interesting_title', site_text_value($siteTextMap, 'home.interesting_title', 'interesante'), 'h2'); ?>
      <div class="topic-list">
        <a class="topic-item" href="/tools">
          <img class="project-icon-img" src="/assets/tools.webp" alt="">
          <div class="topic-text">
            <span class="topic-title">tools</span>
            <span class="topic-sub">(colecție de aplicații pe care le folosesc în proiecte)</span>
          </div>
        </a>
        <a class="topic-item" href="/blog">
          <img class="project-icon-img" src="/assets/paper.png" alt="">
          <div class="topic-text">
            <span class="topic-title">blog</span>
            <span class="topic-sub">(mozaic de gânduri pentru Eric din viitor)</span>
          </div>
        </a>
      </div>
    </section>

    <section class="section">
      <?php echo editable_text($isLoggedIn, 'home.inspo_title', site_text_value($siteTextMap, 'home.inspo_title', 'inspo'), 'h2'); ?>
      <?php echo editable_text($isLoggedIn, 'home.inspo_lead', site_text_value($siteTextMap, 'home.inspo_lead', 'imagini salvate pentru zilele alea naspa'), 'p', 'page-lead'); ?>
      <div class="inspo-strip">
        <?php foreach (fetch_images($dbPath, 8) as $img): ?>
          <a class="inspo-thumb" href="/inspo">
            <img src="<?php echo '/uploads/inspo/' . h($img['filename']); ?>" alt="">
          </a>
        <?php endforeach; ?>
      </div>
      <a class="inspo-link" href="/inspo">vezi toate imaginile →</a>
    </section>

  </main>
  <?php if ($isLoggedIn): ?>
    <script>
      document.querySelectorAll('.hero-avatar-editor input[type="file"]').forEach((input) => {
        input.addEventListener('change', () => {
          if (input.files && input.files.length > 0) {
            input.form.submit();
          }
        });
      });

      document.querySelectorAll('.inspo-upload input[type="file"]').forEach((input) => {
        input.addEventListener('change', () => {
          if (input.files && input.files.length > 0) {
            input.form.submit();
          }
        });
      });

      (() => {
        const toggle = document.querySelector('[data-site-text-toggle]');
        const editableNodes = Array.from(document.querySelectorAll('[data-site-text]'));
        if (!toggle || editableNodes.length === 0) return;

        const csrfToken = <?php echo json_encode(csrf_token()); ?>;
        let editMode = false;
        let originalValues = new Map();

        const setEditMode = (enabled) => {
          editMode = enabled;
          document.body.classList.toggle('site-text-editing', enabled);
          toggle.textContent = enabled ? 'salveaza text' : 'edit text';
          editableNodes.forEach((node) => {
            if (enabled) {
              originalValues.set(node.dataset.siteText, node.textContent.trim());
              node.setAttribute('contenteditable', 'true');
            } else {
              node.removeAttribute('contenteditable');
            }
          });
        };

        toggle.addEventListener('click', async () => {
          if (!editMode) {
            setEditMode(true);
            return;
          }

          const texts = {};
          editableNodes.forEach((node) => {
            texts[node.dataset.siteText] = node.textContent.trim();
          });

          const response = await fetch('/admin/site-texts.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ csrf_token: csrfToken, texts }),
          });

          if (!response.ok) {
            alert('Nu am putut salva textele.');
            return;
          }

          setEditMode(false);
        });

        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && editMode) {
            editableNodes.forEach((node) => {
              const original = originalValues.get(node.dataset.siteText);
              if (typeof original === 'string') {
                node.textContent = original;
              }
            });
            setEditMode(false);
          }
        });
      })();
    </script>
  <?php endif; ?>
<?php endif; ?>
<?php if ($postHasTwitterEmbeds): ?>
  <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
<?php endif; ?>
<?php if ($uri === '/inspo'): ?>
  <script>
    (() => {
      document.querySelectorAll('.inspo-upload input[type="file"]').forEach((input) => {
        input.addEventListener('change', () => {
          if (input.files && input.files.length > 0) {
            input.form.submit();
          }
        });
      });

      const lightbox = document.querySelector('[data-inspo-lightbox]');
      const lightboxImage = document.querySelector('[data-inspo-image]');
      if (!lightbox || !lightboxImage) return;

      const closeLightbox = () => {
        lightbox.hidden = true;
        lightboxImage.src = '';
        document.body.classList.remove('lightbox-open');
      };

      document.querySelectorAll('[data-inspo-open]').forEach((card) => {
        card.addEventListener('click', () => {
          const src = card.getAttribute('data-inspo-src');
          if (!src) return;
          lightboxImage.src = src;
          lightbox.hidden = false;
          document.body.classList.add('lightbox-open');
        });
      });

      lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox || event.target.hasAttribute('data-inspo-close')) {
          closeLightbox();
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !lightbox.hidden) {
          closeLightbox();
        }
      });
    })();
  </script>
<?php endif; ?>
</body>
</html>
