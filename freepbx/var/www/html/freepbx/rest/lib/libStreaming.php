<?php
#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

/*
 * Video sources (door intercoms, cameras) for NethVoice CTI.
 *
 * A source is either an "image" source, a HTTP(S) URL returning a JPEG that
 * nethcti-server polls (legacy behaviour), or a "rtsp" source, a RTSP(S)
 * stream pulled on demand by the MediaMTX gateway of the module and served
 * to the CTI clients over WebRTC (WHEP). Credentials are kept out of the URL
 * and every source has zero or more ordered gates (door openers), opened by
 * DTMF through the source extension or by an HTTP request.
 *
 * TLS: certificates of https:// and rtsps:// devices are verified (system CA
 * store and host name) by the admin check, by nethcti-server and by the
 * gateway. A source can skip the verification ("tls_skip_verify", for devices
 * with a self-signed certificate): it then applies to the source URL and to
 * all its URL gates. MediaMTX has no switch to skip it, only the pinning of the
 * SHA-256 fingerprint of the device certificate ("sourceFingerprint"): the
 * fingerprint is read from the device when the source is saved and stored in
 * "tls_fingerprint". If the device certificate changes later, the gateway
 * refuses the device until the source is saved again; the check reports it.
 *
 * The functions in this file have no FreePBX dependency, so they can be used
 * by the REST API, by the nethcti3 configuration generator and by tests.
 */

const STREAMING_GATEWAY_PREFIX = 'streaming-gw';
const STREAMING_MAX_GATES = 10;
const STREAMING_REASONS = ['auth_failed', 'connection_refused', 'timeout', 'not_found', 'tls_error', 'unsupported', 'unknown'];
// Video codecs that MediaMTX can forward to a browser over WebRTC
const STREAMING_WEBRTC_VIDEO_CODECS = ['h264', 'vp8', 'vp9', 'av1', 'hevc'];

class StreamingValidationException extends \InvalidArgumentException
{
    private $field;

    public function __construct(string $field, string $message)
    {
        parent::__construct($message);
        $this->field = $field;
    }

    public function getField(): string
    {
        return $this->field;
    }
}

/*
 * CTI permission name of a source, also used as key of streaming.json and as
 * the last element of the gateway path. Must stay in sync with the legacy
 * expression used in rest/modules/cti.php.
 */
function streaming_permission_name(string $descr): string
{
    return 'vs_' . strtolower(str_replace(' ', '_', preg_replace('/[^a-zA-Z0-9\s]/', '', $descr)));
}

/* MediaMTX path (and WHEP URL prefix) of a RTSP source */
function streaming_gateway_path(string $descr): string
{
    return STREAMING_GATEWAY_PREFIX . '/' . streaming_permission_name($descr);
}

/*
 * Split a source URL in its parts. Return null when the URL is not an
 * absolute http(s) or rtsp(s) URL with a host.
 */
function streaming_parse_url(string $url): ?array
{
    if ($url === '' || strlen($url) > 8000 || preg_match('/[\x00-\x20\x7f]/', $url)) {
        return null;
    }
    if (!preg_match('#^([a-zA-Z][a-zA-Z0-9+.-]*)://([^/?\#]*)(.*)$#s', $url, $matches)) {
        return null;
    }
    $scheme = strtolower($matches[1]);
    if (!in_array($scheme, ['http', 'https', 'rtsp', 'rtsps'], true)) {
        return null;
    }
    $authority = $matches[2];
    $user = '';
    $secret = '';
    $hasCredentials = false;
    // A raw "@" in the password is common: the host starts after the last one.
    $at = strrpos($authority, '@');
    if ($at !== false) {
        $hasCredentials = true;
        $userinfo = substr($authority, 0, $at);
        $authority = substr($authority, $at + 1);
        $colon = strpos($userinfo, ':');
        $user = rawurldecode($colon === false ? $userinfo : substr($userinfo, 0, $colon));
        $secret = $colon === false ? '' : rawurldecode(substr($userinfo, $colon + 1));
    }
    if (preg_match('/^\[([0-9a-fA-F:.]+)\](?::(\d{1,5}))?$/', $authority, $hostParts)) {
        $host = $hostParts[1];
        $port = $hostParts[2] ?? '';
        if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) === false) {
            return null;
        }
    } elseif (preg_match('/^([a-zA-Z0-9._-]+)(?::(\d{1,5}))?$/', $authority, $hostParts)) {
        $host = $hostParts[1];
        $port = $hostParts[2] ?? '';
    } else {
        return null;
    }
    if ($host === '' || ($port !== '' && ((int) $port < 1 || (int) $port > 65535))) {
        return null;
    }
    return [
        'scheme' => $scheme,
        'type' => in_array($scheme, ['rtsp', 'rtsps'], true) ? 'rtsp' : 'image',
        'authority' => $authority,
        'host' => $host,
        'port' => $port,
        'rest' => $matches[3],
        'user' => $user,
        'secret' => $secret,
        'has_credentials' => $hasCredentials,
        // The URL without the user info: the only form that is stored
        'url' => $scheme . '://' . $authority . $matches[3],
    ];
}

/* Source type from the URL scheme: "rtsp" for rtsp(s)://, "image" otherwise */
function streaming_type_from_url(string $url): string
{
    $parsed = streaming_parse_url($url);
    return ($parsed !== null && $parsed['type'] === 'rtsp') ? 'rtsp' : 'image';
}

/* Put URL-encoded credentials back into a (credential-free) URL */
function streaming_url_with_credentials(string $url, string $user, string $secret): string
{
    $parsed = streaming_parse_url($url);
    if ($parsed === null || $user === '') {
        return $url;
    }
    $userinfo = rawurlencode($user);
    if ($secret !== '') {
        $userinfo .= ':' . rawurlencode($secret);
    }
    return $parsed['scheme'] . '://' . $userinfo . '@' . $parsed['authority'] . $parsed['rest'];
}

/* "host:port" of a URL, with the scheme default port, to compare two URLs */
function streaming_url_endpoint(string $url): string
{
    $parsed = streaming_parse_url($url);
    if ($parsed === null) {
        return '';
    }
    $defaults = ['http' => '80', 'https' => '443', 'rtsp' => '554', 'rtsps' => '322'];
    return $parsed['scheme'] . '://' . strtolower($parsed['host']) . ':' . ($parsed['port'] !== '' ? $parsed['port'] : $defaults[$parsed['scheme']]);
}

