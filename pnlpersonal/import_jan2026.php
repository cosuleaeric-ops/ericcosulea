<?php
ini_set('display_errors', '1');
error_reporting(E_ALL);
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/pnlpersonal/import_jan2026.php');
    exit;
}

$db_dir = __DIR__ . '/data';
if (!is_dir($db_dir)) {
    mkdir($db_dir, 0750, true);
}

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

$cats_v = array('Salariu', 'Mama', '2Performant', 'Profitshare', 'Trading212', 'Vinted');
foreach ($cats_v as $c) {
    $s = $db->prepare("INSERT OR IGNORE INTO venit_categorii (nume) VALUES (:n)");
    $s->bindValue(':n', $c);
    $s->execute();
}

$cats_c = array(
    "Groceries \xf0\x9f\x8d\x8e",
    "Snacks \xf0\x9f\x8d\xab",
    "Fast-food \xf0\x9f\x8d\x94",
    "B\xc4\x83uturi \xe2\x98\x95",
    "Fun \xf0\x9f\x8e\xb3",
    "Igiena \xf0\x9f\xa7\xbc",
    "Transport \xf0\x9f\x9a\x8c",
    "Abonamente \xf0\x9f\x93\xba",
    "Proiecte \xf0\x9f\x92\xbb",
    "Chirie \xf0\x9f\x8f\xa0",
    "Altele \xf0\x9f\x93\xa6"
);
foreach ($cats_c as $c) {
    $s = $db->prepare("INSERT OR IGNORE INTO cheltuiala_categorii (nume) VALUES (:n)");
    $s->bindValue(':n', $c);
    $s->execute();
}

// Categorii cu emoji ca bytes pentru siguranta
$GR = "Groceries \xf0\x9f\x8d\x8e";
$SN = "Snacks \xf0\x9f\x8d\xab";
$FF = "Fast-food \xf0\x9f\x8d\x94";
$BA = "B\xc4\x83uturi \xe2\x98\x95";
$FN = "Fun \xf0\x9f\x8e\xb3";
$IG = "Igiena \xf0\x9f\xa7\xbc";
$TR = "Transport \xf0\x9f\x9a\x8c";
$AB = "Abonamente \xf0\x9f\x93\xba";
$PR = "Proiecte \xf0\x9f\x92\xbb";
$CH = "Chirie \xf0\x9f\x8f\xa0";
$AL = "Altele \xf0\x9f\x93\xa6";

$rows = array(
    array('2026-01-01', $FF, '', 34.0),
    array('2026-01-02', $FF, '', 29.7),
    array('2026-01-03', $GR, '', 36.8),
    array('2026-01-03', $FF, '', 29.7),
    array('2026-01-04', $GR, '', 26.3),
    array('2026-01-04', $SN, '',  4.5),
    array('2026-01-04', $BA, '', 26.4),
    array('2026-01-04', $AL, '',  4.1),
    array('2026-01-05', $FF, '', 11.5),
    array('2026-01-06', $GR, '', 60.2),
    array('2026-01-06', $SN, '',  7.0),
    array('2026-01-06', $IG, '', 10.0),
    array('2026-01-06', $AB, '', 18.0),
    array('2026-01-07', $GR, '', 29.0),
    array('2026-01-07', $SN, '',  6.0),
    array('2026-01-07', $AB, '', 29.0),
    array('2026-01-08', $FF, '', 29.7),
    array('2026-01-08', $AL, '', 88.0),
    array('2026-01-09', $FF, '', 23.0),
    array('2026-01-09', $TR, '', 22.0),
    array('2026-01-10', $GR, '', 54.1),
    array('2026-01-10', $FF, '', 44.0),
    array('2026-01-10', $BA, '', 20.0),
    array('2026-01-10', $TR, '', 13.0),
    array('2026-01-10', $PR, '', 44.2),
    array('2026-01-10', $AL, '', 566.7),
    array('2026-01-11', $GR, '', 25.0),
    array('2026-01-11', $FF, '', 33.0),
    array('2026-01-12', $GR, '', 30.0),
    array('2026-01-12', $SN, '',  7.0),
    array('2026-01-12', $BA, '', 13.0),
    array('2026-01-12', $IG, '', 30.0),
    array('2026-01-13', $SN, '',  6.4),
    array('2026-01-13', $FF, '', 29.7),
    array('2026-01-13', $TR, '', 80.0),
    array('2026-01-13', $AL, '', 250.0),
    array('2026-01-14', $FF, '', 35.5),
    array('2026-01-14', $PR, '', 1437.0),
    array('2026-01-15', $FF, '', 45.5),
    array('2026-01-15', $PR, '', 37.5),
    array('2026-01-16', $GR, '', 23.7),
    array('2026-01-17', $FF, '', 75.0),
    array('2026-01-17', $BA, '', 22.9),
    array('2026-01-17', $IG, '', 65.0),
    array('2026-01-17', $TR, '', 20.0),
    array('2026-01-18', $SN, '',  5.5),
    array('2026-01-18', $FF, '', 56.2),
    array('2026-01-18', $FN, '', 100.0),
    array('2026-01-19', $SN, '',  6.0),
    array('2026-01-19', $FF, '', 26.0),
    array('2026-01-19', $AL, '', 21.5),
    array('2026-01-20', $GR, '', 23.0),
    array('2026-01-20', $SN, '',  6.0),
    array('2026-01-20', $FF, '', 16.5),
    array('2026-01-20', $IG, '', 13.0),
    array('2026-01-21', $FF, '', 46.5),
    array('2026-01-21', $AB, '', 12.7),
    array('2026-01-22', $SN, '',  8.0),
    array('2026-01-22', $FN, '', 95.0),
    array('2026-01-23', $FF, '', 36.7),
    array('2026-01-23', $PR, '',  8.6),
    array('2026-01-24', $SN, '',  6.0),
    array('2026-01-24', $FF, '', 53.0),
    array('2026-01-24', $BA, '', 13.0),
    array('2026-01-25', $FF, '', 33.0),
    array('2026-01-26', $GR, '', 26.5),
    array('2026-01-26', $FF, '', 29.5),
    array('2026-01-26', $BA, '', 13.0),
    array('2026-01-27', $FF, '', 41.0),
    array('2026-01-28', $FF, '', 29.0),
    array('2026-01-29', $FF, '', 31.0),
    array('2026-01-29', $CH, '', 491.0),
    array('2026-01-30', $GR, '', 10.2),
    array('2026-01-30', $FF, '', 29.7),
    array('2026-01-30', $BA, '', 13.0),
    array('2026-01-30', $TR, '',  5.0),
    array('2026-01-31', $GR, '', 19.8),
    array('2026-01-31', $FF, '', 50.0),
    array('2026-01-31', $BA, '', 13.0),
    array('2026-01-31', $AB, '', 99.0),
    array('2026-01-31', $CH, '', 1274.0),
    array('2026-01-31', $AL, '', 133.0),
);

