<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Interfaces\RouteInterface;
use Slim\Routing\RouteContext;

const NETHVOICE_SUPERADMIN = 'superadmin';
const NETHVOICE_LOOKUP = 'lookup';
const NETHVOICE_SECTIONS = ['dashboard', 'users', 'trunks', 'routes', 'phones', 'integrations', 'settings'];
const NETHVOICE_SECTION_PREFIX = 'nethvoice:';
const NETHVOICE_USERNAME_ATTRIBUTE = 'nethvoice_username';
const NETHVOICE_PERMISSIONS_ATTRIBUTE = 'nethvoice_permissions';

const NETHVOICE_ROUTE_RULES = [
    'GET /me' => NETHVOICE_LOOKUP,
    'GET /logout' => NETHVOICE_LOOKUP,
    'GET /tasks/{task}' => NETHVOICE_LOOKUP,
    'GET /configuration/wizard' => NETHVOICE_LOOKUP,
    'GET /adminphone' => NETHVOICE_LOOKUP,
    'POST /adminphone/session' => NETHVOICE_LOOKUP,
    'GET /users/{all}' => NETHVOICE_LOOKUP,
    'GET /users/count' => NETHVOICE_LOOKUP,
    'GET /mainextensions/userlimits' => NETHVOICE_LOOKUP,
    'GET /physicalextensions' => NETHVOICE_LOOKUP,
    'GET /cti/groups' => NETHVOICE_LOOKUP,
    'GET /cti/profiles' => NETHVOICE_LOOKUP,
    'GET /trunks' => NETHVOICE_LOOKUP,
    'GET /trunks/count' => NETHVOICE_LOOKUP,
    'GET /providers' => NETHVOICE_LOOKUP,
    'GET /inboundroutes' => NETHVOICE_LOOKUP,
    'GET /inboundroutes/count' => NETHVOICE_LOOKUP,
    'GET /outboundroutes' => NETHVOICE_LOOKUP,
    'GET /outboundroutes/count' => NETHVOICE_LOOKUP,
    'GET /outboundroutes/supportedLocales' => NETHVOICE_LOOKUP,
    'GET /settings/languages' => NETHVOICE_LOOKUP,
    'GET /users/{username}/password' => NETHVOICE_SUPERADMIN,
    'POST /users/{username}/password' => ['sections' => ['settings'], 'self' => 'username'],
    'POST /physicalextensions/adminpw' => 'phones',
];

const NETHVOICE_PREFIX_RULES = [
    '/users' => 'users',
    '/mainextensions' => 'users',
    '/voicemails' => 'users',
    '/mobiles' => 'users',
    '/webrtc' => 'users',
    '/nethlink' => 'users',
    '/mobileapp' => 'users',
    '/bulk' => 'users',
    '/csv' => 'users',
    '/destinations' => 'users',
    '/contexts' => 'users',
    '/extension' => 'users',
    '/cti/groups' => 'users',
    '/cti/users' => 'users',
    '/cti/profiles' => 'users',
    '/cti/permissions' => 'users',
    '/physicalextensions' => ['users', 'phones'],
    '/phones/reconfigure' => ['users', 'phones'],
    '/phones/rps' => ['users', 'phones'],
    '/phones' => 'phones',
    '/extensions' => 'phones',
    '/provisioning' => 'phones',
    '/devices/phones' => 'phones',
    '/trunks' => 'trunks',
    '/devices/gateways' => 'trunks',
    '/providers' => 'trunks',
    '/codecs' => 'trunks',
    '/configuration/networks' => 'trunks',
    '/inboundroutes' => 'routes',
    '/outboundroutes' => 'routes',
    '/phonebook' => 'integrations',
    '/cti/streaming' => 'integrations',
    '/cti/sources' => 'integrations',
    '/cti/paramurl' => 'integrations',
    '/cti/paramurls' => 'integrations',
    '/cti/dbconn' => 'integrations',
    '/cti/customer_card' => 'integrations',
    '/settings' => 'settings',
];