function streaming_string_field(array $data, string $field, int $maxLength, string $default = ''): string
{
    if (!array_key_exists($field, $data) || $data[$field] === null) {
        return $default;
    }
    if (!is_scalar($data[$field])) {
        throw new StreamingValidationException($field, "$field must be a string");
    }
    $value = (string) $data[$field];
    if (strlen($value) > $maxLength) {
        throw new StreamingValidationException($field, "$field is too long");
    }
    if (preg_match('/[\x00-\x1f\x7f]/', $value)) {
        throw new StreamingValidationException($field, "$field contains control characters");
    }
    return $value;
}

function streaming_bool_field(array $data, string $field, bool $default = false): bool
{
    if (!array_key_exists($field, $data) || $data[$field] === null) {
        return $default;
    }
    $value = $data[$field];
    if (is_bool($value)) {
        return $value;
    }
    if (in_array($value, [1, '1', 'true'], true)) {
        return true;
    }
    if (in_array($value, [0, '0', 'false', ''], true)) {
        return false;
    }
    throw new StreamingValidationException($field, "$field must be a boolean");
}

/*
 * True when something the PBX contacts for this source uses TLS: a rtsps://
 * or https:// source URL or at least one https:// URL gate. Only then the
 * "skip TLS certificate verification" option has a meaning.
 */
function streaming_tls_relevant(string $url, array $gates): bool
{
    $parsed = streaming_parse_url($url);
    if ($parsed !== null && in_array($parsed['scheme'], ['https', 'rtsps'], true)) {
        return true;
    }
    foreach ($gates as $gate) {
        if (($gate['type'] ?? '') === 'url') {
            $gateUrl = streaming_parse_url((string) ($gate['url'] ?? ''));
            if ($gateUrl !== null && $gateUrl['scheme'] === 'https') {
                return true;
            }
        }
    }
    return false;
}

/* True when the gateway must pin the device certificate of the source */
function streaming_needs_fingerprint(array $source): bool
{
    $parsed = streaming_parse_url((string) $source['url']);
    return !empty($source['tls_skip_verify']) && $parsed !== null && $parsed['scheme'] === 'rtsps';
}

/* A SHA-256 fingerprint as MediaMTX wants it: 64 lowercase hex digits, or null */
function streaming_normalize_fingerprint($fingerprint): ?string
{
    if (!is_string($fingerprint)) {
        return null;
    }
    $fingerprint = strtolower(str_replace(':', '', trim($fingerprint)));
    return preg_match('/^[0-9a-f]{64}$/', $fingerprint) ? $fingerprint : null;
}

/*
 * Read the SHA-256 fingerprint of the certificate presented by a TLS device
 * (https:// or rtsps://, TLS from the first byte), without verifying it.
 * Return [fingerprint or null, error message].
 */
