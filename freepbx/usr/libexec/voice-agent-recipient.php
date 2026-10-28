<?php
// Private, read-only recipient lookup; deliberately outside the public web root.
ini_set('display_errors', '0');
header('Content-Type: application/json');
header('Cache-Control: no-store');
$started = microtime(true);
$token = getenv('VOICE_AGENT_RECIPIENT_TOKEN');
$port = getenv('NETHVOICE_RECIPIENT_SERVICE_PORT');
if (!$token || strlen($token) < 32 || !$port
    || ($_SERVER['SERVER_PORT'] ?? '') !== $port
    || ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1'
    || !hash_equals('Bearer '.$token, $_SERVER['HTTP_AUTHORIZATION'] ?? '')) {
    http_response_code(403);
    echo '{"error":"forbidden"}';
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET'
    || !preg_match('~\A/v1/recipients/([0-9]{1,20})\z~D', $_SERVER['REQUEST_URI'] ?? '', $match)
    || !empty($_SERVER['CONTENT_LENGTH']) || !empty($_SERVER['HTTP_TRANSFER_ENCODING'])) {
    http_response_code(400);
    echo '{"error":"invalid_request"}';
    exit;
}
try {
    require_once '/var/www/html/freepbx/rest/lib/libCTI.php';
    require_once '/var/www/html/freepbx/rest/lib/libExtensions.php';
    $main = getMainExtensionUser($match[1]);
    $user = $main ? getCTIUserPermission($main['id'], 'nethvoice_cti', 'chat') : null;
    if (!$user || !preg_match('/\A[a-z0-9][a-z0-9._-]{0,63}\z/D', $user['username'])
        || $user['username'] === 'voice-agent-assistant') {
        http_response_code(404);
        echo '{"error":"recipient_not_found"}';
        exit;
    }
    $presence = getMainExtensionPresence($match[1]);
    if (microtime(true) - $started > 2) throw new RuntimeException('stale_presence');
    echo json_encode(['version'=>1, 'recipient_id'=>$user['username'],
        'mainextension'=>$match[1], 'chat_allowed'=>$user['allowed'],
        'observed_at'=>gmdate('Y-m-d\TH:i:s\Z', (int)$started)] + $presence, JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    http_response_code(503);
    echo '{"error":"recipient_unavailable"}';
}
