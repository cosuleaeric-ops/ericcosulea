<?php
declare(strict_types=1);

$dbPath = __DIR__ . '/data/blog.sqlite';

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
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
    $sql = 'SELECT filename, created_at FROM images ORDER BY created_at DESC';
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

if ($uri === '/blog') {
    $posts = fetch_posts($dbPath);
} elseif ($uri === '/tools') {
    $toolsPage = fetch_page('tools', $dbPath);
} elseif ($uri === '/inspo') {
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
</head>
<body>
<?php if ($isLoggedIn): ?>
  <div class="admin-bar">
    <div class="admin-bar-inner">
      <a href="/admin/">dashboard</a>
      <a href="/admin/inspo.php">inspo</a>
      <a href="/deep-work/">deep work</a>
      <a href="/elite-deux/">elite deux</a>
    </div>
  </div>
<?php endif; ?>
<?php if ($post): ?>
  <main class="page">
    <article class="post">
      <a class="post-back" href="/">← homepage</a>
      <?php if ($isLoggedIn && isset($post['id'])): ?>
        <a class="post-edit" href="/admin/edit.php?id=<?php echo (int)$post['id']; ?>">editeaza</a>
      <?php endif; ?>
      <h1 class="post-title"><?php echo h($post['title']); ?></h1>
      <p class="post-meta"><?php echo h(date('j F Y', strtotime($post['published_at']))); ?></p>
      <div class="post-content">
        <?php echo $post['content_html']; ?>
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
      <h1 class="page-title">tools</h1>
      <?php if ($toolsPage && !empty($toolsPage['content_html'])): ?>
        <div class="post-content">
          <?php echo $toolsPage['content_html']; ?>
        </div>
      <?php else: ?>
        <p class="page-lead">O colecție de programe/aplicații pe care le folosesc în proiectele mele.</p>
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
      <h1 class="page-title">inspo</h1>
      <p class="page-lead">imagini salvate pentru zile negre</p>
      <?php if ($isLoggedIn): ?>
        <form class="inspo-upload" method="post" enctype="multipart/form-data" action="/admin/inspo.php">
          <input type="hidden" name="csrf_token" value="<?php echo h(csrf_token()); ?>">
          <input type="hidden" name="redirect_to" value="/inspo">
          <input type="file" name="image" accept="image/*" required>
          <button type="submit">upload</button>
        </form>
      <?php endif; ?>
      <div class="inspo-grid">
        <?php foreach ($images as $img): ?>
          <div class="inspo-card">
            <img src="<?php echo '/uploads/inspo/' . h($img['filename']); ?>" alt="">
          </div>
        <?php endforeach; ?>
      </div>
    </section>
  </main>
<?php elseif ($uri === '/blog'): ?>
  <main class="page">
    <section class="section">
      <h2>articole</h2>
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
        <img src="/assets/avatar.jpeg" alt="Eric Cosulea">
      </div>
      <div class="hero-text">
        <div class="hero-title">
          <h1>eric coșulea</h1>
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
        <p class="hero-sub">speedrunning failures.</p>
      </div>
    </header>

    <section class="section">
      <h2>proiectele mele</h2>
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
      <h2>interesante</h2>
      <div class="topic-list">
        <a class="topic-item" href="/tools">
          <img class="project-icon-img" src="/assets/tools.webp" alt="">
          <div class="topic-text">
            <span class="topic-title">tools</span>
            <span class="topic-sub">(colecție de aplicații pe care le folosesc în proiectele mele)</span>
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
      <h2>inspo</h2>
      <p class="page-lead">imagini salvate pentru zile negre</p>
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
<?php endif; ?>
</body>
</html>
