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
    $db->exec('CREATE TABLE IF NOT EXISTS course_reports (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id      INTEGER NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
        total_bilete   REAL NOT NULL DEFAULT 0,
        total_incasari REAL NOT NULL DEFAULT 0,
        filename       TEXT NOT NULL DEFAULT \'\',
        original_name  TEXT NOT NULL DEFAULT \'\',
        uploaded_at    TEXT NOT NULL
    );');
    // Coloana types_json adăugată ulterior (ignoră eroarea dacă există deja)
    @$db->exec('ALTER TABLE course_reports ADD COLUMN types_json TEXT NOT NULL DEFAULT \'[]\';');
    $db->exec('CREATE TABLE IF NOT EXISTS viza_subtips (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        seria      TEXT NOT NULL,
        tarif      REAL NOT NULL,
        nr_unitati INTEGER NOT NULL,
        de_la      TEXT NOT NULL,
        pana_la    TEXT NOT NULL
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

// Extrage subtipurile de bilete dintr-un text PDF (output pdftotext sau PDF.js)
function parse_viza_subtips(string $text): array {
    $subtips = [];
    $text = preg_replace('/\r\n?/', "\n", $text);
    // Pattern flexibil: acceptă orice whitespace (newline sau spații) între câmpuri
    $pattern = '/Tariful\s+pe\s+buc[aă]t[aă]\s*\(lei\)[^\n]*\s+(\d+)\s+([\d,.]+)\s+[\d,.]+\s+Seria\s+De\s+la\s+nr\.\s+La\s+nr\.[^\n]*\s+([A-Z]+)\s+(\d+)\s+(\d+)/u';
    if (preg_match_all($pattern, $text, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $m) {
            $subtips[] = [
                'nr_unitati' => (int)$m[1],
                'tarif'      => (float)str_replace(',', '.', $m[2]),
                'seria'      => trim($m[3]),
                'de_la'      => $m[4],
                'pana_la'    => $m[5],
            ];
        }
    }
    return $subtips;
}

// Încearcă extragerea textului din PDF cu pdftotext (fallback server-side)
function pdf_to_text(string $filepath): string {
    if (!file_exists($filepath)) return '';
    if (!function_exists('escapeshellarg') || !function_exists('shell_exec')) return '';
    $cmd = 'pdftotext -layout ' . escapeshellarg($filepath) . ' -';
    $out = @shell_exec($cmd);
    return $out ?? '';
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
