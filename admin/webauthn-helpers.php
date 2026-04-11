<?php
declare(strict_types=1);

// ── Minimal CBOR decoder (subset needed for WebAuthn) ────────────────────────

function cbor_decode(string $data): mixed {
    $offset = 0;
    return cbor_decode_item($data, $offset);
}

function cbor_decode_item(string $data, int &$offset): mixed {
    $byte  = ord($data[$offset++]);
    $major = $byte >> 5;
    $minor = $byte & 0x1F;

    $value = cbor_decode_length($data, $offset, $minor);

    return match ($major) {
        0 => $value,                                           // unsigned int
        1 => -1 - $value,                                      // negative int
        2 => cbor_read_bytes($data, $offset, (int)$value),     // byte string
        3 => cbor_read_bytes($data, $offset, (int)$value),     // text string
        4 => cbor_decode_array($data, $offset, (int)$value),   // array
        5 => cbor_decode_map($data, $offset, (int)$value),     // map
        default => null,
    };
}

function cbor_decode_length(string $data, int &$offset, int $minor): int {
    if ($minor < 24) return $minor;
    if ($minor === 24) return ord($data[$offset++]);
    if ($minor === 25) {
        $val = unpack('n', substr($data, $offset, 2))[1];
        $offset += 2;
        return $val;
    }
    if ($minor === 26) {
        $val = unpack('N', substr($data, $offset, 4))[1];
        $offset += 4;
        return $val;
    }
    return 0;
}

function cbor_read_bytes(string $data, int &$offset, int $len): string {
    $bytes = substr($data, $offset, $len);
    $offset += $len;
    return $bytes;
}

function cbor_decode_array(string $data, int &$offset, int $count): array {
    $arr = [];
    for ($i = 0; $i < $count; $i++) {
        $arr[] = cbor_decode_item($data, $offset);
    }
    return $arr;
}

function cbor_decode_map(string $data, int &$offset, int $count): array {
    $map = [];
    for ($i = 0; $i < $count; $i++) {
        $key = cbor_decode_item($data, $offset);
        $val = cbor_decode_item($data, $offset);
        $map[$key] = $val;
    }
    return $map;
}

// ── WebAuthn helpers ─────────────────────────────────────────────────────────

const WEBAUTHN_CRED_FILE = __DIR__ . '/../data/webauthn_credentials.json';

function webauthn_generate_challenge(): string {
    $challenge = random_bytes(32);
    ensure_session();
    $_SESSION['webauthn_challenge'] = base64_encode($challenge);
    return base64_encode($challenge);
}

function webauthn_get_stored_challenge(): string {
    ensure_session();
    return $_SESSION['webauthn_challenge'] ?? '';
}

function webauthn_clear_challenge(): void {
    ensure_session();
    unset($_SESSION['webauthn_challenge']);
}

function webauthn_has_credentials(): bool {
    if (!file_exists(WEBAUTHN_CRED_FILE)) return false;
    $creds = json_decode((string)file_get_contents(WEBAUTHN_CRED_FILE), true);
    return is_array($creds) && count($creds) > 0;
}

function webauthn_get_credentials(): array {
    if (!file_exists(WEBAUTHN_CRED_FILE)) return [];
    $creds = json_decode((string)file_get_contents(WEBAUTHN_CRED_FILE), true);
    return is_array($creds) ? $creds : [];
}

function webauthn_save_credential(string $credentialId, string $publicKeyPem): void {
    $creds = webauthn_get_credentials();
    $creds[] = [
        'credential_id' => $credentialId,
        'public_key_pem' => $publicKeyPem,
        'created_at' => date('c'),
    ];
    file_put_contents(WEBAUTHN_CRED_FILE, json_encode($creds, JSON_PRETTY_PRINT), LOCK_EX);
    @chmod(WEBAUTHN_CRED_FILE, 0600);
}

