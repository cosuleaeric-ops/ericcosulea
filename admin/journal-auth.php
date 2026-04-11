<?php
declare(strict_types=1);
require __DIR__ . '/auth.php';
require __DIR__ . '/webauthn-helpers.php';
require_login();

header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

// ── Registration: generate challenge ──────────────────────────────────────────
if ($action === 'register-challenge') {
    $challenge = webauthn_generate_challenge();
    echo json_encode([
        'ok' => true,
        'challenge' => $challenge,
        'rp' => ['name' => 'ericcosulea.ro', 'id' => 'ericcosulea.ro'],
        'user' => [
            'id' => base64_encode('admin'),
            'name' => 'admin',
            'displayName' => 'Admin',
        ],
    ]);
    exit;
}

// ── Registration: verify attestation ──────────────────────────────────────────
if ($action === 'register-verify' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || !verify_csrf($body['csrf_token'] ?? '')) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'CSRF invalid']);
        exit;
    }

    $result = webauthn_parse_registration(
        $body['attestationObject'] ?? '',
        $body['clientDataJSON'] ?? ''
    );

    webauthn_clear_challenge();

    if (!$result) {
        echo json_encode(['ok' => false, 'error' => 'Registration failed']);
        exit;
    }

    webauthn_save_credential($result['credential_id'], $result['public_key_pem']);

    // Mark session as verified after successful registration
    ensure_session();
    $_SESSION['journal_verified'] = true;

    echo json_encode(['ok' => true]);
    exit;
}

// ── Authentication: generate challenge ────────────────────────────────────────
if ($action === 'auth-challenge') {
    $challenge = webauthn_generate_challenge();
    $creds = webauthn_get_credentials();

    $allowCredentials = array_map(fn($c) => [
        'id' => $c['credential_id'],
        'type' => 'public-key',
    ], $creds);

    echo json_encode([
        'ok' => true,
        'challenge' => $challenge,
        'rpId' => 'ericcosulea.ro',
        'allowCredentials' => $allowCredentials,
    ]);
    exit;
}

// ── Authentication: verify assertion ──────────────────────────────────────────
if ($action === 'auth-verify' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || !verify_csrf($body['csrf_token'] ?? '')) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'CSRF invalid']);
        exit;
    }

    $ok = webauthn_verify_assertion(
        $body['credentialId'] ?? '',
        $body['authenticatorData'] ?? '',
        $body['clientDataJSON'] ?? '',
        $body['signature'] ?? ''
    );

    if ($ok) {
        ensure_session();
        $_SESSION['journal_verified'] = true;
        echo json_encode(['ok' => true]);
    } else {
        echo json_encode(['ok' => false, 'error' => 'Verification failed']);
    }
    exit;
}

http_response_code(404);
echo json_encode(['ok' => false, 'error' => 'Unknown action']);
