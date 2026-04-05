<?php
declare(strict_types=1);
require __DIR__ . '/../../admin/auth.php';
require __DIR__ . '/../cursuri/db.php';
if (!is_logged_in()) { header('Location: /admin/login.php?redirect=/clp/participanti/'); exit; }

$db = get_clp_db();

// Aggregate participants across all courses
$res = $db->query("
    SELECT
        t.participant_name,
        COUNT(DISTINCT t.course_id) AS num_courses,
        COUNT(*) AS total_tickets,
        GROUP_CONCAT(c.name || ' (' || c.date || ')', '|') AS course_list
    FROM tickets t
    JOIN courses c ON c.id = t.course_id
    GROUP BY LOWER(TRIM(t.participant_name))
    ORDER BY num_courses DESC, total_tickets DESC, t.participant_name ASC
");
$participants = [];
while ($r = $res->fetchArray(SQLITE3_ASSOC)) {
    $r['courses'] = array_unique(explode('|', $r['course_list'] ?? ''));
    $participants[] = $r;
}

$totalUnique  = count($participants);
$returners    = count(array_filter($participants, fn($p) => $p['num_courses'] > 1));
$totalTickets = array_sum(array_column($participants, 'total_tickets'));
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Participanți — CLP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/pnlcursuri/style.css" />
  <style>
    .search-wrap { margin-bottom:16px; }
    .search-wrap input { width:100%; padding:10px 14px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:14px; background:var(--card); }
    .search-wrap input:focus { outline:none; border-color:var(--green); }
    .badge-return { background:#EAF5EF; color:var(--green); padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; white-space:nowrap; }
    .course-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
    .course-tag { background:var(--bg); border:1px solid var(--border); border-radius:4px; font-size:11px; color:var(--muted); padding:2px 6px; }
  </style>
</head>
<body>
<header class="app-header">
  <h1><a href="/clp/" style="text-decoration:none;color:inherit">Dashboard</a></h1>
  <div class="header-controls">
    <a href="/clp/" class="logout-link">← CLP</a>

  </div>
</header>
<main class="container">

  <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
    <div class="stat-card accent-blue">
      <div class="label">Participanți unici</div>
      <div class="value"><?php echo $totalUnique; ?></div>
    </div>
    <div class="stat-card accent-green">
      <div class="label">Revin la mai mult de 1 curs</div>
      <div class="value green"><?php echo $returners; ?></div>
    </div>
    <div class="stat-card accent-gold">
      <div class="label">Total bilete vândute</div>
      <div class="value"><?php echo $totalTickets; ?></div>
    </div>
  </div>

  <?php if (empty($participants)): ?>
    <div style="text-align:center;padding:60px;color:var(--muted)">
      Niciun participant înregistrat încă. Adaugă un curs cu participanți.
    </div>
  <?php else: ?>
    <div class="search-wrap">
      <input type="text" id="searchInput" placeholder="Caută participant..." oninput="filterTable()">
    </div>
    <div class="table-card">
      <div class="table-scroll">
        <table id="participantsTable">
          <thead>
            <tr>
              <th>Participant</th>
              <th class="right" style="width:100px"># Cursuri</th>
              <th class="right" style="width:100px"># Bilete</th>
              <th>Cursuri</th>
            </tr>
          </thead>
          <tbody>
          <?php foreach ($participants as $p): ?>
            <tr>
              <td>
                <strong><?php echo h($p['participant_name']); ?></strong>
                <?php if ($p['num_courses'] > 1): ?>
                  <span class="badge-return">revine</span>
                <?php endif; ?>
              </td>
              <td class="right"><?php echo (int)$p['num_courses']; ?></td>
              <td class="right"><?php echo (int)$p['total_tickets']; ?></td>
              <td>
                <div class="course-tags">
                  <?php foreach ($p['courses'] as $course): ?>
                    <?php if (trim($course)): ?>
                      <span class="course-tag"><?php
                        // show just the course name, not the date part
                        $parts = explode(' (', $course);
                        echo h(trim($parts[0]));
                        if (!empty($parts[1])) {
                            $date = rtrim($parts[1], ')');
                            echo ' <span style="opacity:.6">(' . h(substr($date, 0, 7)) . ')</span>';
                        }
                      ?></span>
                    <?php endif; ?>
                  <?php endforeach; ?>
                </div>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>
  <?php endif; ?>
</main>
<script>
function filterTable() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('#participantsTable tbody tr').forEach(tr => {
        const name = tr.querySelector('td strong')?.textContent.toLowerCase() || '';
        tr.style.display = name.includes(q) ? '' : 'none';
    });
}
</script>
</body>
</html>
