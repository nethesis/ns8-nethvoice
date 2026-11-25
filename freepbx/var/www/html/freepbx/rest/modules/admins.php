<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

include_once('lib/libUsers.php');
include_once('lib/libDomainAdmins.php');

use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

function domainAdminsResponse(Response $response, array $result): Response
{
    foreach ($result[2] ?? [] as $name => $value) {
        $response = $response->withHeader($name, $value);
    }
    return $result[1] === null ? $response->withStatus($result[0]) : jsonResponse($response, $result[1], $result[0]);
}

function domainAdminsCaller(Request $request): string
{
    return (string) $request->getAttribute(NETHVOICE_USERNAME_ATTRIBUTE, '');
}

function domainAdminsClientAddress(Request $request): string
{
    $address = trim($request->getHeaderLine('X-Real-Ip'));
    if (filter_var($address, FILTER_VALIDATE_IP) !== false) {
        return $address;
    }
    return (string) ($request->getServerParams()['REMOTE_ADDR'] ?? '');
}

$app->post('/signin', function (Request $request, Response $response) {
    return domainAdminsResponse($response, domainAdminsDefault()->signIn(nethvoiceRequestBody($request), domainAdminsClientAddress($request)));
});

$app->get('/admins', function (Request $request, Response $response) {
    return domainAdminsResponse($response, domainAdminsDefault()->overview(domainAdminsCaller($request)));
});

$app->post('/admins', function (Request $request, Response $response) {
    return domainAdminsResponse($response, domainAdminsDefault()->create(nethvoiceRequestBody($request), domainAdminsCaller($request)));
});

$app->put('/admins/{username}', function (Request $request, Response $response, $args) {
    return domainAdminsResponse($response, domainAdminsDefault()->setPermissions((string) $args['username'], nethvoiceRequestBody($request), domainAdminsCaller($request)));
});

$app->delete('/admins/{username}', function (Request $request, Response $response, $args) {
    return domainAdminsResponse($response, domainAdminsDefault()->remove((string) $args['username'], domainAdminsCaller($request)));
});
