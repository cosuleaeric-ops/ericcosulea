<?php
declare(strict_types=1);
require __DIR__ . '/../admin/auth.php';

if (!is_logged_in()) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$raw = file_get_contents('php://input') ?: '{}';
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'invalid_json']);
    exit;
}

$body = trim((string)($payload['body'] ?? ''));
$apiKey = trim((string)($payload['apiKey'] ?? ''));
if ($body === '' || $apiKey === '') {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'body_and_api_key_required']);
    exit;
}

$url = 'https://api.wip.co/v1/todos?api_key=' . rawurlencode($apiKey);
$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => json_encode(['body' => $body], JSON_UNESCAPED_UNICODE),
        'ignore_errors' => true,
        'timeout' => 15,
    ],
]);

$result = @file_get_contents($url, false, $context);
$status = 502;
if (isset($http_response_header[0]) && preg_match('~\s(\d{3})\s~', $http_response_header[0], $matches)) {
    $status = (int)$matches[1];
}

http_response_code($status);
header('Content-Type: application/json; charset=utf-8');
echo $result !== false ? $result : json_encode(['error' => 'wip_request_failed']);
