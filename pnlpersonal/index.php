<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/pnlpersonal/');
    exit;
}

$csrf = csrf_token();
header('X-Robots-Tag: noindex, nofollow');
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>P&amp;L — Personal</title>
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/pnlpersonal/style.css?v=2" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script>
    window.PNL = {
      csrf: <?php echo json_encode($csrf); ?>,
      api:  '/pnlpersonal/api.php'
    };
  </script>
</head>
<body>

<!-- ── Header ──────────────────────────────────────────────────────────────── -->
<header class="app-header">
  <h1>P&amp;L — Personal</h1>
  <div class="header-controls">
    <button class="month-nav-btn" id="btnPrevMonth" title="Luna anterioară">&#8249;</button>
    <button class="month-nav-btn" id="btnNextMonth" title="Luna următoare">&#8250;</button>
    <select class="year-select" id="yearSelect"></select>
    <a href="/admin/logout.php" class="logout-link">Ieși</a>
  </div>
</header>

<!-- ── Monday banner ────────────────────────────────────────────────────────── -->
<div class="monday-banner" id="mondayBanner">
  <span class="banner-icon">🔔</span>
  <span class="banner-text">E luni! Nu uita să actualizezi valorile din portofel.</span>
  <button class="banner-btn" id="bannerUpdateBtn">Actualizează portofelul</button>
  <button class="banner-close" id="bannerClose" title="Închide">×</button>
</div>

<main class="container">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
    <a href="/admin/"
       style="font-size:12px;color:var(--muted);text-decoration:none;display:inline-flex;align-items:center;gap:4px">← Dashboard</a>
    <div style="display:flex;align-items:center;gap:8px">
      <button id="btnHideSums" title="Ascunde/Arată sumele" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:14px;line-height:1;color:var(--muted)">👁</button>
      <span class="last-entry-badge" id="lastEntryBadge"></span>
    </div>
  </div>

  <!-- ══ QUICK ADD ══════════════════════════════════════════════════════════ -->
  <div class="quick-add-bar">
    <button class="quick-add-btn quick-add-cheltuiala" id="topBtnCheltuiala">
      <span class="qab-icon">−</span>
      <span class="qab-text">Adaugă cheltuială</span>
    </button>
    <button class="quick-add-btn quick-add-venit" id="topBtnVenit">
      <span class="qab-icon">+</span>
      <span class="qab-text">Adaugă venit</span>
    </button>
  </div>

  <!-- ══ PORTOFEL ════════════════════════════════════════════════════════════ -->
  <div id="portofelSection">
    <div class="section-title-bar">
      <h2>💼 Portofel</h2>
    </div>

    <!-- Portofel details + history (all collapsible) -->
    <div class="portofel-history">
      <div class="portofel-history-header" id="historyToggle">
        <span>Detalii &amp; Istoric</span>
        <span class="toggle-icon">▼</span>
      </div>
      <div class="portofel-history-body" id="historyBody">

        <!-- Stat cards -->
        <div class="portofel-grid portofel-grid-inner">
          <div class="stat-card accent-green">
            <div class="label">Cash 💵</div>
            <div class="value green" id="pCash">—</div>
            <div class="sub">portofel fizic</div>
          </div>
          <div class="stat-card accent-orange">
            <div class="label">ING 🏦</div>
            <div class="value" style="color:#E8704A" id="pIng">—</div>
            <div class="sub">cont curent</div>
          </div>
          <div class="stat-card accent-blue">
            <div class="label">Revolut 💳</div>
            <div class="value blue" id="pRevolut">—</div>
            <div class="sub">cont digital</div>
          </div>
          <div class="stat-card accent-gold">
            <div class="label">Total Lichid 💰</div>
            <div class="value gold" id="pTotal">—</div>
            <div class="sub">cash + ing + revolut</div>
          </div>
          <div class="stat-card accent-purple">
            <div class="label">Trading212 📈</div>
            <div class="value purple" id="pTrading">—</div>
            <div class="sub">investiții</div>
          </div>
        </div>

        <div class="portofel-meta portofel-meta-inner">
          <span id="portofelLastUpdate">—</span>
          <span>·</span>
          <a class="update-link" id="portofelEditLink">Editează ultima intrare</a>
          <span>·</span>
          <button class="btn btn-blue btn-sm" id="btnActualizeaza">+ Actualizează</button>
        </div>

        <!-- History table -->
        <table>
          <thead>
            <tr>
              <th style="width:110px">Data</th>
              <th class="right">Cash</th>
              <th class="right">ING</th>
              <th class="right">Revolut</th>
              <th class="right">Lichid</th>
              <th class="right">Trading212</th>
              <th style="width:60px"></th>
            </tr>
          </thead>
          <tbody id="portofelHistoryRows"></tbody>
        </table>

      </div>
    </div>
  </div>
  <!-- /portofel -->

  <hr class="section-divider" />

  <!-- ══ P&L ════════════════════════════════════════════════════════════════ -->

  <!-- Stats -->
  <div class="stats-grid">
    <div class="stat-card accent-green">
      <div class="label">Venituri totale</div>
      <div class="value green" id="statVenituri">—</div>
      <div class="sub" id="statVenituriSub"></div>
    </div>
    <div class="stat-card accent-red">
      <div class="label">Cheltuieli totale</div>
      <div class="value red" id="statCheltuieli">—</div>
      <div class="sub" id="statCheltuieliSub"></div>
    </div>
    <div class="stat-card" id="statCard3">
      <div class="label" id="statCard3Label">—</div>
      <div class="value" id="statCard3Value">—</div>
      <div class="sub" id="statCard3Sub"></div>
    </div>
    <div class="stat-card" id="statCard4">
      <div class="label" id="statCard4Label">—</div>
      <div class="value" id="statCard4Value">—</div>
      <div class="sub" id="statCard4Sub"></div>
    </div>
  </div>

  <!-- Ranking chart -->
  <div class="chart-card cumulative-card">
    <h3>Top categorii</h3>
    <div class="ranking-wrap">
      <canvas id="chartRanking"></canvas>
    </div>
    <button id="btnToggleRanking" style="display:none" onclick="toggleRankingExpand()"></button>
  </div>

  <!-- Transactions -->
  <div class="tx-section">
    <div class="section-header">
      <h2>Tranzacții</h2>
      <div class="tab-group">
        <button class="tab-btn active" data-tab="toate">Toate</button>
        <button class="tab-btn" data-tab="venituri">Venituri</button>
        <button class="tab-btn" data-tab="cheltuieli">Cheltuieli</button>
      </div>
      <div class="add-btns">
        <button class="btn btn-green" id="btnAddVenit">+ Venit</button>
        <button class="btn btn-red"   id="btnAddCheltuiala">+ Cheltuiala</button>
      </div>
    </div>

    <div class="cat-filter-bar" id="catFilterBar"></div>

    <div class="table-card">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th style="width:110px">Data</th>
              <th>Categorie</th>
              <th class="right">Sumă (lei)</th>
              <th style="width:80px"></th>
            </tr>
          </thead>
          <tbody id="txBody"></tbody>
        </table>
      </div>
    </div>
  </div>

