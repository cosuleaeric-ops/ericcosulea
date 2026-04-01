<?php
declare(strict_types=1);

require __DIR__ . '/../admin/auth.php';
require_login();

header('Content-Type: application/json; charset=utf-8');

$dataDir = realpath(__DIR__ . '/../data') ?: (__DIR__ . '/../data');
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$statePath = $dataDir . '/elite-deux-state.json';
$backupPath = $dataDir . '/elite-deux-state.backup.json';

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_state_file(string $path): ?array {
    if (!is_file($path)) {
        return null;
    }

    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') {
        return null;
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond(200, [
        'state' => read_state_file($statePath),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Method not allowed']);
}

$csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!verify_csrf($csrfToken)) {
    respond(400, ['error' => 'CSRF invalid']);
}

$raw = file_get_contents('php://input');
$decoded = json_decode($raw ?: '', true);
$state = $decoded['state'] ?? null;

if (!is_array($state)) {
    respond(400, ['error' => 'Invalid state payload']);
}

$json = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    respond(400, ['error' => 'Could not encode state']);
}

if (is_file($statePath)) {
    @copy($statePath, $backupPath);
}

if (file_put_contents($statePath, $json . PHP_EOL, LOCK_EX) === false) {
    respond(500, ['error' => 'Could not persist state']);
}

respond(200, ['ok' => true]);
