<?php
/** Standard Webhooks verification against original bytes, before forwarding locally. */
class AgentWebhookVerifier
{
    // Check the provider webhook signature and timestamp.
    public static function verify($secret, $body, array $headers, $now = null)
    {
        $now = $now === null ? time() : $now;
        foreach (array('webhook-id', 'webhook-timestamp', 'webhook-signature') as $name) {
            if (!isset($headers[$name]) || !is_string($headers[$name]) || strlen($headers[$name]) > 4096) {
                throw new \InvalidArgumentException('Invalid webhook authentication');
            }
        }
        $timestamp = $headers['webhook-timestamp'];
        if (!ctype_digit($timestamp) || abs($now - (int) $timestamp) > 300 || $headers['webhook-id'] === '') {
            throw new \InvalidArgumentException('Invalid webhook timestamp');
        }
        $key = strpos($secret, 'whsec_') === 0 ? base64_decode(substr($secret, 6), true) : $secret;
        if (!is_string($key) || $key === '') { throw new \InvalidArgumentException('Invalid webhook key'); }
        $expected = base64_encode(hash_hmac('sha256', $headers['webhook-id'] . '.' . $timestamp . '.' . $body, $key, true));
        $valid = false;
        foreach (preg_split('/\s+/', $headers['webhook-signature']) as $signature) {
            if (strpos($signature, 'v1,') === 0 && hash_equals($expected, substr($signature, 3))) { $valid = true; }
        }
        if (!$valid) { throw new \InvalidArgumentException('Invalid webhook signature'); }
        $event = json_decode($body, true);
        if (!is_array($event)) { throw new \InvalidArgumentException('Invalid webhook payload'); }
        return $event;
    }
}