</main>

<!-- ── Modal: Actualizează Portofel ─────────────────────────────────────────── -->
<div class="modal-overlay" id="modalPortofel">
  <div class="modal">
    <button class="modal-close" data-close="modalPortofel">&times;</button>
    <h2 id="modalPortofelTitle">Actualizează portofelul</h2>
    <div class="error-msg" id="errorPortofel"></div>
    <form id="formPortofel">
      <input type="hidden" name="id" id="portofelId" />
      <div class="form-group">
        <label>Data</label>
        <input type="date" name="data" id="portofelData" required />
      </div>
      <div class="portofel-form-grid">
        <div class="form-group">
          <label>Cash 💵 (lei)</label>
          <input type="number" name="cash" id="portofelCash" step="0.01" min="0" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label>ING 🏦 (lei)</label>
          <input type="number" name="ing" id="portofelIng" step="0.01" min="0" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label>Revolut 💳 (lei)</label>
          <input type="number" name="revolut" id="portofelRevolut" step="0.01" min="0" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label>Trading212 📈 (lei)</label>
          <input type="number" name="trading212" id="portofelTrading" step="0.01" min="0" placeholder="0.00" />
        </div>
      </div>
      <div class="portofel-total-row">
        <span class="total-label">Total lichid (cash + ING + Revolut)</span>
        <span class="total-value" id="portofelModalTotal">0,00 lei</span>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close="modalPortofel">Anulează</button>
        <button type="submit" class="btn btn-blue" id="portofelSubmit">Salvează</button>
      </div>
    </form>
  </div>
</div>

<!-- ── Modal: Adaugă / Editează Venit ───────────────────────────────────────── -->
<div class="modal-overlay" id="modalVenit">
  <div class="modal">
    <button class="modal-close" data-close="modalVenit">&times;</button>
    <h2 id="modalVenitTitle">Adaugă venit</h2>
    <div class="error-msg" id="errorVenit"></div>
    <form id="formVenit">
      <input type="hidden" name="id" id="venitId" />
      <div class="form-group">
        <label>Data</label>
        <input type="date" name="data" id="venitData" required />
        <div class="date-nav-row">
          <button type="button" class="date-nav-btn" data-dir="-1" data-target="venitData">‹</button>
          <button type="button" class="date-nav-btn" data-dir="1" data-target="venitData">›</button>
        </div>
      </div>
      <div class="form-group">
        <label>Categorie</label>
        <select id="venitCategorieSelect"></select>
        <input type="text" id="venitCategorieNoua" placeholder="Nume categorie nouă"
               style="display:none; margin-top:8px; width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:14px; background:var(--bg);" />
      </div>
      <div class="form-group">
        <label>Sumă (lei)</label>
        <input type="number" name="suma" id="venitSuma" step="0.01" min="0.01" required />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close="modalVenit">Anulează</button>
        <button type="submit" class="btn btn-green" id="venitSubmit">Salvează</button>
      </div>
    </form>
  </div>
</div>

