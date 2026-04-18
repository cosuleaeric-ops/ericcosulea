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

// Backup rotativ — păstrează ultimele 10 versiuni
if (is_file($statePath)) {
    @copy($statePath, $backupPath);
    // Rotație: backup.9 → șters, backup.8 → backup.9, ..., backup.1 → backup.2, curent → backup.1
    for ($i = 8; $i >= 1; $i--) {
        $src = $dataDir . '/elite-deux-state.backup.' . $i . '.json';
        $dst = $dataDir . '/elite-deux-state.backup.' . ($i + 1) . '.json';
        if (is_file($src)) @rename($src, $dst);
    }
    @copy($statePath, $dataDir . '/elite-deux-state.backup.1.json');
}

// Nu salva niciodată o stare goală dacă serverul are deja date
$existing = read_state_file($statePath);
if ($existing !== null) {
    $existingTasks = 0;
    foreach (($existing['columns'] ?? []) as $col)
        foreach (($col['days'] ?? []) as $day)
            $existingTasks += count($day['tasks'] ?? []);

    $newTasks = 0;
    foreach (($state['columns'] ?? []) as $col)
        foreach (($col['days'] ?? []) as $day)
            $newTasks += count($day['tasks'] ?? []);

    if ($existingTasks > 0 && $newTasks === 0) {
        respond(400, ['error' => 'Refusing to overwrite non-empty state with empty state']);
    }
}

if (file_put_contents($statePath, $json . PHP_EOL, LOCK_EX) === false) {
    respond(500, ['error' => 'Could not persist state']);
}

respond(200, ['ok' => true]);
