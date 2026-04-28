<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/vanzaridogu/');
    exit;
}

$csrf = csrf_token();
header('X-Robots-Tag: noindex, nofollow');

// ─── Breeze XLS Parser ───────────────────────────────────────────────────────
// Breeze exports SpreadsheetML (.xls) — XML-based, NOT binary Excel.
// Section headers contain embedded HTML tags (<b>), so we use regex for those.

function parse_breeze_xls(string $path): array {
    $content = file_get_contents($path);
    if ($content === false) throw new Exception('Nu s-a putut citi fișierul.');

    // Strip UTF-8 BOM
    $content = ltrim($content, "\xEF\xBB\xBF");

    // Extract section boundaries from header rows (MergeAcross=9) using regex
    // These rows look like: <ss:Data ...><b>Restaurant</b> Total -> ...</ss:Data>
    preg_match_all(
        '/MergeAcross="9".*?<ss:Data[^>]*>(.*?)<\/ss:Data>/s',
        $content,
        $headerMatches,
        PREG_OFFSET_CAPTURE
    );

    $sections = [];
    foreach ($headerMatches[1] as $i => [$rawText, $offset]) {
        $name = trim(preg_replace('/<[^>]+>/', '', $rawText)); // strip HTML tags
        // Extract section name (word before " Total ->")
        if (preg_match('/^(\S+)\s+Total\s*->/i', $name, $m)) {
            $sections[] = [
                'name'   => $m[1],
                'offset' => $headerMatches[0][$i][1], // offset of full match
                'raw'    => $name,
            ];
        }
    }

    if (empty($sections)) throw new Exception('Nu s-a găsit nicio secțiune în fișier. Verifică că ai încărcat un export Breeze valid.');

    // Find the "Restaurant" section
    $restIdx = null;
    foreach ($sections as $idx => $s) {
        if (strtolower($s['name']) === 'restaurant') { $restIdx = $idx; break; }
    }
    if ($restIdx === null) {
        $found = implode(', ', array_column($sections, 'name'));
        throw new Exception("Secțiunea \"Restaurant\" nu a fost găsită. Secțiuni detectate: $found.");
    }

    // Determine the byte-range of the Restaurant section in the XML
    // The section starts after the separator row following the previous section's total
    // and ends at (including) the Total row for this section.
    // Strategy: parse all rows, track which section we're in.

    // Parse with SimpleXML — suppress warnings for embedded HTML in header rows
    libxml_use_internal_errors(true);
    $xml = simplexml_load_string($content, 'SimpleXMLElement', 0,
        'urn:schemas-microsoft-com:office:spreadsheet');
    libxml_clear_errors();

    if (!$xml) throw new Exception('Fișierul nu este un XML valid.');

    $ns    = 'urn:schemas-microsoft-com:office:spreadsheet';
    $ws    = $xml->children($ns)->Worksheet;
    $table = $ws->children($ns)->Table;
    $rows  = $table->children($ns)->Row;

    // Walk rows, detect section boundaries:
    // A "separator" row has exactly 1 cell with MergeAcross=9 (section header or blank divider)
    // Section headers have embedded HTML (<b>Restaurant</b>) so SimpleXML returns
    // empty text for those nodes. We identify sections purely by counting separator
    // rows (single cell, MergeAcross>=5) and mapping them to the $sections array
    // which was already extracted via regex.

    $sectionIdx   = -1;
    $inRestaurant = false;
    $products     = [];

    foreach ($rows as $row) {
        $cells   = $row->children($ns)->Cell;
        $cellArr = iterator_to_array($cells, false);
        $count   = count($cellArr);
        if ($count === 0) continue;

        // Single-cell merged row = section separator/header
        if ($count === 1) {
            $mergeAttr = $cellArr[0]->attributes($ns);
            if (isset($mergeAttr['MergeAcross']) && (int)(string)$mergeAttr['MergeAcross'] >= 5) {
                // Advance to next section (text is empty due to embedded HTML — use index)
                $sectionIdx++;
                $currentName  = $sections[$sectionIdx]['name'] ?? '';
                $inRestaurant = (strtolower($currentName) === 'restaurant');
            }
            continue;
        }

        // Total row: first cell empty, second cell starts with "Total:"
        $d0 = $cellArr[0]->children($ns)->Data;
        $d1 = isset($cellArr[1]) ? $cellArr[1]->children($ns)->Data : null;
        if ((!$d0 || !(string)$d0) && $d1 && strpos((string)$d1, 'Total:') === 0) {
            $inRestaurant = false;
            continue;
        }

        // Skip column header row
        if ($d0 && (string)$d0 === 'Produs') continue;

        // Product row in Restaurant section
        if ($inRestaurant && $count >= 7) {
            $vals = [];
            foreach ($cellArr as $cell) {
                $d = $cell->children($ns)->Data;
                $vals[] = $d ? (string)$d : '';
            }
            $products[] = [
                'name'     => trim($vals[0]),
                'qty'      => (float)($vals[1] ?? 0),
                'venit'    => (float)($vals[3] ?? 0),
                'discount' => (float)($vals[5] ?? 0),
                'incasat'  => (float)($vals[6] ?? 0),
                'tva'      => (float)($vals[8] ?? 0),
                'net'      => (float)($vals[9] ?? 0),
            ];
        }
    }

    if (empty($products)) {
        throw new Exception('Secțiunea Restaurant nu conține produse. Verifică formatul fișierului.');
    }

    // Collect ambalaj from ALL sections (all rows in file)
    $ambalajTotal = 0.0;
    foreach ($rows as $row) {
        $cells   = $row->children($ns)->Cell;
        $cellArr = iterator_to_array($cells, false);
        if (count($cellArr) < 7) continue;
        $d0 = $cellArr[0]->children($ns)->Data;
        $d6 = $cellArr[6]->children($ns)->Data;
        if (!$d0 || !$d6) continue;
        $name = (string)$d0;
        if (stripos($name, 'ambalaj') !== false) {
            $ambalajTotal += (float)(string)$d6;
        }
    }

    return [
        'sections'     => $sections,
        'products'     => $products,
        'ambalaj_total'=> $ambalajTotal,
    ];
}

