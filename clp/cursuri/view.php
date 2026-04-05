<?php
declare(strict_types=1);
require __DIR__ . '/../../admin/auth.php';
require __DIR__ . '/db.php';
if (!is_logged_in()) { header('Location: /admin/login.php?redirect=/clp/cursuri/'); exit; }

$db = get_clp_db();
$id = (int)($_GET['id'] ?? 0);
if (!$id) { header('Location: /clp/cursuri/'); exit; }

$stmt = $db->prepare('SELECT * FROM courses WHERE id = :id');
$stmt->bindValue(':id', $id, SQLITE3_INTEGER);
$course = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
if (!$course) { header('Location: /clp/cursuri/'); exit; }

$csrf = csrf_token();
$uploadDir = __DIR__ . '/../uploads/';
$error = '';

// ── Handle POST ───────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) { http_response_code(400); exit('CSRF invalid'); }
    $action = $_POST['action'] ?? '';

    if ($action === 'upload_viza') {
        $file = $_FILES['viza'] ?? null;
        if ($file && $file['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if ($ext === 'pdf') {
                if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
                $safeName = bin2hex(random_bytes(10)) . '-' . $id . '.pdf';
                if (move_uploaded_file($file['tmp_name'], $uploadDir . $safeName)) {
                    $ins = $db->prepare('INSERT INTO course_files (course_id, filename, original_name, file_type, uploaded_at) VALUES (:cid, :fn, :on, \'viza\', :now)');
                    $ins->bindValue(':cid', $id, SQLITE3_INTEGER);
                    $ins->bindValue(':fn',  $safeName, SQLITE3_TEXT);
                    $ins->bindValue(':on',  $file['name'], SQLITE3_TEXT);
                    $ins->bindValue(':now', date('Y-m-d H:i:s'), SQLITE3_TEXT);
                    $ins->execute();
                }
            } else { $error = 'Doar fișiere PDF sunt acceptate.'; }
        } else { $error = 'Eroare la upload.'; }
        if (!$error) { header("Location: /clp/cursuri/{$id}"); exit; }
    }

    if ($action === 'delete_viza') {
        $fid = (int)($_POST['file_id'] ?? 0);
        $row = $db->querySingle("SELECT filename FROM course_files WHERE id={$fid} AND course_id={$id}", true);
        if ($row) {
            @unlink($uploadDir . $row['filename']);
            $db->exec("DELETE FROM course_files WHERE id={$fid}");
        }
        header("Location: /clp/cursuri/{$id}"); exit;
    }

    if ($action === 'delete_course') {
        // Delete associated files from disk
        $res = $db->query("SELECT filename FROM course_files WHERE course_id={$id}");
        while ($f = $res->fetchArray(SQLITE3_ASSOC)) @unlink($uploadDir . $f['filename']);
        $db->exec("DELETE FROM courses WHERE id={$id}");
        header('Location: /clp/cursuri/'); exit;
    }
}

// ── Load data ─────────────────────────────────────────────────────────────────
$res = $db->query("SELECT participant_name FROM tickets WHERE course_id={$id}");
$tickets = [];
while ($r = $res->fetchArray(SQLITE3_ASSOC)) $tickets[] = $r;

$dist = ticket_distribution($tickets);

$res = $db->query("SELECT * FROM course_files WHERE course_id={$id} AND file_type='viza' ORDER BY uploaded_at DESC");
$vizaFiles = [];
while ($r = $res->fetchArray(SQLITE3_ASSOC)) $vizaFiles[] = $r;
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?php echo h($course['name']); ?> — CLP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/pnlcursuri/style.css" />
  <style>
    .course-wrap { max-width: 800px; margin: 0 auto; }
    .course-hero { margin-bottom: 28px; }
    .course-hero h2 { font-family:'Crimson Pro',Georgia,serif; font-size:28px; font-weight:600; letter-spacing:-.3px; }
    .course-hero .meta { font-size:14px; color:var(--muted); margin-top:4px; }
    .section-card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:24px; box-shadow:var(--shadow); margin-bottom:20px; }
    .section-card h3 { font-family:'Crimson Pro',Georgia,serif; font-size:17px; font-weight:600; margin-bottom:16px; }
    .dist-total { font-family:'Crimson Pro',Georgia,serif; font-size:26px; font-weight:600; margin-bottom:4px; }
    .dist-sub { font-size:13px; color:var(--muted); margin-bottom:16px; }
    .dist-list { list-style:none; display:flex; flex-direction:column; gap:10px; }
    .dist-list li { display:flex; align-items:center; gap:12px; font-size:15px; }
    .dist-bullet { width:8px; height:8px; border-radius:50%; background:var(--green); flex-shrink:0; }
    .viza-file { display:flex; align-items:center; justify-content:space-between; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px 14px; margin-bottom:10px; }
    .viza-name { font-size:13px; color:var(--text); text-decoration:none; font-weight:500; }
    .viza-name:hover { color:var(--green); }
    .viza-date { font-size:12px; color:var(--muted); }
    .upload-zone { border:2px dashed var(--border); border-radius:var(--radius-sm); padding:20px; text-align:center; position:relative; cursor:pointer; transition:all .15s; }
    .upload-zone:hover { border-color:var(--green); background:var(--green-light); }
    .upload-zone input { position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%; }
    .upload-zone p { font-size:13px; color:var(--muted); margin:0; }
    .participants-list { columns:2; column-gap:24px; list-style:none; }
    .participants-list li { font-size:13px; padding:3px 0; break-inside:avoid; }
    .participants-list li span { font-size:11px; color:var(--muted); margin-left:4px; }
    .danger-zone { border-top:1px solid var(--border); padding-top:16px; margin-top:8px; }
    @media(max-width:600px) { .participants-list { columns:1; } }
  </style>
