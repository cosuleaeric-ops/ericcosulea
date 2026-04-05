<?php
declare(strict_types=1);
require __DIR__ . '/../../admin/auth.php';
require __DIR__ . '/db.php';
if (!is_logged_in()) { header('Location: /admin/login.php?redirect=/clp/cursuri/add.php'); exit; }

$db  = get_clp_db();
$csrf = csrf_token();
$error = '';

function parse_ro_date(string $input): ?string {
    $input = trim(strtolower($input));
    $year  = (int)date('Y');
    $months = [
        'ianuarie'=>1,'ian'=>1,
        'februarie'=>2,'feb'=>2,
        'martie'=>3,'mar'=>3,
        'aprilie'=>4,'apr'=>4,
        'mai'=>5,
        'iunie'=>6,'iun'=>6,
        'iulie'=>7,'iul'=>7,
        'august'=>8,'aug'=>8,
        'septembrie'=>9,'sep'=>9,'sept'=>9,
        'octombrie'=>10,'oct'=>10,
        'noiembrie'=>11,'noi'=>11,'nov'=>11,
        'decembrie'=>12,'dec'=>12,
    ];
    // "6 martie" / "6 martie 2026"
    foreach ($months as $name => $num) {
        if (preg_match('/(\d{1,2})\s+' . preg_quote($name, '/') . '(?:\s+(\d{4}))?/', $input, $m)) {
            $d = (int)$m[1];
            $y = isset($m[2]) && $m[2] ? (int)$m[2] : $year;
            if ($d >= 1 && $d <= 31) return sprintf('%04d-%02d-%02d', $y, $num, $d);
        }
    }
    // "6.03" / "6.03.2026" / "6/03/2026"
    if (preg_match('/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{4}))?$/', $input, $m)) {
        $d = (int)$m[1]; $mo = (int)$m[2];
        $y = isset($m[3]) && $m[3] ? (int)$m[3] : $year;
        if ($d >= 1 && $d <= 31 && $mo >= 1 && $mo <= 12) return sprintf('%04d-%02d-%02d', $y, $mo, $d);
    }
    // already yyyy-mm-dd
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $input)) return $input;
    return null;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        http_response_code(400); exit('CSRF invalid');
    }
    $name = trim($_POST['name'] ?? '');
    $dateRaw = trim($_POST['date_raw'] ?? '');
    $date = parse_ro_date($dateRaw);
    $participantsJson = $_POST['participants_json'] ?? '[]';
    $participants = json_decode($participantsJson, true);

    if (!$name || !$date || !is_array($participants) || empty($participants)) {
        $error = !$date && $dateRaw
            ? 'Nu am putut interpreta data "' . $dateRaw . '". Încearcă: 6 martie, 6.03 sau 6.03.2026.'
            : 'Completează toate câmpurile și încarcă fișierul XLSX.';
    } else {
        $stmt = $db->prepare('INSERT INTO courses (name, date, created_at) VALUES (:name, :date, :now)');
        $stmt->bindValue(':name', $name, SQLITE3_TEXT);
        $stmt->bindValue(':date', $date, SQLITE3_TEXT);
        $stmt->bindValue(':now',  date('Y-m-d H:i:s'), SQLITE3_TEXT);
        $stmt->execute();
        $courseId = (int)$db->lastInsertRowID();

        $ins = $db->prepare('INSERT INTO tickets (course_id, participant_name) VALUES (:cid, :name)');
        foreach ($participants as $pname) {
            $pname = trim((string)$pname);
            if ($pname === '') continue;
            $ins->bindValue(':cid',  $courseId, SQLITE3_INTEGER);
            $ins->bindValue(':name', $pname,    SQLITE3_TEXT);
            $ins->execute();
            $ins->reset();
        }
        header("Location: /clp/cursuri/view.php?id={$courseId}");
        exit;
    }
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Curs nou — CLP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/pnlcursuri/style.css" />
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <style>
    .add-wrap { max-width: 600px; margin: 40px auto; }
    .add-wrap h2 { font-family:'Crimson Pro',Georgia,serif; font-size:22px; font-weight:600; margin-bottom:4px; }
    .add-wrap .lead { color:var(--muted); font-size:14px; margin-bottom:32px; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:28px; box-shadow:var(--shadow); }
    .drop-zone { border:2px dashed var(--border); border-radius:var(--radius); background:var(--bg); padding:40px 24px; text-align:center; cursor:pointer; transition:all .18s; position:relative; }
    .drop-zone:hover, .drop-zone.dragover { border-color:var(--green); background:var(--green-light); }
    .drop-zone input[type="file"] { position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%; }
    .drop-icon { font-size:32px; margin-bottom:10px; line-height:1; }
    .drop-title { font-size:14px; font-weight:600; margin-bottom:4px; }
    .drop-sub { font-size:12px; color:var(--muted); }
    .col-picker { display:none; margin-top:16px; background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:16px 18px; }
    .col-picker label { display:block; font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
    .col-picker select { width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:14px; background:var(--bg); cursor:pointer; }
    .preview-card { display:none; margin-top:16px; background:var(--green-light); border:1px solid #b2d9c0; border-radius:var(--radius); padding:20px 22px; }
    .preview-total { font-family:'Crimson Pro',Georgia,serif; font-size:24px; font-weight:600; margin-bottom:4px; }
    .preview-sub { font-size:13px; color:var(--muted); margin-bottom:14px; }
    .preview-list { list-style:none; display:flex; flex-direction:column; gap:8px; }
    .preview-list li { display:flex; align-items:center; gap:10px; font-size:14px; }
    .preview-bullet { width:7px; height:7px; border-radius:50%; background:var(--green); flex-shrink:0; }
    .divider { border:none; border-top:1px solid var(--border); margin:24px 0; }
  </style>
</head>
<body>
<header class="app-header">
  <h1>Curs nou</h1>
  <div class="header-controls">
    <a href="/clp/cursuri/" class="logout-link">← Cursuri</a>

  </div>
</header>
<main class="container">
  <div class="add-wrap">
    <a href="/clp/" style="font-size:12px;color:var(--muted);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-bottom:20px">← Dashboard</a>
    <?php if ($error): ?>
      <div class="error-msg" style="display:block;margin-bottom:20px"><?php echo h($error); ?></div>
    <?php endif; ?>

    <form method="post" id="addForm">
      <input type="hidden" name="csrf_token" value="<?php echo h($csrf); ?>">
      <input type="hidden" name="participants_json" id="participantsJson">

      <div class="card">
        <div class="form-group">
          <label>Numele cursului</label>
          <input type="text" name="name" id="courseName" required placeholder="" value="<?php echo h($_POST['name'] ?? ''); ?>">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Data cursului</label>
          <input type="text" name="date_raw" id="courseDate" autocomplete="off"
                 value="<?php echo h($_POST['date_raw'] ?? ''); ?>"
                 placeholder="">
          <div id="dateParsed" style="font-size:12px;margin-top:5px;color:var(--muted);min-height:16px"></div>
        </div>
      </div>

      <hr class="divider">

      <div class="card">
        <div class="form-group" style="margin-bottom:0">
          <label>Lista participanți (XLSX)</label>
          <div class="drop-zone" id="dropZone" style="margin-top:8px">
            <input type="file" id="fileInput" accept=".xlsx,.xls,.csv">
            <div class="drop-icon">📊</div>
            <div class="drop-title">Trage fișierul sau apasă pentru selectare</div>
            <div class="drop-sub">.xlsx, .xls sau .csv</div>
          </div>
        </div>
      </div>

      <!-- Column picker -->
      <div class="col-picker" id="colPicker">
        <label>Selectează coloana cu nume participanți</label>
        <select id="colSelect"></select>
        <button type="button" class="btn btn-ghost" id="btnApplyCol" style="margin-top:10px;width:100%;justify-content:center">Aplică</button>
      </div>

      <!-- Preview -->
      <div class="preview-card" id="previewCard">
        <div class="preview-total" id="previewTotal"></div>
        <div class="preview-sub" id="previewSub"></div>
        <ul class="preview-list" id="previewList"></ul>
      </div>

      <!-- Submit (apare după preview) -->
      <div id="submitWrap" style="display:none;margin-top:20px">
        <button type="submit" class="btn btn-green" style="width:100%;justify-content:center;padding:12px" id="btnSave">Salvează cursul</button>
      </div>
    </form>
  </div>
</main>
<script>
let parsedRows = [];
let allHeaders = [];

const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const colPicker = document.getElementById('colPicker');
const colSelect = document.getElementById('colSelect');
const previewCard = document.getElementById('previewCard');
const submitWrap  = document.getElementById('submitWrap');

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

function handleFile(file) {
    colPicker.style.display = 'none';
    previewCard.style.display = 'none';
    submitWrap.style.display = 'none';
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const wb = XLSX.read(e.target.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            parsedRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
            if (!parsedRows.length) { alert('Fișierul pare gol.'); return; }
            allHeaders = Object.keys(parsedRows[0]);
            const detected = detectCol(allHeaders);
            if (detected) {
                applyCol(detected);
            } else {
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

document.getElementById('btnApplyCol').addEventListener('click', () => {
    colPicker.style.display = 'none';
    applyCol(colSelect.value);
});

function applyCol(col) {
    const names = parsedRows.map(r => String(r[col] ?? '').trim()).filter(n => n);
    if (!names.length) { alert('Coloana selectată pare goală.'); return; }

    // Compute distribution
    const counts = {};
    names.forEach(n => counts[n] = (counts[n] || 0) + 1);
    const groups = {};
    Object.values(counts).forEach(c => groups[c] = (groups[c] || 0) + 1);
    const sorted = Object.entries(groups).map(([n, o]) => ({ n: +n, o })).sort((a, b) => b.n - a.n);

    document.getElementById('previewTotal').textContent = `${names.length} ${names.length === 1 ? 'bilet' : 'bilete'}`;
    document.getElementById('previewSub').textContent = `${Object.keys(counts).length} comenzi · coloana: ${col}`;

    const list = document.getElementById('previewList');
    list.innerHTML = '';
    sorted.forEach(({ n, o }) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="preview-bullet"></span> <strong>${o}</strong>&nbsp;${o===1?'comandă':'comenzi'} × <strong>${n} ${n===1?'bilet':'bilete'}</strong>`;
        list.appendChild(li);
    });

    document.getElementById('participantsJson').value = JSON.stringify(names);
    previewCard.style.display = 'block';
    submitWrap.style.display = 'block';
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Date parser (mirrors PHP logic) ──────────────────────────────────────────
const RO_MONTHS = {
    'ianuarie':1,'ian':1,'februarie':2,'feb':2,'martie':3,'mar':3,
    'aprilie':4,'apr':4,'mai':5,'iunie':6,'iun':6,'iulie':7,'iul':7,
    'august':8,'aug':8,'septembrie':9,'sep':9,'sept':9,
    'octombrie':10,'oct':10,'noiembrie':11,'noi':11,'nov':11,'decembrie':12,'dec':12
};
const RO_MONTH_NAMES = ['','ianuarie','februarie','martie','aprilie','mai','iunie',
    'iulie','august','septembrie','octombrie','noiembrie','decembrie'];

function parseRoDate(input) {
    const s = input.trim().toLowerCase();
    const y = new Date().getFullYear();
    for (const [name, num] of Object.entries(RO_MONTHS)) {
        const re = new RegExp('(\\d{1,2})\\s+' + name + '(?:\\s+(\\d{4}))?');
        const m = s.match(re);
        if (m) {
            const d = +m[1], yr = m[2] ? +m[2] : y;
            if (d >= 1 && d <= 31) return { d, mo: num, y: yr };
        }
    }
    const m2 = s.match(/^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{4}))?$/);
    if (m2) {
        const d = +m2[1], mo = +m2[2], yr = m2[3] ? +m2[3] : y;
        if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return { d, mo, y: yr };
    }
    return null;
}

document.getElementById('courseDate').addEventListener('input', function() {
    const el = document.getElementById('dateParsed');
    const parsed = parseRoDate(this.value);
    if (!this.value.trim()) { el.textContent = ''; return; }
    if (parsed) {
        el.style.color = 'var(--green)';
        el.textContent = '→ ' + parsed.d + ' ' + RO_MONTH_NAMES[parsed.mo] + ' ' + parsed.y;
    } else {
        el.style.color = 'var(--red)';
        el.textContent = '✕ dată nerecunoscută';
    }
});
</script>
</body>
</html>
