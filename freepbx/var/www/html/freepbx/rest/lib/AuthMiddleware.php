<?php

#
# Copyright (C) 2017 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class AuthMiddleware implements MiddlewareInterface
{
    private $secret = NULL;
    private ResponseFactoryInterface $responseFactory;

    public function __construct($secret, ResponseFactoryInterface $responseFactory) {
        $this->secret = $secret;
        $this->responseFactory = $responseFactory;
    }

    /**
     * Authentication middleware invokable class
     *
     * @param  \Psr\Http\Message\ServerRequestInterface $request  PSR7 request
     * @param  \Psr\Http\Server\RequestHandlerInterface $handler  Next middleware
     *
     * @return \Psr\Http\Message\ResponseInterface
     */
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $path = trim($request->getUri()->getPath(), '/');
        $isTestAuthPath = preg_match('#(^|/)testauth$#', $path) === 1;
        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            return $handler->handle($request);
        }

        if (!$isTestAuthPath && (!$request->hasHeader('Secretkey') || !$request->hasHeader('User'))) {
            return $this->jsonResponse(['error' => 'Forbidden: no credentials'], 403);
        }

	$dbh = FreePBX::Database();
            $given_user = $request->getHeaderLine('User');
            $given_secret = $request->getHeaderLine('Secretkey');

        $stmt = $dbh->prepare("SELECT * FROM ampusers WHERE sections LIKE '%*%' AND username = ?");
        $stmt->execute(array($given_user));
        $user = $stmt->fetch(\PDO::FETCH_ASSOC) ?: array();
        $password_sha1 = $user['password_sha1'] ?? '';
        $username = $user['username'] ?? '';

            # check the user is valid and is an admin (sections = *)
        if (!$isTestAuthPath && !$username ) {
            return $this->jsonResponse(['error' => 'Forbidden: invalid user'], 403);
            }
            $hash = sha1($username . $password_sha1 . $this->secret);
        if (!$isTestAuthPath && $given_secret != $hash) {
            return $this->jsonResponse(['error' => 'Forbidden: wrong secret key'], 403);
        }

        return $handler->handle($request);
    }

    private function jsonResponse(array $payload, int $status): ResponseInterface
    {
        $response = $this->responseFactory->createResponse();
        $json = json_encode($payload);
        if ($json === false) {
            throw new RuntimeException('Unable to encode middleware JSON response: ' . json_last_error_msg());
        }

        $response->getBody()->write($json);

        return $response
            ->withHeader('Content-Type', 'application/json;charset=utf-8')
            ->withStatus($status);
    }
}