</head>
<body>
<header class="app-header">
  <h1><?php echo h($course['name']); ?></h1>
  <div class="header-controls">
    <a href="/clp/cursuri/" class="logout-link">← Cursuri</a>
    <a href="/admin/logout.php" class="logout-link">Ieși</a>
  </div>
</header>
<main class="container">
  <div class="course-wrap">

    <?php if ($error): ?>
      <div class="error-msg" style="display:block;margin-bottom:16px"><?php echo h($error); ?></div>
    <?php endif; ?>

    <div class="course-hero">
      <h2><?php echo h($course['name']); ?></h2>
      <div class="meta">📅 <?php echo h(ro_date($course['date'])); ?></div>
    </div>

    <!-- Distribuție bilete -->
    <div class="section-card">
      <h3>Distribuție bilete</h3>
      <?php if ($dist['total_tickets'] === 0): ?>
        <p style="color:var(--muted);font-size:14px">Niciun bilet înregistrat.</p>
      <?php else: ?>
        <div class="dist-total"><?php echo $dist['total_tickets']; ?> <?php echo $dist['total_tickets'] === 1 ? 'bilet' : 'bilete'; ?></div>
        <div class="dist-sub"><?php echo $dist['total_orders']; ?> <?php echo $dist['total_orders'] === 1 ? 'comandă' : 'comenzi'; ?></div>
        <ul class="dist-list">
          <?php foreach ($dist['groups'] as $n => $orders): ?>
            <li>
              <span class="dist-bullet"></span>
              <strong><?php echo $orders; ?></strong>&nbsp;<?php echo $orders === 1 ? 'comandă' : 'comenzi'; ?>
              &times;
              <strong><?php echo $n; ?> <?php echo $n === 1 ? 'bilet' : 'bilete'; ?></strong>
            </li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </div>

    <!-- Viză bilete -->
    <div class="section-card">
      <h3>Viză bilete</h3>
      <?php if (!empty($vizaFiles)): ?>
        <?php foreach ($vizaFiles as $f): ?>
          <div class="viza-file">
            <div>
              <a class="viza-name" href="/clp/uploads/<?php echo h($f['filename']); ?>" target="_blank" rel="noopener">
                📄 <?php echo h($f['original_name']); ?>
              </a>
              <div class="viza-date">Încărcat <?php echo h(substr($f['uploaded_at'], 0, 10)); ?></div>
            </div>
            <form method="post" onsubmit="return confirm('Ștergi acest fișier?');">
              <input type="hidden" name="csrf_token" value="<?php echo h($csrf); ?>">
              <input type="hidden" name="action" value="delete_viza">
              <input type="hidden" name="file_id" value="<?php echo (int)$f['id']; ?>">
              <button type="submit" class="icon-btn danger" title="Șterge">✕</button>
            </form>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>

      <form method="post" enctype="multipart/form-data" style="margin-top:<?php echo empty($vizaFiles) ? 0 : 12; ?>px">
        <input type="hidden" name="csrf_token" value="<?php echo h($csrf); ?>">
        <input type="hidden" name="action" value="upload_viza">
        <div class="upload-zone">
          <input type="file" name="viza" accept=".pdf" onchange="this.form.submit()">
          <p>📎 Trage sau apasă pentru a încărca o Viză PDF</p>
        </div>
      </form>
    </div>

    <!-- Lista participanți -->
    <?php if (!empty($dist['name_counts'])): ?>
    <div class="section-card">
      <h3>Participanți (<?php echo count($dist['name_counts']); ?> comenzi)</h3>
      <ul class="participants-list">
        <?php
          $sorted = $dist['name_counts'];
          arsort($sorted);
          foreach ($sorted as $name => $cnt):
        ?>
          <li>
            <?php echo h($name); ?>
            <?php if ($cnt > 1): ?><span>×<?php echo $cnt; ?></span><?php endif; ?>
          </li>
        <?php endforeach; ?>
      </ul>
    </div>
    <?php endif; ?>

    <!-- Danger zone -->
    <div class="section-card" style="border-color:#f5c6c7">
      <div class="danger-zone">
        <form method="post" onsubmit="return confirm('Ștergi cursul «<?php echo h(addslashes($course['name'])); ?>»? Această acțiune este ireversibilă.');">
          <input type="hidden" name="csrf_token" value="<?php echo h($csrf); ?>">
          <input type="hidden" name="action" value="delete_course">
          <button type="submit" class="btn btn-red" style="font-size:12px;padding:5px 14px">Șterge cursul</button>
        </form>
      </div>
    </div>

  </div>
</main>
</body>
</html>
