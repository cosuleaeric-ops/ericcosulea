<?php
declare(strict_types=1);
require __DIR__ . '/../admin/auth.php';
require_login();
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Recover EliteDeux</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 20px; background: #fffaf2; }
    h1 { font-size: 24px; margin-bottom: 6px; }
    .box { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 20px; margin: 16px 0; }
    .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .05em; }
    .val { font-size: 22px; font-weight: 700; margin: 4px 0 2px; }
    .ts  { font-size: 13px; color: #aaa; }
    .btn { display: block; width: 100%; padding: 14px; background: #1c6b2a; color: #fff; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; margin-top: 20px; }
    .btn:hover { background: #174f20; }
    .btn:disabled { background: #aaa; cursor: not-allowed; }
    .msg { padding: 12px 16px; border-radius: 8px; font-weight: 600; margin-bottom: 16px; }
    .msg.ok  { background: #eaf6ec; color: #1a6b2a; }
    .msg.err { background: #fdecea; color: #8b1a1a; }
    .back { display: inline-block; margin-top: 20px; color: #888; text-decoration: none; font-size: 14px; }
    pre { font-size: 11px; color: #666; overflow: auto; max-height: 120px; background: #f5f0e8; padding: 10px; border-radius: 8px; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Recover din localStorage</h1>
  <p style="color:#666">Această pagină citește datele rămase în browserul <strong>acestui device</strong> și le poate împinge înapoi pe server.</p>
  <p style="color:#c00; font-weight:600">⚠️ Deschide această pagină pe device-ul care NU a fost refreshat după eroare (probabil desktop-ul).</p>

  <div id="msg"></div>

  <div class="box">
    <div class="label">Date găsite în localStorage (acest browser)</div>
    <div class="val" id="taskCount">se citesc...</div>
    <div class="ts"  id="savedAt"></div>
    <pre id="preview"></pre>
  </div>

  <button class="btn" id="btnRestore" disabled>Restaurează pe server datele din acest browser</button>

  <a class="back" href="/elite-deux/">← Înapoi la EliteDeux</a>

  <script>
    const STORAGE_KEY = 'eliteDeux_state';

    function countTasks(state) {
      let n = 0;
      for (const col of state.columns ?? [])
        for (const day of col.days ?? [])
          n += (day.tasks ?? []).length;
      return n;
    }

    function fmtDate(ts) {
      if (!ts) return '—';
      return new Date(ts).toLocaleString('ro-RO');
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    const taskCountEl = document.getElementById('taskCount');
    const savedAtEl   = document.getElementById('savedAt');
    const previewEl   = document.getElementById('preview');
    const btn         = document.getElementById('btnRestore');
    const msgEl       = document.getElementById('msg');

    let snapshot = null;
    if (raw) {
      try {
        snapshot = JSON.parse(raw);
        const n = countTasks(snapshot);
        taskCountEl.textContent = n + ' task-uri';
        savedAtEl.textContent   = 'salvat local: ' + fmtDate(snapshot.savedAt);
        previewEl.textContent   = JSON.stringify(snapshot, null, 2).slice(0, 500) + '...';
        if (n > 0) {
          btn.disabled = false;
        } else {
          taskCountEl.textContent = '0 task-uri — localStorage gol pe acest device';
        }
      } catch(e) {
        taskCountEl.textContent = 'Eroare la citire localStorage';
      }
    } else {
      taskCountEl.textContent = 'Nimic în localStorage pe acest device';
    }

    btn.addEventListener('click', async () => {
      if (!snapshot) return;
      btn.disabled = true;
      btn.textContent = 'Se trimite...';
      try {
        const csrfToken = <?php echo json_encode(csrf_token()); ?>;

        const resp = await fetch('/elite-deux/state.php', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ state: snapshot }),
        });
        const result = await resp.json();
        if (result.ok) {
          msgEl.innerHTML = '<div class="msg ok">✓ Restaurat cu succes! Mergi la <a href="/elite-deux/">EliteDeux</a> și refreshează.</div>';
          btn.textContent = 'Trimis!';
        } else {
          throw new Error(result.error ?? 'unknown');
        }
      } catch(e) {
        msgEl.innerHTML = '<div class="msg err">Eroare: ' + e.message + '</div>';
        btn.disabled = false;
        btn.textContent = 'Încearcă din nou';
      }
    });
  </script>
</body>
</html>
