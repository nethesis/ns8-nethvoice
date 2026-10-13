<?php
// SPDX-License-Identifier: GPL-3.0-or-later
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
require_once __DIR__ . '/../lib/agents/Access.php';

// Global AuthMiddleware enforces Wizard credentials and administrator rights.
// M0 has no configuration mutation routes; later routes must also require CSRF.
$app->get('/agents/access', function (Request $request, Response $response) {
    try {
        $user = $request->getAttribute('nethvoice_admin');
        if (!is_string($user) || $user === '') {
            return jsonResponse($response, ['error' => 'forbidden'], 403);
        }
        // NS8 Traefik supplies the request scheme; Apache serves the same-origin UI.
        $scheme = $request->getHeaderLine('X-Forwarded-Proto') ?: $request->getUri()->getScheme();
        \NethVoice\Agents\Access::requireSameOrigin($request->getHeaderLine('Origin'),
            $request->getHeaderLine('Host'), $scheme, $request->getHeaderLine('Sec-Fetch-Site'));
        $envelope = \NethVoice\Agents\Access::envelope($user);
        session_write_close();
        return jsonResponse($response, $envelope)->withHeader('Cache-Control', 'no-store');
    } catch (\Throwable $error) {
        return jsonResponse($response, ['error' => $error->getCode() === 403 ? 'forbidden' : 'access_unavailable'],
            $error->getCode() === 403 ? 403 : 503)
            ->withHeader('Cache-Control', 'no-store');
    }
});