$already = (int)$db->querySingle("SELECT COUNT(*) FROM cheltuieli WHERE strftime('%Y-%m', data) = '2026-01'");

$inserted = 0;
$skipped  = 0;

if ($already > 0 && !isset($_GET['force'])) {
    $skipped = count($rows);
} else {
    $stmt = $db->prepare("INSERT INTO cheltuieli (data, categorie, detalii, suma) VALUES (:data, :cat, :det, :suma)");
    foreach ($rows as $row) {
        $stmt->bindValue(':data', $row[0]);
        $stmt->bindValue(':cat',  $row[1]);
        $stmt->bindValue(':det',  $row[2]);
        $stmt->bindValue(':suma', $row[3]);
        $stmt->execute();
        $inserted++;
    }
}

$total = 0.0;
foreach ($rows as $row) {
    $total += $row[3];
}
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <title>Import Ianuarie 2026</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FFFDF7; color: #1C1C1A; padding: 40px 24px; }
    .box { max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #E8E3D8; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,.07); }
    h1 { font-size: 22px; margin-bottom: 20px; }
    .ok   { color: #2A7D4F; font-weight: 700; font-size: 18px; }
    .warn { color: #B8860B; font-weight: 700; font-size: 18px; }
    p { margin: 10px 0; color: #555; }
    .btn { display: inline-block; margin-top: 20px; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .btn-green { background: #2A7D4F; color: #fff; }
    .btn-gold  { background: #B8860B; color: #fff; margin-left: 10px; }
  </style>
</head>
<body>
<div class="box">
  <h1>Import Cheltuieli &mdash; Ianuarie 2026</h1>

  <?php if ($skipped > 0): ?>
    <p class="warn">&#9888; Exista deja <?php echo $already; ?> inregistrari pentru Ianuarie 2026.</p>
    <p>Pentru a evita duplicatele, importul a fost oprit.</p>
    <a class="btn btn-green" href="/pnlpersonal/">&#8592; Inapoi la P&amp;L</a>
    <a class="btn btn-gold" href="?force=1" onclick="return confirm('Esti sigur? Se vor adauga din nou toate <?php echo count($rows); ?> intrari!')">Forteaza import</a>
  <?php else: ?>
    <p class="ok">&#10003; Import reusit! <?php echo $inserted; ?> cheltuieli adaugate.</p>
    <p><strong>Total cheltuieli Ianuarie 2026:</strong> <?php echo number_format($total, 2, ',', '.'); ?> lei</p>
    <a class="btn btn-green" href="/pnlpersonal/">&#8592; Deschide P&amp;L Personal</a>
  <?php endif; ?>
</div>
</body>
</html>
