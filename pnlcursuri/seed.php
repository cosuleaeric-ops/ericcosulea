<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    header('Location: /admin/login.php?redirect=/pnlcursuri/seed.php');
    exit;
}

$db_dir = __DIR__ . '/data';
if (!is_dir($db_dir)) mkdir($db_dir, 0750, true);

$db = new SQLite3($db_dir . '/pnl.sqlite');
$db->enableExceptions(true);
$db->exec('PRAGMA journal_mode=WAL');

$db->exec("CREATE TABLE IF NOT EXISTS venituri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    descriere TEXT NOT NULL,
    suma REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)");

$db->exec("CREATE TABLE IF NOT EXISTS cheltuieli (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    descriere TEXT NOT NULL,
    categorie TEXT NOT NULL,
    suma REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)");

$venituri = [
    ['2026-01-26', 'Curs',                   1516.99],
    ['2026-02-02', 'Curs',                   1584.5 ],
    ['2026-02-03', 'Depunere capital social',  500.0 ],
    ['2026-02-09', 'Curs',                   1860.0 ],
    ['2026-02-16', 'Curs',                   1706.0 ],
    ['2026-03-02', 'Curs',                   2450.0 ],
];

$stmt = $db->prepare("INSERT INTO venituri (data, descriere, suma) VALUES (:data, :descriere, :suma)");
foreach ($venituri as [$data, $descriere, $suma]) {
    $stmt->bindValue(':data', $data);
    $stmt->bindValue(':descriere', $descriere);
    $stmt->bindValue(':suma', $suma);
    $stmt->execute();
}

// Auto-delete this file after use
unlink(__FILE__);

header('Location: /pnlcursuri/');
exit;
