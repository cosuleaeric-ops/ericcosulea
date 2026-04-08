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
        if (!$error) { header("Location: /clp/cursuri/view.php?id={$id}"); exit; }
    }

    if ($action === 'delete_viza') {
        $fid = (int)($_POST['file_id'] ?? 0);
        $row = $db->querySingle("SELECT filename FROM course_files WHERE id={$fid} AND course_id={$id}", true);
        if ($row) {
            @unlink($uploadDir . $row['filename']);
            $db->exec("DELETE FROM course_files WHERE id={$fid}");
        }
        header("Location: /clp/cursuri/view.php?id={$id}"); exit;
    }

    if ($action === 'update_participants') {
        $participantsJson = $_POST['participants_json'] ?? '[]';
        $participants = json_decode($participantsJson, true);
        if (is_array($participants) && !empty($participants)) {
            $db->exec("DELETE FROM tickets WHERE course_id={$id}");
            $ins = $db->prepare('INSERT INTO tickets (course_id, participant_name) VALUES (:cid, :name)');
            foreach ($participants as $pname) {
                $pname = trim((string)$pname);
                if ($pname === '') continue;
                $ins->bindValue(':cid',  $id,    SQLITE3_INTEGER);
                $ins->bindValue(':name', $pname, SQLITE3_TEXT);
                $ins->execute();
                $ins->reset();
            }
        }
        header("Location: /clp/cursuri/view.php?id={$id}"); exit;
    }

    if ($action === 'upload_raport') {
        $totalBilete   = round((float)($_POST['total_bilete']   ?? 0), 2);
        $totalIncasari = round((float)($_POST['total_incasari'] ?? 0), 2);
        $typesJson     = $_POST['types_json'] ?? '[]';
        if (!is_string($typesJson) || !json_decode($typesJson)) $typesJson = '[]';
        $file = $_FILES['raport_file'] ?? null;
        $safeName = '';
        $origName = '';
        if ($file && $file['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ['xlsx', 'xls'], true)) {
                if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
                $safeName = bin2hex(random_bytes(10)) . '-raport-' . $id . '.' . $ext;
                $origName = $file['name'];
                // Delete old raport file if exists
                $old = $db->querySingle("SELECT filename FROM course_reports WHERE course_id={$id}", true);
                if ($old && $old['filename']) @unlink($uploadDir . $old['filename']);
                move_uploaded_file($file['tmp_name'], $uploadDir . $safeName);
            } else { $error = 'Doar fișiere XLSX sunt acceptate.'; }
        }
        if (!$error) {
            $upsert = $db->prepare('INSERT INTO course_reports (course_id, total_bilete, total_incasari, types_json, filename, original_name, uploaded_at)
                VALUES (:cid, :tb, :ti, :tj, :fn, :on, :now)
                ON CONFLICT(course_id) DO UPDATE SET
                    total_bilete=excluded.total_bilete,
                    total_incasari=excluded.total_incasari,
                    types_json=excluded.types_json,
                    filename=CASE WHEN excluded.filename!=\'\' THEN excluded.filename ELSE filename END,
                    original_name=CASE WHEN excluded.original_name!=\'\' THEN excluded.original_name ELSE original_name END,
                    uploaded_at=excluded.uploaded_at');
            $upsert->bindValue(':cid', $id,           SQLITE3_INTEGER);
            $upsert->bindValue(':tb',  $totalBilete,   SQLITE3_FLOAT);
            $upsert->bindValue(':ti',  $totalIncasari, SQLITE3_FLOAT);
            $upsert->bindValue(':tj',  $typesJson,     SQLITE3_TEXT);
            $upsert->bindValue(':fn',  $safeName,      SQLITE3_TEXT);
            $upsert->bindValue(':on',  $origName,      SQLITE3_TEXT);
            $upsert->bindValue(':now', date('Y-m-d H:i:s'), SQLITE3_TEXT);
            $upsert->execute();
            header("Location: /clp/cursuri/view.php?id={$id}"); exit;
        }
    }

    if ($action === 'delete_raport') {
        $row = $db->querySingle("SELECT filename FROM course_reports WHERE course_id={$id}", true);
        if ($row && $row['filename']) @unlink($uploadDir . $row['filename']);
        $db->exec("DELETE FROM course_reports WHERE course_id={$id}");
        header("Location: /clp/cursuri/view.php?id={$id}"); exit;
    }

    if ($action === 'upload_viza') {
        $file = $_FILES['viza'] ?? null;
        if ($file && $file['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if ($ext === 'pdf') {
                if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
                $safeName = bin2hex(random_bytes(10)) . '-' . $id . '.pdf';
                if (move_uploaded_file($file['tmp_name'], $uploadDir . $safeName)) {
                    // Șterge viža veche
                    $old = $db->querySingle("SELECT filename FROM course_files WHERE course_id={$id} AND file_type='viza' LIMIT 1", true);
                    if ($old) {
                        @unlink($uploadDir . $old['filename']);
                        $db->exec("DELETE FROM course_files WHERE course_id={$id} AND file_type='viza'");
                    }
                    $ins = $db->prepare('INSERT INTO course_files (course_id, filename, original_name, file_type, uploaded_at) VALUES (:cid, :fn, :on, \'viza\', :now)');
                    $ins->bindValue(':cid', $id,            SQLITE3_INTEGER);
                    $ins->bindValue(':fn',  $safeName,      SQLITE3_TEXT);
                    $ins->bindValue(':on',  $file['name'],  SQLITE3_TEXT);
                    $ins->bindValue(':now', date('Y-m-d H:i:s'), SQLITE3_TEXT);
                    $ins->execute();
                    // Extrage subtipuri din PDF
                    $pdfText = pdf_to_text($uploadDir . $safeName);
                    if ($pdfText) {
                        $subtips = parse_viza_subtips($pdfText);
                        $db->exec("DELETE FROM viza_subtips WHERE course_id={$id}");
                        $si = $db->prepare('INSERT INTO viza_subtips (course_id, seria, tarif, nr_unitati, de_la, pana_la) VALUES (:cid,:s,:t,:n,:d,:p)');
                        foreach ($subtips as $sub) {
                            $si->bindValue(':cid', $id,              SQLITE3_INTEGER);
                            $si->bindValue(':s',   $sub['seria'],    SQLITE3_TEXT);
                            $si->bindValue(':t',   $sub['tarif'],    SQLITE3_FLOAT);
                            $si->bindValue(':n',   $sub['nr_unitati'], SQLITE3_INTEGER);
                            $si->bindValue(':d',   $sub['de_la'],    SQLITE3_TEXT);
                            $si->bindValue(':p',   $sub['pana_la'],  SQLITE3_TEXT);
                            $si->execute();
                            $si->reset();
                        }
                    }
                }
            } else { $error = 'Doar fișiere PDF sunt acceptate.'; }
        } else { $error = 'Eroare la upload.'; }
        if (!$error) { header("Location: /clp/cursuri/view.php?id={$id}"); exit; }
    }

    if ($action === 'delete_viza') {
        $fid = (int)($_POST['file_id'] ?? 0);
        $row = $db->querySingle("SELECT filename FROM course_files WHERE id={$fid} AND course_id={$id}", true);
        if ($row) {
            @unlink($uploadDir . $row['filename']);
            $db->exec("DELETE FROM course_files WHERE id={$fid}");
        }
        $db->exec("DELETE FROM viza_subtips WHERE course_id={$id}");
        header("Location: /clp/cursuri/view.php?id={$id}"); exit;
    }

    if ($action === 'reprocess_viza') {
        $row = $db->querySingle("SELECT filename FROM course_files WHERE course_id={$id} AND file_type='viza' LIMIT 1", true);
        if ($row) {
            $pdfText = pdf_to_text($uploadDir . $row['filename']);
            if ($pdfText) {
                $subtips = parse_viza_subtips($pdfText);
                $db->exec("DELETE FROM viza_subtips WHERE course_id={$id}");
                $si = $db->prepare('INSERT INTO viza_subtips (course_id, seria, tarif, nr_unitati, de_la, pana_la) VALUES (:cid,:s,:t,:n,:d,:p)');
                foreach ($subtips as $sub) {
                    $si->bindValue(':cid', $id,              SQLITE3_INTEGER);
                    $si->bindValue(':s',   $sub['seria'],    SQLITE3_TEXT);
                    $si->bindValue(':t',   $sub['tarif'],    SQLITE3_FLOAT);
                    $si->bindValue(':n',   $sub['nr_unitati'], SQLITE3_INTEGER);
                    $si->bindValue(':d',   $sub['de_la'],    SQLITE3_TEXT);
                    $si->bindValue(':p',   $sub['pana_la'],  SQLITE3_TEXT);
                    $si->execute();
                    $si->reset();
                }
            }
        }
        header("Location: /clp/cursuri/view.php?id={$id}"); exit;
    }

    if ($action === 'delete_course') {
        // Delete associated files from disk
        $res = $db->query("SELECT filename FROM course_files WHERE course_id={$id}");
        while ($f = $res->fetchArray(SQLITE3_ASSOC)) @unlink($uploadDir . $f['filename']);
        $row = $db->querySingle("SELECT filename FROM course_reports WHERE course_id={$id}", true);
        if ($row && $row['filename']) @unlink($uploadDir . $row['filename']);
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

$report = $db->querySingle("SELECT * FROM course_reports WHERE course_id={$id}", true) ?: null;

$res = $db->query("SELECT * FROM course_files WHERE course_id={$id} AND file_type='viza' ORDER BY uploaded_at DESC");
$vizaFiles = [];
while ($r = $res->fetchArray(SQLITE3_ASSOC)) $vizaFiles[] = $r;

$res = $db->query("SELECT * FROM viza_subtips WHERE course_id={$id} ORDER BY tarif DESC");
$vizaSubtips = [];
while ($r = $res->fetchArray(SQLITE3_ASSOC)) $vizaSubtips[] = $r;

$reportTypes  = ($report && !empty($report['types_json'])) ? (json_decode($report['types_json'], true) ?: []) : [];
$reportByPrice = [];
foreach ($reportTypes as $rt) {
    $reportByPrice[(string)(float)$rt['pret']] = $rt;
}

// Returning participants: people in this course who attended other CLP courses
$retRes = $db->query("
    SELECT t.participant_name,
           COUNT(DISTINCT t2.course_id) AS num_other,
           GROUP_CONCAT(c2.name || '|||' || c2.date, '|') AS other_list
    FROM tickets t
    JOIN tickets t2 ON LOWER(TRIM(t2.participant_name)) = LOWER(TRIM(t.participant_name))
                    AND t2.course_id != {$id}
    JOIN courses c2 ON c2.id = t2.course_id
    WHERE t.course_id = {$id}
    GROUP BY LOWER(TRIM(t.participant_name))
    ORDER BY num_other DESC, t.participant_name ASC
");
$returningParticipants = [];
while ($r = $retRes->fetchArray(SQLITE3_ASSOC)) $returningParticipants[] = $r;
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
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
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
    /* Update participants */
    .update-drop { border:2px dashed var(--border); border-radius:var(--radius-sm); padding:24px; text-align:center; position:relative; cursor:pointer; transition:all .15s; }
    .update-drop:hover, .update-drop.dragover { border-color:var(--green); background:var(--green-light); }
    .update-drop input { position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%; }
    .update-drop p { font-size:13px; color:var(--muted); margin:0; }
    .update-col-picker { display:none; margin-top:12px; }
    .update-col-picker label { font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:var(--muted); display:block; margin-bottom:6px; }
    .update-col-picker select { width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:14px; background:var(--bg); }
    .update-preview { display:none; margin-top:12px; background:var(--green-light); border:1px solid #b2d9c0; border-radius:var(--radius-sm); padding:14px 16px; font-size:13px; }
    .update-preview strong { font-family:'Crimson Pro',Georgia,serif; font-size:18px; }
    .update-submit { display:none; margin-top:12px; }
    /* Returning participants */
    .returning-list { list-style:none; display:flex; flex-direction:column; gap:8px; }
    .returning-list li { font-size:14px; display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
    .returning-badge { background:var(--green-light); color:var(--green); border:1px solid #b2d9c0; border-radius:12px; font-size:11px; font-weight:700; padding:2px 9px; white-space:nowrap; }
    .returning-courses { font-size:12px; color:var(--muted); }
    /* Viță subtipuri */
    .subtip-table { width:100%; border-collapse:collapse; font-size:14px; margin-top:12px; }
    .subtip-table th { font-size:11px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:var(--muted); padding:6px 10px; text-align:left; border-bottom:1px solid var(--border); }
    .subtip-table td { padding:10px 10px; border-bottom:1px solid var(--border); }
    .subtip-table tr:last-child td { border-bottom:none; }
    .subtip-table td.num { font-variant-numeric:tabular-nums; text-align:right; }
    .seria-badge { font-family:monospace; font-size:13px; font-weight:700; background:var(--bg); border:1px solid var(--border); border-radius:6px; padding:2px 8px; }
    .sold-match { color:var(--green); font-weight:600; }
    .no-match { color:var(--muted); font-style:italic; }
    .reprocess-btn { font-size:12px; color:var(--muted); background:none; border:none; cursor:pointer; padding:0; text-decoration:underline; }
    /* Raport financiar */
    .raport-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:20px; }
    .raport-stat { background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:16px; }
    .raport-stat .label { font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
    .raport-stat .value { font-family:'Crimson Pro',Georgia,serif; font-size:26px; font-weight:600; }
    .raport-stat .value.ditl { color:#c0392b; }
    .raport-meta { font-size:12px; color:var(--muted); margin-bottom:16px; }
    .raport-drop { border:2px dashed var(--border); border-radius:var(--radius-sm); padding:20px; text-align:center; position:relative; cursor:pointer; transition:all .15s; }
    .raport-drop:hover, .raport-drop.dragover { border-color:var(--green); background:var(--green-light); }
    .raport-drop input { position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%; }
    .raport-drop p { font-size:13px; color:var(--muted); margin:0; }
    .raport-preview { display:none; margin-top:12px; background:var(--green-light); border:1px solid #b2d9c0; border-radius:var(--radius-sm); padding:12px 16px; font-size:14px; }
    .raport-submit { display:none; margin-top:10px; }
    @media(max-width:600px) { .raport-grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
<header class="app-header">
  <h1><?php echo h($course['name']); ?></h1>
  <div class="header-controls">
    <a href="/clp/cursuri/" class="logout-link">← Cursuri</a>

  </div>
</header>
<main class="container">
  <div class="course-wrap">

    <?php if ($error): ?>
      <div class="error-msg" style="display:block;margin-bottom:16px"><?php echo h($error); ?></div>
    <?php endif; ?>

    <div class="course-hero">
      <a href="/clp/cursuri/" style="font-size:12px;color:var(--muted);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-bottom:10px">← Înapoi</a>
      <h2><?php echo h($course['name']); ?></h2>
      <div class="meta">📅 <?php echo h(ro_date($course['date'])); ?></div>
    </div>

    <?php if ($report): ?>
    <!-- Raport eveniment (sus — doar dacă există) -->
    <div class="section-card">
      <h3>Raport eveniment</h3>
      <div class="raport-grid">
        <div class="raport-stat">
          <div class="label">Total încasări</div>
          <div class="value"><?php echo number_format((float)$report['total_incasari'], 2, ',', '.'); ?> <small style="font-size:14px;font-weight:400">RON</small></div>
        </div>
        <div class="raport-stat">
          <div class="label">Total bilete (brut)</div>
          <div class="value"><?php echo number_format((float)$report['total_bilete'], 2, ',', '.'); ?> <small style="font-size:14px;font-weight:400">RON</small></div>
        </div>
        <div class="raport-stat">
          <div class="label">Taxă DITL (2%)</div>
          <div class="value ditl"><?php echo number_format((float)$report['total_bilete'] * 0.02, 2, ',', '.'); ?> <small style="font-size:14px;font-weight:400">RON</small></div>
        </div>
      </div>
      <div class="raport-meta">
        <?php if ($report['original_name']): ?>📎 <?php echo h($report['original_name']); ?> · <?php endif; ?>
        Actualizat <?php echo h(substr($report['uploaded_at'], 0, 10)); ?>
      </div>
      <details style="margin-bottom:16px">
        <summary style="font-size:13px;color:var(--muted);cursor:pointer">Actualizează raportul</summary>
        <div style="margin-top:12px">
          <?php include __DIR__ . '/raport_upload_form.inc.php'; ?>
        </div>
      </details>
      <form method="post" onsubmit="return confirm('Ștergi raportul financiar?');" style="margin-top:4px">
        <input type="hidden" name="csrf_token" value="<?php echo h($csrf); ?>">
        <input type="hidden" name="action" value="delete_raport">
        <button type="submit" class="btn btn-ghost" style="font-size:12px;padding:4px 12px;color:var(--muted)">Șterge raportul</button>
      </form>
    </div>
    <?php endif; ?>

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

    <!-- Participanți fideli -->
    <?php if (!empty($returningParticipants)): ?>
    <div class="section-card">
      <h3>Participanți fideli (<?php echo count($returningParticipants); ?>)</h3>
      <ul class="returning-list">
        <?php foreach ($returningParticipants as $rp): ?>
          <?php
            $courses = array_map(function($c) {
                $parts = explode('|||', $c, 2);
                if (count($parts) < 2) return h($c);
                return h($parts[0]) . ' <span style="color:var(--muted)">(' . h(ro_date($parts[1])) . ')</span>';
            }, array_unique(explode('|', $rp['other_list'])));
          ?>
          <li>
            <span class="returning-badge">×<?php echo $rp['num_other']; ?></span>
            <strong><?php echo h($rp['participant_name']); ?></strong>
            <span class="returning-courses"><?php echo implode(', ', $courses); ?></span>
          </li>
        <?php endforeach; ?>
      </ul>
    </div>
    <?php endif; ?>

    <?php if (!$report): ?>
    <!-- Raport eveniment (jos — doar dacă nu există încă) -->
    <div class="section-card">
      <h3>Raport eveniment</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:14px">Încarcă fișierul XLSX primit după eveniment pentru a vedea încasările și taxa DITL.</p>
      <?php include __DIR__ . '/raport_upload_form.inc.php'; ?>
    </div>
    <?php endif; ?>

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

    <!-- Actualizează participanți -->
    <div class="section-card">
      <h3>Actualizează participanți</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:14px">Încarcă un nou XLSX pentru a actualiza lista. Participanții existenți vor fi înlocuiți cu noua listă — dacă unii se repetă, nu vor fi duplicați.</p>
      <form method="post" id="updateForm">
        <input type="hidden" name="csrf_token" value="<?php echo h($csrf); ?>">
        <input type="hidden" name="action" value="update_participants">
        <input type="hidden" name="participants_json" id="updateParticipantsJson">
        <div class="update-drop" id="updateDrop">
          <input type="file" id="updateFileInput" accept=".xlsx,.xls,.csv">
          <p>📊 Trage sau apasă pentru a încărca XLSX / CSV</p>
        </div>
        <div class="update-col-picker" id="updateColPicker">
          <label>Selectează coloana cu nume participanți</label>
          <select id="updateColSelect"></select>
          <button type="button" class="btn btn-ghost" id="btnUpdateApplyCol" style="margin-top:8px;width:100%;justify-content:center">Aplică</button>
        </div>
        <div class="update-preview" id="updatePreview"></div>
        <div class="update-submit" id="updateSubmit">
          <button type="submit" class="btn btn-green" style="width:100%;justify-content:center;padding:10px">Înlocuiește lista de participanți</button>
        </div>
      </form>
    </div>

    <!-- Viza bilete -->
    <div class="section-card">
      <h3>Viță bilete</h3>

      <?php if (!empty($vizaFiles)): $vf = $vizaFiles[0]; ?>
        <div class="viza-file" style="margin-bottom:12px">
          <div>
            <a class="viza-name" href="/clp/uploads/<?php echo h($vf['filename']); ?>" target="_blank" rel="noopener">
              📄 <?php echo h($vf['original_name']); ?>
            </a>
            <div class="viza-date">Încărcat <?php echo h(substr($vf['uploaded_at'], 0, 10)); ?></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <?php if (empty($vizaSubtips)): ?>
              <form method="post" style="margin:0">
                <input type="hidden" name="csrf_token" value="<?php echo h($csrf); ?>">
                <input type="hidden" name="action" value="reprocess_viza">
                <button type="submit" class="reprocess-btn" title="Extrage date din PDF">↻ Extrage date</button>
              </form>
            <?php endif; ?>
            <form method="post" onsubmit="return confirm('Ștergi viža?');" style="margin:0">
              <input type="hidden" name="csrf_token" value="<?php echo h($csrf); ?>">
              <input type="hidden" name="action" value="delete_viza">
              <input type="hidden" name="file_id" value="<?php echo (int)$vf['id']; ?>">
              <button type="submit" class="icon-btn danger" title="Șterge">✕</button>
            </form>
          </div>
        </div>

        <?php if (!empty($vizaSubtips)): ?>
          <table class="subtip-table">
            <thead>
              <tr>
                <th>Seria</th>
                <th>Tarif</th>
                <th>Nr. bilete</th>
                <th>De la</th>
                <th>Până la</th>
                <?php if (!empty($reportByPrice)): ?><th>Vândute</th><?php endif; ?>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($vizaSubtips as $sub):
                $key    = (string)(float)$sub['tarif'];
                $match  = $reportByPrice[$key] ?? null;
              ?>
              <tr>
                <td><span class="seria-badge"><?php echo h($sub['seria']); ?></span></td>
                <td class="num"><?php echo number_format((float)$sub['tarif'], 0, ',', '.'); ?> RON</td>
                <td class="num"><?php echo (int)$sub['nr_unitati']; ?></td>
                <td class="num"><?php echo h($sub['de_la']); ?></td>
                <td class="num"><?php echo h($sub['pana_la']); ?></td>
                <?php if (!empty($reportByPrice)): ?>
                <td class="num <?php echo $match ? 'sold-match' : 'no-match'; ?>">
                  <?php echo $match ? (int)$match['vandute'] . ' vândute' : '—'; ?>
                </td>
                <?php endif; ?>
              </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        <?php elseif (!empty($vizaFiles)): ?>
          <p style="font-size:13px;color:var(--muted);margin:8px 0 0">Nu s-au putut extrage datele automat. Apasă „Extrage date" sau re-încarcă PDF-ul.</p>
        <?php endif; ?>

      <?php endif; ?>

      <form method="post" enctype="multipart/form-data" style="margin-top:<?php echo empty($vizaFiles) ? 0 : 16; ?>px">
        <input type="hidden" name="csrf_token" value="<?php echo h($csrf); ?>">
        <input type="hidden" name="action" value="upload_viza">
        <div class="upload-zone">
          <input type="file" name="viza" accept=".pdf" onchange="this.form.submit()">
          <p>📎 <?php echo empty($vizaFiles) ? 'Trage sau apasă pentru a încărca Viža PDF' : 'Înlocuiește viža'; ?></p>
        </div>
      </form>
    </div>

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
<script>
(function() {
    let parsedRows = [], allHeaders = [];
    const drop = document.getElementById('updateDrop');
    const fileInput = document.getElementById('updateFileInput');
    const colPicker = document.getElementById('updateColPicker');
    const colSelect = document.getElementById('updateColSelect');
    const preview = document.getElementById('updatePreview');
    const submitWrap = document.getElementById('updateSubmit');

    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

    function handleFile(file) {
        colPicker.style.display = 'none'; preview.style.display = 'none'; submitWrap.style.display = 'none';
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                parsedRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                if (!parsedRows.length) { alert('Fișierul pare gol.'); return; }
                allHeaders = Object.keys(parsedRows[0]);
                const detected = detectCol(allHeaders);
                if (detected) { applyCol(detected); }
                else {
                    colSelect.innerHTML = allHeaders.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
                    colPicker.style.display = 'block';
                }
            } catch (err) { alert('Nu am putut citi fișierul.'); }
        };
        reader.readAsArrayBuffer(file);
    }

    function detectCol(headers) {
        for (const re of [/^prenume$/i, /prenume/i, /^nume complet$/i, /^participant/i, /^cump[aă]r[aă]tor/i, /^client/i, /^name$/i, /full.?name/i, /^nume$/i, /nume/i]) {
            const found = headers.find(h => re.test(h.trim()));
            if (found) return found;
        }
        return null;
    }

    document.getElementById('btnUpdateApplyCol').addEventListener('click', () => {
        colPicker.style.display = 'none'; applyCol(colSelect.value);
    });

    function applyCol(col) {
        const names = parsedRows.map(r => String(r[col] ?? '').trim()).filter(n => n);
        if (!names.length) { alert('Coloana selectată pare goală.'); return; }
        const counts = {};
        names.forEach(n => counts[n] = (counts[n] || 0) + 1);
        const orders = Object.keys(counts).length;
        preview.innerHTML = `<strong>${names.length}</strong> bilete · <strong>${orders}</strong> comenzi · coloana: <em>${esc(col)}</em>`;
        document.getElementById('updateParticipantsJson').value = JSON.stringify(names);
        preview.style.display = 'block';
        submitWrap.style.display = 'block';
    }

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
})();

// ── Raport XLSX parser ────────────────────────────────────────────────────────
(function() {
    document.querySelectorAll('.raport-drop').forEach(function(drop) {
        const form       = drop.closest('form');
        const fileInput  = drop.querySelector('input[type=file]');
        const preview    = form.querySelector('.raport-preview');
        const submitWrap = form.querySelector('.raport-submit');

        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
        drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleRaport(e.dataTransfer.files[0], form, preview, submitWrap); });
        fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleRaport(fileInput.files[0], form, preview, submitWrap); });
    });

    function handleRaport(file, form, preview, submitWrap) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const wsName = wb.SheetNames.find(n => /vanzari/i.test(n)) || wb.SheetNames[0];
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { defval: 0 });

                let totalBilete = 0, totalIncasari = 0;
                const types = [];
                for (const row of rows) {
                    const tb      = Number(row['Total bilete']     || row['total_bilete']     || 0);
                    const refund  = Number(row['Valoare retururi'] || row['valoare_retururi'] || 0);
                    const ti      = Number(row['Total incasari']   || row['total_incasari']   || 0);
                    const pret    = Number(row['Pret']             || row['pret']             || 0);
                    const vandute = Number(row['Vandute']          || row['vandute']          || 0);
                    const bilet   = String(row['Bilet']            || row['bilet']            || '').trim();
                    if (!isNaN(tb)) totalBilete   += tb - (isNaN(refund) ? 0 : refund);
                    if (!isNaN(ti)) totalIncasari += ti;
                    if (bilet && pret > 0) types.push({ bilet, pret, vandute, refund: isNaN(refund) ? 0 : refund });
                }

                form.querySelector('[name=total_bilete]').value   = totalBilete.toFixed(2);
                form.querySelector('[name=total_incasari]').value = totalIncasari.toFixed(2);
                const tjField = form.querySelector('[name=types_json]');
                if (tjField) tjField.value = JSON.stringify(types);

                const ditl = (totalBilete * 0.02).toFixed(2);
                preview.innerHTML =
                    '<strong>Total încasări:</strong> ' + totalIncasari.toFixed(2) + ' RON &nbsp;·&nbsp; ' +
                    '<strong>Total bilete:</strong> ' + totalBilete.toFixed(2) + ' RON &nbsp;·&nbsp; ' +
                    '<strong>DITL (2%):</strong> <span style="color:#c0392b">' + ditl + ' RON</span>';
                preview.style.display = 'block';
                submitWrap.style.display = 'block';
            } catch(err) { alert('Nu am putut citi fișierul XLSX.'); }
        };
        reader.readAsArrayBuffer(file);
    }
})();
</script>
</body>
</html>