<!-- ── Modal: Adaugă / Editează Cheltuiala ──────────────────────────────────── -->
<div class="modal-overlay" id="modalCheltuiala">
  <div class="modal">
    <button class="modal-close" data-close="modalCheltuiala">&times;</button>
    <h2 id="modalCheltuialaTitle">Adaugă cheltuiala</h2>
    <div class="error-msg" id="errorCheltuiala"></div>
    <form id="formCheltuiala">
      <input type="hidden" name="id" id="cheltuialaId" />
      <div class="form-group">
        <label>Data</label>
        <input type="date" name="data" id="cheltuialaData" required />
        <div class="date-nav-row">
          <button type="button" class="date-nav-btn" data-dir="-1" data-target="cheltuialaData">‹</button>
          <button type="button" class="date-nav-btn" data-dir="1" data-target="cheltuialaData">›</button>
        </div>
      </div>
      <div class="form-group">
        <label>Categorie</label>
        <select id="cheltuialaCategorieSelect"></select>
        <input type="text" id="cheltuialaCategorieNoua" placeholder="Nume categorie nouă"
               style="display:none; margin-top:8px; width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:14px; background:var(--bg);" />
      </div>
      <div class="form-group">
        <label>Sumă (lei)</label>
        <input type="number" name="suma" id="cheltuialaSuma" step="0.01" min="0.01" required />
      </div>
      <div class="form-group">
        <label>Detalii</label>
        <input type="text" name="detalii" id="cheltuialaDetalii" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close="modalCheltuiala">Anulează</button>
        <button type="submit" class="btn btn-red" id="cheltuialaSubmit">Salvează</button>
      </div>
    </form>
  </div>
</div>

<script>
// ── Helpers ──────────────────────────────────────────────────────────────────
const api = (action, params = '') =>
  fetch(`${window.PNL.api}?action=${action}${params ? '&' + params : ''}`).then(r => r.json());

const post = (action, body) => {
  body.csrf_token = window.PNL.csrf;
  return fetch(`${window.PNL.api}?action=${action}`, {
    method: 'POST',
    body:   new URLSearchParams(body),
  }).then(r => r.json());
};

const fmt = n => new Intl.NumberFormat('ro-RO', {
  minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(n);

const fmtDate = s => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
};

const monthLabel = s => {
  if (!s) return '';
  const months = ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','nov','dec'];
  const [, m] = s.split('-');
  return months[parseInt(m) - 1];
};

const todayStr = () => new Date().toISOString().split('T')[0];

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── State ─────────────────────────────────────────────────────────────────────
let currentYear   = new Date().getFullYear();
let currentMonth  = null;
let currentTab    = 'toate';
let currentCatFilter = null;
let allVenituri   = [];
let allCheltuieli = [];
let chartRanking;
let rankingExpanded = false;
let rankingAllData  = [];
const rowStore    = new Map();
const lastDateKey = 'pnlpersonal_last_date';
const getLastDate = () => localStorage.getItem(lastDateKey) || todayStr();
const setLastDate = d  => localStorage.setItem(lastDateKey, d);

let latestPortofelRow = null; // tracks latest portofel entry

// ── Monday banner ─────────────────────────────────────────────────────────────
async function checkMondayBanner() {
  const today = new Date();
  if (today.getDay() !== 1) return; // 1 = Monday

  const latest = await api('latest_portofel');
  const todayS = todayStr();

  if (!latest || !latest.data || latest.data !== todayS) {
    document.getElementById('mondayBanner').classList.add('visible');
  }
}

document.getElementById('bannerClose').addEventListener('click', () => {
  document.getElementById('mondayBanner').classList.remove('visible');
});

document.getElementById('bannerUpdateBtn').addEventListener('click', () => {
  document.getElementById('mondayBanner').classList.remove('visible');
  openPortofelModal(null);
});

// ── Categories ────────────────────────────────────────────────────────────────
async function loadCategories() {
  const [vc, cc] = await Promise.all([
    api('categorii_venituri'),
    api('categorii_cheltuieli'),
  ]);
  populateSelect('venitCategorieSelect',      vc, 'add_categorie_venit');
  populateSelect('cheltuialaCategorieSelect', cc, 'add_categorie_cheltuiala');
}

function populateSelect(selectId, cats, addAction) {
  const sel     = document.getElementById(selectId);
  const current = sel.value;
  sel.innerHTML = '';

  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });

  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '+ Categorie nouă...';
  sel.appendChild(newOpt);

  if (current && current !== '__new__') sel.value = current;

  const inputId = selectId.replace('Select', 'Noua');
  const inp     = document.getElementById(inputId);
  if (inp) {
    sel.onchange = () => {
      inp.style.display = sel.value === '__new__' ? 'block' : 'none';
      if (sel.value === '__new__') inp.focus();
    };
  }
}

async function resolveCategorie(selectId, inputId, addAction) {
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(inputId);

  if (sel.value === '__new__') {
    const nome = inp.value.trim();
    if (!nome) return null;
    await post(addAction, { nume: nome });
    await loadCategories();
    document.getElementById(selectId).value = nome;
    return nome;
  }
  return sel.value || null;
}

// ── Portofel ─────────────────────────────────────────────────────────────────

async function loadPortofel() {
  const mParam = currentMonth ? `&month=${currentMonth}` : '';
  const [latest, history] = await Promise.all([
    api('latest_portofel'),
    api('list_portofel', `year=${currentYear}${mParam}`),
  ]);
  latestPortofelRow = latest;
  renderPortofelCards(latest);
  renderPortofelHistory(history);
}

