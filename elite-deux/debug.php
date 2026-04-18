<?php
declare(strict_types=1);
require __DIR__ . '/../admin/auth.php';
require_login();

$statePath  = __DIR__ . '/../data/elite-deux-state.json';
$serverRaw  = file_exists($statePath) ? file_get_contents($statePath) : null;
$serverData = $serverRaw ? json_decode($serverRaw, true) : null;

function countTasks(array $state): int {
    $n = 0;
    foreach ($state['tasksByDate'] ?? [] as $tasks)
        $n += is_array($tasks) ? count($tasks) : 0;
    foreach ($state['columns'] ?? [] as $col)
        foreach ($col['days'] ?? [] as $day)
            $n += count($day['tasks'] ?? []);
    return $n;
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Debug EliteDeux</title>
  <style>
    body { font-family: monospace; max-width: 700px; margin: 40px auto; padding: 20px; background: #fffaf2; }
    h2 { font-size: 16px; margin: 24px 0 8px; }
    .box { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .ok  { color: green; font-weight: bold; }
    .err { color: red;   font-weight: bold; }
    pre  { font-size: 12px; overflow: auto; max-height: 200px; background: #f5f0e8; padding: 10px; border-radius: 6px; margin-top: 8px; }
    button { padding: 10px 20px; background: #1c1c1c; color: #fff; border: none; border-radius: 8px; cursor: pointer; margin-top: 8px; font-size: 14px; }
  </style>
</head>
<body>
  <h1>EliteDeux Debug</h1>

  <h2>SERVER</h2>
  <div class="box">
    <?php if ($serverData): ?>
      <span class="ok">✓ <?= countTasks($serverData) ?> task-uri pe server</span>
      <div style="font-size:12px;color:#888">savedAt: <?= isset($serverData['savedAt']) ? date('d.m.Y H:i:s', (int)($serverData['savedAt']/1000)) : '—' ?></div>
      <pre><?= htmlspecialchars(json_encode($serverData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) ?></pre>
    <?php else: ?>
      <span class="err">✗ Server gol sau fișier lipsă</span>
    <?php endif; ?>
  </div>

  <h2>BROWSER (localStorage pe acest device)</h2>
  <div class="box">
    <div id="localInfo">se citește...</div>
    <pre id="localPre"></pre>
  </div>

  <h2>ACȚIUNI</h2>
  <div class="box">
    <button onclick="pushLocal()">Forțează push localStorage → Server</button>
    <button onclick="pullServer()" style="margin-left:8px;background:#2e7d32">Forțează pull Server → Browser</button>
    <div id="actionMsg" style="margin-top:10px;font-size:13px;"></div>
  </div>

  <script>
    const KEY = 'eliteDeux_state';
    const CSRF = <?php echo json_encode(csrf_token()); ?>;

    function countTasks(s) {
      let n = 0;
      for (const col of s?.columns ?? [])
        for (const day of col?.days ?? [])
          n += (day?.tasks ?? []).length;
      return n;
    }

    const raw = localStorage.getItem(KEY);
    const localEl = document.getElementById('localInfo');
    const localPre = document.getElementById('localPre');

    if (raw) {
      try {
        const s = JSON.parse(raw);
        const n = countTasks(s);
        const ts = s.savedAt ? new Date(s.savedAt).toLocaleString('ro-RO') : '—';
        localEl.innerHTML = (n > 0 ? '<span class="ok">✓ ' : '<span class="err">✗ ') + n + ' task-uri în localStorage</span><div style="font-size:12px;color:#888">savedAt: ' + ts + '</div>';
        localPre.textContent = JSON.stringify(s, null, 2).slice(0, 1000);
      } catch(e) {
        localEl.innerHTML = '<span class="err">Eroare parsare: ' + e.message + '</span>';
      }
    } else {
      localEl.innerHTML = '<span class="err">✗ localStorage gol pe acest device</span>';
    }

    async function pushLocal() {
      const msg = document.getElementById('actionMsg');
      const data = localStorage.getItem(KEY);
      if (!data) { msg.textContent = 'localStorage gol, nimic de trimis.'; return; }
      msg.textContent = 'Se trimite...';
      try {
        const r = await fetch('./state.php', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
          body: JSON.stringify({ state: JSON.parse(data) })
        });
        const res = await r.json();
        msg.textContent = res.ok ? '✓ Trimis pe server! Refreshează pe celălalt device.' : '✗ Eroare: ' + (res.error ?? 'unknown');
      } catch(e) { msg.textContent = '✗ ' + e.message; }
    }

    async function pullServer() {
      const msg = document.getElementById('actionMsg');
      msg.textContent = 'Se preia de pe server...';
      try {
        const r = await fetch('./state.php', { credentials: 'same-origin', cache: 'no-store' });
        const res = await r.json();
        if (res.state && countTasks(res.state) > 0) {
          localStorage.setItem(KEY, JSON.stringify(res.state));
          msg.textContent = '✓ ' + countTasks(res.state) + ' task-uri preluate de pe server. Mergi la EliteDeux.';
        } else {
          msg.textContent = '✗ Serverul e gol, nimic de preluat.';
        }
      } catch(e) { msg.textContent = '✗ ' + e.message; }
    }
  </script>
</body>
</html>
