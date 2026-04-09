<?php
declare(strict_types=1);
require __DIR__ . '/../../admin/auth.php';
require __DIR__ . '/../cursuri/db.php';
if (!is_logged_in()) { header('Location: /admin/login.php?redirect=/clp/rapoarte/'); exit; }

$db = get_clp_db();

// ── Selector an/lună ──────────────────────────────────────────────────────────
$now   = new DateTimeImmutable();
$year  = (int)($_GET['year']  ?? $now->format('Y'));
$month = isset($_GET['month']) ? (int)$_GET['month'] : (int)$now->format('n');
if ($month < 0 || $month > 12) $month = (int)$now->format('n');
$allYear = ($month === 0);

// ── Date cursuri cu raport ────────────────────────────────────────────────────
if ($allYear) {
    $res = $db->query("
        SELECT c.id, c.name, c.date,
               r.total_bilete, r.total_incasari, r.uploaded_at
        FROM courses c
        JOIN course_reports r ON r.course_id = c.id
        WHERE c.date LIKE '{$year}%'
        ORDER BY c.date DESC
    ");
} else {
    $monthPad = str_pad((string)$month, 2, '0', STR_PAD_LEFT);
    $prefix   = "{$year}-{$monthPad}";
    $res = $db->query("
        SELECT c.id, c.name, c.date,
               r.total_bilete, r.total_incasari, r.uploaded_at
        FROM courses c
        JOIN course_reports r ON r.course_id = c.id
        WHERE c.date LIKE '{$prefix}%'
        ORDER BY c.date DESC
    ");
}
$rows = [];
while ($r = $res->fetchArray(SQLITE3_ASSOC)) $rows[] = $r;

$sumBilete   = array_sum(array_column($rows, 'total_bilete'));
$sumIncasari = array_sum(array_column($rows, 'total_incasari'));
$sumDitl     = $sumBilete * 0.02;

// ── Viza subtipuri + vândute per curs ────────────────────────────────────────
$vizaSubtipsByCourse = [];
$reportByPriceByCourse = [];
if (!empty($rows)) {
    $ids = implode(',', array_map(fn($r) => (int)$r['id'], $rows));
    // Subtipuri viză
    $vsRes = $db->query("SELECT * FROM viza_subtips WHERE course_id IN ({$ids}) ORDER BY course_id, tarif DESC");
    while ($vs = $vsRes->fetchArray(SQLITE3_ASSOC)) {
        $vizaSubtipsByCourse[(int)$vs['course_id']][] = $vs;
    }
    // types_json din rapoarte (conține nr. vândute per preț)
    $rjRes = $db->query("SELECT course_id, types_json FROM course_reports WHERE course_id IN ({$ids})");
    while ($rj = $rjRes->fetchArray(SQLITE3_ASSOC)) {
        $types = json_decode($rj['types_json'] ?? '[]', true) ?: [];
        $byPrice = [];
        foreach ($types as $t) {
            $byPrice[(string)(float)($t['pret'] ?? 0)] = $t;
        }
        $reportByPriceByCourse[(int)$rj['course_id']] = $byPrice;
    }
}

// ── An/luni disponibile (pentru dropdown) ─────────────────────────────────────
$availRes = $db->query("
    SELECT DISTINCT strftime('%Y', c.date) AS y, strftime('%m', c.date) AS m
    FROM courses c
    JOIN course_reports r ON r.course_id = c.id
    ORDER BY y DESC, m DESC
");
$available = [];
while ($r = $availRes->fetchArray(SQLITE3_ASSOC)) $available[] = $r;

$roMonths = ['', 'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
             'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

function fmt(float $v): string {
    return number_format($v, 2, ',', '.');
}

// Ani disponibili pentru selector (cel puțin anul curent)
$years = array_unique(array_column($available, 'y') ?: [date('Y')]);
rsort($years);
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapoarte DITL — CLP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/pnlcursuri/style.css">
  <style>
    .page-wrap { max-width: 800px; margin: 0 auto; }
    .filter-bar { display: flex; gap: 10px; align-items: center; margin-bottom: 24px; flex-wrap: wrap; }
    .filter-bar select { padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 14px; background: var(--bg); cursor: pointer; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 28px; }
    .stat-box { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; box-shadow: var(--shadow); }
    .stat-box .label { font-size: 11px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
    .stat-box .value { font-family: 'Crimson Pro', Georgia, serif; font-size: 30px; font-weight: 600; }
    .stat-box .value.ditl { color: #c0392b; }
    .table-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    thead th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); }
    thead th:not(:first-child) { text-align: right; }
    tbody td { padding: 12px 16px; border-bottom: 1px solid var(--border); }
    tbody td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: var(--green-light); }
    tfoot td { padding: 12px 16px; font-weight: 700; border-top: 2px solid var(--border); }
    tfoot td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
    .ditl-cell { color: #c0392b; font-weight: 600; }
    .empty-state { text-align: center; padding: 48px 24px; color: var(--muted); font-size: 15px; }
    .course-link { color: var(--text); text-decoration: none; font-weight: 500; }
    .course-link:hover { color: var(--green); }
    .toggle-viza { background: none; border: none; cursor: pointer; font-size: 12px; color: var(--muted); padding: 2px 6px; border-radius: 4px; margin-left: 6px; }
    .toggle-viza:hover { background: var(--border); color: var(--text); }
    .viza-subtips-row { display: none; }
    .viza-subtips-row.open { display: table-row; }
    .viza-subtips-inner { padding: 0 16px 12px 32px; }
    .viza-subtable { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
    .viza-subtable th { padding: 5px 10px; font-size: 10px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--muted); text-align: left; border-bottom: 1px solid var(--border); }
    .viza-subtable th:not(:first-child) { text-align: right; }
    .viza-subtable td { padding: 5px 10px; border-bottom: 1px solid var(--border); }
    .viza-subtable td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
    .viza-subtable tr:last-child td { border-bottom: none; }
    .seria-badge { background: var(--green-light); border: 1px solid #b2d9c0; border-radius: 4px; padding: 1px 6px; font-weight: 700; font-size: 11px; }
    @media(max-width:600px) { .summary-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<header class="app-header">
  <h1>Rapoarte DITL</h1>
</header>
<main class="container">
  <div class="page-wrap">

    <div style="margin-bottom:20px">
      <a href="/clp/" style="font-size:13px;color:var(--muted);text-decoration:none">← Dashboard</a>
    </div>

    <!-- Filtru -->
    <form method="get" class="filter-bar" id="filterForm">
      <select name="year" onchange="document.getElementById('filterForm').submit()">
        <?php foreach ($years as $y): ?>
          <option value="<?php echo h((string)$y); ?>" <?php echo (int)$y === $year ? 'selected' : ''; ?>>
            <?php echo h((string)$y); ?>
          </option>
        <?php endforeach; ?>
        <?php if (!in_array((string)$year, $years)): ?>
          <option value="<?php echo $year; ?>" selected><?php echo $year; ?></option>
        <?php endif; ?>
      </select>
      <select name="month" onchange="document.getElementById('filterForm').submit()">
        <option value="0" <?php echo $allYear ? 'selected' : ''; ?>>Tot anul</option>
        <?php for ($m = 1; $m <= 12; $m++): ?>
          <option value="<?php echo $m; ?>" <?php echo !$allYear && $m === $month ? 'selected' : ''; ?>>
            <?php echo ucfirst($roMonths[$m]); ?>
          </option>
        <?php endfor; ?>
      </select>
    </form>

    <!-- Sumar -->
    <div class="summary-grid">
      <div class="stat-box">
        <div class="label">Total încasări</div>
        <div class="value"><?php echo fmt($sumIncasari); ?> <small style="font-size:15px;font-weight:400">RON</small></div>
      </div>
      <div class="stat-box">
        <div class="label">Total bilete (brut)</div>
        <div class="value"><?php echo fmt($sumBilete); ?> <small style="font-size:15px;font-weight:400">RON</small></div>
      </div>
      <div class="stat-box">
        <div class="label">Taxă DITL (2%)</div>
        <div class="value ditl"><?php echo fmt($sumDitl); ?> <small style="font-size:15px;font-weight:400">RON</small></div>
      </div>
    </div>

    <!-- Tabel cursuri -->
    <div class="table-card">
      <?php
        $emptyLabel = $allYear ? (string)$year : (ucfirst($roMonths[$month]) . ' ' . $year);
      ?>
      <?php if (empty($rows)): ?>
        <div class="empty-state">Niciun raport pentru <?php echo h($emptyLabel); ?>.<br><small>Încarcă rapoarte XLSX pe paginile individuale ale cursurilor.</small></div>
      <?php else: ?>
        <table>
          <thead>
            <tr>
              <th>Curs</th>
              <th>Data</th>
              <th>Total bilete</th>
              <th>Total încasări</th>
              <th>DITL (2%)</th>
            </tr>
          </thead>
          <tbody>
            <?php
              $prevMonth = '';
              foreach ($rows as $r):
                // Separator pe lună când vedem tot anul
                if ($allYear) {
                    $rowMonth = substr($r['date'], 0, 7); // YYYY-MM
                    if ($rowMonth !== $prevMonth) {
                        $mNum = (int)substr($r['date'], 5, 2);
                        $prevMonth = $rowMonth;
                        echo '<tr><td colspan="5" style="background:var(--bg);font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);padding:8px 16px">'
                           . h(ucfirst($roMonths[$mNum]) . ' ' . $year) . '</td></tr>';
                    }
                }
            ?>
              <?php
                $subs = $vizaSubtipsByCourse[(int)$r['id']] ?? [];
                $rowId = 'viza-' . (int)$r['id'];
              ?>
              <tr>
                <td>
                  <?php if (!empty($subs)): ?>
                    <span class="course-link" style="cursor:pointer" onclick="toggleViza('<?php echo $rowId; ?>', this)"><?php echo h($r['name']); ?></span>
                  <?php else: ?>
                    <span><?php echo h($r['name']); ?></span>
                  <?php endif; ?>
                </td>
                <td style="color:var(--muted)"><?php echo h(ro_date($r['date'])); ?></td>
                <td><?php echo fmt((float)$r['total_bilete']); ?> RON</td>
                <td><?php echo fmt((float)$r['total_incasari']); ?> RON</td>
                <td class="ditl-cell"><?php echo fmt((float)$r['total_bilete'] * 0.02); ?> RON</td>
              </tr>
              <?php if (!empty($subs)):
                $byPrice = $reportByPriceByCourse[(int)$r['id']] ?? [];
              ?>
              <tr class="viza-subtips-row" id="<?php echo $rowId; ?>">
                <td colspan="5" style="padding:0;background:var(--bg)">
                  <div class="viza-subtips-inner">
                    <table class="viza-subtable">
                      <thead>
                        <tr>
                          <th>Seria</th>
                          <th>Tarif</th>
                          <th>Total bilete</th>
                          <th>Vândute</th>
                          <th>De la</th>
                          <th>Până la</th>
                        </tr>
                      </thead>
                      <tbody>
                        <?php foreach ($subs as $sub):
                          $key = (string)(float)$sub['tarif'];
                          $vandute = isset($byPrice[$key]) ? (int)$byPrice[$key]['vandute'] : null;
                        ?>
                        <tr>
                          <td><span class="seria-badge"><?php echo h($sub['seria']); ?></span></td>
                          <td><?php echo number_format((float)$sub['tarif'], 0, ',', '.'); ?> RON</td>
                          <td><?php echo (int)$sub['nr_unitati']; ?></td>
                          <td><?php echo $vandute !== null ? '<strong>' . $vandute . '</strong>' : '<span style="color:var(--muted)">—</span>'; ?></td>
                          <td><?php echo h($sub['de_la']); ?></td>
                          <td><?php echo h($sub['pana_la']); ?></td>
                        </tr>
                        <?php endforeach; ?>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
              <?php endif; ?>
            <?php endforeach; ?>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">Total <?php echo h($emptyLabel); ?></td>
              <td><?php echo fmt($sumBilete); ?> RON</td>
              <td><?php echo fmt($sumIncasari); ?> RON</td>
              <td class="ditl-cell"><?php echo fmt($sumDitl); ?> RON</td>
            </tr>
          </tfoot>
        </table>
      <?php endif; ?>
    </div>

  </div>
</main>
<script>
function toggleViza(id, el) {
    const row = document.getElementById(id);
    row.classList.toggle('open');
}
</script>
</body>
</html>
