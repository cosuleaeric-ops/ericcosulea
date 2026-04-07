<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/reviewsdogu/');
    exit;
}

$csrf = csrf_token();
header('X-Robots-Tag: noindex, nofollow');

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parse_csv_file(string $path): array {
    $rows = [];
    $handle = fopen($path, 'r');
    if ($handle === false) return $rows;

    // Strip UTF-8 BOM if present
    $bom = fread($handle, 3);
    if ($bom !== "\xEF\xBB\xBF") fseek($handle, 0);

    $header = null;
    while (($data = fgetcsv($handle, 0, ',')) !== false) {
        if ($header === null) {
            $header = array_map('trim', $data);
            continue;
        }
        $padded = array_pad($data, count($header), '');
        $rows[] = array_combine($header, array_slice($padded, 0, count($header)));
    }
    fclose($handle);
    return $rows;
}

// ─── XLSX Parser ──────────────────────────────────────────────────────────────

function col_letter_to_idx(string $col): int {
    $col = strtoupper($col);
    $idx = 0;
    for ($i = 0; $i < strlen($col); $i++) {
        $idx = $idx * 26 + (ord($col[$i]) - ord('A') + 1);
    }
    return $idx - 1;
}

function parse_xlsx_file(string $path): array {
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) throw new Exception('Nu s-a putut deschide fișierul XLSX.');

    $sharedStrings = [];
    $ssXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($ssXml) {
        $ssDoc = new SimpleXMLElement($ssXml);
        foreach ($ssDoc->si as $si) {
            $text = isset($si->t) ? (string)$si->t : '';
            if (!$text) foreach ($si->r as $r) $text .= (string)$r->t;
            $sharedStrings[] = $text;
        }
    }

    $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close();

    if (!$sheetXml) throw new Exception('Nu s-a găsit foaia de calcul în fișierul XLSX.');

    $sheetDoc = new SimpleXMLElement($sheetXml);
    $rows     = [];
    $header   = null;

    foreach ($sheetDoc->sheetData->row as $xmlRow) {
        $cells  = [];
        $maxCol = 0;

        foreach ($xmlRow->c as $cell) {
            preg_match('/([A-Z]+)\d+/', (string)$cell['r'], $m);
            $colIdx = col_letter_to_idx($m[1]);
            $maxCol = max($maxCol, $colIdx);
            $type   = (string)$cell['t'];
            $value  = (string)$cell->v;
            if ($type === 's') $value = $sharedStrings[(int)$value] ?? '';
            $cells[$colIdx] = $value;
        }

        $rowData = [];
        for ($i = 0; $i <= $maxCol; $i++) $rowData[] = $cells[$i] ?? '';

        if ($header === null) {
            $header = $rowData;
        } else {
            while (count($rowData) < count($header)) $rowData[] = '';
            $rows[] = array_combine($header, array_slice($rowData, 0, count($header)));
        }
    }
    return $rows;
}

// ─── Bolt Report Generator ────────────────────────────────────────────────────

function generate_bolt_report(array $rows): array {
    $keys   = ['dogu', 'turmerizza', 'gustoria', 'hotdog', 'other'];
    $labels = [
        'dogu'       => 'DOGU',
        'turmerizza' => 'Turmerizza',
        'gustoria'   => 'Gustoria',
        'hotdog'     => 'HotDog de Bucuresti',
        'other'      => 'Altele',
    ];

    $counts   = array_fill_keys($keys, 0);
    $positive = array_fill_keys($keys, 0);
    $negative = array_fill_keys($keys, 0);
    $comments = array_fill_keys($keys, []);
    $dates    = [];

    foreach ($rows as $row) {
        $pRaw    = $row['Provider Name'] ?? '';
        $pLower  = strtolower($pRaw);
        $date    = $row['Order Create Date'] ?? '';
        $rating  = trim($row['Rating'] ?? '');
        $comment = trim($row['Rating Comment'] ?? '');

        if ($date) $dates[] = $date;

        if (strpos($pLower, 'dogu') !== false)                                              $key = 'dogu';
        elseif (strpos($pLower, 'turmerizza') !== false)                                    $key = 'turmerizza';
        elseif (strpos($pLower, 'gustoria') !== false)                                      $key = 'gustoria';
        elseif (strpos($pLower, 'hotdog') !== false || strpos($pLower, 'hot dog') !== false) $key = 'hotdog';
        else                                                                                 $key = 'other';

        $counts[$key]++;

        if ($rating !== '') {
            $n = (int)$rating;
            if ($n >= 4)               $positive[$key]++;
            elseif ($n >= 1 && $n <= 3) $negative[$key]++;

            if ($comment !== '') {
                $comments[$key][] = ['provider' => $pRaw, 'date' => $date, 'rating' => $n, 'comment' => $comment];
            }
        }
    }

    sort($dates);

    return [
        'period_start' => $dates ? $dates[0] : null,
        'period_end'   => $dates ? $dates[count($dates) - 1] : null,
        'counts'       => $counts,
        'labels'       => $labels,
        'positive'     => $positive,
        'negative'     => $negative,
        'comments'     => $comments,
        'total'        => count($rows),
    ];
}

