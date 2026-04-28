<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/raportpnldogu/');
    exit;
}

header('X-Robots-Tag: noindex, nofollow');
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Raport P&L lunar — DOGU</title>
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #FFFDF7;
      --card: #FFFFFF;
      --border: #E8E3D8;
      --text: #1C1C1A;
      --muted: #888880;
      --ok: #2E7D32;
      --err: #C62828;
      --shadow: 0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04);
      --radius: 14px;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 32px 20px 80px;
    }
    .wrap { max-width: 900px; margin: 0 auto; }
    .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
    .back { font-size: 13px; color: var(--muted); text-decoration: none; padding: 6px 14px; border: 1px solid var(--border); border-radius: 999px; }
    .back:hover { color: var(--text); }
    h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.6px; margin-bottom: 6px; }
    .sub { font-size: 14px; color: var(--muted); margin-bottom: 28px; }

    .card {
      background: var(--card);
      border: 1.5px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 22px;
      margin-bottom: 18px;
      box-shadow: var(--shadow);
    }
    .card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .card-title { font-size: 17px; font-weight: 700; }
    .card-meta { font-size: 12px; color: var(--muted); }

    .drop {
      border: 2px dashed var(--border);
      border-radius: 12px;
      padding: 22px;
      text-align: center;
      color: var(--muted);
      font-size: 14px;
      cursor: pointer;
      transition: border-color .15s, background .15s;
    }
    .drop:hover, .drop.dragover { border-color: #999; background: #FAF7EE; }
    .drop input { display: none; }
    .drop strong { color: var(--text); }

    .files { list-style: none; margin-top: 14px; }
    .files li {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 10px; border-radius: 8px;
      font-size: 13px;
    }
    .files li:nth-child(odd) { background: #FAF7EE; }
    .fname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; }
    .famount { font-variant-numeric: tabular-nums; font-weight: 600; }
    .famount.err { color: var(--err); font-weight: 400; font-size: 12px; }

    .total-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border);
      font-size: 15px;
    }
    .total-row .amount { font-weight: 700; font-variant-numeric: tabular-nums; font-size: 18px; }

    .grand {
      background: #1C1C1A; color: #FFFDF7;
      border-radius: var(--radius);
      padding: 22px 26px;
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 24px;
    }
    .grand .label { font-size: 15px; opacity: .8; }
    .grand .amount { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }

    .actions { margin-top: 12px; }
    .btn-clear {
      background: transparent; border: 1px solid var(--border); border-radius: 999px;
      padding: 4px 12px; font-size: 12px; color: var(--muted); cursor: pointer;
    }
    .btn-clear:hover { color: var(--text); }
  </style>
<!-- Privacy-friendly analytics by Plausible -->
<script async src="https://plausible.io/js/pa-U3QUedm8aW1g2Ou0qk-1J.js"></script>
<script>
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()
</script>

</head>
<body>

<div class="wrap">
  <div class="topbar">
    <a href="/dogu/" class="back">← DOGU</a>
    <a href="/admin/logout.php" class="back">Ieși din cont</a>
  </div>

  <h1>Raport P&L lunar</h1>
  <p class="sub">Încarcă PDF-urile de la Wolt, Glovo și Bolt. Extragem automat suma de pe fiecare factură și calculăm totalul per platformă.</p>

  <div class="card" data-type="wolt" data-label="Suma facturii" data-max="20">
    <div class="card-head">
      <div>
        <div class="card-title">Wolt</div>
        <div class="card-meta">Extragem „Suma facturii” · max 20 PDF-uri</div>
      </div>
      <button class="btn-clear" data-clear>golește</button>
    </div>
    <label class="drop">
      <input type="file" accept="application/pdf" multiple>
      <div>Trage PDF-uri aici sau <strong>click pentru a selecta</strong></div>
    </label>
    <ul class="files"></ul>
    <div class="total-row"><span>Total Wolt</span><span class="amount">0,00 RON</span></div>
  </div>

  <div class="card" data-type="glovo" data-label="Factura totala" data-max="8">
    <div class="card-head">
      <div>
        <div class="card-title">Glovo</div>
        <div class="card-meta">Extragem „Factura totala (TVA inclus)” · max 8 PDF-uri</div>
      </div>
      <button class="btn-clear" data-clear>golește</button>
    </div>
    <label class="drop">
      <input type="file" accept="application/pdf" multiple>
      <div>Trage PDF-uri aici sau <strong>click pentru a selecta</strong></div>
    </label>
    <ul class="files"></ul>
    <div class="total-row"><span>Total Glovo</span><span class="amount">0,00 RON</span></div>
  </div>

  <div class="card" data-type="bolt" data-label="Suma de plată" data-max="20">
    <div class="card-head">
      <div>
        <div class="card-title">Bolt</div>
        <div class="card-meta">Extragem „Suma de plată” · max 20 PDF-uri</div>
      </div>
      <button class="btn-clear" data-clear>golește</button>
    </div>
    <label class="drop">
      <input type="file" accept="application/pdf" multiple>
      <div>Trage PDF-uri aici sau <strong>click pentru a selecta</strong></div>
    </label>
    <ul class="files"></ul>
    <div class="total-row"><span>Total Bolt</span><span class="amount">0,00 RON</span></div>
  </div>

  <div class="grand">
    <span class="label">Total general</span>
    <span class="amount" id="grandTotal">0,00 RON</span>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs" type="module"></script>
