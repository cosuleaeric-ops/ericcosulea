<?php
declare(strict_types=1);

function get_clp_db(): SQLite3 {
    $path = __DIR__ . '/../data/clp.sqlite';
    $dir  = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $db = new SQLite3($path);
    $db->exec('PRAGMA foreign_keys = ON;');
    $db->exec('PRAGMA journal_mode = WAL;');
    $db->exec('CREATE TABLE IF NOT EXISTS courses (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        date        TEXT NOT NULL,
        created_at  TEXT NOT NULL
    );');
    $db->exec('CREATE TABLE IF NOT EXISTS tickets (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id        INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        participant_name TEXT NOT NULL
    );');
    $db->exec('CREATE TABLE IF NOT EXISTS course_files (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        filename      TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_type     TEXT NOT NULL DEFAULT \'viza\',
        uploaded_at   TEXT NOT NULL
    );');
    return $db;
}

if (!function_exists('h')) {
    function h(string $v): string {
        return htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
    }
}

function ro_date(string $date): string {
    if (!$date) return '';
    $months = ['', 'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
               'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
    [$y, $m, $d] = explode('-', $date);
    return ltrim($d, '0') . ' ' . $months[(int)$m] . ' ' . $y;
}

function ticket_distribution(array $tickets): array {
    $nameCounts = [];
    foreach ($tickets as $t) {
        $name = $t['participant_name'];
        $nameCounts[$name] = ($nameCounts[$name] ?? 0) + 1;
    }
    $groups = [];
    foreach ($nameCounts as $cnt) {
        $groups[$cnt] = ($groups[$cnt] ?? 0) + 1;
    }
    krsort($groups);
    return [
        'total_tickets' => count($tickets),
        'total_orders'  => count($nameCounts),
        'groups'        => $groups,
        'name_counts'   => $nameCounts,
    ];
}
