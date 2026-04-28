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
    $bom = fread($handle, 3);
    if ($bom !== "\xEF\xBB\xBF") fseek($handle, 0);
    $header = null;
    while (($data = fgetcsv($handle, 0, ',')) !== false) {
        if ($header === null) { $header = array_map('trim', $data); continue; }
        $padded = array_pad($data, count($header), '');
        $rows[] = array_combine($header, array_slice($padded, 0, count($header)));
    }
    fclose($handle);
    return $rows;
}

// ─── XLSX Parser ──────────────────────────────────────────────────────────────

function col_letter_to_idx(string $col): int {
    $col = strtoupper($col); $idx = 0;
    for ($i = 0; $i < strlen($col); $i++) $idx = $idx * 26 + (ord($col[$i]) - ord('A') + 1);
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
    $rows = []; $header = null;
    foreach ($sheetDoc->sheetData->row as $xmlRow) {
        $cells = []; $maxCol = 0;
        foreach ($xmlRow->c as $cell) {
            preg_match('/([A-Z]+)\d+/', (string)$cell['r'], $m);
            $colIdx = col_letter_to_idx($m[1]); $maxCol = max($maxCol, $colIdx);
            $type = (string)$cell['t']; $value = (string)$cell->v;
            if ($type === 's') $value = $sharedStrings[(int)$value] ?? '';
            $cells[$colIdx] = $value;
        }
        $rowData = [];
        for ($i = 0; $i <= $maxCol; $i++) $rowData[] = $cells[$i] ?? '';
        if ($header === null) { $header = $rowData; }
        else {
            while (count($rowData) < count($header)) $rowData[] = '';
            $rows[] = array_combine($header, array_slice($rowData, 0, count($header)));
        }
    }
    return $rows;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function resolve_key(string $name): string {
    $l = strtolower($name);
    if (strpos($l, 'dogu') !== false) return 'dogu';
    if (strpos($l, 'turmerizza') !== false) return 'turmerizza';
    if (strpos($l, 'gustoria') !== false) return 'gustoria';
    if (strpos($l, 'hotdog') !== false || strpos($l, 'hot dog') !== false) return 'hotdog';
    return 'other';
}

function get_labels(): array {
    return ['dogu' => 'DOGU', 'turmerizza' => 'Turmerizza', 'gustoria' => 'Gustoria', 'hotdog' => 'HotDog de Bucuresti', 'other' => 'Altele'];
}

function glovo_float(string $val): float { return (float) str_replace(',', '.', trim($val)); }

function fmt_date(string $date): string {
    if (!$date) return '—';
    $ts = strtotime($date);
    return $ts ? date('d.m.Y', $ts) : $date;
}

function stars(int $n): string { return str_repeat('★', $n) . str_repeat('☆', 5 - $n); }

// ─── Database ─────────────────────────────────────────────────────────────────

function get_db(): SQLite3 {
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $db = new SQLite3($dir . '/reviewsdogu.sqlite');
    $db->exec('PRAGMA journal_mode=WAL');
    $db->exec('CREATE TABLE IF NOT EXISTS orders (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        platform           TEXT    NOT NULL,
        order_id           TEXT    NOT NULL,
        restaurant_key     TEXT    NOT NULL,
        restaurant_name    TEXT    NOT NULL,
        order_date         TEXT    NOT NULL,
        order_time         TEXT    NOT NULL DEFAULT \'\',
        status             TEXT    NOT NULL,
        order_amount       REAL    NOT NULL DEFAULT 0,
        rating             INTEGER,
        rating_comment     TEXT    NOT NULL DEFAULT \'\',
        waiting_tax        REAL    NOT NULL DEFAULT 0,
        refund_amount      REAL    NOT NULL DEFAULT 0,
        cancel_reason      TEXT    NOT NULL DEFAULT \'\',
        cancel_responsible TEXT    NOT NULL DEFAULT \'\',
        has_complaint      INTEGER NOT NULL DEFAULT 0,
        complaint_reason   TEXT    NOT NULL DEFAULT \'\',
        imported_at        TEXT    NOT NULL,
        UNIQUE(platform, order_id)
    )');
    // Migration: add order_amount if missing (existing DBs)
    $cols = []; $cr = $db->query("PRAGMA table_info(orders)");
    while ($row = $cr->fetchArray(SQLITE3_ASSOC)) $cols[] = $row['name'];
    if (!in_array('order_amount', $cols))
        $db->exec('ALTER TABLE orders ADD COLUMN order_amount REAL NOT NULL DEFAULT 0');
    return $db;
}

// ─── Save to DB ───────────────────────────────────────────────────────────────

function save_bolt_rows(SQLite3 $db, array $rows): array {
    $saved = $skipped = 0;
    $now = date('Y-m-d H:i:s');
    $stmt = $db->prepare(
        "INSERT OR IGNORE INTO orders
         (platform, order_id, restaurant_key, restaurant_name, order_date, order_time,
          status, order_amount, rating, rating_comment, waiting_tax, refund_amount,
          cancel_reason, cancel_responsible, has_complaint, complaint_reason, imported_at)
         VALUES ('bolt', :oid, :rk, :rn, :od, '', :st, :am, :rt, :rc, 0, 0, '', '', 0, '', :ia)"
    );
    foreach ($rows as $row) {
        $oid = trim($row['Order Reference ID'] ?? '');
        if (!$oid) continue;
        $pRaw   = $row['Provider Name'] ?? '';
        $rating = trim($row['Rating'] ?? '');
        $stmt->bindValue(':oid', $oid);
        $stmt->bindValue(':rk',  resolve_key($pRaw));
        $stmt->bindValue(':rn',  $pRaw);
        $stmt->bindValue(':od',  $row['Order Create Date'] ?? '');
        $stmt->bindValue(':st',  strtolower(trim($row['Finished Order Status'] ?? '')));
        $stmt->bindValue(':am',  (float)($row['Order Total Gross'] ?? 0));
        if ($rating !== '') $stmt->bindValue(':rt', (int)$rating, SQLITE3_INTEGER);
        else                $stmt->bindValue(':rt', null, SQLITE3_NULL);
        $stmt->bindValue(':rc', trim($row['Rating Comment'] ?? ''));
        $stmt->bindValue(':ia', $now);
        $stmt->execute();
        $db->changes() > 0 ? $saved++ : $skipped++;
        $stmt->reset();
    }
    return ['saved' => $saved, 'skipped' => $skipped];
}

function save_glovo_rows(SQLite3 $db, array $rows): array {
    $saved = $skipped = 0;
    $now = date('Y-m-d H:i:s');
    $stmt = $db->prepare(
        "INSERT OR IGNORE INTO orders
         (platform, order_id, restaurant_key, restaurant_name, order_date, order_time,
          status, order_amount, rating, rating_comment, waiting_tax, refund_amount,
          cancel_reason, cancel_responsible, has_complaint, complaint_reason, imported_at)
         VALUES ('glovo', :oid, :rk, :rn, :od, :ot, :st, :am, NULL, '', :wt, :ra, :cr, :cb, :hc, :pr, :ia)"
    );
    foreach ($rows as $row) {
        $oid = trim($row['ID comandă'] ?? '');
        if (!$oid) continue;
        $pRaw     = trim(preg_replace('/\s*\(.*$/s', '', $row['Denumire restaurant'] ?? ''));
        $datetime = trim($row['Comandă primită la'] ?? '');
        $status   = trim($row['Status comandă'] ?? '');
        $stmt->bindValue(':oid', $oid);
        $stmt->bindValue(':rk',  resolve_key($pRaw));
        $stmt->bindValue(':rn',  $pRaw);
        $stmt->bindValue(':od',  substr($datetime, 0, 10));
        $stmt->bindValue(':ot',  strlen($datetime) > 10 ? substr($datetime, 11, 5) : '');
        $stmt->bindValue(':st',  $status === 'Anulată' ? 'cancelled' : 'delivered');
        $stmt->bindValue(':am',  $status === 'Anulată' ? 0.0 : glovo_float($row['Subtotal'] ?? '0'));
        $stmt->bindValue(':wt',  glovo_float($row['Taxa pentru timpul de așteptare'] ?? '0'));
        $stmt->bindValue(':ra',  glovo_float($row['Rambursări partener'] ?? '0'));
        $stmt->bindValue(':cr',  $status === 'Anulată' ? trim($row['Motiv anulare'] ?? '') : '');
        $stmt->bindValue(':cb',  $status === 'Anulată' ? trim($row['Responsabil anulare'] ?? '') : '');
        $stmt->bindValue(':hc',  trim($row['Are reclamație?'] ?? '') === 'Y' ? 1 : 0, SQLITE3_INTEGER);
        $stmt->bindValue(':pr',  trim($row['Motiv reclamație'] ?? ''));
        $stmt->bindValue(':ia',  $now);
        $stmt->execute();
        $db->changes() > 0 ? $saved++ : $skipped++;
        $stmt->reset();
    }
    return ['saved' => $saved, 'skipped' => $skipped];
}

// ─── Report from CSV rows ─────────────────────────────────────────────────────

function generate_bolt_report(array $rows): array {
    $keys = ['dogu', 'turmerizza', 'gustoria', 'hotdog', 'other'];
    $counts = array_fill_keys($keys, 0);
    $sales  = array_fill_keys($keys, 0.0);
    $positive = array_fill_keys($keys, 0);
    $negative = array_fill_keys($keys, 0);
    $comments = array_fill_keys($keys, []);
    $dates = [];
    foreach ($rows as $row) {
        if (strtolower(trim($row['Finished Order Status'] ?? '')) === 'cancelled') continue;
        $pRaw    = $row['Provider Name'] ?? '';
        $key     = resolve_key($pRaw);
        $date    = $row['Order Create Date'] ?? '';
        $rating  = trim($row['Rating'] ?? '');
        $comment = trim($row['Rating Comment'] ?? '');
        if ($date) $dates[] = $date;
        $counts[$key]++;
        $sales[$key] += (float)($row['Order Total Gross'] ?? 0);
        if ($rating !== '') {
            $n = (int)$rating;
            if ($n >= 4)               $positive[$key]++;
            elseif ($n >= 1 && $n <= 3) $negative[$key]++;
            if ($comment !== '') $comments[$key][] = ['provider' => $pRaw, 'date' => $date, 'rating' => $n, 'comment' => $comment];
        }
    }
    sort($dates);
    return ['period_start' => $dates ? $dates[0] : null, 'period_end' => $dates ? $dates[count($dates)-1] : null,
            'counts' => $counts, 'sales' => $sales, 'labels' => get_labels(), 'positive' => $positive, 'negative' => $negative,
            'comments' => $comments, 'total' => array_sum($counts), 'total_sales' => array_sum($sales)];
}

function generate_glovo_report(array $rows): array {
    $keys = ['dogu', 'turmerizza', 'gustoria', 'hotdog', 'other'];
    $counts = array_fill_keys($keys, 0);
    $sales  = array_fill_keys($keys, 0.0);
    $dates = []; $waitingTax = []; $waitingTotal = 0.0; $refunds = []; $refundTotal = 0.0; $cancels = []; $complaints = [];
    foreach ($rows as $row) {
        $pRaw   = trim(preg_replace('/\s*\(.*$/s', '', $row['Denumire restaurant'] ?? ''));
        $key    = resolve_key($pRaw);
        $dt     = trim($row['Comandă primită la'] ?? '');
        $date   = substr($dt, 0, 10);
        $status = trim($row['Status comandă'] ?? '');
        if ($status === 'Anulată') {
            if (!empty(trim($row['Anulată la'] ?? '')))
                $cancels[] = ['date' => $date, 'restaurant' => $pRaw, 'reason' => trim($row['Motiv anulare'] ?? '—'), 'responsible' => trim($row['Responsabil anulare'] ?? '—')];
            continue;
        }
        if ($date) $dates[] = $date;
        $counts[$key]++;
        $sales[$key] += glovo_float($row['Subtotal'] ?? '0');
        $waitAmt = glovo_float($row['Taxa pentru timpul de așteptare'] ?? '0');
        if ($waitAmt > 0) { $waitingTax[] = ['date' => $date, 'time' => strlen($dt) > 10 ? substr($dt, 11, 5) : '', 'restaurant' => $pRaw, 'amount' => $waitAmt]; $waitingTotal += $waitAmt; }
        $refundAmt = glovo_float($row['Rambursări partener'] ?? '0');
        if ($refundAmt > 0) { $refunds[] = ['date' => $date, 'restaurant' => $pRaw, 'amount' => $refundAmt]; $refundTotal += $refundAmt; }
        if (trim($row['Are reclamație?'] ?? '') === 'Y') $complaints[] = ['date' => $date, 'restaurant' => $pRaw, 'reason' => trim($row['Motiv reclamație'] ?? '—')];
    }
    sort($dates);
    return ['period_start' => $dates ? $dates[0] : null, 'period_end' => $dates ? $dates[count($dates)-1] : null,
            'counts' => $counts, 'sales' => $sales, 'labels' => get_labels(), 'total' => array_sum($counts), 'total_sales' => array_sum($sales),
            'waiting_tax' => $waitingTax, 'waiting_total' => $waitingTotal, 'refunds' => $refunds,
            'refund_total' => $refundTotal, 'cancels' => $cancels, 'complaints' => $complaints];
}

// ─── Report from DB ───────────────────────────────────────────────────────────

function bolt_report_from_db(SQLite3 $db, string $start, string $end): array {
    $keys = ['dogu', 'turmerizza', 'gustoria', 'hotdog', 'other'];
    $counts = array_fill_keys($keys, 0);
    $sales  = array_fill_keys($keys, 0.0);
    $positive = array_fill_keys($keys, 0);
    $negative = array_fill_keys($keys, 0);
    $comments = array_fill_keys($keys, []);
    $stmt = $db->prepare("SELECT * FROM orders WHERE platform='bolt' AND status!='cancelled' AND order_date BETWEEN :s AND :e ORDER BY order_date");
    $stmt->bindValue(':s', $start); $stmt->bindValue(':e', $end);
    $res = $stmt->execute();
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $key = in_array($row['restaurant_key'], $keys) ? $row['restaurant_key'] : 'other';
        $counts[$key]++;
        $sales[$key] += (float)$row['order_amount'];
        if ($row['rating'] !== null) {
            $n = (int)$row['rating'];
            if ($n >= 4) $positive[$key]++;
            elseif ($n >= 1) $negative[$key]++;
            if (!empty($row['rating_comment'])) $comments[$key][] = ['provider' => $row['restaurant_name'], 'date' => $row['order_date'], 'rating' => $n, 'comment' => $row['rating_comment']];
        }
    }
    return ['period_start' => $start, 'period_end' => $end, 'counts' => $counts, 'sales' => $sales, 'labels' => get_labels(),
            'positive' => $positive, 'negative' => $negative, 'comments' => $comments,
            'total' => array_sum($counts), 'total_sales' => array_sum($sales)];
}

