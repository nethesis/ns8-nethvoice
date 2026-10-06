<?php
// Supply Satellite workflows with company contacts (pbx.contacts) and answered
// call history (pbx.history), using a read-only phonebook/CDR database account.
// Accept only local POST requests authenticated with the Satellite bearer token.
header('Content-Type: application/json'); header('Cache-Control: no-store');
$token = getenv('SATELLITE_PBX_DATA_TOKEN');
// Apache can expose Authorization only through the original request headers.
$headers = function_exists('getallheaders') ? array_change_key_case(getallheaders(), CASE_LOWER) : array();
$authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? ($headers['authorization'] ?? '');
if (isset($_SERVER['HTTP_X_FORWARDED_FOR']) || isset($_SERVER['HTTP_X_FORWARDED_HOST']) || isset($_SERVER['HTTP_X_REAL_IP']) ||
    $_SERVER['REQUEST_METHOD'] !== 'POST' || !in_array($_SERVER['REMOTE_ADDR'] ?? '', array('127.0.0.1', '::1'), true) ||
    !$token || !hash_equals('Bearer ' . $token, $authorization)) { http_response_code(403); echo '{"error":"forbidden"}'; exit; }
try {
    if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) { throw new \InvalidArgumentException(); }
    $raw = file_get_contents('php://input', false, null, 0, 32769);
    if (strlen($raw) > 32768) { throw new \InvalidArgumentException(); }
    $input = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
    if (!is_array($input) || !isset($input['operation'], $input['input'], $input['settings'])) { throw new \InvalidArgumentException(); }
    $password = getenv('SATELLITE_WORKFLOW_DB_PASSWORD');
    $port = getenv('NETHVOICE_MARIADB_PORT');
    if (!$password || !ctype_digit((string) $port)) { throw new \RuntimeException(); }
    $db = new PDO('mysql:host=127.0.0.1;port=' . $port . ';dbname=phonebook;charset=utf8mb4', 'satellite_workflow', $password,
        array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3));
    $db->exec('SET SESSION max_statement_time=3');
    require_once __DIR__ . '/../../../../rest/lib/AgentWorkflowData.php';
    $data = new AgentWorkflowData($db);
    if ($input['operation'] === 'pbx.contacts') {
        $result = $data->contacts($input['input']['phone'] ?? '');
    } elseif ($input['operation'] === 'pbx.history') {
        $result = $data->history($input['input']['numbers'] ?? array(), $input['settings']['support_extensions'] ?? array(), $input['settings']['lookback_days'] ?? 90);
    } else { throw new \InvalidArgumentException(); }
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (\InvalidArgumentException $error) { http_response_code(400); echo '{"error":"invalid_request"}'; }
catch (\Throwable $error) { http_response_code(503); echo '{"error":"pbx_data_unavailable"}'; }
