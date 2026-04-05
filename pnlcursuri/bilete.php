<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/pnlcursuri/bilete.php');
    exit;
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Analizor bilete — Cursuri la Pahar</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/pnlcursuri/style.css" />
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <style>
    .bilete-wrap {
      max-width: 640px;
      margin: 48px auto;
    }

    .bilete-wrap h2 {
      font-family: 'Crimson Pro', Georgia, serif;
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 6px;
    }

    .bilete-wrap .lead {
      color: var(--muted);
      font-size: 14px;
      margin-bottom: 32px;
    }

    /* Drop zone */
    .drop-zone {
      border: 2px dashed var(--border);
      border-radius: var(--radius);
      background: var(--card);
      padding: 52px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.18s;
      position: relative;
    }

    .drop-zone:hover,
    .drop-zone.dragover {
      border-color: var(--green);
      background: var(--green-light);
    }

    .drop-zone input[type="file"] {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      width: 100%;
      height: 100%;
    }

    .drop-icon {
      font-size: 36px;
      margin-bottom: 12px;
      line-height: 1;
    }

    .drop-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 4px;
    }

    .drop-sub {
      font-size: 13px;
      color: var(--muted);
    }

    /* Column picker */
    .col-picker {
      display: none;
      margin-top: 20px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 18px 20px;
    }

    .col-picker label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .col-picker select {
      width: 100%;
      padding: 9px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 14px;
      color: var(--text);
      background: var(--bg);
      cursor: pointer;
    }

    .col-picker select:focus {
      outline: none;
      border-color: var(--green);
    }

    .col-picker .btn {
      margin-top: 12px;
      width: 100%;
      justify-content: center;
    }

    /* Result */
    .result-card {
      display: none;
      margin-top: 24px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      border-top: 3px solid var(--green);
      padding: 28px 28px 24px;
      box-shadow: var(--shadow);
    }

    .result-total {
      font-family: 'Crimson Pro', Georgia, serif;
      font-size: 28px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 6px;
    }

    .result-sub {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 22px;
    }

    .result-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .result-list li {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 15px;
    }

    .result-bullet {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      flex-shrink: 0;
    }

    .result-num {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      min-width: 24px;
      text-align: right;
    }

    .result-label {
      color: var(--muted);
    }

    .result-label strong {
      color: var(--text);
      font-weight: 600;
    }

    .reset-btn {
      margin-top: 22px;
      background: none;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 7px 14px;
      font-size: 13px;
      color: var(--muted);
      cursor: pointer;
      transition: all 0.12s;
    }

    .reset-btn:hover {
      background: var(--bg);
      color: var(--text);
    }

    .error-banner {
      display: none;
      margin-top: 16px;
      background: var(--red-light);
      border: 1px solid #f5b5b6;
      border-radius: var(--radius-sm);
      padding: 12px 16px;
      color: var(--red);
      font-size: 13px;
    }
  </style>
</head>
<body>

<header class="app-header">
  <h1>Analizor bilete</h1>
  <div class="header-controls">
    <a href="/clp/" class="logout-link">← CLP</a>
    <a href="/admin/logout.php" class="logout-link">Ieși</a>
  </div>
</header>

<main class="container">
  <div class="bilete-wrap">
    <h2>Câte bilete s-au vândut per comandă?</h2>
    <p class="lead">Încarcă exportul XLSX de pe Livetickets și primești instant distribuția comenzilor.</p>

    <!-- Drop zone -->
    <div class="drop-zone" id="dropZone">
      <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" />
      <div class="drop-icon">📊</div>
      <div class="drop-title">Trage fișierul aici sau apasă pentru a selecta</div>
      <div class="drop-sub">.xlsx, .xls sau .csv</div>
    </div>

    <!-- Error -->
    <div class="error-banner" id="errorBanner"></div>

    <!-- Column picker (apare după parsare dacă e neclar) -->
    <div class="col-picker" id="colPicker">
      <label>Selectează coloana cu nume</label>
      <select id="colSelect"></select>
      <button class="btn btn-green" id="btnAnalyze">Analizează</button>
    </div>

    <!-- Result -->
    <div class="result-card" id="resultCard">
      <div class="result-total" id="resultTotal"></div>
      <div class="result-sub" id="resultSub"></div>
      <ul class="result-list" id="resultList"></ul>
      <button class="reset-btn" id="btnReset">← Încarcă alt fișier</button>
    </div>
  </div>
</main>

<script>
// ── State ────────────────────────────────────────────────────────────────────
let parsedData = [];   // array of row objects
let allHeaders = [];

