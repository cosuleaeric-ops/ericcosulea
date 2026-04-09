<?php
declare(strict_types=1);
require __DIR__ . '/../../admin/auth.php';
require __DIR__ . '/db.php';
if (!is_logged_in()) { header('Location: /admin/login.php?redirect=/clp/cursuri/'); exit; }

$db = get_clp_db();

// ── An + lună comune pentru ambele tab-uri ────────────────────────────────────
$now       = new DateTimeImmutable();
$ditlYear  = (int)($_GET['year']  ?? $now->format('Y'));
$ditlMonth = isset($_GET['month']) ? (int)$_GET['month'] : 0; // 0 = tot anul
$datePrefix = $ditlMonth > 0
    ? $ditlYear . '-' . str_pad((string)$ditlMonth, 2, '0', STR_PAD_LEFT)
    : (string)$ditlYear;

// ── Lista cursuri (filtrat pe an/lună) ────────────────────────────────────────
$result = $db->query("SELECT c.id, c.name, c.date,
    (SELECT COUNT(*) FROM tickets t WHERE t.course_id = c.id) as total_tickets,
    (SELECT filename FROM course_files f WHERE f.course_id = c.id AND f.file_type = 'viza' ORDER BY f.uploaded_at DESC LIMIT 1) as viza_filename,
    (SELECT 1 FROM course_reports r WHERE r.course_id = c.id LIMIT 1) as has_report
    FROM courses c WHERE c.date LIKE '{$datePrefix}%' ORDER BY c.date DESC");
$courses = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) $courses[] = $row;

