<?php
declare(strict_types=1);
ini_set('display_errors', '1');
error_reporting(E_ALL);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/pnlpersonal/import_mar2026.php');
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
    array('2026-03-01', $FF, '',  60.9),
    array('2026-03-01', $FN, '', 110.0),
    array('2026-03-01', $TR, '',   8.0),
    array('2026-03-01', $AL, '', 111.0),
    array('2026-03-02', $SN, '',  16.2),
    array('2026-03-02', $FF, '',  22.9),
    array('2026-03-02', $BA, '',  15.0),
    array('2026-03-02', $AL, '',  17.0),
    array('2026-03-03', $SN, '',  11.0),
    array('2026-03-03', $FF, '',  24.0),
    array('2026-03-04', $GR, '',  11.2),
    array('2026-03-04', $SN, '',  16.5),
    array('2026-03-04', $FF, '',   6.2),
    array('2026-03-05', $GR, '',  25.5),
    array('2026-03-05', $SN, '',   7.5),
    array('2026-03-05', $FF, '',  16.5),
    array('2026-03-05', $BA, '',  13.0),
    array('2026-03-06', $FF, '',  24.5),
    array('2026-03-06', $BA, '',  13.0),
    array('2026-03-06', $AB, '',  18.0),
    array('2026-03-07', $SN, '',   7.1),
    array('2026-03-07', $FF, '',  39.8),
    array('2026-03-07', $BA, '',  17.0),
    array('2026-03-07', $AB, '',  29.0),
    array('2026-03-08', $SN, '',  11.0),
    array('2026-03-08', $FF, '',  54.6),
    array('2026-03-08', $BA, '',  22.9),
    array('2026-03-08', $FN, '', 105.0),
    array('2026-03-08', $TR, '',  17.9),
    array('2026-03-08', $AL, '', 285.0),
    array('2026-03-09', $GR, '',  42.0),
    array('2026-03-09', $SN, '',  19.8),
    array('2026-03-09', $BA, '',  17.0),
    array('2026-03-09', $IG, '',  44.8),
    array('2026-03-09', $AB, '',  30.0),
    array('2026-03-09', $AL, '', 250.0),
    array('2026-03-10', $BA, '',  13.0),
    array('2026-03-10', $IG, '',  13.7),
    array('2026-03-10', $AL, '', 566.7),
    array('2026-03-11', $SN, '',  11.6),
    array('2026-03-11', $BA, '',  13.0),
    array('2026-03-11', $FN, '',  70.0),
    array('2026-03-12', $FF, '',  33.0),
    array('2026-03-12', $AL, '',  40.0),
    array('2026-03-13', $SN, '',  10.0),
    array('2026-03-13', $FF, '',  41.0),
    array('2026-03-13', $BA, '',  13.0),
    array('2026-03-14', $GR, '',  57.1),
    array('2026-03-14', $FF, '',  36.0),
    array('2026-03-14', $BA, '',  13.0),
    array('2026-03-15', $FF, '',  43.6),
    array('2026-03-15', $BA, '',  13.0),
    array('2026-03-15', $AL, '', 202.5),
    array('2026-03-16', $SN, '',  20.0),
    array('2026-03-16', $BA, '',  13.0),
    array('2026-03-16', $IG, '',  90.0),
    array('2026-03-16', $TR, '',  80.0),
    array('2026-03-16', $AL, '',  16.0),
    array('2026-03-17', $FF, '',  16.0),
    array('2026-03-17', $BA, '',  13.0),
    array('2026-03-17', $AL, '', 418.0),
    array('2026-03-18', $FF, '',   7.0),
    array('2026-03-18', $BA, '',  13.0),
    array('2026-03-18', $FN, '',  48.0),
    array('2026-03-18', $AB, '',  25.5),
    array('2026-03-19', $SN, '',   6.5),
    array('2026-03-19', $FF, '',  36.0),
    array('2026-03-20', $FF, '',  35.0),
    array('2026-03-20', $BA, '',  13.0),
    array('2026-03-20', $FN, '', 168.0),
    array('2026-03-20', $TR, '',  20.0),
    array('2026-03-21', $FF, '',  52.3),
    array('2026-03-21', $BA, '',  13.0),
    array('2026-03-21', $PR, '',  15.6),
    array('2026-03-22', $FF, '',  91.5),
    array('2026-03-22', $BA, '',  22.9),
    array('2026-03-23', $SN, '',   6.0),
    array('2026-03-23', $FF, '',  24.5),
    array('2026-03-23', $BA, '',  13.0),
    array('2026-03-24', $GR, '',  19.0),
    array('2026-03-24', $SN, '',   9.8),
    array('2026-03-24', $FF, '',  36.0),
    array('2026-03-24', $BA, '',  13.0),
    array('2026-03-24', $IG, '',  20.0),
    array('2026-03-24', $PR, '',  25.0),
    array('2026-03-24', $CH, '', 127.0),
    array('2026-03-25', $SN, '',   7.5),
    array('2026-03-25', $FF, '',  42.4),
    array('2026-03-25', $BA, '',  13.0),
    array('2026-03-25', $CH, '', 118.0),
    array('2026-03-25', $AL, '',  35.0),
    array('2026-03-26', $SN, '',  11.7),
    array('2026-03-26', $FF, '',  34.0),
    array('2026-03-26', $BA, '',  17.0),
    array('2026-03-27', $FF, '',  37.0),
    array('2026-03-27', $TR, '',  10.0),
    array('2026-03-27', $PR, '', 111.9),
    array('2026-03-28', $GR, '',  34.5),
    array('2026-03-28', $SN, '',  23.1),
    array('2026-03-28', $FF, '',  64.2),
    array('2026-03-28', $BA, '',  21.1),
    array('2026-03-29', $SN, '',  13.3),
    array('2026-03-29', $FF, '',  66.4),
    array('2026-03-29', $BA, '',  16.0),
    array('2026-03-29', $CH, '', 1274.0),
    array('2026-03-30', $GR, '',  17.2),
    array('2026-03-30', $SN, '',  19.4),
    array('2026-03-30', $FF, '',  33.0),
    array('2026-03-30', $TR, '',  10.0),
    array('2026-03-31', $SN, '',   5.9),
    array('2026-03-31', $BA, '',  20.0),
);

$already = (int)$db->querySingle("SELECT COUNT(*) FROM cheltuieli WHERE strftime('%Y-%m', data) = '2026-03'");

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
  <title>Import Martie 2026</title>
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
  <h1>Import Cheltuieli &mdash; Martie 2026</h1>
  <?php if ($skipped > 0): ?>
    <p class="warn">&#9888; Exista deja <?php echo $already; ?> inregistrari pentru Martie 2026.</p>
    <p>Pentru a evita duplicatele, importul a fost oprit.</p>
    <a class="btn btn-green" href="/pnlpersonal/">&#8592; Inapoi la P&amp;L</a>
    <a class="btn btn-gold" href="?force=1" onclick="return confirm('Esti sigur? Se vor adauga din nou toate <?php echo count($rows); ?> intrari!')">Forteaza import</a>
  <?php else: ?>
    <p class="ok">&#10003; Import reusit! <?php echo $inserted; ?> cheltuieli adaugate.</p>
    <p><strong>Total cheltuieli Martie 2026:</strong> <?php echo number_format($total, 2, ',', '.'); ?> lei</p>
    <a class="btn btn-green" href="/pnlpersonal/">&#8592; Deschide P&amp;L Personal</a>
  <?php endif; ?>
</div>
</body>
</html>
