<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/pnlpersonal/import_jan2026.php');
    exit;
}

$db_dir = __DIR__ . '/data';
if (!is_dir($db_dir)) mkdir($db_dir, 0750, true);

$db = new SQLite3($db_dir . '/pnlpersonal.sqlite');
$db->enableExceptions(true);
$db->busyTimeout(5000);
$db->exec('PRAGMA journal_mode=WAL');

$db->exec("CREATE TABLE IF NOT EXISTS cheltuieli (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    categorie TEXT NOT NULL,
    detalii TEXT NOT NULL DEFAULT '',
    suma REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)");
$db->exec("CREATE TABLE IF NOT EXISTS venituri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    descriere TEXT NOT NULL,
    suma REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)");
$db->exec("CREATE TABLE IF NOT EXISTS venit_categorii (id INTEGER PRIMARY KEY AUTOINCREMENT, nume TEXT NOT NULL UNIQUE)");
$db->exec("CREATE TABLE IF NOT EXISTS cheltuiala_categorii (id INTEGER PRIMARY KEY AUTOINCREMENT, nume TEXT NOT NULL UNIQUE)");
$db->exec("CREATE TABLE IF NOT EXISTS portofel (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, cash REAL NOT NULL DEFAULT 0, ing REAL NOT NULL DEFAULT 0, revolut REAL NOT NULL DEFAULT 0, trading212 REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))");

foreach (['Salariu','Mama','2Performant','Profitshare','Trading212','Vinted'] as $c) {
    $s = $db->prepare("INSERT OR IGNORE INTO venit_categorii (nume) VALUES (:n)"); $s->bindValue(':n',$c); $s->execute();
}
foreach (['Groceries 🍎','Snacks 🍫','Fast-food 🍔','Băuturi ☕','Fun 🎳','Igiena 🧼','Transport 🚌','Abonamente 📺','Proiecte 💻','Chirie 🏠','Altele 📦'] as $c) {
    $s = $db->prepare("INSERT OR IGNORE INTO cheltuiala_categorii (nume) VALUES (:n)"); $s->bindValue(':n',$c); $s->execute();
}

