<?php
declare(strict_types=1);
require __DIR__ . '/../admin/auth.php';
require_login();

$dataDir    = __DIR__ . '/../data';
$statePath  = $dataDir . '/elite-deux-state.json';
$backupPath = $dataDir . '/elite-deux-state.backup.json';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!file_exists($backupPath)) {
        $msg = 'Nu există fișier backup.';
    } else {
        copy($statePath, $dataDir . '/elite-deux-state.before-restore.json');
        copy($backupPath, $statePath);
        $msg = 'Backup restaurat cu succes!';
    }
}

$backupData = file_exists($backupPath) ? json_decode(file_get_contents($backupPath), true) : null;
$stateData  = file_exists($statePath)  ? json_decode(file_get_contents($statePath),  true) : null;

function count_tasks(array $state): int {
    $n = 0;
    foreach ($state['columns'] ?? [] as $col)
        foreach ($col['days'] ?? [] as $day)
            $n += count($day['tasks'] ?? []);
    return $n;
}
function fmt_ts(?int $ts): string {
    return $ts ? date('d.m.Y H:i:s', (int)($ts / 1000)) : '—';
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restore EliteDeux</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 20px; background: #fffaf2; }
    h1 { font-size: 24px; margin-bottom: 6px; }
    .box { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 20px; margin: 16px 0; }
    .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .05em; }
    .val { font-size: 20px; font-weight: 700; margin: 4px 0 0; }
    .ts { font-size: 13px; color: #aaa; }
    .btn { display: block; width: 100%; padding: 14px; background: #1c1c1c; color: #fff; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; margin-top: 20px; }
    .btn:hover { background: #333; }
    .msg { padding: 12px 16px; border-radius: 8px; background: #eaf6ec; color: #1a6b2a; font-weight: 600; margin-bottom: 16px; }
    .back { display: inline-block; margin-top: 20px; color: #888; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Restore EliteDeux</h1>
  <p style="color:#666">Restaurezi backup-ul automat din fișierul anterior salvării.</p>

  <?php if (!empty($msg)): ?>
    <div class="msg"><?= htmlspecialchars($msg) ?></div>
  <?php endif; ?>

  <div class="box">
    <div class="label">Stare curentă (server acum)</div>
    <div class="val"><?= $stateData ? count_tasks($stateData) . ' task-uri' : 'gol / lipsă' ?></div>
    <div class="ts">salvat: <?= fmt_ts($stateData['savedAt'] ?? null) ?></div>
  </div>

  <div class="box">
    <div class="label">Backup (starea de dinainte)</div>
    <div class="val"><?= $backupData ? count_tasks($backupData) . ' task-uri' : 'gol / lipsă' ?></div>
    <div class="ts">salvat: <?= fmt_ts($backupData['savedAt'] ?? null) ?></div>
  </div>

  <?php if ($backupData): ?>
  <form method="post">
    <button class="btn" type="submit" onclick="return confirm('Restaurezi backup-ul? Starea curentă se va pierde.')">
      Restaurează backup-ul
    </button>
  </form>
  <?php else: ?>
    <p style="color:#c00">Nu există backup disponibil.</p>
  <?php endif; ?>

  <a class="back" href="/elite-deux/">← Înapoi la EliteDeux</a>
</body>
</html>