function nethvoiceParseSections($sections): array
{
    $entries = is_array($sections) ? $sections : explode(';', (string) $sections);
    $entries = array_map(fn($entry) => trim((string) $entry), $entries);

    if (in_array('*', $entries, true)) {
        return [NETHVOICE_SUPERADMIN];
    }

    $granted = [];
    foreach ($entries as $entry) {
        if (!str_starts_with($entry, NETHVOICE_SECTION_PREFIX)) {
            continue;
        }
        $granted[] = substr($entry, strlen(NETHVOICE_SECTION_PREFIX));
    }

    if (in_array(NETHVOICE_SUPERADMIN, $granted, true)) {
        return [NETHVOICE_SUPERADMIN];
    }

    return array_values(array_intersect(NETHVOICE_SECTIONS, $granted));
}

function nethvoicePermissionsFor(array $user): array
{
    return nethvoiceParseSections($user['sections'] ?? '');
}

function nethvoiceNormalizeAccess($rule): array
{
    if (is_string($rule)) {
        return ['sections' => [$rule], 'self' => null];
    }
    if (array_is_list($rule)) {
        return ['sections' => $rule, 'self' => null];
    }

    return ['sections' => $rule['sections'], 'self' => $rule['self'] ?? null];
}

function nethvoiceRouteAccess(string $method, string $pattern): array
{
    $key = strtoupper($method) . ' ' . $pattern;
    if (array_key_exists($key, NETHVOICE_ROUTE_RULES)) {
        return nethvoiceNormalizeAccess(NETHVOICE_ROUTE_RULES[$key]);
    }

    $match = null;
    foreach (NETHVOICE_PREFIX_RULES as $prefix => $rule) {
        if ($pattern !== $prefix && !str_starts_with($pattern, $prefix . '/')) {
            continue;
        }
        if ($match === null || strlen($prefix) > strlen($match)) {
            $match = $prefix;
        }
    }

    return nethvoiceNormalizeAccess($match === null ? NETHVOICE_SUPERADMIN : NETHVOICE_PREFIX_RULES[$match]);
}

function nethvoiceIsAllowed(array $permissions, string $username, string $method, string $pattern, array $arguments = []): bool
{
    if (in_array(NETHVOICE_SUPERADMIN, $permissions, true)) {
        return true;
    }
    if (!$permissions) {
        return false;
    }

    $access = nethvoiceRouteAccess($method, $pattern);
    if (in_array(NETHVOICE_LOOKUP, $access['sections'], true)) {
        return true;
    }
    if (!array_intersect($access['sections'], $permissions)) {
        return false;
    }
    if ($access['self'] !== null) {
        return strtolower((string) ($arguments[$access['self']] ?? '')) === strtolower($username);
    }

    return true;
}

class PermissionMiddleware implements MiddlewareInterface
{
    private const PUBLIC_ROUTES = ['POST /testauth'];

    public function __construct(private ResponseFactoryInterface $responseFactory)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $route = RouteContext::fromRequest($request)->getRoute();
        if ($route !== null && $this->isAllowed($request, $route)) {
            return $handler->handle($request);
        }

        $response = $this->responseFactory->createResponse(403);
        $response->getBody()->write(json_encode(['message' => 'Forbidden: missing permission']));

        return $response->withHeader('Content-Type', 'application/json;charset=utf-8');
    }

    private function isAllowed(ServerRequestInterface $request, RouteInterface $route): bool
    {
        $method = strtoupper($request->getMethod());
        $pattern = $route->getPattern();
        if (in_array($method . ' ' . $pattern, self::PUBLIC_ROUTES, true)) {
            return true;
        }

        return nethvoiceIsAllowed(
            (array) $request->getAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, []),
            (string) $request->getAttribute(NETHVOICE_USERNAME_ATTRIBUTE, ''),
            $method,
            $pattern,
            $route->getArguments()
        );
    }
}
