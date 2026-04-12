<?php
/**
 * One-time cleanup: sterge clp/ si pnlcursuri/ de pe server.
 * Se auto-sterge dupa executie.
 * Acceseaza: https://ericcosulea.ro/cleanup_clp.php
 */
declare(strict_types=1);

require __DIR__ . '/admin/auth.php';
if (!is_logged_in()) { die('Neautorizat'); }

header('Content-Type: text/plain; charset=utf-8');

function rrmdir(string $dir): int {
    if (!is_dir($dir)) return 0;
    $count = 0;
    foreach (scandir($dir) as $f) {
        if ($f === '.' || $f === '..') continue;
        $path = $dir . '/' . $f;
        if (is_dir($path)) {
            $count += rrmdir($path);
        } else {
            unlink($path);
            $count++;
        }
    }
    rmdir($dir);
    return $count;
}

$dirs = [__DIR__ . '/clp', __DIR__ . '/pnlcursuri'];

foreach ($dirs as $d) {
    if (is_dir($d)) {
        $n = rrmdir($d);
        echo "Sters: {$d} ({$n} fisiere)\n";
    } else {
        echo "Nu exista: {$d}\n";
    }
}

echo "\nSterg cleanup_clp.php...\n";
unlink(__FILE__);
echo "Done.\n";