// Extract EC P-256 public key from attestation object and return as PEM
function webauthn_parse_registration(string $attestationObjectB64, string $clientDataJsonB64): ?array {
    $attestationObject = base64_decode(strtr($attestationObjectB64, '-_', '+/'));
    $clientDataJson    = base64_decode(strtr($clientDataJsonB64, '-_', '+/'));

    // Decode the CBOR attestation object
    $att = cbor_decode($attestationObject);
    if (!is_array($att) || !isset($att['authData'])) return null;

    $authData = $att['authData'];

    // authData layout: rpIdHash(32) + flags(1) + signCount(4) + attestedCredData(variable)
    if (strlen($authData) < 37) return null;

    $flags = ord($authData[32]);
    $hasAttestedCred = ($flags & 0x40) !== 0;
    if (!$hasAttestedCred) return null;

    $offset = 37; // after rpIdHash + flags + signCount

    // AAGUID (16 bytes)
    $offset += 16;

    // Credential ID length (2 bytes big-endian)
    $credIdLen = unpack('n', substr($authData, $offset, 2))[1];
    $offset += 2;

    // Credential ID
    $credentialId = substr($authData, $offset, $credIdLen);
    $offset += $credIdLen;

    // Public key in COSE format (CBOR-encoded)
    $coseKey = cbor_decode_item($authData, $offset);
    if (!is_array($coseKey)) return null;

    // COSE EC2 key: 1=kty(2=EC2), 3=alg(-7=ES256), -1=crv(1=P-256), -2=x, -3=y
    $kty = $coseKey[1] ?? null;
    $x   = $coseKey[-2] ?? null;
    $y   = $coseKey[-3] ?? null;

    if ($kty !== 2 || !is_string($x) || !is_string($y)) return null;
    if (strlen($x) !== 32 || strlen($y) !== 32) return null;

    // Build uncompressed EC point: 04 || x || y
    $uncompressed = "\x04" . $x . $y;

    // Wrap in DER SubjectPublicKeyInfo for EC P-256
    $pem = webauthn_ec_point_to_pem($uncompressed);

    return [
        'credential_id' => base64_encode($credentialId),
        'public_key_pem' => $pem,
    ];
}

function webauthn_ec_point_to_pem(string $point): string {
    // EC P-256 OID: 1.2.840.10045.2.1, curve P-256: 1.2.840.10045.3.1.7
    $ecOid    = hex2bin('06072a8648ce3d0201');      // OID for EC
    $curveOid = hex2bin('06082a8648ce3d030107');     // OID for P-256
    $algId    = "\x30" . chr(strlen($ecOid . $curveOid)) . $ecOid . $curveOid;

    // BIT STRING wrapping the point
    $bitString = "\x03" . chr(strlen($point) + 1) . "\x00" . $point;

    // SEQUENCE { algId, bitString }
    $spki = "\x30" . chr(strlen($algId . $bitString)) . $algId . $bitString;

    $b64 = chunk_split(base64_encode($spki), 64, "\n");
    return "-----BEGIN PUBLIC KEY-----\n{$b64}-----END PUBLIC KEY-----\n";
}

// Verify a WebAuthn authentication assertion
function webauthn_verify_assertion(
    string $credentialIdB64,
    string $authenticatorDataB64,
    string $clientDataJsonB64,
    string $signatureB64
): bool {
    $creds = webauthn_get_credentials();
    $storedChallenge = webauthn_get_stored_challenge();
    webauthn_clear_challenge();

    if (!$storedChallenge) return false;

    // Find matching credential
    $publicKeyPem = null;
    foreach ($creds as $c) {
        if ($c['credential_id'] === $credentialIdB64) {
            $publicKeyPem = $c['public_key_pem'];
            break;
        }
    }
    if (!$publicKeyPem) return false;

    $authenticatorData = base64_decode(strtr($authenticatorDataB64, '-_', '+/'));
    $clientDataJson    = base64_decode(strtr($clientDataJsonB64, '-_', '+/'));
    $signature         = base64_decode(strtr($signatureB64, '-_', '+/'));

    // Verify clientDataJSON contains the correct challenge
    $clientData = json_decode($clientDataJson, true);
    if (!$clientData) return false;

    $receivedChallenge = $clientData['challenge'] ?? '';
    // The challenge in clientDataJSON is base64url-encoded
    $expectedChallengeB64url = rtrim(strtr($storedChallenge, '+/', '-_'), '=');
    if ($receivedChallenge !== $expectedChallengeB64url) return false;

    if (($clientData['type'] ?? '') !== 'webauthn.get') return false;

    // Verify signature over: authenticatorData || SHA-256(clientDataJSON)
    $clientDataHash = hash('sha256', $clientDataJson, true);
    $signedData     = $authenticatorData . $clientDataHash;

    $pubKey = openssl_pkey_get_public($publicKeyPem);
    if (!$pubKey) return false;

    $ok = openssl_verify($signedData, $signature, $pubKey, OPENSSL_ALGO_SHA256);
    return $ok === 1;
}
