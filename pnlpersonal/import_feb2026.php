<?php
declare(strict_types=1);
ini_set('display_errors', '1');
error_reporting(E_ALL);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/pnlpersonal/import_feb2026.php');
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
    array('2026-02-01', $FF, '', 27.7),
    array('2026-02-01', $BA, '', 13.0),
    array('2026-02-01', $TR, '',  5.0),
    array('2026-02-02', $SN, '',  7.8),
    array('2026-02-02', $FF, '', 42.0),
    array('2026-02-02', $FN, '', 32.0),
    array('2026-02-02', $TR, '', 15.0),
    array('2026-02-02', $AB, '', 30.0),
    array('2026-02-03', $GR, '', 25.7),
    array('2026-02-03', $SN, '', 13.0),
    array('2026-02-03', $FF, '', 24.0),
    array('2026-02-03', $BA, '', 13.0),
    array('2026-02-03', $TR, '', 20.0),
    array('2026-02-04', $SN, '',  4.5),
    array('2026-02-04', $FF, '', 36.0),
    array('2026-02-04', $FN, '', 45.0),
    array('2026-02-04', $AL, '', 70.0),
    array('2026-02-05', $SN, '',  7.2),
    array('2026-02-05', $FF, '', 16.5),
    array('2026-02-05', $PR, '', 28.1),
    array('2026-02-06', $FF, '', 36.5),
    array('2026-02-06', $FN, '', 116.0),
    array('2026-02-06', $TR, '', 18.7),
    array('2026-02-06', $AB, '', 18.0),
    array('2026-02-07', $FF, '', 48.0),
    array('2026-02-07', $BA, '', 13.0),
    array('2026-02-07', $AB, '', 29.0),
    array('2026-02-08', $FF, '', 77.2),
    array('2026-02-08', $FN, '', 60.0),
    array('2026-02-09', $GR, '', 54.1),
    array('2026-02-09', $FF, '', 47.7),
    array('2026-02-09', $FN, '', 594.6),
    array('2026-02-10', $SN, '',  6.0),
    array('2026-02-10', $FF, '', 30.5),
    array('2026-02-10', $AL, '', 566.7),
    array('2026-02-11', $SN, '',  7.3),
    array('2026-02-11', $FF, '', 24.5),
    array('2026-02-11', $BA, '', 17.0),
    array('2026-02-12', $SN, '',  6.4),
    array('2026-02-12', $FF, '', 34.5),
    array('2026-02-12', $TR, '',  5.0),
    array('2026-02-14', $AL, '', 70.0),
    array('2026-02-15', $FF, '', 45.0),
    array('2026-02-16', $FF, '', 12.5),
    array('2026-02-16', $FN, '', 37.0),
    array('2026-02-16', $TR, '', 80.0),
    array('2026-02-17', $FF, '', 37.0),
    array('2026-02-17', $BA, '', 22.0),
    array('2026-02-18', $GR, '', 25.4),
    array('2026-02-18', $SN, '',  7.2),
    array('2026-02-18', $FF, '', 27.0),
    array('2026-02-18', $PR, '', 15.6),
    array('2026-02-18', $CH, '', 206.0),
    array('2026-02-19', $FF, '', 35.0),
    array('2026-02-19', $BA, '', 23.0),
    array('2026-02-20', $FF, '', 27.0),
    array('2026-02-21', $SN, '',  6.0),
    array('2026-02-21', $FF, '', 33.8),
    array('2026-02-21', $BA, '', 25.0),
    array('2026-02-21', $AB, '', 12.7),
    array('2026-02-22', $GR, '', 58.1),
    array('2026-02-22', $SN, '',  7.2),
    array('2026-02-22', $FF, '', 64.4),
    array('2026-02-22', $AB, '', 321.0),
    array('2026-02-23', $GR, '', 23.2),
    array('2026-02-23', $FF, '', 11.0),
    array('2026-02-23', $BA, '', 13.0),
    array('2026-02-23', $CH, '', 129.0),
    array('2026-02-23', $AL, '', 118.9),
    array('2026-02-24', $SN, '',  3.0),
    array('2026-02-24', $FN, '', 50.0),
    array('2026-02-24', $AL, '', 29.0),
    array('2026-02-25', $SN, '', 11.5),
    array('2026-02-25', $FF, '', 46.9),
    array('2026-02-25', $CH, '', 49.0),
    array('2026-02-26', $SN, '',  7.5),
    array('2026-02-26', $FF, '', 28.4),
    array('2026-02-26', $BA, '', 19.1),
    array('2026-02-26', $IG, '', 75.0),
    array('2026-02-26', $CH, '', 1274.0),
    array('2026-02-26', $AL, '', 660.0),
    array('2026-02-27', $FF, '', 27.0),
    array('2026-02-27', $AL, '', 16.4),
    array('2026-02-28', $SN, '', 19.8),
    array('2026-02-28', $FF, '', 29.4),
);

$already = (int)$db->querySingle("SELECT COUNT(*) FROM cheltuieli WHERE strftime('%Y-%m', data) = '2026-02'");

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
foreach ($rows as $row) { $total += $row[3]; }
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <title>Import Februarie 2026</title>
  <link rel="icon" type="image/png" href="/assets/Logo3.png">
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
  <h1>Import Cheltuieli &mdash; Februarie 2026</h1>
  <?php if ($skipped > 0): ?>
    <p class="warn">&#9888; Exista deja <?php echo $already; ?> inregistrari pentru Februarie 2026.</p>
    <p>Pentru a evita duplicatele, importul a fost oprit.</p>
    <a class="btn btn-green" href="/pnlpersonal/">&#8592; Inapoi la P&amp;L</a>
    <a class="btn btn-gold" href="?force=1" onclick="return confirm('Esti sigur? Se vor adauga din nou toate <?php echo count($rows); ?> intrari!')">Forteaza import</a>
  <?php else: ?>
    <p class="ok">&#10003; Import reusit! <?php echo $inserted; ?> cheltuieli adaugate.</p>
    <p><strong>Total cheltuieli Februarie 2026:</strong> <?php echo number_format($total, 2, ',', '.'); ?> lei</p>
    <a class="btn btn-green" href="/pnlpersonal/">&#8592; Deschide P&amp;L Personal</a>
  <?php endif; ?>
</div>
</body>
</html>
