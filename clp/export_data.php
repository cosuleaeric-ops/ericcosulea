<?php
declare(strict_types=1);
$TOKEN = 'migrate_clp_2026_xK9mP2qR';
if (($_GET['token'] ?? '') !== $TOKEN) { http_response_code(403); echo 'Forbidden'; exit; }
$file = $_GET['file'] ?? '';

if ($file === 'clp.sqlite') {
    $path = __DIR__ . '/data/clp.sqlite';
} elseif ($file === 'pnl.sqlite') {
    $path = __DIR__ . '/../pnlcursuri/data/pnl.sqlite';
} elseif ($file === 'list_uploads') {
    header('Content-Type: application/json');
    $dir = __DIR__ . '/uploads/';
    $files = [];
    if (is_dir($dir)) foreach (glob($dir . '*') as $f) if (is_file($f) && basename($f) !== '.htaccess') $files[] = basename($f);
    echo json_encode($files);
    exit;
} elseif (str_starts_with($file, 'uploads/')) {
    $path = __DIR__ . '/uploads/' . basename($file);
} else {
    http_response_code(400); echo 'Invalid file'; exit;
}

if (!file_exists($path)) { http_response_code(404); echo "Not found: $file"; exit; }
header('Content-Type: application/octet-stream');
header('Content-Length: ' . filesize($path));
readfile($path);
if (($_GET['cleanup'] ?? '') === 'yes') @unlink(__FILE__);
