<?php

class AgentSession
{
    // Return the administrator session token.
    public static function csrfToken() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (empty($_SESSION['satellite_agent_csrf']) || !is_string($_SESSION['satellite_agent_csrf'])) {
            $_SESSION['satellite_agent_csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['satellite_agent_csrf'];
    }

    // Reject a missing or mismatched administrator session token.
    public static function assertCsrfToken($token) {
        if (!is_string($token) || !hash_equals(self::csrfToken(), $token)) {
            throw new \RuntimeException('Invalid or missing security token, reload the page and retry');
        }
    }
}