// ── DOM ──────────────────────────────────────────────────────────────────────
const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('fileInput');
const errorBanner = document.getElementById('errorBanner');
const colPicker   = document.getElementById('colPicker');
const colSelect   = document.getElementById('colSelect');
const resultCard  = document.getElementById('resultCard');
const btnAnalyze  = document.getElementById('btnAnalyze');
const btnReset    = document.getElementById('btnReset');

// ── Drag & drop ──────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

// ── File handling ─────────────────────────────────────────────────────────────
function handleFile(file) {
  hideError();
  colPicker.style.display  = 'none';
  resultCard.style.display = 'none';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) {
        showError('Fișierul pare gol sau nu are rânduri de date.');
        return;
      }

      parsedData = rows;
      allHeaders = Object.keys(rows[0]);

      const detected = detectNameColumn(allHeaders);

      if (detected) {
        // Auto-detect reușit → analizăm direct
        analyze(detected);
      } else {
        // Arătăm picker-ul
        colSelect.innerHTML = allHeaders.map(h =>
          `<option value="${esc(h)}">${esc(h)}</option>`
        ).join('');
        colPicker.style.display = 'block';
      }
    } catch (err) {
      showError('Nu am putut citi fișierul. Asigură-te că e un XLSX/XLS/CSV valid.');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Column detection ──────────────────────────────────────────────────────────
function detectNameColumn(headers) {
  const priorities = [
    /^prenume$/i,
    /prenume/i,
    /^nume complet$/i,
    /^participant/i,
    /^cump[aă]r[aă]tor/i,
    /^client/i,
    /^name$/i,
    /full.?name/i,
    /^nume$/i,
    /nume/i,
  ];

  for (const re of priorities) {
    const found = headers.find(h => re.test(h.trim()));
    if (found) return found;
  }
  return null;
}

// ── Analyze button ─────────────────────────────────────────────────────────────
btnAnalyze.addEventListener('click', () => {
  const col = colSelect.value;
  if (col) {
    colPicker.style.display = 'none';
    analyze(col);
  }
});

// ── Core analysis ─────────────────────────────────────────────────────────────
function analyze(nameCol) {
  hideError();

  // Count occurrences per name
  const counts = {};
  for (const row of parsedData) {
    const name = String(row[nameCol] ?? '').trim();
    if (!name) continue;
    counts[name] = (counts[name] || 0) + 1;
  }

  const uniqueNames = Object.keys(counts);
  if (!uniqueNames.length) {
    showError(`Coloana „${nameCol}" pare goală.`);
    return;
  }

  // Group by ticket count: { ticketCount → numberOfOrders }
  const groups = {};
  for (const name of uniqueNames) {
    const n = counts[name];
    groups[n] = (groups[n] || 0) + 1;
  }

  // Sort descending by ticket count
  const sorted = Object.entries(groups)
    .map(([n, orders]) => ({ n: parseInt(n), orders }))
    .sort((a, b) => b.n - a.n);

  const totalTickets = parsedData.filter(r => String(r[nameCol] ?? '').trim()).length;
  const totalOrders  = uniqueNames.length;

  renderResult(totalTickets, totalOrders, sorted, nameCol);
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderResult(totalTickets, totalOrders, groups, col) {
  document.getElementById('resultTotal').textContent =
    `${totalTickets} ${totalTickets === 1 ? 'bilet' : 'bilete'}`;

  document.getElementById('resultSub').textContent =
    `${totalOrders} ${totalOrders === 1 ? 'comandă' : 'comenzi'} · coloana: ${col}`;

  const list = document.getElementById('resultList');
  list.innerHTML = '';

  for (const { n, orders } of groups) {
    const li = document.createElement('li');
    const ordersLabel = orders === 1 ? 'comandă' : 'comenzi';
    const biletLabel  = n === 1 ? 'bilet' : 'bilete';
    li.innerHTML = `
      <span class="result-bullet"></span>
      <span class="result-num">${orders}</span>
      <span class="result-label"><strong>${ordersLabel}</strong> × <strong>${n} ${biletLabel}</strong></span>
    `;
    list.appendChild(li);
  }

  resultCard.style.display = 'block';
}

// ── Reset ─────────────────────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
  resultCard.style.display = 'none';
  colPicker.style.display  = 'none';
  hideError();
  fileInput.value = '';
  parsedData = [];
  allHeaders = [];
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.style.display = 'block';
}

function hideError() {
  errorBanner.style.display = 'none';
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
</script>
</body>
</html>
