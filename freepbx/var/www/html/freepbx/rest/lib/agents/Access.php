<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

final class Access
{
    /** Reuse the Wizard admin identity already verified by AuthMiddleware. */
    public static function envelope(string $user): array
    {
        if ($user === '') throw new \RuntimeException('forbidden', 403);
        if (session_status() !== PHP_SESSION_ACTIVE && !session_start()) {
            throw new \RuntimeException('session_unavailable', 503);
        }
        if (($_SESSION['voice_agent_user'] ?? null) !== $user || !isset($_SESSION['voice_agent_csrf'])) {
            $_SESSION['voice_agent_user'] = $user;
            $_SESSION['voice_agent_csrf'] = bin2hex(random_bytes(32));
        }
        return ['contract_version' => 1, 'milestone' => 'v0.1-configuration', 'capabilities' => ['agents', 'trunks', 'tools', 'activity'],
                'csrf' => $_SESSION['voice_agent_csrf']];
    }

    /** Adapted from the legacy agents route: browser requests stay on the Wizard origin. */
    public static function requireSameOrigin(string $origin, string $host, string $scheme, string $fetchSite): void
    {
        if ($fetchSite === 'cross-site') throw new \RuntimeException('forbidden_origin', 403);
        if ($origin === '') return; // Header-authenticated non-browser clients.
        $source = parse_url($origin);
        $target = parse_url($scheme . '://' . $host);
        if (!$source || !$target || !in_array($scheme, ['http', 'https'], true) ||
            ($source['scheme'] ?? '') !== $scheme ||
            strtolower($source['host'] ?? '') !== strtolower($target['host'] ?? '') ||
            isset($source['user']) || isset($source['pass']) ||
            ($source['port'] ?? ($scheme === 'https' ? 443 : 80)) !== ($target['port'] ?? ($scheme === 'https' ? 443 : 80))) {
            throw new \RuntimeException('forbidden_origin', 403);
        }
    }

    public static function requireCsrf(string $user, string $provided): void
    {
        $expected = self::envelope($user)['csrf'];
        if ($provided === '' || !hash_equals($expected, $provided)) {
            throw new \InvalidArgumentException('csrf_invalid');
        }
    }
}
