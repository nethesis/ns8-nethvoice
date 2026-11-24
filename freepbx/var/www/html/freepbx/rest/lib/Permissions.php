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

require_once __DIR__ . '/libSecurity.php';

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
    'GET /dashboard/live/extensions' => ['dashboard', 'users', 'phones'],
    'GET /dashboard/live/trunks' => ['dashboard', 'trunks'],
    'GET /dashboard/live/users' => ['dashboard', 'users'],
    'GET /users/{username}/password' => NETHVOICE_SUPERADMIN,
    'GET /phones/account/{mac}' => NETHVOICE_SUPERADMIN,
    'POST /users/{username}/password' => NETHVOICE_SUPERADMIN,
    'POST /physicalextensions/adminpw' => 'phones',
    'POST /cti/customer_card/template' => NETHVOICE_SUPERADMIN,
    'PUT /cti/customer_card/template/{name}' => NETHVOICE_SUPERADMIN,
    'DELETE /cti/customer_card/template/{name}' => NETHVOICE_SUPERADMIN,
    'GET /phonebook/ldap' => 'phones',
    'POST /extensions/{extension}/srtp/{enabled}' => ['users', 'phones'],
    'DELETE /outboundroutes/{route_id}/trunks/{id}' => NETHVOICE_SUPERADMIN,
];

const NETHVOICE_CUSTOMER_CARD_FILTERS = ['id', 'name', 'dbconn_id', 'template'];
const NETHVOICE_CUSTOMER_CARD_FIELDS = ['name', 'query', 'template', 'dbconn_id'];
const NETHVOICE_CSV_PASSWORD_COLUMN = 3;
const NETHVOICE_SECRET_FIELDS = ['/voicemails' => 'pwd', '/phonebook/ldap' => 'password'];

const NETHVOICE_PREFIX_RULES = [
    '/dashboard' => 'dashboard',
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
    '/admins' => NETHVOICE_SUPERADMIN,
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
    return ['sections' => is_string($rule) ? [$rule] : $rule];
}

function nethvoiceRuleMethod(string $method): string
{
    $method = strtoupper($method);

    return $method === 'HEAD' ? 'GET' : $method;
}

function nethvoiceRouteAccess(string $method, string $pattern): array
{
    $key = nethvoiceRuleMethod($method) . ' ' . $pattern;
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

function nethvoiceIsAllowed(array $permissions, string $method, string $pattern): bool
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

    return (bool) array_intersect($access['sections'], $permissions);
}

function nethvoiceRequestPermissions(ServerRequestInterface $request): array
{
    return (array) $request->getAttribute(NETHVOICE_PERMISSIONS_ATTRIBUTE, []);
}

function nethvoiceRequestIsSuperadmin(ServerRequestInterface $request): bool
{
    return in_array(NETHVOICE_SUPERADMIN, nethvoiceRequestPermissions($request), true);
}

function nethvoiceRequestHasSection(ServerRequestInterface $request, string $section): bool
{
    $permissions = nethvoiceRequestPermissions($request);

    return in_array(NETHVOICE_SUPERADMIN, $permissions, true) || in_array($section, $permissions, true);
}

function nethvoiceKeepsFreepbxSession($sections): bool
{
    return nethvoiceParseSections($sections) === [NETHVOICE_SUPERADMIN];
}

function nethvoiceForbidden(ResponseInterface $response): ResponseInterface
{
    $response->getBody()->write(json_encode(['message' => 'Forbidden: missing permission']));

    return $response->withStatus(403)->withHeader('Content-Type', 'application/json;charset=utf-8');
}

function nethvoiceBadRequest(ResponseInterface $response): ResponseInterface
{
    $response->getBody()->write(json_encode(['message' => 'Bad request: invalid parameters']));

    return $response->withStatus(400)->withHeader('Content-Type', 'application/json;charset=utf-8');
}

function nethvoiceRequestBody(ServerRequestInterface $request)
{
    $parsed = $request->getParsedBody();
    if ($parsed !== null) {
        return $parsed;
    }
    $stream = $request->getBody();
    $contents = (string) $stream;
    if ($stream->isSeekable()) {
        $stream->rewind();
    }
    $type = strtolower(trim(explode(';', $request->getHeaderLine('Content-Type'))[0]));
    if ($type === 'application/x-www-form-urlencoded') {
        parse_str($contents, $data);

        return $data;
    }
    if ($type === 'application/json' || preg_match('#^application/[^+/]+\+json$#', $type)) {
        $data = json_decode($contents, true);

        return is_array($data) ? $data : null;
    }

    return null;
}

