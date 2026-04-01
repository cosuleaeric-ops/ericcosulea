<?php
declare(strict_types=1);
require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

$dbPath = __DIR__ . '/../data/blog.sqlite';
$db = new SQLite3($dbPath);
$db->exec('CREATE TABLE IF NOT EXISTS deep_work_state (
    user_key TEXT PRIMARY KEY,
    days_json TEXT NOT NULL,
    settings_json TEXT NOT NULL,
    active_timer_json TEXT,
    updated_at TEXT NOT NULL
);');

function read_state(SQLite3 $db): array {
    $stmt = $db->prepare('SELECT days_json, settings_json, active_timer_json FROM deep_work_state WHERE user_key = :user_key LIMIT 1');
    $stmt->bindValue(':user_key', 'admin', SQLITE3_TEXT);
    $result = $stmt->execute();
    $row = $result ? $result->fetchArray(SQLITE3_ASSOC) : false;
    if (!$row) {
        return ['days' => [], 'settings' => [], 'activeTimer' => null];
    }

    $days = json_decode($row['days_json'] ?? '{}', true);
    $settings = json_decode($row['settings_json'] ?? '{}', true);
    $activeTimer = json_decode($row['active_timer_json'] ?? 'null', true);

    return [
        'days' => is_array($days) ? $days : [],
        'settings' => is_array($settings) ? $settings : [],
        'activeTimer' => is_array($activeTimer) ? $activeTimer : null,
    ];
}

function write_state(SQLite3 $db, array $state): array {
    $stmt = $db->prepare('INSERT OR REPLACE INTO deep_work_state (user_key, days_json, settings_json, active_timer_json, updated_at)
        VALUES (:user_key, :days_json, :settings_json, :active_timer_json, :updated_at)');
    $stmt->bindValue(':user_key', 'admin', SQLITE3_TEXT);
    $stmt->bindValue(':days_json', json_encode($state['days'] ?? [], JSON_UNESCAPED_UNICODE), SQLITE3_TEXT);
    $stmt->bindValue(':settings_json', json_encode($state['settings'] ?? [], JSON_UNESCAPED_UNICODE), SQLITE3_TEXT);
    $activeTimer = $state['activeTimer'] ?? null;
    $stmt->bindValue(':active_timer_json', $activeTimer === null ? null : json_encode($activeTimer, JSON_UNESCAPED_UNICODE), $activeTimer === null ? SQLITE3_NULL : SQLITE3_TEXT);
    $stmt->bindValue(':updated_at', gmdate('c'), SQLITE3_TEXT);
    $stmt->execute();
    return read_state($db);
}

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(read_state($db), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$raw = file_get_contents('php://input') ?: '{}';
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_json']);
    exit;
}

$current = read_state($db);
$next = [
    'days' => isset($payload['days']) && is_array($payload['days']) ? $payload['days'] : $current['days'],
    'settings' => isset($payload['settings']) && is_array($payload['settings']) ? $payload['settings'] : $current['settings'],
    'activeTimer' => array_key_exists('activeTimer', $payload) ? ($payload['activeTimer'] ?? null) : $current['activeTimer'],
];

echo json_encode(write_state($db, $next), JSON_UNESCAPED_UNICODE);
