<?php
// Diagnostic temporar - sterge dupa folosire
echo '<pre>';
echo 'PHP version: ' . PHP_VERSION . "\n";
echo 'SQLite3: ' . (class_exists('SQLite3') ? 'OK' : 'MISSING') . "\n";
echo 'session_start: ' . (function_exists('session_start') ? 'OK' : 'MISSING') . "\n";
echo 'hash_hmac: ' . (function_exists('hash_hmac') ? 'OK' : 'MISSING') . "\n";
echo 'password_verify: ' . (function_exists('password_verify') ? 'OK' : 'MISSING') . "\n";
$dir = __DIR__ . '/pnlpersonal/data';
echo 'pnlpersonal/data dir exists: ' . (is_dir($dir) ? 'YES' : 'NO') . "\n";
echo 'pnlpersonal/data writable: ' . (is_writable($dir) ? 'YES' : 'NO (or not yet created)') . "\n";
$authFile = __DIR__ . '/admin/auth.php';
echo 'admin/auth.php exists: ' . (file_exists($authFile) ? 'YES' : 'NO') . "\n";
echo 'admin/config.php exists: ' . (file_exists(__DIR__ . '/admin/config.php') ? 'YES' : 'NO') . "\n";

echo "\n--- Test include auth.php ---\n";
try {
    require_once $authFile;
    echo "auth.php: OK\n";
} catch (Throwable $e) {
    echo "auth.php ERROR: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . " Line: " . $e->getLine() . "\n";
}
echo '</pre>';
