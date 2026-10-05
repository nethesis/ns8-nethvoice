<?php
/** Fixed private workflow surface; errors carry only safe codes and node IDs. */
class AgentWorkflowException extends \RuntimeException
{
    public $nodeId;
    public function __construct($code, $status, $nodeId = null) { parent::__construct($code, $status); $this->nodeId = $nodeId; }
}
class AgentWorkflowClient
{
    public function request($method, $path, $actor, $input = null)
    {
        $id = '[a-z][a-z0-9_-]{0,47}'; $run = '[A-Za-z0-9_-]{1,128}';
        $routes = array(
            'GET' => '#^/(inventory|catalog|jobs/[a-f0-9]{32}|definitions/(agent|subflow)/' . $id . '/versions/[1-9][0-9]{0,5}|runs/' . $run . ')$#D',
            'PUT' => '#^/(definitions/(agent|subflow)/' . $id . '|data/' . $id . ')$#D',
            'POST' => '#^/(validate|test|definitions/(agent|subflow)/' . $id . '/(publish|activate)|data/preview|data/' . $id . '/(publish|refresh)|runs/' . $run . '/cancel)$#D',
            'DELETE' => '#^/data/' . $id . '/versions/[1-9][0-9]{0,5}$#D');
        if (!isset($routes[$method]) || !preg_match($routes[$method], $path) || !preg_match('/^[A-Za-z0-9_.@-]{1,128}$/D', $actor)) {
            throw new \InvalidArgumentException('invalid_operation');
        }
        $port = getenv('SATELLITE_HTTP_PORT'); $token = getenv('SATELLITE_API_TOKEN');
        if (!ctype_digit((string) $port) || (int) $port < 1 || (int) $port > 65535 || !$token) {
            throw new \RuntimeException('workflows_unavailable', 503);
        }
        $large = preg_match('#^/data/(preview|' . $id . '/publish)$#D', $path);
        $payload = $input === null ? null : json_encode($input, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($payload === false || ($payload !== null && strlen($payload) > ($large ? 14 * 1024 * 1024 : 262144))) {
            throw new \InvalidArgumentException('invalid_request');
        }
        $body = ''; $curl = curl_init('http://127.0.0.1:' . $port . '/api/agent/v1/application/workflows' . $path);
        $options = array(CURLOPT_CUSTOMREQUEST => $method, CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 30,
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROXY => '', CURLOPT_MAXREDIRS => 0,
            CURLOPT_HTTPHEADER => array('Authorization: Bearer ' . $token, 'X-Agents-Actor: ' . $actor, 'Content-Type: application/json', 'Accept: application/json'),
            CURLOPT_WRITEFUNCTION => function ($handle, $chunk) use (&$body) {
                if (strlen($body) + strlen($chunk) > 16 * 1024 * 1024) { return 0; }
                $body .= $chunk; return strlen($chunk);
            });
        if ($payload !== null) { $options[CURLOPT_POSTFIELDS] = $payload; }
        curl_setopt_array($curl, $options); $ok = curl_exec($curl); $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE); curl_close($curl);
        $value = json_decode($body, true, 48);
        if ($ok === false || $status < 200 || $status >= 300) {
            $status = in_array($status, array(400,403,404,409,413,422,429), true) ? $status : 503;
            $code = is_array($value) && preg_match('/^[a-z_]{1,64}$/D', $value['error'] ?? '') ? $value['error'] : 'workflows_unavailable';
            $node = is_array($value) && preg_match('/^[a-z][a-z0-9_-]{0,47}$/D', $value['node_id'] ?? '') ? $value['node_id'] : null;
            throw new AgentWorkflowException($code, $status, $node);
        }
        if (!is_array($value)) { throw new \RuntimeException('workflows_unavailable', 503); }
        return $value;
    }
}
