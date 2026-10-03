<?php
/** Local-only control plane. Never return upstream error bodies containing credentials. */
class AgentSatelliteClient
{
    public function request($method, $path, $body = null)
    {
        $port = getenv('SATELLITE_HTTP_PORT');
        $token = getenv('SATELLITE_API_TOKEN');
        if (!ctype_digit((string) $port) || (int) $port < 1 || (int) $port > 65535 || !$token) {
            throw new \RuntimeException('Satellite Agent local connection is not configured');
        }
        $curl = curl_init('http://127.0.0.1:' . $port . '/api/agent/v1' . $path);
        $headers = array('Authorization: Bearer ' . $token, 'Content-Type: application/json');
        $options = array(CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROXY => '', CURLOPT_MAXREDIRS => 0);
        if ($body !== null) {
            $options[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }
        curl_setopt_array($curl, $options);
        $response = curl_exec($curl);
        $code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if ($response === false || $code < 200 || $code >= 300) {
            throw new \RuntimeException('Satellite Agent request failed (HTTP ' . (int) $code . ')');
        }
        $result = json_decode($response, true);
        if (!is_array($result)) {
            throw new \RuntimeException('Satellite Agent returned an invalid response');
        }
        return $result;
    }

    public function readiness() { return $this->request('GET', '/readiness'); }

    public static function publicWebhookUrl()
    {
        $host = getenv('NETHVOICE_HOST');
        if (!is_string($host) || !preg_match('/^[a-zA-Z0-9.-]+$/D', $host)) {
            return '';
        }
        return 'https://' . $host . '/freepbx/satellite/index.php';
    }
}