function renderPortofelCards(p) {
  if (!p) {
    ['pCash','pIng','pRevolut','pTotal','pTrading'].forEach(id => {
      document.getElementById(id).textContent = '0,00 lei';
    });
    document.getElementById('portofelLastUpdate').textContent = 'Nicio înregistrare';
    document.getElementById('portofelEditLink').style.display = 'none';
    return;
  }

  const cash    = parseFloat(p.cash)       || 0;
  const ing     = parseFloat(p.ing)        || 0;
  const revolut = parseFloat(p.revolut)    || 0;
  const trading = parseFloat(p.trading212) || 0;
  const lichid  = cash + ing + revolut;

  document.getElementById('pCash').textContent    = fmt(cash)    + ' lei';
  document.getElementById('pIng').textContent     = fmt(ing)     + ' lei';
  document.getElementById('pRevolut').textContent = fmt(revolut) + ' lei';
  document.getElementById('pTotal').textContent   = fmt(lichid)  + ' lei';
  document.getElementById('pTrading').textContent = fmt(trading) + ' lei';

  document.getElementById('portofelLastUpdate').textContent = 'Actualizat: ' + fmtDate(p.data);
  document.getElementById('portofelEditLink').style.display = '';
}

function renderPortofelHistory(rows) {
  const tbody = document.getElementById('portofelHistoryRows');
  tbody.innerHTML = '';

  if (!rows || !rows.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state" style="padding:24px">Nicio înregistrare</div></td></tr>';
    return;
  }

  rows.forEach(p => {
    const cash    = parseFloat(p.cash)       || 0;
    const ing     = parseFloat(p.ing)        || 0;
    const revolut = parseFloat(p.revolut)    || 0;
    const trading = parseFloat(p.trading212) || 0;
    const lichid  = cash + ing + revolut;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(p.data)}</td>
      <td class="right">${fmt(cash)}</td>
      <td class="right">${fmt(ing)}</td>
      <td class="right">${fmt(revolut)}</td>
      <td class="right total-cell">${fmt(lichid)}</td>
      <td class="right invested">${fmt(trading)}</td>
      <td>
        <div class="actions-cell">
          <button class="icon-btn" title="Editează" data-portofel-edit="${p.id}">✎</button>
          <button class="icon-btn danger" title="Șterge" data-portofel-delete="${p.id}">✕</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

// Portofel history toggle
document.getElementById('historyToggle').addEventListener('click', () => {
  const header = document.getElementById('historyToggle');
  const body   = document.getElementById('historyBody');
  header.classList.toggle('open');
  body.classList.toggle('open');
});

// Portofel history actions
document.getElementById('portofelHistoryRows').addEventListener('click', async e => {
  const editBtn   = e.target.closest('[data-portofel-edit]');
  const deleteBtn = e.target.closest('[data-portofel-delete]');

  if (editBtn) {
    const id = parseInt(editBtn.dataset.portofelEdit);
    // Find the row by id in history
    const mParam  = currentMonth ? `&month=${currentMonth}` : '';
    const history = await api('list_portofel', `year=${currentYear}${mParam}`);
    const row     = history.find(r => parseInt(r.id) === id);
    if (row) openPortofelModal(row);
  } else if (deleteBtn) {
    if (!confirm('Ștergi această înregistrare?')) return;
    const res = await post('delete_portofel', { id: deleteBtn.dataset.portofelDelete });
    if (res.success) loadPortofel();
    else alert(res.error || 'Eroare la ștergere');
  }
});

// Edit latest link
document.getElementById('portofelEditLink').addEventListener('click', e => {
  e.preventDefault();
  if (latestPortofelRow) openPortofelModal(latestPortofelRow);
});

// Open portofel modal
function openPortofelModal(row) {
  const isEdit = !!(row && row.id);
  document.getElementById('modalPortofelTitle').textContent = isEdit ? 'Editează portofelul' : 'Actualizează portofelul';
  document.getElementById('portofelSubmit').textContent     = isEdit ? 'Salvează' : 'Adaugă';
  document.getElementById('portofelId').value     = row ? row.id   : '';
  document.getElementById('portofelData').value   = row ? row.data : todayStr();
  document.getElementById('portofelCash').value   = row ? row.cash       : '';
  document.getElementById('portofelIng').value    = row ? row.ing        : '';
  document.getElementById('portofelRevolut').value = row ? row.revolut   : '';
  document.getElementById('portofelTrading').value = row ? row.trading212 : '';
  document.getElementById('errorPortofel').style.display = 'none';
  updatePortofelModalTotal();
  openModal('modalPortofel');
}

// Live total in portofel modal
function updatePortofelModalTotal() {
  const cash    = parseFloat(document.getElementById('portofelCash').value)    || 0;
  const ing     = parseFloat(document.getElementById('portofelIng').value)     || 0;
  const revolut = parseFloat(document.getElementById('portofelRevolut').value) || 0;
  document.getElementById('portofelModalTotal').textContent = fmt(cash + ing + revolut) + ' lei';
}

['portofelCash','portofelIng','portofelRevolut'].forEach(id => {
  document.getElementById(id).addEventListener('input', updatePortofelModalTotal);
});

// Open modal btn
document.getElementById('btnActualizeaza').addEventListener('click', () => {
  const prefill = latestPortofelRow ? { ...latestPortofelRow, id: '', data: todayStr() } : null;
  openPortofelModal(prefill);
});

// Form submit: Portofel
document.getElementById('formPortofel').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('errorPortofel');
  errEl.style.display = 'none';

  const id   = document.getElementById('portofelId').value;
  const body = {
    data:       document.getElementById('portofelData').value,
    cash:       document.getElementById('portofelCash').value       || '0',
    ing:        document.getElementById('portofelIng').value        || '0',
    revolut:    document.getElementById('portofelRevolut').value    || '0',
    trading212: document.getElementById('portofelTrading').value    || '0',
  };
  if (id) body.id = id;

  const action = id ? 'edit_portofel' : 'add_portofel';
  const res    = await post(action, body);

  if (res.success || res.id) {
    closeModal('modalPortofel');
    document.getElementById('mondayBanner').classList.remove('visible');
    loadPortofel();
  } else {
    errEl.textContent = res.error || 'Eroare la salvare';
    errEl.style.display = 'block';
  }
});