function glovo_report_from_db(SQLite3 $db, string $start, string $end): array {
    $keys = ['dogu', 'turmerizza', 'gustoria', 'hotdog', 'other'];
    $counts = array_fill_keys($keys, 0);
    $sales  = array_fill_keys($keys, 0.0);
    $waitingTax = []; $waitingTotal = 0.0; $refunds = []; $refundTotal = 0.0; $cancels = []; $complaints = [];

    $stmt = $db->prepare("SELECT * FROM orders WHERE platform='glovo' AND status='cancelled' AND order_date BETWEEN :s AND :e ORDER BY order_date, order_time");
    $stmt->bindValue(':s', $start); $stmt->bindValue(':e', $end);
    $res = $stmt->execute();
    while ($row = $res->fetchArray(SQLITE3_ASSOC))
        $cancels[] = ['date' => $row['order_date'], 'restaurant' => $row['restaurant_name'], 'reason' => $row['cancel_reason'], 'responsible' => $row['cancel_responsible']];

    $stmt = $db->prepare("SELECT * FROM orders WHERE platform='glovo' AND status!='cancelled' AND order_date BETWEEN :s AND :e ORDER BY order_date, order_time");
    $stmt->bindValue(':s', $start); $stmt->bindValue(':e', $end);
    $res = $stmt->execute();
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $key = in_array($row['restaurant_key'], $keys) ? $row['restaurant_key'] : 'other';
        $counts[$key]++;
        $sales[$key] += (float)$row['order_amount'];
        if ((float)$row['waiting_tax'] > 0) { $waitingTax[] = ['date' => $row['order_date'], 'time' => $row['order_time'], 'restaurant' => $row['restaurant_name'], 'amount' => (float)$row['waiting_tax']]; $waitingTotal += (float)$row['waiting_tax']; }
        if ((float)$row['refund_amount'] > 0) { $refunds[] = ['date' => $row['order_date'], 'restaurant' => $row['restaurant_name'], 'amount' => (float)$row['refund_amount']]; $refundTotal += (float)$row['refund_amount']; }
        if ($row['has_complaint']) $complaints[] = ['date' => $row['order_date'], 'restaurant' => $row['restaurant_name'], 'reason' => $row['complaint_reason']];
    }
    return ['period_start' => $start, 'period_end' => $end, 'counts' => $counts, 'sales' => $sales, 'labels' => get_labels(),
            'total' => array_sum($counts), 'total_sales' => array_sum($sales),
            'waiting_tax' => $waitingTax, 'waiting_total' => $waitingTotal,
            'refunds' => $refunds, 'refund_total' => $refundTotal, 'cancels' => $cancels, 'complaints' => $complaints];
}

