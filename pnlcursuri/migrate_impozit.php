<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/pnlcursuri/migrate_impozit.php');
    exit;
}

$db_path = __DIR__ . '/data/pnl.sqlite';
if (!file_exists($db_path)) {
    die('DB not found at: ' . $db_path);
}

$db = new SQLite3($db_path);

// Ensure category table exists before updating it
$db->exec("CREATE TABLE IF NOT EXISTS cheltuiala_categorii (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nume TEXT NOT NULL UNIQUE
)");

$db->exec("UPDATE cheltuiala_categorii SET nume = 'Impozit curs' WHERE nume = 'Impozit'");
$db->exec("UPDATE cheltuieli SET categorie = 'Impozit curs', descriere = 'Impozit curs' WHERE categorie = 'Impozit'");

$db->close();
unlink(__FILE__);

header('Location: /pnlcursuri/');
exit;