// ── Month navigation ─────────────────────────────────────────────────────────
function getMonthOptions() {
  return [...document.getElementById('yearSelect').options]
    .filter(o => o.value.includes('-'));
}

function updateMonthNavBtns() {
  const opts  = getMonthOptions();
  const sel   = document.getElementById('yearSelect');
  const idx   = opts.findIndex(o => o.value === sel.value);
  document.getElementById('btnPrevMonth').disabled = idx < 0 || idx >= opts.length - 1;
  document.getElementById('btnNextMonth').disabled = idx <= 0;
}

function navigateMonth(dir) {
  const opts = getMonthOptions();
  const sel  = document.getElementById('yearSelect');
  const idx  = opts.findIndex(o => o.value === sel.value);
  const next = opts[idx + dir];
  if (!next) return;
  sel.value    = next.value;
  const parts  = next.value.split('-');
  currentYear  = parseInt(parts[0]);
  currentMonth = parseInt(parts[1]);
  updateMonthNavBtns();
  refresh();
  loadPortofel();
}

document.getElementById('btnPrevMonth').addEventListener('click', () => navigateMonth(1));
document.getElementById('btnNextMonth').addEventListener('click', () => navigateMonth(-1));

// ── Last entry date ───────────────────────────────────────────────────────────
async function loadLastEntry() {
  const res = await api('last_entry');
  if (!res || !res.data) return;

  const badge   = document.getElementById('lastEntryBadge');
  const parts   = res.data.split('-');
  const entryDt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const today   = new Date(); today.setHours(0,0,0,0);
  const diffMs  = today - entryDt;
  const diffZ   = Math.round(diffMs / 86400000);

  let when;
  if (diffZ === 0)      when = 'azi';
  else if (diffZ === 1) when = 'ieri';
  else                  when = `acum ${diffZ} zile`;

  badge.textContent = `Ultima cheltuială: ${fmtDate(res.data)} (${when})`;
  if (diffZ >= 3) badge.classList.add('stale');
}

// ── PNL Init ──────────────────────────────────────────────────────────────────
async function init() {
  const periods = await api('periods');
  const sel     = document.getElementById('yearSelect');

  periods.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.value;
    opt.textContent = p.month ? '\u00A0\u00A0' + p.label : p.label;
    if (p.month) opt.style.color = 'var(--muted)';
    sel.appendChild(opt);
  });

  // Default: luna curentă → luna trecută → primul period disponibil
  const now = new Date();
  const candidates = [
    { year: now.getFullYear(),                               month: now.getMonth() + 1 },
    { year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
      month: now.getMonth() === 0 ? 12 : now.getMonth() },
  ];
  let chosen = null;
  for (const c of candidates) {
    const key = `${c.year}-${c.month}`;
    if ([...sel.options].some(o => o.value === key)) { chosen = c; break; }
  }
  if (chosen) {
    sel.value    = `${chosen.year}-${chosen.month}`;
    currentYear  = chosen.year;
    currentMonth = chosen.month;
  } else if (periods.length) {
    sel.value   = periods[0].value;
    currentYear = periods[0].year;
    currentMonth = periods[0].month;
  }

  sel.addEventListener('change', () => {
    const parts  = sel.value.split('-');
    currentYear  = parseInt(parts[0]);
    currentMonth = parts[1] ? parseInt(parts[1]) : null;
    updateMonthNavBtns();
    refresh();
    loadPortofel();
  });

  updateMonthNavBtns();
  await loadCategories();
  await Promise.all([refresh(), loadPortofel(), checkMondayBanner(), loadLastEntry()]);
}