// ─── Request handling ─────────────────────────────────────────────────────────

$report     = null;
$error      = null;
$saveResult = null;
$platform   = '';
$tab        = isset($_POST['action']) ? $_POST['action'] : ($_GET['tab'] ?? 'upload');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf($_POST['csrf'] ?? '');

    // ── History query ──────────────────────────────────────────────────────────
    if ($tab === 'history') {
        $platform   = $_POST['platform'] ?? '';
        $dateStart  = $_POST['date_start'] ?? '';
        $dateEnd    = $_POST['date_end'] ?? '';

        if (!in_array($platform, ['bolt', 'glovo'], true)) {
            $error = 'Selectează o platformă validă.';
        } elseif (!$dateStart || !$dateEnd) {
            $error = 'Selectează perioada completă.';
        } elseif ($dateStart > $dateEnd) {
            $error = 'Data de start trebuie să fie înainte de data de final.';
        } else {
            $db = get_db();
            if ($platform === 'bolt') {
                $report = bolt_report_from_db($db, $dateStart, $dateEnd);
                $report['type']      = 'bolt';
                $report['platform']  = 'Bolt';
                $report['filenames'] = [];
                $report['from_db']   = true;
            } else {
                $report = glovo_report_from_db($db, $dateStart, $dateEnd);
                $report['type']      = 'glovo';
                $report['platform']  = 'Glovo';
                $report['filenames'] = [];
                $report['from_db']   = true;
            }
            if ($report['total'] === 0 && empty($report['cancels'] ?? [])) {
                $report = null;
                $error  = 'Nu există comenzi stocate în perioada selectată pentru această platformă.';
            }
        }
    }

    // ── Upload ─────────────────────────────────────────────────────────────────
    elseif ($tab === 'upload') {
        $platform = $_POST['platform'] ?? '';
        $files    = $_FILES['report_files'] ?? null;

        if (!in_array($platform, ['bolt', 'glovo', 'wolt'], true)) {
            $error = 'Selectează o platformă validă.';
        } elseif ($platform === 'wolt') {
            $error = 'Exporturile Wolt vor fi adăugate în curând.';
        } elseif (!$files || empty($files['name'][0])) {
            $error = 'Nu a fost selectat niciun fișier.';
        } else {
            try {
                $allRows = []; $filenames = [];
                for ($i = 0; $i < count($files['name']); $i++) {
                    if ($files['error'][$i] !== UPLOAD_ERR_OK) throw new Exception('Eroare la fișierul "' . $files['name'][$i] . '".');
                    $ext = strtolower(pathinfo($files['name'][$i], PATHINFO_EXTENSION));
                    if (!in_array($ext, ['csv', 'xlsx'], true)) throw new Exception('Format nesuportat pentru "' . $files['name'][$i] . '".');
                    $rows    = ($ext === 'csv') ? parse_csv_file($files['tmp_name'][$i]) : parse_xlsx_file($files['tmp_name'][$i]);
                    $allRows = array_merge($allRows, $rows);
                    $filenames[] = $files['name'][$i];
                }
                if (empty($allRows)) { $error = 'Fișierele sunt goale.'; }
                elseif ($platform === 'bolt') {
                    if (!isset($allRows[0]['Provider Name'])) { $error = 'Format Bolt invalid (lipsește "Provider Name").'; }
                    else {
                        $db = get_db();
                        $saveResult          = save_bolt_rows($db, $allRows);
                        $report              = generate_bolt_report($allRows);
                        $report['type']      = 'bolt';
                        $report['platform']  = 'Bolt';
                        $report['filenames'] = $filenames;
                        $report['from_db']   = false;
                    }
                } elseif ($platform === 'glovo') {
                    if (!isset($allRows[0]['Denumire restaurant'])) { $error = 'Format Glovo invalid (lipsește "Denumire restaurant").'; }
                    else {
                        $db = get_db();
                        $saveResult          = save_glovo_rows($db, $allRows);
                        $report              = generate_glovo_report($allRows);
                        $report['type']      = 'glovo';
                        $report['platform']  = 'Glovo';
                        $report['filenames'] = $filenames;
                        $report['from_db']   = false;
                    }
                }
            } catch (Exception $e) { $error = 'Eroare la procesare: ' . $e->getMessage(); }
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
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/reviewsdogu/style.css" />
<!-- Privacy-friendly analytics by Plausible -->
<script async src="https://plausible.io/js/pa-U3QUedm8aW1g2Ou0qk-1J.js"></script>
<script>
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()
</script>

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

  <!-- ── Tab Bar ────────────────────────────────────────────────────────────── -->
  <div class="tab-bar">
    <a href="?tab=upload" class="tab <?php echo $tab === 'upload' ? 'tab-active' : ''; ?>">📤 Încarcă fișier</a>
    <a href="?tab=history" class="tab <?php echo $tab === 'history' ? 'tab-active' : ''; ?>">📅 Raport din baza de date</a>
  </div>

  <?php if ($tab === 'upload'): ?>
  <!-- ── Upload Card ────────────────────────────────────────────────────────── -->
  <div class="card">
    <h2 class="card-title">Încarcă raport</h2>
    <p class="card-subtitle">Selectează platforma și încarcă exportul CSV sau XLSX. Datele sunt salvate automat.</p>
    <form method="POST" enctype="multipart/form-data" class="upload-form">
      <input type="hidden" name="csrf" value="<?php echo htmlspecialchars($csrf); ?>" />
      <input type="hidden" name="action" value="upload" />
      <div class="form-group">
        <label class="form-label">Platformă</label>
        <div class="platform-pills">
          <label class="pill <?php echo $platform === 'bolt' ? 'pill-active' : ''; ?>">
            <input type="radio" name="platform" value="bolt" <?php echo $platform === 'bolt' ? 'checked' : ''; ?> />
            <span class="pill-icon">⚡</span> Bolt
          </label>
          <label class="pill <?php echo $platform === 'glovo' ? 'pill-active' : ''; ?>">
            <input type="radio" name="platform" value="glovo" <?php echo $platform === 'glovo' ? 'checked' : ''; ?> />
            <span class="pill-icon">🟡</span> Glovo
          </label>
          <label class="pill pill-soon">
            <input type="radio" name="platform" value="wolt" disabled />
            <span class="pill-icon">🔵</span> Wolt
            <span class="pill-badge">curând</span>
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Fișiere <span class="muted">(CSV sau XLSX — poți selecta mai multe)</span></label>
        <div class="file-drop" id="fileDrop">
          <input type="file" name="report_files[]" id="fileInput" accept=".csv,.xlsx" class="file-input" multiple />
          <div class="file-drop-inner">
            <span class="file-icon">📁</span>
            <span class="file-text" id="fileText">Trage fișierele aici sau <strong>click pentru selectare</strong></span>
          </div>
        </div>
        <div id="fileList" class="file-list"></div>
      </div>
      <button type="submit" class="btn-submit">Generează raport →</button>
    </form>
    <?php if ($error): ?>
    <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
    <?php endif; ?>
  </div>

  <?php elseif ($tab === 'history'): ?>
  <!-- ── History Card ───────────────────────────────────────────────────────── -->
  <div class="card">
    <h2 class="card-title">Raport din baza de date</h2>
    <p class="card-subtitle">Selectează platforma și perioada pentru care vrei să generezi raportul din datele stocate.</p>
    <form method="POST" class="upload-form">
      <input type="hidden" name="csrf" value="<?php echo htmlspecialchars($csrf); ?>" />
      <input type="hidden" name="action" value="history" />
      <div class="form-group">
        <label class="form-label">Platformă</label>
        <div class="platform-pills">
          <label class="pill <?php echo $platform === 'bolt' ? 'pill-active' : ''; ?>">
            <input type="radio" name="platform" value="bolt" <?php echo $platform === 'bolt' ? 'checked' : ''; ?> />
            <span class="pill-icon">⚡</span> Bolt
          </label>
          <label class="pill <?php echo $platform === 'glovo' ? 'pill-active' : ''; ?>">
            <input type="radio" name="platform" value="glovo" <?php echo $platform === 'glovo' ? 'checked' : ''; ?> />
            <span class="pill-icon">🟡</span> Glovo
          </label>
        </div>
      </div>
      <div class="form-group date-range-group">
        <div>
          <label class="form-label">De la</label>
          <input type="date" name="date_start" class="date-input"
                 value="<?php echo htmlspecialchars($_POST['date_start'] ?? date('Y-m-01')); ?>" required />
        </div>
        <div>
          <label class="form-label">Până la</label>
          <input type="date" name="date_end" class="date-input"
                 value="<?php echo htmlspecialchars($_POST['date_end'] ?? date('Y-m-t')); ?>" required />
        </div>
      </div>
      <button type="submit" class="btn-submit">Generează raport →</button>
    </form>
    <?php if ($error): ?>
    <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
    <?php endif; ?>
  </div>
  <?php endif; ?>

  <!-- ── Save result banner ─────────────────────────────────────────────────── -->
  <?php if ($saveResult): ?>
  <div class="save-banner">
    <span class="save-banner-icon">✅</span>
    <span>
      <strong><?php echo $saveResult['saved']; ?> comenzi noi salvate</strong>
      <?php if ($saveResult['skipped'] > 0): ?>
      &nbsp;·&nbsp; <?php echo $saveResult['skipped']; ?> duplicate ignorate
      <?php endif; ?>
    </span>
  </div>
  <?php endif; ?>

  <!-- ── Report ─────────────────────────────────────────────────────────────── -->
  <?php if ($report): ?>
  <?php
  $brandColors = [
      'dogu'       => ['bg' => '#FFF3E0', 'accent' => '#E65100', 'icon' => '🍔'],
      'turmerizza' => ['bg' => '#FFF8E1', 'accent' => '#F57F17', 'icon' => '🍕'],
      'gustoria'   => ['bg' => '#E8F5E9', 'accent' => '#2E7D32', 'icon' => '🥗'],
      'hotdog'     => ['bg' => '#FCE4EC', 'accent' => '#C62828', 'icon' => '🌭'],
      'other'      => ['bg' => '#F3E5F5', 'accent' => '#6A1B9A', 'icon' => '📦'],
  ];
  $isBolt  = $report['type'] === 'bolt';
  $isGlovo = $report['type'] === 'glovo';
  $total   = $report['total'];
  ?>
  <div class="report-wrapper">

    <!-- Header -->
    <div class="report-header">
      <div class="report-title-block">
        <span class="report-badge <?php echo $isGlovo ? 'badge-glovo' : 'badge-bolt'; ?>">
          <?php echo $isGlovo ? '🟡' : '⚡'; ?> <?php echo $report['platform']; ?>
          <?php if ($report['from_db']): ?><span class="badge-db">BD</span><?php endif; ?>
        </span>
        <h2 class="report-title"><?php echo $isBolt ? 'Raport comenzi &amp; reviews' : 'Raport comenzi &amp; taxe'; ?></h2>
        <?php if (!empty($report['filenames'])): ?>
        <div class="report-filenames">
          <?php foreach ($report['filenames'] as $fn): ?>
          <span class="report-filename-tag">📄 <?php echo htmlspecialchars($fn); ?></span>
          <?php endforeach; ?>
        </div>
        <?php endif; ?>
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
      <?php foreach ($report['counts'] as $key => $cnt):
          if ($key === 'other' && $cnt === 0) continue;
          $c    = $brandColors[$key];
          $pct  = $total > 0 ? round($cnt / $total * 100) : 0;
          $sale = $report['sales'][$key] ?? 0.0;
      ?>
      <div class="order-card" style="--card-bg:<?php echo $c['bg']; ?>; --card-accent:<?php echo $c['accent']; ?>">
        <div class="order-card-icon"><?php echo $c['icon']; ?></div>
        <div class="order-card-body">
          <div class="order-card-label"><?php echo htmlspecialchars($report['labels'][$key]); ?></div>
          <div class="order-card-count"><?php echo $cnt; ?></div>
          <div class="order-card-pct"><?php echo $pct; ?>% din total</div>
          <div class="order-card-sales"><?php echo number_format($sale, 2, ',', '.'); ?> RON</div>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
    <div class="total-strip">
      Total comenzi: <strong><?php echo $total; ?></strong>
      &nbsp;&nbsp;·&nbsp;&nbsp;
      Total vânzări: <strong><?php echo number_format($report['total_sales'] ?? 0, 2, ',', '.'); ?> RON</strong>
    </div>

    <?php if ($isBolt): ?>
    <!-- ══ BOLT: Reviews ══ -->
    <?php $allComments = 0; foreach ($report['comments'] as $cc) $allComments += count($cc); ?>
    <div class="section-title">Reviews per restaurant</div>
    <?php foreach ($report['counts'] as $key => $cnt):
        if ($key === 'other' && $cnt === 0) continue;
        $c = $brandColors[$key]; $pos = $report['positive'][$key]; $neg = $report['negative'][$key];
        $coms = $report['comments'][$key]; $totalRev = $pos + $neg;
    ?>
    <div class="restaurant-block" style="--rb-accent:<?php echo $c['accent']; ?>; --rb-bg:<?php echo $c['bg']; ?>">
      <div class="rb-header">
        <span class="rb-icon"><?php echo $c['icon']; ?></span>
        <span class="rb-name"><?php echo htmlspecialchars($report['labels'][$key]); ?></span>
        <?php if ($totalRev > 0): ?>
        <span class="rb-total-badge"><?php echo $totalRev; ?> review<?php echo $totalRev !== 1 ? 'uri' : ''; ?></span>
        <?php else: ?><span class="rb-no-reviews">fără reviews</span><?php endif; ?>
      </div>
      <?php if ($totalRev > 0): ?>
      <div class="rb-stats">
        <div class="rb-stat rb-pos"><span class="rb-stat-emoji">😊</span><span class="rb-stat-num"><?php echo $pos; ?></span><span class="rb-stat-label">pozitive (4–5★)</span></div>
        <div class="rb-stat rb-neg"><span class="rb-stat-emoji">😟</span><span class="rb-stat-num"><?php echo $neg; ?></span><span class="rb-stat-label">negative (1–3★)</span></div>
      </div>
      <?php endif; ?>
      <?php if (!empty($coms)): ?>
      <div class="rb-comments-title">Comentarii (<?php echo count($coms); ?>)</div>
      <div class="rb-comments">
        <?php foreach ($coms as $com): $isPos = $com['rating'] >= 4; ?>
        <div class="comment-card <?php echo $isPos ? 'comment-positive' : 'comment-negative'; ?>">
          <div class="comment-meta">
            <span class="comment-stars <?php echo $isPos ? 'stars-pos' : 'stars-neg'; ?>"><?php echo stars($com['rating']); ?></span>
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
    <div class="empty-comments"><span>💬</span> Niciun comentariu text în această perioadă.</div>
    <?php endif; ?>

    <?php elseif ($isGlovo): ?>
    <!-- ══ GLOVO: Taxe & Rambursări ══ -->

    <div class="section-title">Taxa pentru timpul de așteptare</div>
    <?php $waitCount = count($report['waiting_tax']); ?>
    <div class="tax-summary-row">
      <div class="tax-stat <?php echo $waitCount > 0 ? 'tax-stat-alert' : 'tax-stat-ok'; ?>">
        <span class="tax-stat-icon"><?php echo $waitCount > 0 ? '⏱️' : '✅'; ?></span>
        <div class="tax-stat-body"><div class="tax-stat-label">Comenzi afectate</div><div class="tax-stat-num"><?php echo $waitCount; ?></div></div>
      </div>
      <div class="tax-stat <?php echo $waitCount > 0 ? 'tax-stat-alert' : 'tax-stat-ok'; ?>">
        <span class="tax-stat-icon">💸</span>
        <div class="tax-stat-body"><div class="tax-stat-label">Total taxă</div><div class="tax-stat-num"><?php echo number_format($report['waiting_total'], 2, ',', '.'); ?> RON</div></div>
      </div>
    </div>
    <?php if (!empty($report['waiting_tax'])): ?>
    <table class="tax-table">
      <thead><tr><th>Data</th><th>Ora</th><th>Restaurant</th><th>Taxă (RON)</th></tr></thead>
      <tbody>
      <?php foreach ($report['waiting_tax'] as $t): ?>
        <tr><td><?php echo htmlspecialchars(fmt_date($t['date'])); ?></td><td class="tax-time"><?php echo htmlspecialchars($t['time']); ?></td><td><?php echo htmlspecialchars($t['restaurant']); ?></td><td class="tax-amount"><?php echo number_format($t['amount'], 2, ',', '.'); ?></td></tr>
      <?php endforeach; ?>
      </tbody>
      <tfoot><tr class="tax-total-row"><td colspan="3">Total</td><td class="tax-amount"><?php echo number_format($report['waiting_total'], 2, ',', '.'); ?></td></tr></tfoot>
    </table>
    <?php else: ?>
    <div class="empty-comments"><span>✅</span> Nicio taxă de așteptare în această perioadă.</div>
    <?php endif; ?>

    <div class="section-title">Rambursări partener</div>
    <?php $refCount = count($report['refunds']); ?>
    <div class="tax-summary-row">
      <div class="tax-stat <?php echo $refCount > 0 ? 'tax-stat-alert' : 'tax-stat-ok'; ?>">
        <span class="tax-stat-icon"><?php echo $refCount > 0 ? '↩️' : '✅'; ?></span>
        <div class="tax-stat-body"><div class="tax-stat-label">Comenzi afectate</div><div class="tax-stat-num"><?php echo $refCount; ?></div></div>
      </div>
      <div class="tax-stat <?php echo $refCount > 0 ? 'tax-stat-alert' : 'tax-stat-ok'; ?>">
        <span class="tax-stat-icon">💸</span>
        <div class="tax-stat-body"><div class="tax-stat-label">Total rambursări</div><div class="tax-stat-num"><?php echo number_format($report['refund_total'], 2, ',', '.'); ?> RON</div></div>
      </div>
    </div>
    <?php if (!empty($report['refunds'])): ?>
    <table class="tax-table">
      <thead><tr><th>Data</th><th>Restaurant</th><th>Sumă (RON)</th></tr></thead>
      <tbody>
      <?php foreach ($report['refunds'] as $r): ?>
        <tr><td><?php echo htmlspecialchars(fmt_date($r['date'])); ?></td><td><?php echo htmlspecialchars($r['restaurant']); ?></td><td class="tax-amount"><?php echo number_format($r['amount'], 2, ',', '.'); ?></td></tr>
      <?php endforeach; ?>
      </tbody>
      <tfoot><tr class="tax-total-row"><td colspan="2">Total</td><td class="tax-amount"><?php echo number_format($report['refund_total'], 2, ',', '.'); ?></td></tr></tfoot>
    </table>
    <?php else: ?>
    <div class="empty-comments"><span>✅</span> Nicio rambursare în această perioadă.</div>
    <?php endif; ?>

    <?php if (!empty($report['cancels'])): ?>
    <div class="section-title">Comenzi anulate (<?php echo count($report['cancels']); ?>)</div>
    <table class="tax-table">
      <thead><tr><th>Data</th><th>Restaurant</th><th>Motiv</th><th>Responsabil</th></tr></thead>
      <tbody>
      <?php foreach ($report['cancels'] as $cc): ?>
        <tr><td><?php echo htmlspecialchars(fmt_date($cc['date'])); ?></td><td><?php echo htmlspecialchars($cc['restaurant']); ?></td><td><?php echo htmlspecialchars($cc['reason']); ?></td><td><span class="responsible-badge"><?php echo htmlspecialchars($cc['responsible']); ?></span></td></tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    <?php endif; ?>

    <?php if (!empty($report['complaints'])): ?>
    <div class="section-title">Reclamații (<?php echo count($report['complaints']); ?>)</div>
    <table class="tax-table">
      <thead><tr><th>Data</th><th>Restaurant</th><th>Motiv</th></tr></thead>
      <tbody>
      <?php foreach ($report['complaints'] as $cp): ?>
        <tr><td><?php echo htmlspecialchars(fmt_date($cp['date'])); ?></td><td><?php echo htmlspecialchars($cp['restaurant']); ?></td><td><?php echo htmlspecialchars($cp['reason']); ?></td></tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    <?php endif; ?>

    <?php endif; ?>

  </div><!-- /report-wrapper -->
  <?php endif; ?>

</main>

<script>
(function () {
  document.querySelectorAll('.pill input[type=radio]').forEach(function(radio) {
    radio.addEventListener('change', function() {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('pill-active'));
      if (this.checked) this.closest('.pill').classList.add('pill-active');
    });
  });

  var drop     = document.getElementById('fileDrop');
  var input    = document.getElementById('fileInput');
  var fileList = document.getElementById('fileList');
  if (!drop) return;

  function renderFiles(files) {
    var text = document.getElementById('fileText');
    if (!files || files.length === 0) {
      text.innerHTML = 'Trage fișierele aici sau <strong>click pentru selectare</strong>';
      drop.classList.remove('file-drop-selected');
      fileList.innerHTML = '';
      return;
    }
    text.innerHTML = '<strong>' + files.length + ' fișier' + (files.length > 1 ? 'e selectate' : ' selectat') + '</strong>';
    drop.classList.add('file-drop-selected');
    var html = '';
    for (var i = 0; i < files.length; i++)
      html += '<div class="file-chip">📄 <span>' + files[i].name + '</span><button type="button" class="file-chip-remove" data-idx="' + i + '">×</button></div>';
    fileList.innerHTML = html;
    fileList.querySelectorAll('.file-chip-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-idx'));
        var dt  = new DataTransfer();
        for (var j = 0; j < input.files.length; j++) if (j !== idx) dt.items.add(input.files[j]);
        input.files = dt.files;
        renderFiles(input.files);
      });
    });
  }

  input.addEventListener('change', function() { renderFiles(this.files); });
  drop.addEventListener('dragover',  function(e) { e.preventDefault(); drop.classList.add('file-drop-hover'); });
  drop.addEventListener('dragleave', function()  { drop.classList.remove('file-drop-hover'); });
  drop.addEventListener('drop', function(e) {
    e.preventDefault(); drop.classList.remove('file-drop-hover');
    var dropped = e.dataTransfer.files;
    if (dropped.length) {
      var dt = new DataTransfer();
      for (var i = 0; i < input.files.length; i++) dt.items.add(input.files[i]);
      for (var i = 0; i < dropped.length; i++)      dt.items.add(dropped[i]);
      input.files = dt.files; renderFiles(input.files);
    }
  });
})();
</script>

</body>
</html>