function fmt_date(string $date): string {
    if (!$date) return '—';
    $ts = strtotime($date);
    return $ts ? date('d.m.Y', $ts) : $date;
}

function stars(int $n): string {
    return str_repeat('★', $n) . str_repeat('☆', 5 - $n);
}

// ─── Handle Upload ────────────────────────────────────────────────────────────

$report   = null;
$error    = null;
$platform = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf($_POST['csrf'] ?? '');
    $platform = $_POST['platform'] ?? '';
    $file     = $_FILES['report_file'] ?? null;

    if (!in_array($platform, ['bolt', 'glovo', 'wolt'], true)) {
        $error = 'Selectează o platformă validă.';
    } elseif (!$file || $file['error'] !== UPLOAD_ERR_OK) {
        $errs = [
            UPLOAD_ERR_INI_SIZE  => 'Fișierul depășește limita serverului.',
            UPLOAD_ERR_FORM_SIZE => 'Fișierul depășește limita formularului.',
            UPLOAD_ERR_PARTIAL   => 'Fișierul a fost încărcat parțial.',
            UPLOAD_ERR_NO_FILE   => 'Nu a fost selectat niciun fișier.',
        ];
        $error = $errs[$file['error'] ?? 0] ?? 'Eroare la încărcarea fișierului.';
    } elseif (!in_array(strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)), ['csv', 'xlsx'], true)) {
        $error = 'Format nesuportat. Acceptăm CSV sau XLSX.';
    } elseif ($platform !== 'bolt') {
        $error = 'Momentan suportăm doar exporturile Bolt. Glovo și Wolt vor fi adăugate în curând.';
    } else {
        try {
            $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $rows = ($ext === 'csv') ? parse_csv_file($file['tmp_name']) : parse_xlsx_file($file['tmp_name']);

            if (empty($rows)) {
                $error = 'Fișierul este gol sau nu a putut fi citit.';
            } elseif (!isset($rows[0]['Provider Name'])) {
                $error = 'Format necunoscut. Asigură-te că încarci un export Bolt valid (coloana "Provider Name" lipsește).';
            } else {
                $report             = generate_bolt_report($rows);
                $report['platform'] = 'Bolt';
                $report['filename'] = htmlspecialchars($file['name']);
            }
        } catch (Exception $e) {
            $error = 'Eroare la procesare: ' . $e->getMessage();
        }
    }
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reviews DOGU</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/reviewsdogu/style.css" />
</head>
<body>

<header class="app-header">
  <div class="header-inner">
    <div class="header-left">
      <a href="#" onclick="history.back();return false;" class="back-link">← Înapoi</a>
      <h1>Reviews DOGU</h1>
    </div>
    <a href="/admin/logout.php" class="logout-link">Ieși</a>
  </div>
</header>