// ─── Report generator ─────────────────────────────────────────────────────────

function generate_breeze_report(array $data): array {
    $products = $data['products'];

    $total      = 0.0;
    $gustoria   = 0.0; // 100g sau Gustoria în nume
    $hotdog     = 0.0; // HotDog în nume
    $turmerizza = 0.0; // pizza în nume
    $dogu       = 0.0; // restul

    $byCategory = [
        'gustoria'   => [],
        'hotdog'     => [],
        'turmerizza' => [],
        'dogu'       => [],
    ];

    foreach ($products as $p) {
        $name  = $p['name'];
        $lower = strtolower($name);
        $inc   = $p['incasat'];

        $total += $inc;

        if (strpos($name, '100g') !== false || stripos($name, 'Gustoria') !== false) {
            $gustoria += $inc;
            $byCategory['gustoria'][] = $p;
        } elseif (stripos($name, 'HotDog') !== false) {
            $hotdog += $inc;
            $byCategory['hotdog'][] = $p;
        } elseif (stripos($name, 'pizza') !== false) {
            $turmerizza += $inc;
            $byCategory['turmerizza'][] = $p;
        } else {
            $dogu += $inc;
            $byCategory['dogu'][] = $p;
        }
    }

    return [
        'total'        => $total,
        'gustoria'     => $gustoria,
        'hotdog'       => $hotdog,
        'turmerizza'   => $turmerizza,
        'dogu'         => $dogu,
        'ambalaj'      => $data['ambalaj_total'],
        'by_category'  => $byCategory,
        'sections'     => $data['sections'],
    ];
}