<script type="module">
  import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

  // Etichetă per tip (regex) — căutată pe linie reconstituită vizual
  // PDF.js poate extrage caracterele cu spatii intre ele (ex: "S um a f ac turii")
  // spacedRe permite \s* intre fiecare caracter si \s+ pentru spatiile din cuvant
  function spacedRe(str) {
    const parts = [...str].map(c => c === ' ' ? '\\s+' : c.replace(/[.*+?^${}()|[\]\\]/, '\\$&'));
    return new RegExp(parts.join('\\s*'), 'i');
  }
  const LABELS = {
    wolt:  spacedRe('Suma facturii'),
    glovo: spacedRe('Factura totala'),
    bolt:  new RegExp(spacedRe('SUMA DE PLAT').source + '[ĂăA]', 'i'),
  };
  const AMOUNT_RE = /-?\d{1,3}(?:[.\s]\d{3})*\s*,\d{2}/g;

  function parseRo(n) {
    // "1.542,74" / "1 542,74" -> 1542.74
    return parseFloat(String(n).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  }
  function fmtRo(n) {
    return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' RON';
  }

  // Reconstituie liniile vizuale grupând itemii după coordonata Y
  async function extractLines(file) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items
        .filter(it => it.str && it.str.trim())
        .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
      // grupare pe Y cu toleranță (3 unități)
      const groups = {};
      for (const it of items) {
        const key = Math.round(it.y / 3);
        (groups[key] = groups[key] || []).push(it);
      }
      Object.keys(groups)
        .sort((a, b) => Number(b) - Number(a)) // top-down
        .forEach(k => {
          const row = groups[k].sort((a, b) => a.x - b.x);
          lines.push(row.map(r => r.str).join(' ').replace(/\s+/g, ' ').trim());
        });
    }
    return lines;
  }

  async function parseFile(file, type) {
    try {
      const lines = await extractLines(file);
      const labelRe = LABELS[type];
      // 1. Caută pe aceeași linie vizuală ca eticheta
      for (const line of lines) {
        if (labelRe.test(line)) {
          const nums = line.match(AMOUNT_RE);
          if (nums && nums.length) {
            // ia ultimul număr de pe linie (de obicei e în dreapta = totalul)
            return { ok: true, amount: parseRo(nums[nums.length - 1]) };
          }
        }
      }
      // 2. Fallback: caută în ±5 linii față de etichetă
      for (let i = 0; i < lines.length; i++) {
        if (labelRe.test(lines[i])) {
          for (let j = Math.max(0, i - 5); j < Math.min(i + 6, lines.length); j++) {
            if (j === i) continue;
            const nums = lines[j].match(AMOUNT_RE);
            if (nums && nums.length) return { ok: true, amount: parseRo(nums[nums.length - 1]) };
          }
        }
      }
      // 3. Fallback flat: caută în tot textul paginii indiferent de ordine
      const flat = lines.join('\n');
      const flatLabelRe = LABELS[type];
      const flatAmtRe = /(\d{1,3}(?:[.\s]\d{3})*\s*,\d{2})/;
      const flatM = flat.match(new RegExp(flatLabelRe.source + '[\\s\\S]{0,400}?' + flatAmtRe.source, 'i'))
                 || flat.match(new RegExp(flatAmtRe.source + '[\\s\\S]{0,400}?' + flatLabelRe.source, 'i'));
      if (flatM) return { ok: true, amount: parseRo(flatM[1]) };
      return { ok: false, error: 'nu am găsit suma' };
    } catch (e) {
      return { ok: false, error: 'eroare citire PDF' };
    }
  }

  const state = { wolt: [], glovo: [], bolt: [] };

  function renderCard(card) {
    const type = card.dataset.type;
    const max = parseInt(card.dataset.max, 10);
    const ul = card.querySelector('.files');
    const totalEl = card.querySelector('.total-row .amount');
    const list = state[type];
    ul.innerHTML = '';
    let total = 0;
    list.forEach((f, idx) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'fname';
      name.textContent = f.name;
      const amt = document.createElement('span');
      if (f.ok) {
        amt.className = 'famount';
        amt.textContent = fmtRo(f.amount);
        total += f.amount;
      } else {
        amt.className = 'famount err';
        amt.textContent = f.error || 'eroare';
      }
      li.appendChild(name);
      li.appendChild(amt);
      ul.appendChild(li);
    });
    totalEl.textContent = fmtRo(total);
    const meta = card.querySelector('.card-meta');
    const label = meta.textContent.split(' · ')[0];
    meta.textContent = label + ' · ' + list.length + '/' + max + ' PDF-uri';
    renderGrand();
  }

  function renderGrand() {
    let g = 0;
    for (const k of Object.keys(state)) for (const f of state[k]) if (f.ok) g += f.amount;
    document.getElementById('grandTotal').textContent = fmtRo(g);
  }

  async function handleFiles(card, fileList) {
    const type = card.dataset.type;
    const max = parseInt(card.dataset.max, 10);
    const files = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    for (const file of files) {
      if (state[type].length >= max) break;
      // placeholder cu „se procesează”
      const idx = state[type].push({ name: file.name, ok: false, error: 'se procesează...' }) - 1;
      renderCard(card);
      const res = await parseFile(file, type);
      state[type][idx] = { name: file.name, ...res };
      renderCard(card);
    }
  }

  document.querySelectorAll('.card').forEach(card => {
    const drop = card.querySelector('.drop');
    const input = card.querySelector('input[type=file]');
    input.addEventListener('change', () => handleFiles(card, input.files));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('dragover');
      handleFiles(card, e.dataTransfer.files);
    });
    card.querySelector('[data-clear]').addEventListener('click', () => {
      state[card.dataset.type] = [];
      input.value = '';
      renderCard(card);
    });
  });
</script>

</body>
</html>