// ── Date import Ianuarie 2026 ─────────────────────────────────────────────────
$rows = [
    ['2026-01-01', 'Fast-food 🍔',  '',       34.0  ],
    ['2026-01-02', 'Fast-food 🍔',  '',       29.7  ],
    ['2026-01-03', 'Groceries 🍎',  '',       36.8  ],
    ['2026-01-03', 'Fast-food 🍔',  '',       29.7  ],
    ['2026-01-04', 'Groceries 🍎',  '',       26.3  ],
    ['2026-01-04', 'Snacks 🍫',     '',        4.5  ],
    ['2026-01-04', 'Băuturi ☕',    '',       26.4  ],
    ['2026-01-04', 'Altele 📦',     '',        4.1  ],
    ['2026-01-05', 'Fast-food 🍔',  '',       11.5  ],
    ['2026-01-06', 'Groceries 🍎',  '',       60.2  ],
    ['2026-01-06', 'Snacks 🍫',     '',        7.0  ],
    ['2026-01-06', 'Igiena 🧼',     '',       10.0  ],
    ['2026-01-06', 'Abonamente 📺', '',       18.0  ],
    ['2026-01-07', 'Groceries 🍎',  '',       29.0  ],
    ['2026-01-07', 'Snacks 🍫',     '',        6.0  ],
    ['2026-01-07', 'Abonamente 📺', '',       29.0  ],
    ['2026-01-08', 'Fast-food 🍔',  '',       29.7  ],
    ['2026-01-08', 'Altele 📦',     '',       88.0  ],
    ['2026-01-09', 'Fast-food 🍔',  '',       23.0  ],
    ['2026-01-09', 'Transport 🚌',  '',       22.0  ],
    ['2026-01-10', 'Groceries 🍎',  '',       54.1  ],
    ['2026-01-10', 'Fast-food 🍔',  '',       44.0  ],
    ['2026-01-10', 'Băuturi ☕',    '',       20.0  ],
    ['2026-01-10', 'Transport 🚌',  '',       13.0  ],
    ['2026-01-10', 'Proiecte 💻',   '',       44.2  ],
    ['2026-01-10', 'Altele 📦',     '',      566.7  ],
    ['2026-01-11', 'Groceries 🍎',  '',       25.0  ],
    ['2026-01-11', 'Fast-food 🍔',  '',       33.0  ],
    ['2026-01-12', 'Groceries 🍎',  '',       30.0  ],
    ['2026-01-12', 'Snacks 🍫',     '',        7.0  ],
    ['2026-01-12', 'Băuturi ☕',    '',       13.0  ],
    ['2026-01-12', 'Igiena 🧼',     '',       30.0  ],
    ['2026-01-13', 'Snacks 🍫',     '',        6.4  ],
    ['2026-01-13', 'Fast-food 🍔',  '',       29.7  ],
    ['2026-01-13', 'Transport 🚌',  '',       80.0  ],
    ['2026-01-13', 'Altele 📦',     '',      250.0  ],
    ['2026-01-14', 'Fast-food 🍔',  '',       35.5  ],
    ['2026-01-14', 'Proiecte 💻',   '',     1437.0  ],
    ['2026-01-15', 'Fast-food 🍔',  '',       45.5  ],
    ['2026-01-15', 'Proiecte 💻',   '',       37.5  ],
    ['2026-01-16', 'Groceries 🍎',  '',       23.7  ],
    ['2026-01-17', 'Fast-food 🍔',  '',       75.0  ],
    ['2026-01-17', 'Băuturi ☕',    '',       22.9  ],
    ['2026-01-17', 'Igiena 🧼',     '',       65.0  ],
    ['2026-01-17', 'Transport 🚌',  '',       20.0  ],
    ['2026-01-18', 'Snacks 🍫',     '',        5.5  ],
    ['2026-01-18', 'Fast-food 🍔',  '',       56.2  ],
    ['2026-01-18', 'Fun 🎳',        '',      100.0  ],
    ['2026-01-19', 'Snacks 🍫',     '',        6.0  ],
    ['2026-01-19', 'Fast-food 🍔',  '',       26.0  ],
    ['2026-01-19', 'Altele 📦',     '',       21.5  ],
    ['2026-01-20', 'Groceries 🍎',  '',       23.0  ],
    ['2026-01-20', 'Snacks 🍫',     '',        6.0  ],
    ['2026-01-20', 'Fast-food 🍔',  '',       16.5  ],
    ['2026-01-20', 'Igiena 🧼',     '',       13.0  ],
    ['2026-01-21', 'Fast-food 🍔',  '',       46.5  ],
    ['2026-01-21', 'Abonamente 📺', '',       12.7  ],
    ['2026-01-22', 'Snacks 🍫',     '',        8.0  ],
    ['2026-01-22', 'Fun 🎳',        '',       95.0  ],
    ['2026-01-23', 'Fast-food 🍔',  '',       36.7  ],
    ['2026-01-23', 'Proiecte 💻',   '',        8.6  ],
    ['2026-01-24', 'Snacks 🍫',     '',        6.0  ],
    ['2026-01-24', 'Fast-food 🍔',  '',       53.0  ],
    ['2026-01-24', 'Băuturi ☕',    '',       13.0  ],
    ['2026-01-25', 'Fast-food 🍔',  '',       33.0  ],
    ['2026-01-26', 'Groceries 🍎',  '',       26.5  ],
    ['2026-01-26', 'Fast-food 🍔',  '',       29.5  ],
    ['2026-01-26', 'Băuturi ☕',    '',       13.0  ],
    ['2026-01-27', 'Fast-food 🍔',  '',       41.0  ],
    ['2026-01-28', 'Fast-food 🍔',  '',       29.0  ],
    ['2026-01-29', 'Fast-food 🍔',  '',       31.0  ],
    ['2026-01-29', 'Chirie 🏠',     '',      491.0  ],
    ['2026-01-30', 'Groceries 🍎',  '',       10.2  ],
    ['2026-01-30', 'Fast-food 🍔',  '',       29.7  ],
    ['2026-01-30', 'Băuturi ☕',    '',       13.0  ],
    ['2026-01-30', 'Transport 🚌',  '',        5.0  ],
    ['2026-01-31', 'Groceries 🍎',  '',       19.8  ],
    ['2026-01-31', 'Fast-food 🍔',  '',       50.0  ],
    ['2026-01-31', 'Băuturi ☕',    '',       13.0  ],
    ['2026-01-31', 'Abonamente 📺', '',       99.0  ],
    ['2026-01-31', 'Chirie 🏠',     '',     1274.0  ],
    ['2026-01-31', 'Altele 📦',     '',      133.0  ],
];

