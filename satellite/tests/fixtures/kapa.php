<?php
// Optional test-image fixture. It never reads PBX data or forwards a request.
header('Content-Type: application/json');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST' ||
    !hash_equals('phase5-dummy-only', $_SERVER['HTTP_X_API_KEY'] ?? '')) {
    http_response_code(403); echo '{"error":"forbidden"}'; exit;
}
$raw = file_get_contents('php://input', false, null, 0, 32769);
$input = json_decode($raw, true);
if (strlen($raw) > 32768 || !is_array($input) || !is_string($input['query'] ?? null)) {
    http_response_code(400); echo '{"error":"invalid_request"}'; exit;
}
echo json_encode(['synthetic' => true, 'documents' => [[
    'title' => 'Phase 5 synthetic support documentation',
    'content' => 'This is a dummy answer for a controlled test. For an unregistered SIP phone, verify the configured server, username and network connection. If registration still fails, collect the error and open a support ticket. No real diagnostic or repair has been performed.',
]]]);
