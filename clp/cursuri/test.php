<?php
declare(strict_types=1);
echo 'pas1 - declare ok<br>';

function parse_ro_date(string $input): ?string {
    $input = trim(strtolower($input));
    $year  = (int)date('Y');
    $months = ['martie'=>3];
    foreach ($months as $name => $num) {
        if (preg_match('/(\d{1,2})\s+' . preg_quote($name, '/') . '(?:\s+(\d{4}))?/', $input, $m)) {
            $d = (int)$m[1];
            $y = isset($m[2]) && $m[2] ? (int)$m[2] : $year;
            if ($d >= 1 && $d <= 31) return sprintf('%04d-%02d-%02d', $y, $num, $d);
        }
    }
    return null;
}
echo 'pas2 - parse_ro_date ok<br>';

require __DIR__ . '/../../admin/auth.php';
echo 'pas3 - auth ok<br>';

require __DIR__ . '/db.php';
echo 'pas4 - db.php ok<br>';

echo 'TOTUL MERGE';
