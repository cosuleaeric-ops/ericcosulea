<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

$projectsFile = __DIR__ . '/../data/projects.json';

function load_projects(string $file): array {
    if (!file_exists($file)) return [];
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

function save_projects(string $file, array $projects): void {
    usort($projects, fn($a, $b) => ($a['sort'] ?? 99) <=> ($b['sort'] ?? 99));
    file_put_contents($file, json_encode(array_values($projects), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function h(string $v): string { return htmlspecialchars($v, ENT_QUOTES, 'UTF-8'); }

$error = '';
$success = '';

// ── Handle POST actions ──────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    $projects = load_projects($projectsFile);

    if ($action === 'add' || $action === 'edit') {
        $name  = trim($_POST['name'] ?? '');
        $desc  = trim($_POST['description'] ?? '');
        $url   = trim($_POST['url'] ?? '');
        $logo  = trim($_POST['logo'] ?? '');
        $sort  = (int)($_POST['sort'] ?? 99);

        if ($name === '') { $error = 'Numele proiectului este obligatoriu.'; }
        else {
            // Handle logo upload
            if (!empty($_FILES['logo_file']['tmp_name'])) {
                $ext  = strtolower(pathinfo($_FILES['logo_file']['name'], PATHINFO_EXTENSION));
                $allowed = ['jpg','jpeg','png','webp','gif','svg'];
                if (!in_array($ext, $allowed, true)) {
                    $error = 'Tipul fișierului logo nu este permis.';
                } else {
                    $fname = 'logo-project-' . time() . '-' . mt_rand(100, 999) . '.' . $ext;
                    $dest  = __DIR__ . '/../assets/' . $fname;
                    if (!move_uploaded_file($_FILES['logo_file']['tmp_name'], $dest)) {
                        $error = 'Eroare la salvarea logo-ului.';
                    } else {
                        $logo = '/assets/' . $fname;
                    }
                }
            }

            if ($error === '') {
                if ($action === 'add') {
                    $maxId = array_reduce($projects, fn($c, $p) => max($c, $p['id'] ?? 0), 0);
                    $projects[] = ['id' => $maxId + 1, 'name' => $name, 'description' => $desc, 'url' => $url, 'logo' => $logo, 'sort' => $sort];
                    $success = 'Proiect adăugat.';
                } else {
                    $id = (int)($_POST['id'] ?? 0);
                    foreach ($projects as &$p) {
                        if ($p['id'] === $id) {
                            $p['name']        = $name;
                            $p['description'] = $desc;
                            $p['url']         = $url;
                            if ($logo !== '') $p['logo'] = $logo;
                            $p['sort']        = $sort;
                            break;
                        }
                    }
                    unset($p);
                    $success = 'Proiect actualizat.';
                }
                save_projects($projectsFile, $projects);
            }
        }
    } elseif ($action === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        $projects = array_filter($projects, fn($p) => $p['id'] !== $id);
        save_projects($projectsFile, array_values($projects));
        $success = 'Proiect șters.';
    }
}

$projects = load_projects($projectsFile);
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Proiecte — Admin</title>
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <style>
    .wrap { max-width: 780px; margin: 0 auto; padding: 28px 20px 80px; }
    h1 { margin: 0 0 4px; font-size: 32px; font-weight: 600; text-transform: lowercase; }
    .sub { color: #6d6a64; font-size: 16px; margin-bottom: 28px; }

    .notice { padding: 10px 16px; border-radius: 10px; font-size: 14px; margin-bottom: 18px; }
    .notice.ok  { background: #eaf6ec; color: #1a6b2a; }
    .notice.err { background: #fdecea; color: #8b1a1a; }

    /* project list */
    .proj-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
    .proj-row {
      display: flex; align-items: center; gap: 14px;
      background: #fffaf2; border: 1px solid #efe6d6; border-radius: 14px;
      padding: 12px 16px;
    }
    .proj-logo { width: 42px; height: 42px; border-radius: 10px; object-fit: cover; background: #f0e8d8; flex-shrink: 0; }
    .proj-logo.empty { display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .proj-info { flex: 1; min-width: 0; }
    .proj-name { font-weight: 600; font-size: 16px; text-transform: lowercase; }
    .proj-desc { font-size: 13px; color: #8a7b68; }
    .proj-url  { font-size: 12px; color: #b0a090; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
    .proj-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .btn-edit   { padding: 6px 14px; background: #fff; border: 1px solid #dcc9aa; border-radius: 8px; font-size: 13px; cursor: pointer; }
    .btn-edit:hover { background: #fef6e8; }
    .btn-del    { padding: 6px 14px; background: #fff; border: 1px solid #f5c6c6; border-radius: 8px; font-size: 13px; color: #c0392b; cursor: pointer; }
    .btn-del:hover  { background: #fdecea; }

    /* form */
    .form-card {
      background: #fffaf2; border: 1.5px solid #dcc9aa; border-radius: 16px;
      padding: 24px; margin-bottom: 32px; display: none;
    }
    .form-card.open { display: block; }
    .form-card h2 { font-size: 20px; font-weight: 600; margin-bottom: 18px; text-transform: lowercase; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-full  { grid-column: 1 / -1; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    label { font-size: 13px; color: #6d6a64; }
    input[type=text], input[type=url], input[type=number], input[type=file] {
      padding: 9px 12px; border: 1px solid #ddd5c5; border-radius: 9px;
      font-size: 15px; font-family: inherit; background: #fff; width: 100%;
    }
    input:focus { outline: none; border-color: #b0956a; box-shadow: 0 0 0 2px rgba(176,149,106,0.18); }
    .logo-preview { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; margin-top: 6px; border: 1px solid #eee; display: none; }
    .logo-preview.show { display: block; }
    .form-actions { display: flex; gap: 10px; margin-top: 20px; }
    .btn-save   { padding: 10px 24px; background: #1c1c1c; color: #fff; border: none; border-radius: 10px; font-size: 15px; cursor: pointer; }
    .btn-save:hover { background: #333; }
    .btn-cancel { padding: 10px 20px; background: transparent; border: 1px solid #dcc9aa; border-radius: 10px; font-size: 15px; cursor: pointer; }
    .btn-add    { padding: 11px 22px; background: #1c1c1c; color: #fff; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; }
    .btn-add:hover { background: #333; }

    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<div class="admin-bar">
  <div class="admin-bar-inner">
    <a class="btn" href="/admin/">← Admin</a>
    <a class="btn" href="/" target="_blank">Website</a>
    <a class="btn" href="/admin/logout.php" style="margin-left:auto">Logout</a>
  </div>
</div>

<div class="wrap">
  <h1>proiectele mele</h1>
  <p class="sub">Adaugă, editează sau șterge proiectele afișate pe pagina principală.</p>

  <?php if ($success): ?>
    <div class="notice ok"><?= h($success) ?></div>
  <?php elseif ($error): ?>
    <div class="notice err"><?= h($error) ?></div>
  <?php endif; ?>

  <!-- ── Form add/edit ── -->
  <div class="form-card" id="formCard">
    <h2 id="formTitle">proiect nou</h2>
    <form method="post" enctype="multipart/form-data" id="projForm">
      <input type="hidden" name="action" id="formAction" value="add">
      <input type="hidden" name="id"     id="formId"     value="">
      <div class="form-grid">
        <div class="form-group">
          <label>Nume</label>
          <input type="text" name="name" id="fName" placeholder="cursuri la pahar" required>
        </div>
        <div class="form-group">
          <label>Descriere <span style="color:#b0a090">(ce apare în paranteză)</span></label>
          <input type="text" name="description" id="fDesc" placeholder="evenimente">
        </div>
        <div class="form-group form-full">
          <label>URL proiect</label>
          <input type="url" name="url" id="fUrl" placeholder="https://...">
        </div>
        <div class="form-group">
          <label>Logo — URL sau path <span style="color:#b0a090">(ex: /assets/logo-x.png)</span></label>
          <input type="text" name="logo" id="fLogo" placeholder="/assets/logo-x.png" oninput="previewLogo(this.value)">
          <img id="logoPreview" class="logo-preview" src="" alt="preview logo">
        </div>
        <div class="form-group">
          <label>Logo — sau urcă fișier nou</label>
          <input type="file" name="logo_file" accept="image/*">
        </div>
        <div class="form-group">
          <label>Ordine afișare</label>
          <input type="number" name="sort" id="fSort" value="99" min="1" max="99">
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-save">Salvează</button>
        <button type="button" class="btn-cancel" onclick="closeForm()">Anulează</button>
      </div>
    </form>
  </div>

  <!-- ── Project list ── -->
  <div class="proj-list">
    <?php foreach ($projects as $p): ?>
    <div class="proj-row">
      <?php if (!empty($p['logo'])): ?>
        <img class="proj-logo" src="<?= h($p['logo']) ?>" alt="" onerror="this.style.display='none'">
      <?php else: ?>
        <div class="proj-logo empty">📦</div>
      <?php endif; ?>
      <div class="proj-info">
        <div class="proj-name"><?= h($p['name']) ?> <span class="proj-desc">(<?= h($p['description'] ?? '') ?>)</span></div>
        <div class="proj-url"><?= h($p['url'] ?? '') ?></div>
      </div>
      <div class="proj-actions">
        <button class="btn-edit" onclick="openEdit(<?= (int)$p['id'] ?>, <?= htmlspecialchars(json_encode($p, JSON_UNESCAPED_UNICODE), ENT_QUOTES) ?>)">Editează</button>
        <form method="post" style="margin:0" onsubmit="return confirm('Ștergi proiectul «<?= h($p['name']) ?>»?')">
          <input type="hidden" name="action" value="delete">
          <input type="hidden" name="id"     value="<?= (int)$p['id'] ?>">
          <button type="submit" class="btn-del">Șterge</button>
        </form>
      </div>
    </div>
    <?php endforeach; ?>
  </div>

  <button class="btn-add" onclick="openAdd()">+ Adaugă proiect</button>
</div>

<script>
  function openAdd() {
    document.getElementById('formTitle').textContent  = 'proiect nou';
    document.getElementById('formAction').value       = 'add';
    document.getElementById('formId').value           = '';
    document.getElementById('fName').value            = '';
    document.getElementById('fDesc').value            = '';
    document.getElementById('fUrl').value             = '';
    document.getElementById('fLogo').value            = '';
    document.getElementById('fSort').value            = '<?= count($projects) + 1 ?>';
    document.getElementById('logoPreview').classList.remove('show');
    document.getElementById('formCard').classList.add('open');
    document.getElementById('formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openEdit(id, data) {
    document.getElementById('formTitle').textContent  = 'editează proiect';
    document.getElementById('formAction').value       = 'edit';
    document.getElementById('formId').value           = id;
    document.getElementById('fName').value            = data.name        || '';
    document.getElementById('fDesc').value            = data.description || '';
    document.getElementById('fUrl').value             = data.url         || '';
    document.getElementById('fLogo').value            = data.logo        || '';
    document.getElementById('fSort').value            = data.sort        || 99;
    previewLogo(data.logo || '');
    document.getElementById('formCard').classList.add('open');
    document.getElementById('formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeForm() {
    document.getElementById('formCard').classList.remove('open');
  }

  function previewLogo(src) {
    const img = document.getElementById('logoPreview');
    if (src) { img.src = src; img.classList.add('show'); }
    else       img.classList.remove('show');
  }
</script>
</body>
</html>