function streaming_fetch_fingerprint(string $url, int $timeout = 5): array
{
    $parsed = streaming_parse_url($url);
    if ($parsed === null || !in_array($parsed['scheme'], ['https', 'rtsps'], true)) {
        return [null, 'not a TLS URL'];
    }
    $port = $parsed['port'] !== '' ? $parsed['port'] : ($parsed['scheme'] === 'https' ? '443' : '322');
    $isIp = filter_var($parsed['host'], FILTER_VALIDATE_IP) !== false;
    $host = strpos($parsed['host'], ':') !== false ? '[' . $parsed['host'] . ']' : $parsed['host'];
    $ssl = [
        'capture_peer_cert' => true,
        'verify_peer' => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true,
        'SNI_enabled' => !$isIp,
    ];
    if (!$isIp) {
        $ssl['peer_name'] = $parsed['host'];
    }
    $context = stream_context_create(['ssl' => $ssl]);
    $errno = 0;
    $errstr = '';
    $stream = @stream_socket_client('tls://' . $host . ':' . $port, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
    if ($stream === false) {
        $error = error_get_last();
        return [null, $errstr !== '' ? $errstr : (string) ($error['message'] ?? 'TLS connection failed')];
    }
    $params = stream_context_get_params($stream);
    fclose($stream);
    $certificate = $params['options']['ssl']['peer_certificate'] ?? null;
    if ($certificate === null) {
        return [null, 'the device did not send a certificate'];
    }
    $fingerprint = streaming_normalize_fingerprint(@openssl_x509_fingerprint($certificate, 'sha256'));
    return $fingerprint !== null ? [$fingerprint, ''] : [null, 'cannot read the device certificate'];
}

/*
 * Pin the device certificate of a source that skips the TLS verification of
 * its rtsps:// URL: read the fingerprint now, keep the stored one if the device
 * cannot be reached. Return the source with "tls_fingerprint" set and the
 * error of the read ("" on success).
 */
function streaming_refresh_fingerprint(array $source, ?callable $fetch = null): array
{
    if (!streaming_needs_fingerprint($source)) {
        $source['tls_fingerprint'] = null;
        return [$source, ''];
    }
    [$fingerprint, $error] = ($fetch ?? 'streaming_fetch_fingerprint')((string) $source['url']);
    $fingerprint = streaming_normalize_fingerprint($fingerprint);
    if ($fingerprint !== null) {
        $source['tls_fingerprint'] = $fingerprint;
        return [$source, ''];
    }
    $source['tls_fingerprint'] = streaming_normalize_fingerprint($source['tls_fingerprint'] ?? null);
    return [$source, $error !== '' ? $error : 'cannot read the device certificate'];
}

/*
 * Validate and normalize the gates of a source.
 *
 * $current are the stored gates of the source (with secrets), used to keep a
 * gate password when the client sends an empty one: passwords are write-only.
 */
function streaming_normalize_gates($gates, array $current = []): array
{
    if (!is_array($gates) || ($gates !== [] && array_keys($gates) !== range(0, count($gates) - 1))) {
        throw new StreamingValidationException('gates', 'gates must be a list');
    }
    if (count($gates) > STREAMING_MAX_GATES) {
        throw new StreamingValidationException('gates', 'too many gates');
    }
    $currentById = [];
    foreach ($current as $gate) {
        $currentById[(string) $gate['id']] = $gate;
    }
    $result = [];
    foreach ($gates as $index => $gate) {
        if (!is_array($gate)) {
            throw new StreamingValidationException("gates[$index]", 'gate must be an object');
        }
        $name = trim(streaming_string_field($gate, 'name', 50));
        if ($name === '') {
            $name = 'Gate ' . ($index + 1);
        }
        $type = streaming_string_field($gate, 'type', 10, 'dtmf');
        $normalized = [
            'id' => null,
            'position' => $index,
            'name' => $name,
            'type' => $type,
            'code' => null,
            'url' => null,
            'method' => 'GET',
            'username' => null,
            'password' => null,
        ];
        $id = isset($gate['id']) && is_scalar($gate['id']) ? (string) $gate['id'] : '';
        $stored = ($id !== '' && isset($currentById[$id])) ? $currentById[$id] : null;
        if ($stored !== null) {
            $normalized['id'] = (int) $stored['id'];
        }
        if ($type === 'dtmf') {
            $code = trim(streaming_string_field($gate, 'code', 30));
            if (!preg_match('/^[0-9A-Da-d*#+]{1,30}$/', $code)) {
                throw new StreamingValidationException("gates[$index].code", 'invalid DTMF code');
            }
            $normalized['code'] = $code;
        } elseif ($type === 'url') {
            $url = trim(streaming_string_field($gate, 'url', 2048));
            $parsed = streaming_parse_url($url);
            if ($parsed === null || $parsed['type'] !== 'image') {
                throw new StreamingValidationException("gates[$index].url", 'gate URL must be http:// or https://');
            }
            $method = strtoupper(streaming_string_field($gate, 'method', 6, 'GET'));
            if (!in_array($method, ['GET', 'POST'], true)) {
                throw new StreamingValidationException("gates[$index].method", 'method must be GET or POST');
            }
            $username = streaming_string_field($gate, 'username', 255);
            $password = streaming_string_field($gate, 'password', 255);
            if ($parsed['has_credentials']) {
                // Credentials pasted into the URL are moved to their own fields
                $username = $username !== '' ? $username : $parsed['user'];
                $password = $password !== '' ? $password : $parsed['secret'];
            }
            if ($username === '') {
                $password = '';
            } elseif ($password === '' && $stored !== null && (string) ($stored['password'] ?? '') !== '') {
                // A stored password is never sent to another device
                if (streaming_url_endpoint((string) $stored['url']) !== streaming_url_endpoint($parsed['url'])) {
                    throw new StreamingValidationException("gates[$index].password", 'the gate address changed: type the password again');
                }
                $password = (string) $stored['password'];
            }
            $normalized['url'] = $parsed['url'];
            $normalized['method'] = $method;
            $normalized['username'] = $username !== '' ? $username : null;
            $normalized['password'] = $password !== '' ? $password : null;
        } else {
            throw new StreamingValidationException("gates[$index].type", 'type must be dtmf or url');
        }
        $result[] = $normalized;
    }
    return $result;
}

/* Gates for a legacy client that only knows the "open" DTMF code */
function streaming_gates_from_open(string $open, array $current = []): array
{
    $gates = [];
    $replaced = false;
    foreach ($current as $gate) {
        if (!$replaced && $gate['type'] === 'dtmf') {
            $replaced = true;
            if ($open === '') {
                continue;
            }
            $gate['code'] = $open;
        }
        $gates[] = $gate;
    }
    if (!$replaced && $open !== '') {
        array_unshift($gates, ['id' => null, 'name' => 'Gate 1', 'type' => 'dtmf', 'code' => $open]);
    }
    foreach ($gates as $position => $gate) {
        $gates[$position]['position'] = $position;
    }
    return $gates;
}

/* Legacy "open" column: the code of the first DTMF gate */
function streaming_open_code(array $gates): string
{
    foreach ($gates as $gate) {
        if ($gate['type'] === 'dtmf') {
            return (string) $gate['code'];
        }
    }
    return '';
}

/*
 * Validate a source sent by a REST client and merge it with the stored one.
 *
 * Return the normalized source (url without credentials, type, user, secret,
 * exten, frame-rate, gates, open). Secrets are write-only: an empty or absent
 * secret keeps the stored one, an empty user clears both.
 */
function streaming_normalize_source(array $data, ?array $current = null): array
{
    $descr = trim(streaming_string_field($data, 'descr', 50));
    if ($descr === '' || streaming_permission_name($descr) === 'vs_') {
        throw new StreamingValidationException('descr', 'name must contain at least a letter or a digit');
    }
    $rawUrl = trim(streaming_string_field($data, 'url', 8000));
    $parsed = streaming_parse_url($rawUrl);
    if ($parsed === null) {
        throw new StreamingValidationException('url', 'URL must be http(s):// or rtsp(s):// with a host');
    }
    $user = streaming_string_field($data, 'user', 255, $current !== null && !array_key_exists('user', $data) ? (string) $current['user'] : '');
    $secret = streaming_string_field($data, 'secret', 255);
    if ($parsed['has_credentials']) {
        $user = $user !== '' ? $user : $parsed['user'];
        $secret = $secret !== '' ? $secret : $parsed['secret'];
    }
    if ($user === '') {
        $secret = '';
    } elseif ($secret === '' && $current !== null && (string) $current['secret'] !== '') {
        // A stored password is never sent to another device
        if (streaming_url_endpoint((string) $current['url']) !== streaming_url_endpoint($parsed['url'])) {
            throw new StreamingValidationException('secret', 'the device address changed: type the password again');
        }
        $secret = (string) $current['secret'];
    }

    $exten = null;
    if (isset($data['exten']) && $data['exten'] !== '') {
        if (!is_scalar($data['exten']) || !preg_match('/^\d{1,10}$/', (string) $data['exten'])) {
            throw new StreamingValidationException('exten', 'extension must be a number');
        }
        $exten = (int) $data['exten'];
    }
    $frameRate = $current !== null ? (int) ($current['frame-rate'] ?? 1000) : 1000;
    foreach (['frame-rate', 'framerate'] as $key) {
        if (isset($data[$key]) && $data[$key] !== '') {
            if (!is_scalar($data[$key]) || !preg_match('/^\d{1,6}$/', (string) $data[$key]) || (int) $data[$key] < 500) {
                throw new StreamingValidationException('frame-rate', 'frame rate must be a number of milliseconds, at least 500');
            }
            $frameRate = (int) $data[$key];
        }
    }

    $currentGates = $current['gates'] ?? [];
    if (array_key_exists('gates', $data) && $data['gates'] !== null) {
        $gates = streaming_normalize_gates($data['gates'], $currentGates);
    } elseif (array_key_exists('open', $data)) {
        // Legacy client: "open" is the code of the first DTMF gate
        $open = trim(streaming_string_field($data, 'open', 30));
        if ($open !== '' && !preg_match('/^[0-9A-Da-d*#+]{1,30}$/', $open)) {
            throw new StreamingValidationException('open', 'invalid DTMF code');
        }
        $gates = streaming_normalize_gates(streaming_gates_from_open($open, $currentGates), $currentGates);
    } else {
        $gates = $currentGates;
    }

    // Absent: keep the stored value (legacy clients). Stored as false when
    // nothing of the source uses TLS.
    $tlsSkipVerify = streaming_bool_field($data, 'tls_skip_verify', $current !== null && !empty($current['tls_skip_verify']));
    if (!streaming_tls_relevant($parsed['url'], $gates)) {
        $tlsSkipVerify = false;
    }
    $source = [
        'descr' => $descr,
        'type' => $parsed['type'],
        'url' => $parsed['url'],
        'user' => $user,
        'secret' => $secret,
        'frame-rate' => $frameRate,
        'exten' => $exten,
        'gates' => $gates,
        'open' => streaming_open_code($gates),
        'tls_skip_verify' => $tlsSkipVerify,
        'tls_fingerprint' => null,
    ];
    // The pinned certificate stays valid only for the same device
    if (streaming_needs_fingerprint($source) && $current !== null
        && streaming_url_endpoint((string) $current['url']) === streaming_url_endpoint($parsed['url'])) {
        $source['tls_fingerprint'] = streaming_normalize_fingerprint($current['tls_fingerprint'] ?? null);
    }
    return $source;
}

/* Read all sources with their gates, secrets included. Keyed by descr. */
function streaming_load_sources(\PDO $db): array
{
    $sources = [];
    $stmt = $db->query('SELECT * FROM `rest_cti_streaming` ORDER BY `descr`');
    foreach ($stmt->fetchAll(\PDO::FETCH_ASSOC) as $row) {
        $row['type'] = isset($row['type']) && $row['type'] !== '' ? $row['type'] : streaming_type_from_url((string) $row['url']);
        $row['user'] = (string) ($row['user'] ?? '');
        $row['secret'] = (string) ($row['secret'] ?? '');
        $row['tls_skip_verify'] = !empty($row['tls_skip_verify']);
        $row['tls_fingerprint'] = streaming_normalize_fingerprint($row['tls_fingerprint'] ?? null);
        $row['gates'] = [];
        $sources[$row['descr']] = $row;
    }
    $gatesTable = $db->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rest_cti_streaming_gates'")->fetchColumn();
    if ((int) $gatesTable > 0) {
        $stmt = $db->query('SELECT * FROM `rest_cti_streaming_gates` ORDER BY `source`, `position`, `id`');
        foreach ($stmt->fetchAll(\PDO::FETCH_ASSOC) as $gate) {
            if (isset($sources[$gate['source']])) {
                $sources[$gate['source']]['gates'][] = $gate;
            }
        }
    }
    return $sources;
}

/* A source as returned by the REST API: no secrets, only has_* flags */
function streaming_public_source(array $source): array
{
    $gates = [];
    foreach ($source['gates'] as $gate) {
        $gates[] = [
            'id' => (int) $gate['id'],
            'position' => (int) $gate['position'],
            'name' => (string) $gate['name'],
            'type' => (string) $gate['type'],
            'code' => $gate['type'] === 'dtmf' ? (string) $gate['code'] : null,
            'url' => $gate['type'] === 'url' ? (string) $gate['url'] : null,
            'method' => $gate['type'] === 'url' ? (string) $gate['method'] : null,
            'username' => $gate['type'] === 'url' ? (string) ($gate['username'] ?? '') : null,
            'has_password' => $gate['type'] === 'url' && (string) ($gate['password'] ?? '') !== '',
        ];
    }
    return [
        'descr' => (string) $source['descr'],
        'type' => (string) $source['type'],
        'url' => (string) $source['url'],
        'user' => (string) $source['user'],
        'has_secret' => (string) $source['secret'] !== '',
        'frame-rate' => isset($source['frame-rate']) ? (string) $source['frame-rate'] : null,
        'exten' => isset($source['exten']) ? (string) $source['exten'] : null,
        'open' => (string) ($source['open'] ?? ''),
        'gates' => $gates,
        'tls_skip_verify' => !empty($source['tls_skip_verify']),
        // Informative: SHA-256 of the device certificate trusted by the gateway
        'tls_fingerprint' => streaming_needs_fingerprint($source) ? streaming_normalize_fingerprint($source['tls_fingerprint'] ?? null) : null,
        'permission' => streaming_permission_name((string) $source['descr']),
        'gateway_path' => $source['type'] === 'rtsp' ? streaming_gateway_path((string) $source['descr']) : null,
    ];
}

/* Store the gates of a source, replacing the existing ones */
function streaming_save_gates(\PDO $db, string $descr, array $gates): void
{
    $keep = [];
    foreach ($gates as $gate) {
        if (!empty($gate['id'])) {
            $keep[] = (int) $gate['id'];
        }
    }
    if ($keep) {
        $placeholders = implode(',', array_fill(0, count($keep), '?'));
        $stmt = $db->prepare("DELETE FROM `rest_cti_streaming_gates` WHERE `source` = ? AND `id` NOT IN ($placeholders)");
        $stmt->execute(array_merge([$descr], $keep));
    } else {
        $stmt = $db->prepare('DELETE FROM `rest_cti_streaming_gates` WHERE `source` = ?');
        $stmt->execute([$descr]);
    }
    $update = $db->prepare('UPDATE `rest_cti_streaming_gates` SET `position` = ?, `name` = ?, `type` = ?, `code` = ?, `url` = ?, `method` = ?, `username` = ?, `password` = ? WHERE `id` = ? AND `source` = ?');
    $insert = $db->prepare('INSERT INTO `rest_cti_streaming_gates` (`source`, `position`, `name`, `type`, `code`, `url`, `method`, `username`, `password`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($gates as $position => $gate) {
        $values = [
            $position,
            $gate['name'],
            $gate['type'],
            $gate['code'],
            $gate['url'],
            $gate['method'] ?? 'GET',
            $gate['username'],
            $gate['password'],
        ];
        if (!empty($gate['id'])) {
            $update->execute(array_merge($values, [(int) $gate['id'], $descr]));
        } else {
            $insert->execute(array_merge([$descr], $values));
        }
    }
}

class StreamingConflictException extends \RuntimeException
{
}

class StreamingNotFoundException extends \RuntimeException
{
}

function streaming_normalize_profiles($profiles): array
{
    if ($profiles === null) {
        return [];
    }
    if (!is_array($profiles)) {
        throw new StreamingValidationException('profiles', 'profiles must be a list');
    }
    $result = [];
    foreach ($profiles as $profile) {
        if (!is_scalar($profile) || !preg_match('/^\d{1,10}$/', (string) $profile)) {
            throw new StreamingValidationException('profiles', 'invalid profile id');
        }
        $result[(int) $profile] = (int) $profile;
    }
    return array_values($result);
}

/*
 * Create ($currentDescr null) or update a source, its CTI permission
 * "vs_<name>" bound to the given profiles, and its gates, in one transaction.
 */
function streaming_store_source(\PDO $db, array $source, array $profiles, ?string $currentDescr = null): void
{
    $permission = streaming_permission_name($source['descr']);
    $ownTransaction = !$db->inTransaction();
    if ($ownTransaction) {
        $db->beginTransaction();
    }
    try {
        $findSource = $db->prepare('SELECT `descr` FROM `rest_cti_streaming` WHERE `descr` = ?');
        $findPermission = $db->prepare('SELECT `id` FROM `rest_cti_permissions` WHERE `name` = ?');
        $oldPermission = $currentDescr === null ? null : streaming_permission_name($currentDescr);

        if ($currentDescr !== null) {
            $findSource->execute([$currentDescr]);
            if ($findSource->fetchColumn() === false) {
                throw new StreamingNotFoundException("video source $currentDescr not found");
            }
        }
        if ($currentDescr === null || $currentDescr !== $source['descr']) {
            $findSource->execute([$source['descr']]);
            if ($findSource->fetchColumn() !== false) {
                throw new StreamingConflictException("video source {$source['descr']} already exists");
            }
        }
        if ($permission !== $oldPermission) {
            $findPermission->execute([$permission]);
            if ($findPermission->fetchColumn() !== false) {
                throw new StreamingConflictException("the name {$source['descr']} is too similar to the one of another video source");
            }
        }

        $permissionId = false;
        if ($oldPermission !== null) {
            $findPermission->execute([$oldPermission]);
            $permissionId = $findPermission->fetchColumn();
        }
        if ($permissionId === false) {
            $stmt = $db->prepare('INSERT INTO `rest_cti_permissions` (`name`, `displayname`, `description`) VALUES (?, ?, ?)');
            $stmt->execute([$permission, $source['descr'], 'Enable the video source for this profile']);
            $findPermission->execute([$permission]);
            $permissionId = $findPermission->fetchColumn();
            if ($permissionId === false) {
                throw new \RuntimeException('no permission stored for video source');
            }
            $stmt = $db->prepare('INSERT IGNORE INTO `rest_cti_macro_permissions_permissions` SELECT `id`, ? FROM `rest_cti_macro_permissions` WHERE `name` = ?');
            $stmt->execute([$permissionId, 'streaming']);
        } else {
            $stmt = $db->prepare('UPDATE `rest_cti_permissions` SET `name` = ?, `displayname` = ?, `description` = ? WHERE `id` = ?');
            $stmt->execute([$permission, $source['descr'], 'Enable the video source for this profile', $permissionId]);
        }

        $stmt = $db->prepare('DELETE FROM `rest_cti_profiles_permissions` WHERE `permission_id` = ?');
        $stmt->execute([$permissionId]);
        $stmt = $db->prepare('INSERT INTO `rest_cti_profiles_permissions` (`profile_id`, `permission_id`) VALUES (?, ?)');
        foreach ($profiles as $profile) {
            $stmt->execute([$profile, $permissionId]);
        }

        $values = [
            $source['descr'],
            $source['type'],
            $source['url'],
            $source['user'],
            $source['secret'],
            $source['frame-rate'],
            $source['exten'],
            $source['open'],
            empty($source['tls_skip_verify']) ? 0 : 1,
            streaming_needs_fingerprint($source) ? streaming_normalize_fingerprint($source['tls_fingerprint'] ?? null) : null,
        ];
        if ($currentDescr === null) {
            $stmt = $db->prepare('INSERT INTO `rest_cti_streaming` (`descr`, `type`, `url`, `user`, `secret`, `frame-rate`, `exten`, `open`, `tls_skip_verify`, `tls_fingerprint`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute($values);
        } else {
            $stmt = $db->prepare('UPDATE `rest_cti_streaming` SET `descr` = ?, `type` = ?, `url` = ?, `user` = ?, `secret` = ?, `frame-rate` = ?, `exten` = ?, `open` = ?, `tls_skip_verify` = ?, `tls_fingerprint` = ? WHERE `descr` = ?');
            $stmt->execute(array_merge($values, [$currentDescr]));
            if ($currentDescr !== $source['descr']) {
                $stmt = $db->prepare('UPDATE `rest_cti_streaming_gates` SET `source` = ? WHERE `source` = ?');
                $stmt->execute([$source['descr'], $currentDescr]);
            }
        }
        streaming_save_gates($db, $source['descr'], $source['gates']);
        if ($ownTransaction) {
            $db->commit();
        }
    } catch (\Throwable $e) {
        if ($ownTransaction && $db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
}

/* Delete a source, its gates and its CTI permission */
function streaming_delete_source(\PDO $db, string $descr): void
{
    $ownTransaction = !$db->inTransaction();
    if ($ownTransaction) {
        $db->beginTransaction();
    }
    try {
        $stmt = $db->prepare('DELETE FROM `rest_cti_permissions` WHERE `name` = ?');
        $stmt->execute([streaming_permission_name($descr)]);
        $stmt = $db->prepare('DELETE FROM `rest_cti_streaming_gates` WHERE `source` = ?');
        $stmt->execute([$descr]);
        $stmt = $db->prepare('DELETE FROM `rest_cti_streaming` WHERE `descr` = ?');
        $stmt->execute([$descr]);
        if ($ownTransaction) {
            $db->commit();
        }
    } catch (\Throwable $e) {
        if ($ownTransaction && $db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
}

/*
 * Content of /etc/nethcti/streaming.json, keyed by permission name.
 *
 * Every legacy key read by nethcti-server is kept. "user" and "secret" stay
 * empty because nethcti-server returns them to the CTI clients; the URL of a
 * RTSP source is empty so that the legacy JPEG polling never touches it.
 * The new keys are read by nethcti-server from NethVoice 1.9 (phase 2).
 */
function streaming_cti_config(array $sources): array
{
    $out = [];
    foreach ($sources as $source) {
        $permission = streaming_permission_name((string) $source['descr']);
        $isRtsp = $source['type'] === 'rtsp';
        $gates = [];
        foreach ($source['gates'] as $gate) {
            $entry = [
                'id' => (string) $gate['id'],
                'name' => (string) $gate['name'],
                'type' => (string) $gate['type'],
            ];
            if ($gate['type'] === 'dtmf') {
                $entry['code'] = (string) $gate['code'];
            } else {
                $entry['url'] = (string) $gate['url'];
                $entry['method'] = (string) $gate['method'];
                $entry['username'] = (string) ($gate['username'] ?? '');
                $entry['password'] = (string) ($gate['password'] ?? '');
            }
            $gates[] = $entry;
        }
        $out[$permission] = [
            'descr' => (string) $source['descr'],
            'url' => $isRtsp ? '' : (string) $source['url'],
            'user' => '',
            'secret' => '',
            'frame-rate' => isset($source['frame-rate']) ? (string) $source['frame-rate'] : '1000',
            'exten' => isset($source['exten']) ? (string) $source['exten'] : null,
            'open' => streaming_open_code($source['gates']),
            'type' => $isRtsp ? 'rtsp' : 'image',
            'gateway_path' => $isRtsp ? streaming_gateway_path((string) $source['descr']) : null,
            'image_auth' => (!$isRtsp && $source['user'] !== '') ? ['username' => $source['user'], 'password' => $source['secret']] : null,
            // Snapshot (image source) and URL gate requests of this source only
            'tls_skip_verify' => !empty($source['tls_skip_verify']),
            'gates' => $gates,
        ];
    }
    return $out;
}

function streaming_yaml_string(string $value): string
{
    return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

/*
 * Settings of the gateway that come from the module environment. Return null
 * when a mandatory one is missing (ports not allocated).
 */
function streaming_gateway_settings(array $env): ?array
{
    $ports = [];
    foreach (['MEDIAMTX_WHEP_PORT', 'MEDIAMTX_API_PORT', 'MEDIAMTX_RTSP_PORT', 'MEDIAMTX_ICE_UDP_PORT', 'MEDIAMTX_ICE_TCP_PORT', 'NETHCTI_INTERNAL_REST_PORT9'] as $name) {
        $value = (string) ($env[$name] ?? '');
        if (!preg_match('/^\d{1,5}$/', $value) || (int) $value < 1 || (int) $value > 65535) {
            return null;
        }
        $ports[$name] = (int) $value;
    }
    $hosts = [];
    foreach (explode(',', (string) ($env['MEDIAMTX_ICE_HOSTS'] ?? '')) as $host) {
        $host = trim($host);
        if ($host !== '' && preg_match('/^[a-zA-Z0-9.:_-]+$/', $host) && !in_array($host, $hosts, true)) {
            $hosts[] = $host;
        }
    }
    return [
        'whep_port' => $ports['MEDIAMTX_WHEP_PORT'],
        'api_port' => $ports['MEDIAMTX_API_PORT'],
        'rtsp_port' => $ports['MEDIAMTX_RTSP_PORT'],
        'ice_udp_port' => $ports['MEDIAMTX_ICE_UDP_PORT'],
        'ice_tcp_port' => $ports['MEDIAMTX_ICE_TCP_PORT'],
        'auth_url' => 'http://127.0.0.1:' . $ports['NETHCTI_INTERNAL_REST_PORT9'] . '/mediamtx/auth',
        'ice_hosts' => $hosts,
    ];
}

/*
 * The complete MediaMTX configuration: fixed security settings, the
 * listeners from the module environment and one on-demand path per RTSP
 * source. This file is the only source of truth of the gateway: changes made
 * through the MediaMTX API are lost at restart.
 */
function streaming_mediamtx_config(array $sources, array $settings): string
{
    $lines = [
        '# Generated by NethVoice (nethcti3 module) from the video sources: do not edit.',
        '# Rewritten at every FreePBX reload and start; MediaMTX reloads it on change.',
        'logLevel: info',
        'logDestinations: [stdout]',
        '',
        '# Every viewer, local readers included, is authorized by nethcti-server',
        'authMethod: http',
        'authHTTPAddress: ' . streaming_yaml_string($settings['auth_url']),
        'authHTTPExclude:',
        '  - action: api',
        '  - action: metrics',
        '  - action: pprof',
        '',
        '# The control API returns the source passwords: loopback only, never routed',
        'api: true',
        'apiAddress: ' . streaming_yaml_string('127.0.0.1:' . $settings['api_port']),
        'metrics: false',
        'pprof: false',
        'playback: false',
        'rtmp: false',
        'srt: false',
        'moq: false',
        'hls: false',
        '',
        '# RTSP server for local readers (snapshots) only',
        'rtsp: true',
        'rtspTransports: [tcp]',
        'rtspEncryption: "no"',
        'rtspAddress: ' . streaming_yaml_string('127.0.0.1:' . $settings['rtsp_port']),
        '',
        '# WHEP behind traefik (https://<CTI host>/' . STREAMING_GATEWAY_PREFIX . '/...), ICE reached directly',
        'webrtc: true',
        'webrtcAddress: ' . streaming_yaml_string('127.0.0.1:' . $settings['whep_port']),
        'webrtcEncryption: false',
        'webrtcAllowOrigins: ["*"]',
        'webrtcTrustedProxies: ["127.0.0.1"]',
        'webrtcLocalUDPAddress: ' . streaming_yaml_string(':' . $settings['ice_udp_port']),
        'webrtcLocalTCPAddress: ' . streaming_yaml_string(':' . $settings['ice_tcp_port']),
    ];
    if ($settings['ice_hosts']) {
        $lines[] = 'webrtcIPsFromInterfaces: false';
        $lines[] = 'webrtcAdditionalHosts: [' . implode(', ', array_map('streaming_yaml_string', $settings['ice_hosts'])) . ']';
    } else {
        $lines[] = 'webrtcIPsFromInterfaces: true';
        $lines[] = 'webrtcAdditionalHosts: []';
    }
    $lines = array_merge($lines, [
        'webrtcICEServers2: []',
        '',
        '# Devices are pulled only while somebody watches, always over TCP',
        'pathDefaults:',
        '  sourceOnDemand: true',
        '  sourceOnDemandStartTimeout: 10s',
        '  sourceOnDemandCloseAfter: 10s',
        '  rtspTransport: tcp',
        '',
    ]);
    $paths = [];
    foreach ($sources as $source) {
        if ($source['type'] !== 'rtsp') {
            continue;
        }
        $paths[streaming_gateway_path((string) $source['descr'])] = [
            'url' => streaming_url_with_credentials((string) $source['url'], (string) $source['user'], (string) $source['secret']),
            // Without a fingerprint the device certificate is verified
            // (system CA store, host name)
            'fingerprint' => streaming_needs_fingerprint($source) ? streaming_normalize_fingerprint($source['tls_fingerprint'] ?? null) : null,
        ];
    }
    ksort($paths);
    if ($paths) {
        $lines[] = 'paths:';
        foreach ($paths as $name => $path) {
            $lines[] = '  ' . streaming_yaml_string($name) . ':';
            $lines[] = '    source: ' . streaming_yaml_string($path['url']);
            if ($path['fingerprint'] !== null) {
                $lines[] = '    sourceFingerprint: ' . streaming_yaml_string($path['fingerprint']);
            }
        }
    } else {
        $lines[] = 'paths: {}';
    }
    return implode("\n", $lines) . "\n";
}

/*
 * Replace a file atomically (temporary file in the same directory + rename),
 * so that a reader never sees a partial file. Skip the write when the
 * content is unchanged. Return true on success.
 */
function streaming_write_file_atomic(string $path, string $content, int $mode = 0640, ?string $owner = null): bool
{
    if (is_file($path) && @file_get_contents($path) === $content) {
        @chmod($path, $mode);
        return true;
    }
    $dir = dirname($path);
    $tmp = @tempnam($dir, '.' . basename($path) . '.');
    if ($tmp === false) {
        return false;
    }
    if (dirname($tmp) !== (realpath($dir) ?: $dir)) {
        // tempnam() fell back to the system temporary directory: a rename
        // from there would not be atomic
        @unlink($tmp);
        return false;
    }
    // tempnam() creates the file with mode 0600: the content is not exposed
    if (@file_put_contents($tmp, $content) !== strlen($content) || !@chmod($tmp, $mode)) {
        @unlink($tmp);
        return false;
    }
    if ($owner !== null && function_exists('posix_geteuid') && posix_geteuid() === 0) {
        // Written by root (e.g. a reload from the container entrypoint)
        @chown($tmp, $owner);
        @chgrp($tmp, $owner);
    }
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

/*
 * Run a command without a shell. Return [exit code, stdout, stderr, timed out].
 * The command is killed after $timeout seconds.
 */
function streaming_run(array $command, int $timeout): array
{
    $pipes = [];
    $process = @proc_open($command, [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) {
        return [127, '', 'cannot run ' . $command[0], false];
    }
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);
    $stdout = '';
    $stderr = '';
    $timedOut = false;
    $deadline = microtime(true) + $timeout;
    while (true) {
        $read = [];
        foreach ([1, 2] as $fd) {
            if (!feof($pipes[$fd])) {
                $read[] = $pipes[$fd];
            }
        }
        if (!$read) {
            break;
        }
        $left = $deadline - microtime(true);
        if ($left <= 0) {
            $timedOut = true;
            proc_terminate($process, 9);
            break;
        }
        $write = null;
        $except = null;
        if (@stream_select($read, $write, $except, (int) $left, (int) (($left - (int) $left) * 1000000)) === false) {
            break;
        }
        foreach ($read as $stream) {
            $chunk = fread($stream, 65536);
            if ($chunk === false) {
                continue;
            }
            if ($stream === $pipes[1]) {
                // A snapshot is small: never buffer more than 16 MB
                if (strlen($stdout) < 16777216) {
                    $stdout .= $chunk;
                }
            } elseif (strlen($stderr) < 65536) {
                $stderr .= $chunk;
            }
        }
    }
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($process);
    return [$timedOut ? 124 : $exit, $stdout, $stderr, $timedOut];
}

/* Machine-readable reason of a failed probe, from the ffmpeg/curl message */
function streaming_failure_reason(string $message, bool $timedOut = false): string
{
    if ($timedOut) {
        return 'timeout';
    }
    $rules = [
        // ffmpeg (OpenSSL) and curl messages of an untrusted certificate
        'tls_error' => '/certificate verify failed|ssl certificate problem|self[- ]signed certificate|unable to get local issuer|certificate has expired|no alternative certificate subject name|certificate subject name .* does not match|fingerprint does not match/i',
        'auth_failed' => '/\b40[13]\b|unauthori[sz]ed|forbidden|authentication|authorization/i',
        'not_found' => '/\b404\b|not found|no such file|454 session not found/i',
        'connection_refused' => '/connection refused|couldn\'t connect|could not connect|failed to connect/i',
        'timeout' => '/timed? ?out|timeout|operation timed out/i',
        'unsupported' => '/invalid data|protocol not found|unsupported|no video stream|decoder .*not found|not supported|could not find codec|461 /i',
    ];
    foreach ($rules as $reason => $pattern) {
        if (preg_match($pattern, $message)) {
            return $reason;
        }
    }
    return 'unknown';
}

/* Codec warnings for a detected video codec */
function streaming_codec_warnings(?string $videoCodec): array
{
    if ($videoCodec === null) {
        return [];
    }
    if ($videoCodec === 'hevc') {
        // H.265 over WebRTC plays only in some browsers
        return ['h265'];
    }
    if (!in_array($videoCodec, STREAMING_WEBRTC_VIDEO_CODECS, true)) {
        return ['codec_not_supported_by_webrtc'];
    }
    return [];
}

function streaming_probe_result(string $type, bool $success, ?string $reason = null, string $message = ''): array
{
    return [
        'success' => $success,
        'type' => $type,
        'image' => null,
        'mime' => null,
        'video' => null,
        'audio' => null,
        'h265' => false,
        'warnings' => [],
        'reason' => $reason,
        'message' => $message,
        // SHA-256 of the device certificate, read when the verification is skipped
        'tls_fingerprint' => null,
    ];
}

/*
 * Check of a stored source whose rtsps:// certificate is pinned: warn when the
 * device now presents another certificate (or none was pinned), because the
 * gateway refuses it until the source is saved again.
 */
function streaming_tls_check_warnings(array $result, ?array $stored, string $url): array
{
    if (empty($result['success']) || ($result['tls_fingerprint'] ?? null) === null || $stored === null
        || !streaming_needs_fingerprint($stored)
        || streaming_url_endpoint((string) $stored['url']) !== streaming_url_endpoint($url)) {
        return $result;
    }
    if (streaming_normalize_fingerprint($stored['tls_fingerprint'] ?? null) !== $result['tls_fingerprint']) {
        $result['warnings'][] = 'tls_certificate_changed';
    }
    return $result;
}

/*
 * Probe a RTSP source: codecs with ffprobe, then one JPEG frame with ffmpeg.
 * The device is contacted directly (not through the gateway) to report the
 * specific reason of a failure.
 *
 * rtsps://: ffmpeg does not verify certificates by default, "-tls_verify 1"
 * verifies the chain against the system CA store (OpenSSL default paths of
 * the image) and the host name or IP address of the URL. With
 * $tlsSkipVerify the verification is off and the fingerprint of the device
 * certificate, the one the gateway would pin, is returned.
 */
function streaming_probe_rtsp(string $url, string $user, string $secret, bool $tlsSkipVerify = false, ?callable $run = null, ?callable $fetch = null): array
{
    $run = $run ?? 'streaming_run';
    $parsed = streaming_parse_url($url);
    if ($parsed === null || $parsed['type'] !== 'rtsp') {
        return streaming_probe_result('rtsp', false, 'unsupported', 'invalid RTSP URL');
    }
    $target = streaming_url_with_credentials($parsed['url'], $user, $secret);
    $tlsOptions = $parsed['scheme'] === 'rtsps' ? ['-tls_verify', $tlsSkipVerify ? '0' : '1'] : [];
    $fingerprint = null;
    if ($tlsSkipVerify && $parsed['scheme'] === 'rtsps') {
        [$fingerprint] = ($fetch ?? 'streaming_fetch_fingerprint')($parsed['url']);
        $fingerprint = streaming_normalize_fingerprint($fingerprint);
    }

    [$exit, $stdout, $stderr, $timedOut] = $run(array_merge([
        'ffprobe', '-hide_banner', '-v', 'error',
        '-rtsp_transport', 'tcp', '-timeout', '5000000',
    ], $tlsOptions, [
        '-show_entries', 'stream=codec_type,codec_name,width,height,sample_rate',
        '-of', 'json', $target,
    ]), 12);
    $message = trim(str_replace($target, $parsed['url'], $stderr));
    if ($exit !== 0) {
        return streaming_probe_result('rtsp', false, streaming_failure_reason($message, $timedOut), $message);
    }
    $info = json_decode($stdout, true);
    $result = streaming_probe_result('rtsp', true);
    $result['tls_fingerprint'] = $fingerprint;
    foreach ((is_array($info) && isset($info['streams']) && is_array($info['streams'])) ? $info['streams'] : [] as $stream) {
        if (($stream['codec_type'] ?? '') === 'video' && $result['video'] === null) {
            $result['video'] = [
                'codec' => (string) ($stream['codec_name'] ?? 'unknown'),
                'width' => isset($stream['width']) ? (int) $stream['width'] : null,
                'height' => isset($stream['height']) ? (int) $stream['height'] : null,
            ];
        } elseif (($stream['codec_type'] ?? '') === 'audio' && $result['audio'] === null) {
            $result['audio'] = [
                'codec' => (string) ($stream['codec_name'] ?? 'unknown'),
                'sample_rate' => isset($stream['sample_rate']) ? (int) $stream['sample_rate'] : null,
            ];
        }
    }
    if ($result['video'] === null) {
        $result['success'] = false;
        $result['reason'] = 'unsupported';
        $result['message'] = 'no video stream';
        return $result;
    }
    $result['warnings'] = streaming_codec_warnings($result['video']['codec']);
    $result['h265'] = in_array('h265', $result['warnings'], true);

    [$exit, $stdout, $stderr, $timedOut] = $run(array_merge([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin',
        '-rtsp_transport', 'tcp', '-timeout', '5000000',
    ], $tlsOptions, [
        '-probesize', '32k', '-analyzeduration', '0', '-fflags', 'nobuffer',
        // decode only key frames: the first frame is never a broken one
        '-skip_frame', 'nokey',
        '-i', $target, '-an', '-frames:v', '1', '-q:v', '5',
        '-f', 'mjpeg', 'pipe:1',
    ]), 12);
    if ($exit === 0 && $stdout !== '') {
        $result['image'] = chunk_split(base64_encode($stdout));
        $result['mime'] = 'image/jpeg';
    } else {
        // The stream is valid, only the preview is missing
        $result['warnings'][] = 'preview_failed';
        $result['message'] = trim(str_replace($target, $parsed['url'], $stderr));
    }
    return $result;
}

/*
 * Fetch a JPEG from a HTTP image source, with optional credentials. The
 * https:// certificate is verified (CA store and host name) unless
 * $tlsSkipVerify.
 */
function streaming_probe_image(string $url, string $user, string $secret, bool $tlsSkipVerify = false): array
{
    $parsed = streaming_parse_url($url);
    if ($parsed === null || $parsed['type'] !== 'image') {
        return streaming_probe_result('image', false, 'unsupported', 'invalid image URL');
    }
    $curl = curl_init($parsed['url']);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => !$tlsSkipVerify,
        CURLOPT_SSL_VERIFYHOST => $tlsSkipVerify ? 0 : 2,
    ]);
    if ($user !== '') {
        curl_setopt($curl, CURLOPT_HTTPAUTH, CURLAUTH_ANY);
        curl_setopt($curl, CURLOPT_USERPWD, $user . ':' . $secret);
    }
    $body = curl_exec($curl);
    $errno = curl_errno($curl);
    $error = curl_error($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $mime = (string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
    curl_close($curl);
    if ($body === false) {
        if (in_array($errno, [51, 60], true)) {
            // CURLE_PEER_FAILED_VERIFICATION (51 before curl 7.62, then 60)
            $reason = 'tls_error';
        } else {
            $reason = $errno === CURLE_OPERATION_TIMEDOUT ? 'timeout' : ($errno === CURLE_COULDNT_CONNECT ? 'connection_refused' : streaming_failure_reason($error));
        }
        return streaming_probe_result('image', false, $reason, $error);
    }
    if ($status === 401 || $status === 403) {
        return streaming_probe_result('image', false, 'auth_failed', "HTTP $status");
    }
    if ($status === 404) {
        return streaming_probe_result('image', false, 'not_found', "HTTP $status");
    }
    if ($status < 200 || $status >= 300) {
        return streaming_probe_result('image', false, 'unknown', "HTTP $status");
    }
    if (stripos($mime, 'image/') !== 0 && strpos((string) $body, '<!DOCTYPE html PUBLIC') !== false) {
        return streaming_probe_result('image', false, 'unsupported', 'the URL does not return an image');
    }
    $result = streaming_probe_result('image', true);
    $result['image'] = chunk_split(base64_encode((string) $body));
    $result['mime'] = stripos($mime, 'image/') === 0 ? strtok($mime, ';') : 'image/jpeg';
    return $result;
}
