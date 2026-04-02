<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/pnlcursuri/migrate_impozit.php');
    exit;
}

$db = new SQLite3(__DIR__ . '/data/pnl.sqlite');
$db->enableExceptions(true);

$db->exec("UPDATE cheltuiala_categorii SET nume = 'Impozit curs' WHERE nume = 'Impozit'");
$db->exec("UPDATE cheltuieli SET categorie = 'Impozit curs', descriere = 'Impozit curs' WHERE categorie = 'Impozit'");

unlink(__FILE__);

header('Location: /pnlcursuri/');
exit;