function ron(float $v): string {
    return number_format($v, 2, ',', '.') . ' RON';
}

// ─── Handle upload ────────────────────────────────────────────────────────────

$report   = null;
$error    = null;
$filename = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf($_POST['csrf'] ?? '');
    $file = $_FILES['breeze_file'] ?? null;

    if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
        $errs = [
            UPLOAD_ERR_INI_SIZE  => 'Fișierul depășește limita serverului.',
            UPLOAD_ERR_FORM_SIZE => 'Fișierul depășește limita formularului.',
            UPLOAD_ERR_PARTIAL   => 'Fișierul a fost încărcat parțial.',
            UPLOAD_ERR_NO_FILE   => 'Nu a fost selectat niciun fișier.',
        ];
        $error = $errs[$file['error'] ?? 0] ?? 'Eroare la încărcarea fișierului.';
    } else {
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['xls', 'xml'], true)) {
            $error = 'Format nesuportat. Încarcă un export Breeze (.xls).';
        } else {
            try {
                $data     = parse_breeze_xls($file['tmp_name']);
                $report   = generate_breeze_report($data);
                $filename = $file['name'];
            } catch (Exception $e) {
                $error = $e->getMessage();
            }
        }
    }
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vânzări DOGU</title>
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/vanzaridogu/style.css" />
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
      <h1>Vânzări DOGU — Restaurant</h1>
    </div>
    <a href="/admin/logout.php" class="logout-link">Ieși</a>
  </div>
</header>

