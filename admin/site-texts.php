<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require_login();

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($payload) || !verify_csrf((string)($payload['csrf_token'] ?? ''))) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'csrf_invalid']);
    exit;
}

$texts = $payload['texts'] ?? null;
if (!is_array($texts)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_payload']);
    exit;
}

$allowedKeys = [
    'home.hero_name',
    'home.hero_sub',
    'home.projects_title',
    'home.interesting_title',
    'home.inspo_title',
    'home.inspo_lead',
    'inspo.title',
    'inspo.lead',
    'blog.title',
    'tools.title',
    'tools.lead',
];

$db = new SQLite3(__DIR__ . '/../data/blog.sqlite');
$db->exec('CREATE TABLE IF NOT EXISTS site_texts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text_key TEXT UNIQUE NOT NULL,
    text_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);');

$stmt = $db->prepare('INSERT INTO site_texts (text_key, text_value, updated_at) VALUES (:text_key, :text_value, :updated_at)
    ON CONFLICT(text_key) DO UPDATE SET text_value = excluded.text_value, updated_at = excluded.updated_at');

foreach ($texts as $key => $value) {
    if (!is_string($key) || !in_array($key, $allowedKeys, true)) {
        continue;
    }
    $cleanValue = trim((string)$value);
    $stmt->bindValue(':text_key', $key, SQLITE3_TEXT);
    $stmt->bindValue(':text_value', $cleanValue, SQLITE3_TEXT);
    $stmt->bindValue(':updated_at', date('Y-m-d H:i:s'), SQLITE3_TEXT);
    $stmt->execute();
}

echo json_encode(['ok' => true]);
