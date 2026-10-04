<?php
/** Private, bounded transport for application administration. */
class AgentApplicationClient
{
    public static function path($template, $arguments)
    {
        // Quantifier braces are part of the Slim route expression, not the
        // closing brace of a parameter (e.g. {resourceId:...{0,47}}).
        $result = preg_replace_callback('/\{([A-Za-z]+):(?:[^{}]|\{[0-9,]+\})+\}/',
            function ($match) use ($arguments) {
                if (!isset($arguments[$match[1]]) || !is_scalar($arguments[$match[1]])) {
                    throw new \InvalidArgumentException('invalid_operation');
                }
                return (string) $arguments[$match[1]];
            }, $template);
        if ($result === null || strpos($result, '{') !== false || strpos($result, '}') !== false) {
            throw new \InvalidArgumentException('invalid_operation');
        }
        return $result;
    }

    public function request($method, $path, $actor, $input = null)
    {
        $routes = array(
            'GET' => '#^/(inventory|runs/[a-f0-9]{32}/result)$#D',
            'PUT' => '#^/(settings|resources/(connector|preset)/[a-z][a-z0-9_-]{0,47}|grants/(internal|external|support-request))$#D',
            'POST' => '#^/(secrets|clients|test-runs|resources/(connector|preset)/[a-z][a-z0-9_-]{0,47}/publish|effects/[a-f0-9]{32}/reconcile|runs/[a-f0-9]{32}/cancel)$#D',
            'DELETE' => '#^/(secrets/[a-z][a-z0-9_-]{0,47}|clients/[a-z][a-z0-9_-]{0,47}|versions/(connector|preset)/[a-z][a-z0-9_-]{0,47}/[1-9][0-9]{0,5})$#D'
        );
        if (!isset($routes[$method]) || !preg_match($routes[$method], $path) ||
            !preg_match('/^[A-Za-z0-9_.@-]{1,128}$/D', $actor)) {
            throw new \InvalidArgumentException('invalid_operation');
        }
        $port = getenv('SATELLITE_HTTP_PORT'); $token = getenv('SATELLITE_API_TOKEN');
        if (!ctype_digit((string) $port) || (int) $port < 1 || (int) $port > 65535 || !$token) {
            throw new \RuntimeException('application_unavailable', 503);
        }
        $headers = array('Authorization: Bearer ' . $token, 'X-Agents-Actor: ' . $actor,
                         'Accept: application/json', 'Content-Type: application/json');
        $payload = $input === null ? null : json_encode($input, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($payload === false || ($payload !== null && strlen($payload) > 65536)) {
            throw new \InvalidArgumentException('invalid_request');
        }
        $body = ''; $curl = curl_init('http://127.0.0.1:' . $port . '/api/agent/v1/application' . $path);
        $options = array(CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 10, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROXY => '', CURLOPT_MAXREDIRS => 0,
            CURLOPT_WRITEFUNCTION => function ($handle, $chunk) use (&$body) {
                if (strlen($body) + strlen($chunk) > 2 * 1024 * 1024) { return 0; }
                $body .= $chunk; return strlen($chunk);
            });
        if ($payload !== null) { $options[CURLOPT_POSTFIELDS] = $payload; }
        curl_setopt_array($curl, $options);
        $ok = curl_exec($curl); $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if ($ok === false || $status < 200 || $status >= 300) {
            $safe = in_array($status, array(400, 403, 404, 409, 413, 422, 429), true) ? $status : 503;
            throw new \RuntimeException('application_request_failed', $safe);
        }
        $value = json_decode($body, true, 32);
        if (!is_array($value)) { throw new \RuntimeException('application_unavailable', 503); }
        return $value;
    }
}
