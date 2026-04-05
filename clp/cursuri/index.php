<?php
declare(strict_types=1);
require __DIR__ . '/../../admin/auth.php';
require __DIR__ . '/db.php';
if (!is_logged_in()) { header('Location: /admin/login.php?redirect=/clp/cursuri/'); exit; }

$db = get_clp_db();
$result = $db->query('SELECT c.id, c.name, c.date,
    (SELECT COUNT(*) FROM tickets t WHERE t.course_id = c.id) as total_tickets,
    (SELECT COUNT(*) FROM course_files f WHERE f.course_id = c.id AND f.file_type = \'viza\') as has_viza
    FROM courses c ORDER BY c.date DESC');
$courses = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) $courses[] = $row;
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cursuri — CLP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/pnlcursuri/style.css" />
</head>
<body>
<header class="app-header">
  <h1>Cursuri</h1>
  <div class="header-controls">
    <a href="/clp/cursuri/add.php" class="btn btn-green" style="font-size:12px;padding:5px 14px">+ Curs nou</a>
    <a href="/clp/" class="logout-link">← CLP</a>
    <a href="/admin/logout.php" class="logout-link">Ieși</a>
  </div>
</header>
<main class="container" style="max-width:800px">
<?php if (empty($courses)): ?>
  <div style="text-align:center;padding:80px 24px;color:var(--muted)">
    <div style="font-size:40px;margin-bottom:16px">📋</div>
    <div style="font-size:16px;margin-bottom:8px">Niciun curs adăugat încă</div>
    <a href="/clp/cursuri/add.php" class="btn btn-green" style="margin-top:12px;display:inline-flex">+ Adaugă primul curs</a>
  </div>
<?php else: ?>
  <div class="table-card">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Curs</th>
            <th>Data</th>
            <th class="right">Bilete</th>
            <th style="width:80px;text-align:center">Viză</th>
          </tr>
        </thead>
        <tbody>
        <?php foreach ($courses as $c): ?>
          <tr style="cursor:pointer" onclick="location.href='/clp/cursuri/<?php echo $c['id']; ?>'">
            <td><strong><?php echo h($c['name']); ?></strong></td>
            <td><?php echo h(ro_date($c['date'])); ?></td>
            <td class="right"><?php echo (int)$c['total_tickets']; ?></td>
            <td style="text-align:center">
              <?php if ($c['has_viza']): ?>
                <span style="color:var(--green);font-size:16px" title="Viză încărcată">✓</span>
              <?php else: ?>
                <span style="color:var(--border);font-size:16px">—</span>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
<?php endif; ?>
</main>
</body>
</html>
