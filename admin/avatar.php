<?php
declare(strict_types=1);

require __DIR__ . '/auth.php';
require_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /');
    exit;
}

if (!verify_csrf($_POST['csrf_token'] ?? '')) {
    header('Location: /?avatar_error=csrf');
    exit;
}

$redirect = $_POST['redirect_to'] ?? '/';
if (!is_string($redirect) || $redirect === '' || $redirect[0] !== '/') {
    $redirect = '/';
}

$uploadDir = __DIR__ . '/../uploads/profile';
$allowedMimeTypes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
];

if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
    header('Location: ' . $redirect . '?avatar_error=mkdir');
    exit;
}

if (($_POST['action'] ?? '') === 'reset') {
    foreach (glob($uploadDir . '/avatar-current.*') ?: [] as $existingFile) {
        if (is_file($existingFile)) {
            unlink($existingFile);
        }
    }
    header('Location: ' . $redirect . '?avatar_updated=1');
    exit;
}

if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    header('Location: ' . $redirect . '?avatar_error=upload');
    exit;
}

$tmpFile = $_FILES['avatar']['tmp_name'];
$imageInfo = @getimagesize($tmpFile);
$mimeType = $imageInfo['mime'] ?? '';
$extension = $allowedMimeTypes[$mimeType] ?? null;

if ($extension === null) {
    header('Location: ' . $redirect . '?avatar_error=type');
    exit;
}

$targetPath = $uploadDir . '/avatar-current.' . $extension;

foreach (glob($uploadDir . '/avatar-current.*') ?: [] as $existingFile) {
    if (is_file($existingFile)) {
        unlink($existingFile);
    }
}

if (!move_uploaded_file($tmpFile, $targetPath)) {
    header('Location: ' . $redirect . '?avatar_error=move');
    exit;
}

chmod($targetPath, 0644);

header('Location: ' . $redirect . '?avatar_updated=1');
exit;