$ditlRes = $db->query("
    SELECT c.id, c.name, c.date,
           r.total_bilete, r.total_incasari, r.types_json
    FROM courses c
    JOIN course_reports r ON r.course_id = c.id
    WHERE c.date LIKE '{$datePrefix}%'
    ORDER BY c.date DESC
");
$ditlRows = [];
while ($r = $ditlRes->fetchArray(SQLITE3_ASSOC)) $ditlRows[] = $r;

// Ani disponibili
$yearsRes = $db->query("SELECT DISTINCT strftime('%Y', c.date) AS y FROM courses c JOIN course_reports r ON r.course_id = c.id ORDER BY y DESC");
$ditlYears = [];
while ($yr = $yearsRes->fetchArray(SQLITE3_ASSOC)) $ditlYears[] = $yr['y'];
if (!in_array((string)$ditlYear, $ditlYears)) $ditlYears[] = (string)$ditlYear;

// Subtipuri viță + vândute
$vizaSubtipsByCourse   = [];
$reportByPriceByCourse = [];
if (!empty($ditlRows)) {
    $ids   = implode(',', array_map(fn($r) => (int)$r['id'], $ditlRows));
    $vsRes = $db->query("SELECT * FROM viza_subtips WHERE course_id IN ({$ids}) ORDER BY course_id, tarif DESC");
    while ($vs = $vsRes->fetchArray(SQLITE3_ASSOC)) {
        $vizaSubtipsByCourse[(int)$vs['course_id']][] = $vs;
    }
    foreach ($ditlRows as $r) {
        $types = json_decode($r['types_json'] ?? '[]', true) ?: [];
        $byPrice = [];
        foreach ($types as $t) {
            $byPrice[(string)(float)($t['pret'] ?? 0)] = $t;
        }
        $reportByPriceByCourse[(int)$r['id']] = $byPrice;
    }
}

// Grupare pe luni
$byMonth = [];
foreach ($ditlRows as $r) {
    $monthKey = substr($r['date'], 0, 7); // YYYY-MM
    $byMonth[$monthKey][] = $r;
}

$sumBilete   = array_sum(array_column($ditlRows, 'total_bilete'));
$sumIncasari = array_sum(array_column($ditlRows, 'total_incasari'));

$roMonths = ['', 'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
             'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

function fmt(float $v): string { return number_format($v, 2, ',', '.'); }

$tab = $_GET['tab'] ?? 'cursuri';
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
  <style>
    .tabs { display:flex; gap:4px; margin-bottom:24px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); padding:4px; width:fit-content; }
    .tab-btn { padding:7px 20px; border:none; border-radius:calc(var(--radius) - 2px); background:none; font-size:13px; font-weight:500; cursor:pointer; color:var(--muted); transition:all .15s; }
    .tab-btn.active { background:var(--card); color:var(--text); box-shadow:0 1px 3px rgba(0,0,0,.1); }
    .tab-panel { display:none; }
    .tab-panel.active { display:block; }
    /* DITL styles */
    .ditl-year-bar { display:flex; gap:10px; align-items:center; margin-bottom:20px; }
    .ditl-year-bar select { padding:7px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:14px; background:var(--bg); cursor:pointer; }
    .summary-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-bottom:24px; }
    .stat-box { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:18px 20px; box-shadow:var(--shadow); }
    .stat-box .lbl { font-size:10px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:var(--muted); margin-bottom:5px; }
    .stat-box .val { font-family:'Crimson Pro',Georgia,serif; font-size:26px; font-weight:600; }
    .stat-box .val.ditl { color:#c0392b; }
    .month-group { margin-bottom:20px; }
    .month-heading { font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:var(--muted); padding:8px 16px; background:var(--bg); border:1px solid var(--border); border-bottom:none; border-radius:var(--radius) var(--radius) 0 0; }
    .month-table-card { background:var(--card); border:1px solid var(--border); border-radius:0 0 var(--radius) var(--radius); box-shadow:var(--shadow); overflow:hidden; }
    .month-table-card table { width:100%; border-collapse:collapse; font-size:14px; }
    .month-table-card thead th { padding:10px 16px; text-align:left; font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:var(--muted); border-bottom:1px solid var(--border); }
    .month-table-card thead th:not(:first-child) { text-align:right; }
    .month-table-card tbody td { padding:11px 16px; border-bottom:1px solid var(--border); }
    .month-table-card tbody td:not(:first-child) { text-align:right; font-variant-numeric:tabular-nums; }
    .month-table-card tbody tr:last-child td { border-bottom:none; }
    .month-table-card tfoot td { padding:10px 16px; font-weight:700; border-top:2px solid var(--border); }
    .month-table-card tfoot td:not(:first-child) { text-align:right; font-variant-numeric:tabular-nums; }
    .ditl-cell { color:#c0392b; font-weight:600; }
    .course-name-toggle { cursor:pointer; font-weight:500; color:var(--text); }
    .course-name-toggle:hover { color:var(--green); }
    .viza-subtips-row { display:none; }
    .viza-subtips-row.open { display:table-row; }
    .viza-subtips-inner { padding:6px 16px 12px 32px; }
    .viza-subtable { width:100%; border-collapse:collapse; font-size:12px; }
    .viza-subtable th { padding:5px 10px; font-size:10px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:var(--muted); text-align:left; border-bottom:1px solid var(--border); }
    .viza-subtable th:not(:first-child) { text-align:right; }
    .viza-subtable td { padding:5px 10px; border-bottom:1px solid var(--border); }
    .viza-subtable td:not(:first-child) { text-align:right; font-variant-numeric:tabular-nums; }
    .viza-subtable tr:last-child td { border-bottom:none; }
    .seria-badge { background:var(--green-light); border:1px solid #b2d9c0; border-radius:4px; padding:1px 6px; font-weight:700; font-size:11px; }
    @media(max-width:600px) { .summary-grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
<header class="app-header">
  <h1>Cursuri</h1>
  <div class="header-controls">
    <a href="/clp/cursuri/add.php" class="btn btn-green" style="font-size:12px;padding:5px 14px">+ Curs nou</a>
  </div>
</header>
<main class="container" style="max-width:800px">
  <a href="/clp/" style="font-size:12px;color:var(--muted);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-bottom:20px">← Înapoi</a>

  <!-- Selector an + tab toggle -->
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
    <div class="tabs" style="margin-bottom:0">
      <button class="tab-btn <?php echo $tab !== 'ditl' ? 'active' : ''; ?>" onclick="switchTab(event,'cursuri')">Cursuri</button>
      <button class="tab-btn <?php echo $tab === 'ditl' ? 'active' : ''; ?>" onclick="switchTab(event,'ditl')">Rapoarte DITL</button>
    </div>
    <form method="get" id="yearForm" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <input type="hidden" name="tab" value="<?php echo h($tab); ?>">
      <select name="year" onchange="document.getElementById('yearForm').submit()" style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:var(--bg);cursor:pointer">
        <?php foreach ($ditlYears as $y): ?>
          <option value="<?php echo h($y); ?>" <?php echo (int)$y === $ditlYear ? 'selected' : ''; ?>><?php echo h($y); ?></option>
        <?php endforeach; ?>
      </select>
      <select name="month" onchange="document.getElementById('yearForm').submit()" style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:var(--bg);cursor:pointer">
        <option value="0" <?php echo $ditlMonth === 0 ? 'selected' : ''; ?>>Toate lunile</option>
        <?php for ($m = 1; $m <= 12; $m++): ?>
          <option value="<?php echo $m; ?>" <?php echo $ditlMonth === $m ? 'selected' : ''; ?>><?php echo ucfirst($roMonths[$m]); ?></option>
        <?php endfor; ?>
      </select>
    </form>
  </div>

  <!-- ── Tab: Cursuri ─────────────────────────────────────────────────── -->
  <div class="tab-panel <?php echo $tab !== 'ditl' ? 'active' : ''; ?>" id="panel-cursuri">
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
                <th style="width:100%">Curs</th>
                <th style="white-space:nowrap">Data</th>
                <th class="right" style="white-space:nowrap">Bilete</th>
                <th style="white-space:nowrap;text-align:center">Raport</th>
                <th style="white-space:nowrap;text-align:center">Viza</th>
              </tr>
            </thead>
            <tbody>
            <?php foreach ($courses as $c): ?>
              <tr style="cursor:pointer" onclick="location.href='/clp/cursuri/view.php?id=<?php echo $c['id']; ?>'">
                <td><strong><?php echo h($c['name']); ?></strong></td>
                <td style="white-space:nowrap"><?php echo h(ro_date($c['date'])); ?></td>
                <td class="right"><?php echo (int)$c['total_tickets']; ?></td>
                <td style="text-align:center">
                  <?php echo $c['has_report'] ? '<span style="color:var(--green);font-size:16px">✓</span>' : '<span style="color:var(--border);font-size:16px">—</span>'; ?>
                </td>
                <td style="text-align:center">
                  <?php echo $c['viza_filename'] ? '<span style="color:var(--green);font-size:16px">✓</span>' : '<span style="color:var(--border);font-size:16px">—</span>'; ?>
                </td>
              </tr>
            <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </div>
    <?php endif; ?>
  </div>

  <!-- ── Tab: Rapoarte DITL ───────────────────────────────────────────── -->
  <div class="tab-panel <?php echo $tab === 'ditl' ? 'active' : ''; ?>" id="panel-ditl">

    <?php if (empty($ditlRows)): ?>
      <div style="text-align:center;padding:60px 24px;color:var(--muted);font-size:15px">
        Niciun raport pentru <?php echo $ditlYear; ?>.<br>
        <small>Încarcă rapoarte XLSX pe paginile individuale ale cursurilor.</small>
      </div>
    <?php else: ?>

      <!-- Sumar an -->
      <div class="summary-grid" style="grid-template-columns:1fr 1fr">
        <div class="stat-box">
          <div class="lbl">Total încasări</div>
          <div class="val"><?php echo fmt($sumIncasari); ?> <small style="font-size:14px;font-weight:400">RON</small></div>
        </div>
        <div class="stat-box">
          <div class="lbl">Taxă DITL (2%)</div>
          <div class="val ditl"><?php echo fmt($sumIncasari * 0.02); ?> <small style="font-size:14px;font-weight:400">RON</small></div>
        </div>
      </div>

      <!-- Pe luni -->
      <?php foreach ($byMonth as $monthKey => $monthRows):
        $mNum   = (int)substr($monthKey, 5, 2);
        $mLabel = ucfirst($roMonths[$mNum]) . ' ' . $ditlYear;
        $mBilete   = array_sum(array_column($monthRows, 'total_bilete'));
        $mIncasari = array_sum(array_column($monthRows, 'total_incasari'));
      ?>
      <div class="month-group">
        <div class="month-heading"><?php echo h($mLabel); ?></div>
        <div class="month-table-card">
          <table>
            <thead>
              <tr>
                <th>Curs</th>
                <th>Data</th>
                <th>Total încasări</th>
                <th>DITL (2%)</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($monthRows as $r):
                $subs    = $vizaSubtipsByCourse[(int)$r['id']] ?? [];
                $byPrice = $reportByPriceByCourse[(int)$r['id']] ?? [];
                $rowId   = 'viza-' . (int)$r['id'];
              ?>
              <tr>
                <td>
                  <?php if (!empty($subs)): ?>
                    <span class="course-name-toggle" onclick="toggleViza('<?php echo $rowId; ?>')"><?php echo h($r['name']); ?></span>
                  <?php else: ?>
                    <?php echo h($r['name']); ?>
                  <?php endif; ?>
                </td>
                <td style="color:var(--muted)"><?php echo h(ro_date($r['date'])); ?></td>
                <td><?php echo fmt((float)$r['total_incasari']); ?> RON</td>
                <td class="ditl-cell"><?php echo fmt((float)$r['total_incasari'] * 0.02); ?> RON</td>
              </tr>
              <?php if (!empty($subs)): ?>
              <tr class="viza-subtips-row" id="<?php echo $rowId; ?>">
                <td colspan="4" style="padding:0;background:var(--bg)">
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
                          $key     = (string)(float)$sub['tarif'];
                          $vandute = isset($byPrice[$key]) ? (int)$byPrice[$key]['vandute'] : null;
                        ?>
                        <tr>
                          <td><span class="seria-badge"><?php echo h($sub['seria']); ?></span></td>
                          <td><?php echo number_format((float)$sub['tarif'], 0, ',', '.'); ?> RON</td>
                          <td><?php echo (int)$sub['nr_unitati']; ?></td>
                          <td><?php echo $vandute !== null ? '<strong>'.$vandute.'</strong>' : '<span style="color:var(--muted)">—</span>'; ?></td>
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
                <td colspan="2">Total <?php echo h($mLabel); ?></td>
                <td><?php echo fmt($mIncasari); ?> RON</td>
                <td class="ditl-cell"><?php echo fmt($mIncasari * 0.02); ?> RON</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <?php endforeach; ?>

    <?php endif; ?>
  </div>

</main>
<script>
function switchTab(e, tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + tab).classList.add('active');
    e.currentTarget.classList.add('active');
    document.querySelector('#yearForm input[name=tab]').value = tab;
    const year  = document.querySelector('#yearForm select[name=year]').value;
    const month = document.querySelector('#yearForm select[name=month]').value;
    const base  = tab === 'ditl' ? `?tab=ditl&year=${year}` : `?year=${year}`;
    history.replaceState(null, '', month > 0 ? `${base}&month=${month}` : base);
}
function toggleViza(id) {
    document.getElementById(id).classList.toggle('open');
}
</script>
</body>
</html>
