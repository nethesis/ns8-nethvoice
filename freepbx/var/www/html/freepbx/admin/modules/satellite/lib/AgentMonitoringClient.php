<?php
/** Bounded private monitoring transport, with safe HTTP errors only. */
class AgentMonitoringClient
{
    public function request($method, $path, $query = array(), $actor = null)
    {
        if (!in_array($method, array('GET', 'DELETE'), true) ||
            !preg_match('#^/(overview|health|agents|runs(?:/[A-Za-z0-9_.:-]{1,128}(?:/(events|transcript))?)?)$#D', $path)) {
            throw new \InvalidArgumentException('invalid_operation');
        }
        $port = getenv('SATELLITE_HTTP_PORT'); $token = getenv('SATELLITE_API_TOKEN');
        if (!ctype_digit((string) $port) || (int) $port < 1 || (int) $port > 65535 || !$token) {
            throw new \RuntimeException('monitoring_unavailable', 503);
        }
        $url = 'http://127.0.0.1:' . $port . '/api/agent/v1/monitoring' . $path;
        if ($query) { $url .= '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986); }
        $headers = array('Authorization: Bearer ' . $token, 'Accept: application/json');
        if ($actor !== null) {
            if (!preg_match('/^[A-Za-z0-9_.@-]{1,128}$/D', $actor)) { throw new \InvalidArgumentException('invalid_actor'); }
            $headers[] = 'X-Monitoring-Actor: ' . $actor;
        }
        $body = ''; $curl = curl_init($url);
        curl_setopt_array($curl, array(CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROXY => '', CURLOPT_MAXREDIRS => 0,
            CURLOPT_WRITEFUNCTION => function ($handle, $chunk) use (&$body) {
                if (strlen($body) + strlen($chunk) > 2 * 1024 * 1024) { return 0; }
                $body .= $chunk; return strlen($chunk);
            }));
        $ok = curl_exec($curl); $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if ($ok === false || $status < 200 || $status >= 300) {
            $safe = in_array($status, array(400, 404, 422), true) ? $status : 503;
            throw new \RuntimeException($safe === 404 ? 'run_not_found' : ($safe === 503 ? 'monitoring_unavailable' : 'invalid_query'), $safe);
        }
        $value = json_decode($body, true, 32);
        if (!is_array($value)) { throw new \RuntimeException('monitoring_unavailable', 503); }
        return $value;
    }
}