async function refresh() {
  const mParam = currentMonth ? `&month=${currentMonth}` : '';
  const [stats, venituri, cheltuieli] = await Promise.all([
    api('stats',      `year=${currentYear}${mParam}`),
    api('venituri',   `year=${currentYear}${mParam}`),
    api('cheltuieli', `year=${currentYear}${mParam}`),
  ]);

  allVenituri   = venituri;
  allCheltuieli = cheltuieli;

  renderStats(stats);
  renderCharts(stats);
  renderCatFilter();
  renderTable();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats(s) {
  document.getElementById('statVenituri').textContent   = fmt(s.total_venituri)   + ' lei';
  document.getElementById('statCheltuieli').textContent = fmt(s.total_cheltuieli) + ' lei';
  document.getElementById('statVenituriSub').textContent   = `${allVenituri.length} tranzacții`;
  document.getElementById('statCheltuieliSub').textContent = `${allCheltuieli.length} tranzacții`;

  const card3 = document.getElementById('statCard3');
  const card4 = document.getElementById('statCard4');

  if (currentMonth) {
    // ── Vizualizare lunară: medie zilnică + zile active ──────────────────────
    const daysInMonth  = new Date(currentYear, currentMonth, 0).getDate();
    const avgZilnic    = s.total_cheltuieli > 0 ? s.total_cheltuieli / daysInMonth : 0;
    const zileActive   = s.monthly.filter(m => m.cheltuieli > 0).length;

    card3.className = 'stat-card accent-gold';
    document.getElementById('statCard3Label').textContent = 'Medie zilnică';
    document.getElementById('statCard3Value').textContent = fmt(avgZilnic) + ' lei';
    document.getElementById('statCard3Value').className   = 'value gold';
    document.getElementById('statCard3Sub').textContent   = `din ${daysInMonth} zile`;

    const prevC = s.prev_cheltuieli || 0;
    const diff  = prevC > 0 ? ((s.total_cheltuieli - prevC) / prevC * 100) : null;
    const diffTxt = diff === null ? '—'
      : (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    card4.className = 'stat-card accent-purple';
    document.getElementById('statCard4Label').textContent = 'Față de ' + (s.prev_label || 'luna trecută');
    document.getElementById('statCard4Value').textContent = diffTxt;
    document.getElementById('statCard4Value').className   = 'value ' + (diff === null ? '' : diff <= 0 ? 'green' : 'red');
    document.getElementById('statCard4Sub').textContent   = prevC > 0 ? fmt(prevC) + ' lei atunci' : 'fără date';
  } else {
    // ── Vizualizare anuală: profit net + marjă ───────────────────────────────
    card3.className = 'stat-card accent-gold';
    document.getElementById('statCard3Label').textContent = 'Profit net';
    const profitVal = (s.profit_net >= 0 ? '+' : '') + fmt(s.profit_net) + ' lei';
    document.getElementById('statCard3Value').textContent = profitVal;
    document.getElementById('statCard3Value').className   = 'value ' + (s.profit_net >= 0 ? 'green' : 'red');
    document.getElementById('statCard3Sub').textContent   = '';

    card4.className = 'stat-card accent-blue';
    document.getElementById('statCard4Label').textContent = 'Marjă profit';
    document.getElementById('statCard4Value').textContent = (s.marja >= 0 ? '+' : '') + s.marja + '%';
    document.getElementById('statCard4Value').className   = 'value ' + (s.marja >= 0 ? 'green' : 'red');
    document.getElementById('statCard4Sub').textContent   = 'din venituri';
  }
}

// ── Charts ────────────────────────────────────────────────────────────────────
const CAT_COLORS = [
  '#4A90D9','#E8704A','#2A7D4F','#C1444A','#7B5EA7',
  '#D4A017','#E8A87C','#85C1E9','#A9DFBF','#F1948A',
  '#B8860B','#5DADE2','#A569BD','#45B39D','#EC7063',
  '#F0B27A','#82E0AA','#AED6F1','#F9E79F','#D2B4DE',
  '#A3E4D7','#FAD7A0','#FDFEFE','#D5D8DC','#1A5276',
];

function renderCharts(s) {
  // ── Grafic: Top categorii (bar orizontal, ranking) ───────────────────────────
  if (chartRanking) chartRanking.destroy();
  const catData = [...s.categorii_cheltuieli].sort((a, b) => b.suma - a.suma);
  if (catData.length) {
    rankingAllData = catData;
    rankingExpanded = false;
    drawRankingChart();
  }
}

function drawRankingChart() {
  const data = rankingExpanded ? rankingAllData : rankingAllData.slice(0, 5);
  const btn  = document.getElementById('btnToggleRanking');
  const wrap = document.getElementById('chartRanking').parentElement;
  wrap.style.height = Math.max(160, data.length * 38) + 'px';
  if (chartRanking) chartRanking.destroy();
  chartRanking = new Chart(document.getElementById('chartRanking'), {
    type: 'bar',
    data: {
      labels: data.map(c => c.categorie),
      datasets: [{
        data: data.map(c => c.suma),
        backgroundColor: CAT_COLORS.slice(0, data.length),
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.x)} lei` } },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#F0EDE6' },
          ticks: { callback: v => fmt(v) + ' lei', font: { size: 11 } },
        },
        y: { grid: { display: false }, ticks: { font: { size: 12 } } },
      },
    },
  });
  if (rankingAllData.length > 5) {
    btn.style.display = 'block';
    btn.textContent = rankingExpanded
      ? '▲ Mai puține'
      : `▼ Vezi toate (${rankingAllData.length})`;
  }
}

function toggleRankingExpand() {
  rankingExpanded = !rankingExpanded;
  drawRankingChart();
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable() {
  const body = document.getElementById('txBody');
  body.innerHTML = '';

  let rows = [];
  if (currentTab === 'toate') {
    const v = allVenituri.map(r   => ({ ...r, _type: 'venit' }));
    const c = allCheltuieli.map(r => ({ ...r, _type: 'cheltuiala' }));
    rows = [...v, ...c].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  } else if (currentTab === 'venituri') {
    rows = allVenituri.map(r => ({ ...r, _type: 'venit' }));
  } else {
    rows = allCheltuieli.map(r => ({ ...r, _type: 'cheltuiala' }));
    if (currentCatFilter) rows = rows.filter(r => r.categorie === currentCatFilter);
  }

  if (!rows.length) {
    const periodLabel = document.getElementById('yearSelect').options[document.getElementById('yearSelect').selectedIndex]?.textContent.trim() || currentYear;
    body.innerHTML = `<tr><td colspan="4"><div class="empty-state">Nicio tranzacție în ${periodLabel}</div></td></tr>`;
    return;
  }

  rows.forEach(r => {
    const isVenit = r._type === 'venit';
    const key     = `${r._type}-${r.id}`;
    rowStore.set(key, r);

    const cat     = isVenit ? r.descriere : r.categorie;
    const detalii = (!isVenit && r.detalii) ? r.detalii : '';

    let catHtml;
    if (currentTab === 'toate') {
      const dot = isVenit
        ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2A7D4F;margin-right:7px;vertical-align:middle"></span>'
        : '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#C1444A;margin-right:7px;vertical-align:middle"></span>';
      catHtml = dot + esc(cat);
    } else {
      catHtml = esc(cat);
    }

    if (detalii) {
      catHtml += `<div class="tx-detalii">${esc(detalii)}</div>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(r.data)}</td>
      <td>${catHtml}</td>
      <td class="right ${isVenit ? 'suma-green' : 'suma-red'}">
        ${isVenit ? '+' : '−'} ${fmt(r.suma)}
      </td>
      <td>
        <div class="actions-cell">
          <button class="icon-btn" title="Editează" data-key="${key}">✎</button>
          <button class="icon-btn danger" title="Șterge" data-type="${r._type}" data-id="${r.id}">✕</button>
        </div>
      </td>`;
    body.appendChild(tr);
  });
}

// ── Category filter pills ─────────────────────────────────────────────────────
function renderCatFilter() {
  const bar = document.getElementById('catFilterBar');
  bar.innerHTML = '';

  if (currentTab !== 'cheltuieli') return;

  // Unique categories from current cheltuieli, sorted by total desc
  const totals = {};
  allCheltuieli.forEach(r => {
    totals[r.categorie] = (totals[r.categorie] || 0) + parseFloat(r.suma);
  });
  const cats = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  if (!cats.length) return;

  cats.forEach(cat => {
    const pill = document.createElement('button');
    pill.className = 'cat-pill' + (currentCatFilter === cat ? ' active' : '');
    pill.textContent = cat;
    pill.addEventListener('click', () => {
      currentCatFilter = currentCatFilter === cat ? null : cat;
      renderCatFilter();
      renderTable();
    });
    bar.appendChild(pill);
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    currentCatFilter = null;
    renderCatFilter();
    renderTable();
  });
});

// ── Modals ────────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', () => closeModal(el.dataset.close));
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ── Add buttons ───────────────────────────────────────────────────────────────
document.getElementById('btnAddVenit').addEventListener('click', () => {
  document.getElementById('modalVenitTitle').textContent  = 'Adaugă venit';
  document.getElementById('venitSubmit').textContent      = 'Adaugă';
  document.getElementById('formVenit').reset();
  document.getElementById('venitId').value                = '';
  document.getElementById('venitData').value              = getLastDate();
  document.getElementById('venitCategorieNoua').style.display = 'none';
  document.getElementById('errorVenit').style.display         = 'none';
  openModal('modalVenit');
});

document.getElementById('btnAddCheltuiala').addEventListener('click', () => {
  document.getElementById('modalCheltuialaTitle').textContent = 'Adaugă cheltuiala';
  document.getElementById('cheltuialaSubmit').textContent     = 'Adaugă';
  document.getElementById('formCheltuiala').reset();
  document.getElementById('cheltuialaId').value               = '';
  document.getElementById('cheltuialaData').value             = getLastDate();
  document.getElementById('cheltuialaCategorieNoua').style.display = 'none';
  document.getElementById('errorCheltuiala').style.display         = 'none';
  openModal('modalCheltuiala');
});

// ── Edit ──────────────────────────────────────────────────────────────────────
function openEdit(row) {
  if (row._type === 'venit') {
    document.getElementById('modalVenitTitle').textContent = 'Editează venit';
    document.getElementById('venitSubmit').textContent     = 'Salvează';
    document.getElementById('venitId').value               = row.id;
    document.getElementById('venitData').value             = row.data;
    document.getElementById('venitSuma').value             = row.suma;
    document.getElementById('venitCategorieNoua').style.display = 'none';
    document.getElementById('errorVenit').style.display         = 'none';
    document.getElementById('venitCategorieSelect').value       = row.descriere;
    openModal('modalVenit');
  } else {
    document.getElementById('modalCheltuialaTitle').textContent = 'Editează cheltuiala';
    document.getElementById('cheltuialaSubmit').textContent     = 'Salvează';
    document.getElementById('cheltuialaId').value               = row.id;
    document.getElementById('cheltuialaData').value             = row.data;
    document.getElementById('cheltuialaSuma').value             = row.suma;
    document.getElementById('cheltuialaDetalii').value          = row.detalii || '';
    document.getElementById('cheltuialaCategorieNoua').style.display = 'none';
    document.getElementById('errorCheltuiala').style.display         = 'none';
    document.getElementById('cheltuialaCategorieSelect').value       = row.categorie;
    openModal('modalCheltuiala');
  }
}

// ── Table click delegation ────────────────────────────────────────────────────
document.getElementById('txBody').addEventListener('click', async e => {
  const editBtn   = e.target.closest('[data-key]');
  const deleteBtn = e.target.closest('[data-type][data-id]');

  if (editBtn) {
    const row = rowStore.get(editBtn.dataset.key);
    if (row) openEdit(row);
  } else if (deleteBtn) {
    const { type, id } = deleteBtn.dataset;
    if (!confirm('Ștergi această tranzacție?')) return;
    const action = type === 'venit' ? 'delete_venit' : 'delete_cheltuiala';
    const res    = await post(action, { id });
    if (res.success) refresh();
    else alert(res.error || 'Eroare la ștergere');
  }
});

// ── Form submit: Venit ────────────────────────────────────────────────────────
document.getElementById('formVenit').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('errorVenit');
  errEl.style.display = 'none';

  const categorie = await resolveCategorie('venitCategorieSelect', 'venitCategorieNoua', 'add_categorie_venit');
  if (!categorie) {
    errEl.textContent = 'Selectează sau creează o categorie.';
    errEl.style.display = 'block';
    return;
  }

  const id   = document.getElementById('venitId').value;
  const body = {
    data:      document.getElementById('venitData').value,
    categorie,
    suma:      document.getElementById('venitSuma').value,
  };
  if (id) body.id = id;

  const res = await post(id ? 'edit_venit' : 'add_venit', body);

  if (res.success || res.id) {
    if (!id) setLastDate(body.data);
    closeModal('modalVenit');
    refresh();
  } else {
    errEl.textContent = res.error || 'Eroare';
    errEl.style.display = 'block';
  }
});

// ── Form submit: Cheltuiala ───────────────────────────────────────────────────
document.getElementById('formCheltuiala').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('errorCheltuiala');
  errEl.style.display = 'none';

  const categorie = await resolveCategorie('cheltuialaCategorieSelect', 'cheltuialaCategorieNoua', 'add_categorie_cheltuiala');
  if (!categorie) {
    errEl.textContent = 'Selectează sau creează o categorie.';
    errEl.style.display = 'block';
    return;
  }

  const id   = document.getElementById('cheltuialaId').value;
  const body = {
    data:      document.getElementById('cheltuialaData').value,
    categorie,
    detalii:   document.getElementById('cheltuialaDetalii').value,
    suma:      document.getElementById('cheltuialaSuma').value,
  };
  if (id) body.id = id;

  const res = await post(id ? 'edit_cheltuiala' : 'add_cheltuiala', body);

  if (res.success || res.id) {
    if (!id) setLastDate(body.data);
    if (id) {
      closeModal('modalCheltuiala');
    } else {
      // Păstrează modalul deschis pentru adăugare rapidă de mai multe cheltuieli
      document.getElementById('cheltuialaSuma').value = '';
      document.getElementById('cheltuialaDetalii').value = '';
      document.getElementById('cheltuialaSuma').focus();
    }
    refresh();
  } else {
    errEl.textContent = res.error || 'Eroare';
    errEl.style.display = 'block';
  }
});

// ── Quick-add buttons (top bar) ───────────────────────────────────────────────
document.getElementById('topBtnCheltuiala').addEventListener('click', () => {
  document.getElementById('btnAddCheltuiala').click();
});
document.getElementById('topBtnVenit').addEventListener('click', () => {
  document.getElementById('btnAddVenit').click();
});

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); return; }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'c') document.getElementById('topBtnCheltuiala').click();
  if (e.key === 'v') document.getElementById('topBtnVenit').click();
});

// ── Date navigation arrows ───────────────────────────────────────────────────
document.querySelectorAll('.date-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const d = new Date(input.value || new Date().toISOString().slice(0, 10));
    d.setDate(d.getDate() + Number(btn.dataset.dir));
    input.value = d.toISOString().slice(0, 10);
  });
});

// ── Privacy toggle ───────────────────────────────────────────────────────────
document.getElementById('btnHideSums').addEventListener('click', () => {
  const hidden = document.body.classList.toggle('hide-sums');
  document.getElementById('btnHideSums').textContent = hidden ? '🙈' : '👁';
  localStorage.setItem('pnl_hide_sums', hidden ? '1' : '0');
});
if (localStorage.getItem('pnl_hide_sums') === '1') {
  document.body.classList.add('hide-sums');
  document.getElementById('btnHideSums').textContent = '🙈';
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
</script>
</body>
</html>