<main class="container">

  <!-- ── Upload Card ─────────────────────────────────────────────────────── -->
  <div class="card upload-card">
    <h2 class="card-title">Încarcă raport</h2>
    <p class="card-subtitle">Selectează platforma și încarcă exportul CSV sau XLSX.</p>

    <form method="POST" enctype="multipart/form-data" class="upload-form">
      <input type="hidden" name="csrf" value="<?php echo htmlspecialchars($csrf); ?>" />

      <div class="form-group">
        <label class="form-label">Platformă</label>
        <div class="platform-pills">
          <label class="pill <?php echo $platform === 'bolt' ? 'pill-active' : ''; ?>">
            <input type="radio" name="platform" value="bolt" <?php echo $platform === 'bolt' ? 'checked' : ''; ?> />
            <span class="pill-icon">⚡</span> Bolt
          </label>
          <label class="pill pill-soon">
            <input type="radio" name="platform" value="glovo" disabled />
            <span class="pill-icon">🟡</span> Glovo
            <span class="pill-badge">curând</span>
          </label>
          <label class="pill pill-soon">
            <input type="radio" name="platform" value="wolt" disabled />
            <span class="pill-icon">🔵</span> Wolt
            <span class="pill-badge">curând</span>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Fișier <span class="muted">(CSV sau XLSX)</span></label>
        <div class="file-drop" id="fileDrop">
          <input type="file" name="report_file" id="fileInput" accept=".csv,.xlsx" class="file-input" />
          <div class="file-drop-inner" id="fileDropInner">
            <span class="file-icon">📁</span>
            <span class="file-text" id="fileText">Trage fișierul aici sau <strong>click pentru selectare</strong></span>
          </div>
        </div>
      </div>

      <button type="submit" class="btn-submit">Generează raport →</button>
    </form>

    <?php if ($error): ?>
    <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
    <?php endif; ?>
  </div>

  <?php if ($report): ?>

  <!-- ── Report ───────────────────────────────────────────────────────────── -->
  <div class="report-wrapper">

    <!-- Header raport -->
    <div class="report-header">
      <div class="report-title-block">
        <span class="report-badge badge-bolt">⚡ <?php echo $report['platform']; ?></span>
        <h2 class="report-title">Raport comenzi &amp; reviews</h2>
        <p class="report-filename">📄 <?php echo $report['filename']; ?></p>
      </div>
      <div class="report-period">
        <span class="period-label">Perioada</span>
        <span class="period-value">
          <?php echo fmt_date($report['period_start'] ?? ''); ?>
          <?php if ($report['period_start'] !== $report['period_end']): ?>
            &nbsp;—&nbsp;<?php echo fmt_date($report['period_end'] ?? ''); ?>
          <?php endif; ?>
        </span>
      </div>
    </div>

    <!-- Comenzi per restaurant -->
    <div class="section-title">Comenzi per restaurant</div>
    <div class="orders-grid">
      <?php
      $brandColors = [
          'dogu'       => ['bg' => '#FFF3E0', 'accent' => '#E65100', 'icon' => '🍔'],
          'turmerizza' => ['bg' => '#FFF8E1', 'accent' => '#F57F17', 'icon' => '🍕'],
          'gustoria'   => ['bg' => '#E8F5E9', 'accent' => '#2E7D32', 'icon' => '🥗'],
          'hotdog'     => ['bg' => '#FCE4EC', 'accent' => '#C62828', 'icon' => '🌭'],
          'other'      => ['bg' => '#F3E5F5', 'accent' => '#6A1B9A', 'icon' => '📦'],
      ];
      $total = $report['total'];
      foreach ($report['counts'] as $key => $cnt):
          if ($key === 'other' && $cnt === 0) continue;
          $c   = $brandColors[$key];
          $pct = $total > 0 ? round($cnt / $total * 100) : 0;
      ?>
      <div class="order-card" style="--card-bg:<?php echo $c['bg']; ?>; --card-accent:<?php echo $c['accent']; ?>">
        <div class="order-card-icon"><?php echo $c['icon']; ?></div>
        <div class="order-card-body">
          <div class="order-card-label"><?php echo htmlspecialchars($report['labels'][$key]); ?></div>
          <div class="order-card-count"><?php echo $cnt; ?></div>
          <div class="order-card-pct"><?php echo $pct; ?>% din total</div>
        </div>
      </div>
      <?php endforeach; ?>
    </div>

    <!-- Totaluri -->
    <div class="total-strip">
      Total comenzi: <strong><?php echo $total; ?></strong>
    </div>

    <!-- Reviews per restaurant -->
    <?php
    $brandColors = isset($brandColors) ? $brandColors : [
        'dogu'       => ['bg' => '#FFF3E0', 'accent' => '#E65100', 'icon' => '🍔'],
        'turmerizza' => ['bg' => '#FFF8E1', 'accent' => '#F57F17', 'icon' => '🍕'],
        'gustoria'   => ['bg' => '#E8F5E9', 'accent' => '#2E7D32', 'icon' => '🥗'],
        'hotdog'     => ['bg' => '#FCE4EC', 'accent' => '#C62828', 'icon' => '🌭'],
        'other'      => ['bg' => '#F3E5F5', 'accent' => '#6A1B9A', 'icon' => '📦'],
    ];
    $allComments = 0;
    foreach ($report['comments'] as $c) $allComments += count($c);
    ?>
    <div class="section-title">Reviews per restaurant</div>

    <?php foreach ($report['counts'] as $key => $cnt):
        if ($key === 'other' && $cnt === 0) continue;
        $c   = $brandColors[$key];
        $pos = $report['positive'][$key];
        $neg = $report['negative'][$key];
        $coms = $report['comments'][$key];
        $totalRev = $pos + $neg;
    ?>
    <div class="restaurant-block" style="--rb-accent:<?php echo $c['accent']; ?>; --rb-bg:<?php echo $c['bg']; ?>">
      <div class="rb-header">
        <span class="rb-icon"><?php echo $c['icon']; ?></span>
        <span class="rb-name"><?php echo htmlspecialchars($report['labels'][$key]); ?></span>
        <?php if ($totalRev > 0): ?>
        <span class="rb-total-badge"><?php echo $totalRev; ?> review<?php echo $totalRev !== 1 ? 'uri' : ''; ?></span>
        <?php else: ?>
        <span class="rb-no-reviews">fără reviews</span>
        <?php endif; ?>
      </div>

      <?php if ($totalRev > 0): ?>
      <div class="rb-stats">
        <div class="rb-stat rb-pos">
          <span class="rb-stat-emoji">😊</span>
          <span class="rb-stat-num"><?php echo $pos; ?></span>
          <span class="rb-stat-label">pozitive (4–5★)</span>
        </div>
        <div class="rb-stat rb-neg">
          <span class="rb-stat-emoji">😟</span>
          <span class="rb-stat-num"><?php echo $neg; ?></span>
          <span class="rb-stat-label">negative (1–3★)</span>
        </div>
      </div>
      <?php endif; ?>

      <?php if (!empty($coms)): ?>
      <div class="rb-comments-title">Comentarii (<?php echo count($coms); ?>)</div>
      <div class="rb-comments">
        <?php foreach ($coms as $com):
            $isPos = $com['rating'] >= 4;
        ?>
        <div class="comment-card <?php echo $isPos ? 'comment-positive' : 'comment-negative'; ?>">
          <div class="comment-meta">
            <span class="comment-stars <?php echo $isPos ? 'stars-pos' : 'stars-neg'; ?>">
              <?php echo stars($com['rating']); ?>
            </span>
            <span class="comment-date"><?php echo htmlspecialchars(fmt_date($com['date'])); ?></span>
          </div>
          <p class="comment-text"><?php echo htmlspecialchars($com['comment']); ?></p>
        </div>
        <?php endforeach; ?>
      </div>
      <?php endif; ?>
    </div>
    <?php endforeach; ?>

    <?php if ($allComments === 0): ?>
    <div class="empty-comments">
      <span>💬</span> Niciun comentariu text în această perioadă.
    </div>
    <?php endif; ?>

  </div><!-- /report-wrapper -->
  <?php endif; ?>

</main>

<script>
(function () {
  // Platform pill selection
  document.querySelectorAll('.pill input[type=radio]').forEach(function(radio) {
    radio.addEventListener('change', function() {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('pill-active'));
      if (this.checked) this.closest('.pill').classList.add('pill-active');
    });
  });

  // File drop zone
  var drop  = document.getElementById('fileDrop');
  var input = document.getElementById('fileInput');
  var text  = document.getElementById('fileText');

  input.addEventListener('change', function() {
    if (this.files[0]) {
      text.innerHTML = '📄 <strong>' + this.files[0].name + '</strong>';
      drop.classList.add('file-drop-selected');
    }
  });

  drop.addEventListener('dragover', function(e) {
    e.preventDefault();
    drop.classList.add('file-drop-hover');
  });
  drop.addEventListener('dragleave', function() {
    drop.classList.remove('file-drop-hover');
  });
  drop.addEventListener('drop', function(e) {
    e.preventDefault();
    drop.classList.remove('file-drop-hover');
    var file = e.dataTransfer.files[0];
    if (file) {
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      text.innerHTML = '📄 <strong>' + file.name + '</strong>';
      drop.classList.add('file-drop-selected');
    }
  });
})();
</script>

</body>
</html>
