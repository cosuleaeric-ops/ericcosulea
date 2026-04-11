<?php
/**
 * Script temporar: expune bazele de date si fisierele uploadate pentru migrare.
 * Protejat cu token unic. SE STERGE SINGUR dupa prima utilizare completa.
 *
 * Usage: /clp/export_data.php?token=SECRET&file=clp.sqlite
 */
declare(strict_types=1);

$TOKEN = 'migrate_clp_2026_xK9mP2qR';

if (($_GET['token'] ?? '') !== $TOKEN) {
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

$file = $_GET['file'] ?? '';

$allowedFiles = [
    'clp.sqlite'  => __DIR__ . '/data/clp.sqlite',
    'pnl.sqlite'  => __DIR__ . '/../pnlcursuri/data/pnl.sqlite',
    'list_uploads' => null, // special: returns JSON list of upload files
];

// List uploads
if ($file === 'list_uploads') {
    header('Content-Type: application/json');
    $uploadsDir = __DIR__ . '/uploads/';
    $files = [];
    if (is_dir($uploadsDir)) {
        foreach (glob($uploadsDir . '*') as $f) {
            if (is_file($f) && basename($f) !== '.htaccess') {
                $files[] = basename($f);
            }
        }
    }
    echo json_encode($files);
    exit;
}

// Serve upload file
if (str_starts_with($file, 'uploads/')) {
    $name = basename($file);
    $path = __DIR__ . '/uploads/' . $name;
    if (!file_exists($path) || !is_file($path)) {
        http_response_code(404);
        echo 'Not found';
        exit;
    }
    header('Content-Type: application/octet-stream');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

// Serve DB file
if (!isset($allowedFiles[$file]) || !$allowedFiles[$file]) {
    http_response_code(400);
    echo 'Invalid file. Allowed: ' . implode(', ', array_keys($allowedFiles));
    exit;
}

$path = $allowedFiles[$file];
if (!file_exists($path)) {
    http_response_code(404);
    echo "File not found: {$file}";
    exit;
}

header('Content-Type: application/octet-stream');
header('Content-Length: ' . filesize($path));
readfile($path);

// Daca s-a cerut self_delete dupa toate fisierele
if (($_GET['cleanup'] ?? '') === 'yes') {
    @unlink(__FILE__);
}
