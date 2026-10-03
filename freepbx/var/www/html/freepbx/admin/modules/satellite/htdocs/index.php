<?php
// This public endpoint bypasses the admin login; provider signatures are mandatory.
ini_set('display_errors', '0');
header('Content-Type: application/json');
header('Cache-Control: no-store');
function agent_webhook_response($code, $result) { http_response_code($code); echo json_encode($result); exit; }
if (!in_array(parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '', PHP_URL_PATH),
    array('/freepbx/satellite/index.php', '/satellite/index.php'), true)) {
    agent_webhook_response(404, array('error' => 'Not found'));
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Allow: POST'); agent_webhook_response(405, array('error' => 'POST required')); }
if (isset($_SERVER['CONTENT_LENGTH']) && (int) $_SERVER['CONTENT_LENGTH'] > 262144) { agent_webhook_response(413, array('error' => 'Payload too large')); }
$body = file_get_contents('php://input', false, null, 0, 262145);
if ($body === false || strlen($body) > 262144) { agent_webhook_response(413, array('error' => 'Payload too large')); }
$headers = array();
foreach (array('id', 'timestamp', 'signature') as $name) {
    $key = 'HTTP_WEBHOOK_' . strtoupper($name);
    $headers['webhook-' . $name] = isset($_SERVER[$key]) ? $_SERVER[$key] : '';
}
try {
    $bootstrap_settings['freepbx_error_handler'] = false;
    define('FREEPBX_IS_AUTH', 1);
    require_once '/etc/freepbx.conf';
    require_once dirname(__DIR__) . '/lib/AgentWebhookVerifier.php';
    require_once dirname(__DIR__) . '/lib/AgentTrunkRepository.php';
    require_once dirname(__DIR__) . '/lib/AgentSatelliteClient.php';
    $repository = new AgentTrunkRepository(FreePBX::Database());
    $matches = array();
    foreach ($repository->webhookVerificationBindings() as $trunk) {
        try {
            AgentWebhookVerifier::verify($trunk['webhook_secret'], $body, $headers);
            $matches[] = $trunk;
        } catch (\InvalidArgumentException $invalid) { }
    }
    if (!$matches) { agent_webhook_response(401, array('error' => 'Invalid webhook authentication')); }
    // A provider project may have several API-key bindings; Satellite correlates
    // the authenticated event to a pre-existing pending call. Never create a call here.
    $client = new AgentSatelliteClient();
    foreach ($matches as $trunk) {
        $result = $client->request('POST', '/provider-events/' . $trunk['provider'],
            array('binding_id' => (string) $trunk['id'], 'raw_body' => base64_encode($body), 'headers' => $headers));
        if (isset($result['status']) && in_array($result['status'], array('accepted', 'duplicate'), true)) {
            agent_webhook_response(200, $result);
        }
    }
    agent_webhook_response(200, array('status' => 'ignored'));
} catch (\Throwable $error) { agent_webhook_response(503, array('error' => 'Agent service unavailable')); }