interface NethvoiceLimitedAdminLookup
{
    public function builtinDbConnections(): array;

    public function dbConnection(int $id): ?array;

    public function customerCard(int $id): ?array;

    public function phonebookSource(string $id): ?array;

    public function cardTemplateExists(string $name): bool;
}

class NethvoiceDatabaseLookup implements NethvoiceLimitedAdminLookup
{
    public function __construct(
        private string $phonebookSourcesDir = '/etc/phonebook/sources.d',
        private string $cardTemplatesDir = '/var/lib/nethserver/nethcti/templates/customer_card'
    ) {
    }

    public function builtinDbConnections(): array
    {
        $sth = $this->cti()->prepare('SELECT * FROM user_dbconn WHERE id IN (1, 2)');
        $sth->execute();

        return array_values(array_filter($sth->fetchAll(\PDO::FETCH_ASSOC) ?: [], 'nethvoiceIsBuiltinDbConnection'));
    }

    public function dbConnection(int $id): ?array
    {
        $sth = $this->cti()->prepare('SELECT * FROM user_dbconn WHERE id = ?');
        $sth->execute([$id]);
        $row = $sth->fetch(\PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    public function customerCard(int $id): ?array
    {
        $sth = $this->cti()->prepare('SELECT id, query, dbconn_id FROM customer_card WHERE id = ?');
        $sth->execute([$id]);
        $row = $sth->fetch(\PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    public function phonebookSource(string $id): ?array
    {
        if (!nethvoiceIsValidPhonebookSourceId($id)) {
            return null;
        }
        $file = $this->phonebookSourcesDir . '/' . $id . '.json';
        if (!is_file($file)) {
            return null;
        }
        $config = json_decode((string) file_get_contents($file), true);

        return is_array($config) && is_array($config[$id] ?? null) ? $config[$id] : null;
    }

    public function cardTemplateExists(string $name): bool
    {
        return nethvoiceIsValidCardTemplate($name) && is_file($this->cardTemplatesDir . '/' . $name . '.ejs');
    }

    private function cti()
    {
        if (!class_exists('NethCTI')) {
            require_once __DIR__ . '/libCTI.php';
        }

        return NethCTI::Database();
    }
}

function nethvoiceUsesBuiltinDbConnection(?int $id, NethvoiceLimitedAdminLookup $lookup): bool
{
    if ($id === null) {
        return false;
    }
    $connection = $lookup->dbConnection($id);

    return $connection !== null && nethvoiceTargetsBuiltinDbConnection($connection, $lookup->builtinDbConnections());
}

function nethvoiceCustomerCardCreateStatus($body, NethvoiceLimitedAdminLookup $lookup): ?int
{
    if (!is_array($body)) {
        return 400;
    }
    $dbconn = nethvoiceDbConnectionId($body['dbconn_id'] ?? null);
    if ($dbconn === null) {
        return 400;
    }

    return nethvoiceUsesBuiltinDbConnection($dbconn, $lookup) ? 403 : null;
}

function nethvoiceCustomerCardUpdateStatus($id, $body, NethvoiceLimitedAdminLookup $lookup): ?int
{
    $id = nethvoiceDbConnectionId($id);
    if ($id === null || !is_array($body) || !$body) {
        return 400;
    }
    if (array_diff(array_keys($body), [...NETHVOICE_CUSTOMER_CARD_FIELDS, 'profiles'])) {
        return 400;
    }
    foreach (NETHVOICE_CUSTOMER_CARD_FIELDS as $field) {
        if (array_key_exists($field, $body) && !is_scalar($body[$field])) {
            return 400;
        }
    }
    if (array_key_exists('profiles', $body) && !is_array($body['profiles'])) {
        return 400;
    }
    $storedDbconn = null;
    $stored = $lookup->customerCard($id);
    if ($stored !== null) {
        $storedDbconn = nethvoiceDbConnectionId($stored['dbconn_id'] ?? null);
    }
    $dbconn = $storedDbconn;
    if (array_key_exists('dbconn_id', $body)) {
        $dbconn = nethvoiceDbConnectionId($body['dbconn_id']);
        if ($dbconn === null) {
            return 400;
        }
    }
    $queryChanged = array_key_exists('query', $body)
        && ($stored === null || base64_decode((string) $body['query']) !== (string) ($stored['query'] ?? ''));
    if (($queryChanged || $dbconn !== $storedDbconn) && nethvoiceUsesBuiltinDbConnection($dbconn, $lookup)) {
        return 403;
    }

    return null;
}

function nethvoiceDbConnectionSaveStatus($id, $body, NethvoiceLimitedAdminLookup $lookup): ?int
{
    if (!is_array($body)) {
        return 400;
    }
    $builtins = $lookup->builtinDbConnections();
    $target = $body;
    if ($id !== null) {
        $id = nethvoiceDbConnectionId($id);
        if ($id === null) {
            return 400;
        }
        $stored = $lookup->dbConnection($id);
        if ($stored !== null && nethvoiceTargetsBuiltinDbConnection($stored, $builtins)) {
            return 403;
        }
        $target = array_merge($stored ?? [], $body, ['id' => $id]);
    }

    return nethvoiceTargetsBuiltinDbConnection($target, $builtins) ? 403 : null;
}

function nethvoicePhonebookSourceSaveStatus($id, $body, NethvoiceLimitedAdminLookup $lookup): ?int
{
    if ($id !== null && !nethvoiceIsValidPhonebookSourceId($id)) {
        return 400;
    }
    if (!is_array($body) || (array_key_exists('dbtype', $body) && !is_string($body['dbtype']))) {
        return 400;
    }
    if (nethvoicePhonebookDatabaseTargetStatus($body, $id === null ? null : $lookup->phonebookSource($id)) !== null) {
        return 403;
    }
    if (array_key_exists('mapping', $body) && !nethvoiceIsValidPhonebookMapping($body['mapping'])) {
        return 400;
    }

    return null;
}

function nethvoicePhonebookSourceStatus($id): ?int
{
    return nethvoiceIsValidPhonebookSourceId($id) ? null : 400;
}

function nethvoiceCustomerCardPreviewStatus($body, NethvoiceLimitedAdminLookup $lookup): ?int
{
    if (!is_array($body)) {
        return 400;
    }
    $dbconn = nethvoiceDbConnectionId($body['dbconn_id'] ?? null);
    if ($dbconn === null) {
        return 400;
    }

    return nethvoiceUsesBuiltinDbConnection($dbconn, $lookup) ? 403 : null;
}

function nethvoiceDbConnectionTestStatus($body, NethvoiceLimitedAdminLookup $lookup): ?int
{
    if (!is_array($body)) {
        return 400;
    }
    $id = $body['id'] ?? null;

    return nethvoiceDbConnectionSaveStatus($id === '' ? null : $id, $body, $lookup);
}

function nethvoiceDbConnectionDeleteStatus($id, NethvoiceLimitedAdminLookup $lookup): ?int
{
    $id = nethvoiceDbConnectionId($id);
    if ($id === null) {
        return 400;
    }
    $stored = $lookup->dbConnection($id);

    return $stored !== null && nethvoiceTargetsBuiltinDbConnection($stored, $lookup->builtinDbConnections()) ? 403 : null;
}

function nethvoiceLimitedAdminRequestStatus(ServerRequestInterface $request, string $pattern, array $arguments, NethvoiceLimitedAdminLookup $lookup): ?int
{
    switch (nethvoiceRuleMethod($request->getMethod()) . ' ' . $pattern) {
        case 'GET /mobiles/{username}':
            return nethvoiceIsValidUsername($arguments['username'] ?? null) ? null : 400;
        case 'GET /cti/customer_card':
            return array_diff(array_keys($request->getQueryParams()), NETHVOICE_CUSTOMER_CARD_FILTERS) ? 400 : null;
        case 'POST /cti/customer_card':
            return nethvoiceCustomerCardCreateStatus(nethvoiceRequestBody($request), $lookup);
        case 'PUT /cti/customer_card/{id}':
            return nethvoiceCustomerCardUpdateStatus($arguments['id'] ?? null, nethvoiceRequestBody($request), $lookup);
        case 'POST /cti/dbconn':
            return nethvoiceDbConnectionSaveStatus(null, nethvoiceRequestBody($request), $lookup);
        case 'PUT /cti/dbconn/{id}':
            return nethvoiceDbConnectionSaveStatus($arguments['id'] ?? '', nethvoiceRequestBody($request), $lookup);
        case 'POST /cti/dbconn/test':
            return nethvoiceDbConnectionTestStatus(nethvoiceRequestBody($request), $lookup);
        case 'DELETE /cti/dbconn/{id}':
            return nethvoiceDbConnectionDeleteStatus($arguments['id'] ?? null, $lookup);
        case 'POST /cti/customer_card/preview':
            return nethvoiceCustomerCardPreviewStatus(nethvoiceRequestBody($request), $lookup);
        case 'POST /phonebook/config[/{id}]':
            return nethvoicePhonebookSourceSaveStatus($arguments['id'] ?? null, nethvoiceRequestBody($request), $lookup);
        case 'DELETE /phonebook/config/{id}':
        case 'POST /phonebook/syncnow/{id}':
            return nethvoicePhonebookSourceStatus($arguments['id'] ?? null);
    }

    return null;
}

function nethvoiceLimitedAdminResponseFilter(string $method, string $pattern): ?callable
{
    return match (nethvoiceRuleMethod($method) . ' ' . $pattern) {
        'GET /csv/csvexport' => fn($data) => nethvoiceBase64CsvWithoutColumn($data, NETHVOICE_CSV_PASSWORD_COLUMN),
        'GET /voicemails', 'GET /phonebook/ldap' => fn($data) => nethvoiceWithoutFieldInEach($data, NETHVOICE_SECRET_FIELDS[$pattern]),
        'GET /voicemails/{extension}' => fn($data) => nethvoiceWithoutField($data, NETHVOICE_SECRET_FIELDS['/voicemails']),
        default => null,
    };
}

class PermissionMiddleware implements MiddlewareInterface
{
    private const PUBLIC_ROUTES = ['POST /testauth', 'POST /signin'];

    private NethvoiceLimitedAdminLookup $lookup;

    public function __construct(private ResponseFactoryInterface $responseFactory, ?NethvoiceLimitedAdminLookup $lookup = null)
    {
        $this->lookup = $lookup ?? new NethvoiceDatabaseLookup();
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $route = RouteContext::fromRequest($request)->getRoute();
        if ($route === null || !$this->isAllowed($request, $route)) {
            return nethvoiceForbidden($this->responseFactory->createResponse());
        }
        if (nethvoiceRequestIsSuperadmin($request) || $this->isPublic($request, $route)) {
            return $handler->handle($request);
        }

        $pattern = $route->getPattern();
        $status = nethvoiceLimitedAdminRequestStatus($request, $pattern, $route->getArguments(), $this->lookup);
        if ($status === 403) {
            return nethvoiceForbidden($this->responseFactory->createResponse());
        }
        if ($status !== null) {
            return nethvoiceBadRequest($this->responseFactory->createResponse());
        }

        $response = $handler->handle($request);
        $filter = nethvoiceLimitedAdminResponseFilter($request->getMethod(), $pattern);

        return $filter === null ? $response : $this->filterResponse($response, $filter);
    }

    private function filterResponse(ResponseInterface $response, callable $filter): ResponseInterface
    {
        if ($response->getStatusCode() !== 200) {
            return $response;
        }
        $data = json_decode((string) $response->getBody());
        if (json_last_error() !== JSON_ERROR_NONE) {
            return $this->responseFactory->createResponse(500);
        }
        $filtered = $this->responseFactory->createResponse(200);
        foreach ($response->getHeaders() as $name => $values) {
            if (strtolower($name) !== 'content-length') {
                $filtered = $filtered->withHeader($name, $values);
            }
        }
        $filtered->getBody()->write(json_encode($filter($data)));

        return $filtered;
    }

    private function isPublic(ServerRequestInterface $request, RouteInterface $route): bool
    {
        return in_array(nethvoiceRuleMethod($request->getMethod()) . ' ' . $route->getPattern(), self::PUBLIC_ROUTES, true);
    }

    private function isAllowed(ServerRequestInterface $request, RouteInterface $route): bool
    {
        if ($this->isPublic($request, $route)) {
            return true;
        }

        return nethvoiceIsAllowed(
            nethvoiceRequestPermissions($request),
            strtoupper($request->getMethod()),
            $route->getPattern()
        );
    }
}