$already = (int)$db->querySingle("SELECT COUNT(*) FROM cheltuieli WHERE strftime('%Y-%m', data) = '2026-01'");

$inserted = 0;
$skipped  = 0;

if ($already > 0 && !isset($_GET['force'])) {
    $skipped = count($rows);
} else {
    $stmt = $db->prepare("INSERT INTO cheltuieli (data, categorie, detalii, suma) VALUES (:data, :cat, :det, :suma)");
    foreach ($rows as [$data, $cat, $det, $suma]) {
        $stmt->bindValue(':data', $data);
        $stmt->bindValue(':cat',  $cat);
        $stmt->bindValue(':det',  $det);
        $stmt->bindValue(':suma', $suma);
        $stmt->execute();
        $inserted++;
    }
}

$total = array_sum(array_column($rows, 3));
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <title>Import Ianuarie 2026</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FFFDF7; color: #1C1C1A; padding: 40px 24px; }
    .box { max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #E8E3D8; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,.07); }
    h1 { font-family: 'Crimson Pro', Georgia, serif; font-size: 24px; margin-bottom: 20px; }
    .ok  { color: #2A7D4F; font-weight: 700; font-size: 18px; }
    .warn { color: #B8860B; font-weight: 700; font-size: 18px; }
    p { margin: 10px 0; color: #555; }
    .btn { display: inline-block; margin-top: 20px; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .btn-green { background: #2A7D4F; color: #fff; }
    .btn-gold  { background: #B8860B; color: #fff; margin-left: 10px; }
  </style>
</head>
<body>
<div class="box">
  <h1>Import Cheltuieli — Ianuarie 2026</h1>

  <?php if ($skipped > 0): ?>
    <p class="warn">⚠️ Există deja <?php echo $already; ?> înregistrări pentru Ianuarie 2026.</p>
    <p>Pentru a evita duplicatele, importul a fost oprit.</p>
    <p>Dacă vrei să forțezi re-importul (va adăuga din nou toate), apasă butonul de mai jos.</p>
    <a class="btn btn-green" href="/pnlpersonal/">← Înapoi la P&L</a>
    <a class="btn btn-gold" href="?force=1" onclick="return confirm('Ești sigur? Se vor adăuga din nou toate <?php echo count($rows); ?> intrări!')">Forțează import</a>
  <?php else: ?>
    <p class="ok">✅ Import reușit! <?php echo $inserted; ?> cheltuieli adăugate.</p>
    <p><strong>Total cheltuieli Ianuarie 2026:</strong> <?php echo number_format($total, 2, ',', '.'); ?> lei</p>
    <p style="margin-top:16px; font-size:13px; color:#888">Acest fișier va fi șters automat după ce închizi pagina. Poți șterge manual <code>import_jan2026.php</code> de pe server.</p>
    <a class="btn btn-green" href="/pnlpersonal/">← Deschide P&L Personal</a>
  <?php endif; ?>
</div>
</body>
</html>