<main class="container">

  <!-- ── Upload Card ────────────────────────────────────────────────────────── -->
  <div class="card">
    <h2 class="card-title">Încarcă raport Breeze</h2>
    <p class="card-subtitle">Exportul de vânzări din Breeze (.xls). Se va analiza automat secțiunea <strong>Restaurant</strong>.</p>

    <form method="POST" enctype="multipart/form-data" class="upload-form">
      <input type="hidden" name="csrf" value="<?php echo htmlspecialchars($csrf); ?>" />

      <div class="form-group">
        <label class="form-label">Fișier <span class="muted">(.xls export Breeze)</span></label>
        <div class="file-drop" id="fileDrop">
          <input type="file" name="breeze_file" id="fileInput" accept=".xls,.xml" class="file-input" />
          <div class="file-drop-inner">
            <span class="file-icon">📊</span>
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
  <!-- ── Report ─────────────────────────────────────────────────────────────── -->

  <div class="report-header">
    <div class="report-title-block">
      <span class="report-badge">🍽️ Restaurant</span>
      <h2 class="report-title">Raport vânzări</h2>
      <p class="report-filename">📄 <?php echo htmlspecialchars($filename); ?></p>
    </div>
    <div class="report-total-block">
      <div class="report-total-label">Total încasat Restaurant</div>
      <div class="report-total-value"><?php echo ron($report['total']); ?></div>
    </div>
  </div>

  <!-- ── Restaurant cards ───────────────────────────────────────────────────── -->
  <div class="section-title">Defalcat pe restaurante</div>
  <div class="rest-grid">

    <?php
    $restaurants = [
        'dogu'       => ['label' => 'DOGU',               'icon' => '🍔', 'bg' => '#FFF3E0', 'accent' => '#E65100', 'key' => 'dogu'],
        'turmerizza' => ['label' => 'Turmerizza',          'icon' => '🍕', 'bg' => '#FFF8E1', 'accent' => '#F57F17', 'key' => 'turmerizza'],
        'gustoria'   => ['label' => 'Gustoria',            'icon' => '🥗', 'bg' => '#E8F5E9', 'accent' => '#2E7D32', 'key' => 'gustoria'],
        'hotdog'     => ['label' => 'HotDog de Bucuresti', 'icon' => '🌭', 'bg' => '#FCE4EC', 'accent' => '#C62828', 'key' => 'hotdog'],
    ];
    foreach ($restaurants as $key => $r):
        $amount = $report[$key];
        $pct    = $report['total'] > 0 ? round($amount / $report['total'] * 100, 1) : 0;
    ?>
    <div class="rest-card" style="--rc-bg:<?php echo $r['bg']; ?>; --rc-accent:<?php echo $r['accent']; ?>">
      <div class="rc-top">
        <span class="rc-icon"><?php echo $r['icon']; ?></span>
        <span class="rc-label"><?php echo $r['label']; ?></span>
      </div>
      <div class="rc-amount"><?php echo ron($amount); ?></div>
      <div class="rc-pct-bar">
        <div class="rc-pct-fill" style="width:<?php echo $pct; ?>%"></div>
      </div>
      <div class="rc-pct-label"><?php echo $pct; ?>% din total Restaurant</div>
      <details class="rc-details">
        <summary><?php echo count($report['by_category'][$key]); ?> produse</summary>
        <table class="prod-table">
          <thead><tr><th>Produs</th><th>Cantitate</th><th>Incasat</th></tr></thead>
          <tbody>
          <?php
          usort($report['by_category'][$key], fn($a, $b) => $b['incasat'] <=> $a['incasat']);
          foreach ($report['by_category'][$key] as $p):
              if ($p['incasat'] == 0) continue;
          ?>
          <tr>
            <td><?php echo htmlspecialchars($p['name']); ?></td>
            <td class="prod-qty"><?php echo rtrim(rtrim(number_format($p['qty'], 3, ',', '.'), '0'), ','); ?></td>
            <td class="prod-amount"><?php echo number_format($p['incasat'], 2, ',', '.'); ?></td>
          </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </details>
    </div>
    <?php endforeach; ?>
  </div>

  <!-- ── Ambalaj ───────────────────────────────────────────────────────────── -->
  <div class="section-title" style="margin-top:28px">Total ambalaje</div>
  <div class="ambalaj-strip">
    <span class="ambalaj-icon">📦</span>
    <div>
      <div class="ambalaj-label">Produse conținând „Ambalaj" — total incasat</div>
      <div class="ambalaj-value"><?php echo ron($report['ambalaj']); ?></div>
    </div>
  </div>

  <!-- ── Other sections detected ──────────────────────────────────────────── -->
  <?php
  $otherSections = array_filter($report['sections'], fn($s) => strtolower($s['name']) !== 'restaurant');
  if (!empty($otherSections)):
  ?>
  <div class="other-sections">
    <div class="section-title">Alte secțiuni din fișier (neanalizate)</div>
    <div class="other-sections-list">
    <?php foreach ($otherSections as $s): ?>
      <span class="section-chip"><?php echo htmlspecialchars($s['name']); ?></span>
    <?php endforeach; ?>
    </div>
  </div>
  <?php endif; ?>

  <?php endif; ?>

</main>

<script>
(function () {
  var drop  = document.getElementById('fileDrop');
  var input = document.getElementById('fileInput');
  var text  = document.getElementById('fileText');

  input.addEventListener('change', function() {
    if (this.files[0]) {
      text.innerHTML = '📄 <strong>' + this.files[0].name + '</strong>';
      drop.classList.add('file-drop-selected');
    }
  });
  drop.addEventListener('dragover',  function(e) { e.preventDefault(); drop.classList.add('file-drop-hover'); });
  drop.addEventListener('dragleave', function()  { drop.classList.remove('file-drop-hover'); });
  drop.addEventListener('drop', function(e) {
    e.preventDefault(); drop.classList.remove('file-drop-hover');
    var f = e.dataTransfer.files[0];
    if (f) {
      var dt = new DataTransfer(); dt.items.add(f);
      input.files = dt.files;
      text.innerHTML = '📄 <strong>' + f.name + '</strong>';
      drop.classList.add('file-drop-selected');
    }
  });
})();
</script>

</body>
</html>
