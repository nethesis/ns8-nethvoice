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

class AuthMiddleware
{
    private $secret = NULL;

    public function __construct($secret) {
        $this->secret = $secret;
    }

    /**
     * Authentication middleware invokable class
     *
     * @param  \Psr\Http\Message\ServerRequestInterface $request  PSR7 request
     * @param  \Psr\Http\Message\ResponseInterface      $response PSR7 response
     * @param  callable                                 $next     Next middleware
     *
     * @return \Psr\Http\Message\ResponseInterface
     */
    public function __invoke($request, $response, $next)
    {
        if ($request->isOptions()) {
            $response = $next($request, $response);
        }
        else if ($request->getUri()->getPath() != 'testauth' && (!$request->hasHeader('Secretkey') || !$request->hasHeader('User'))) {
            return $response->withJson(['error' => 'Forbidden: no credentials'], 403);
	} else {
	    $dbh = FreePBX::Database();
            $given_user = $request->getHeaderLine('User');
            $given_secret = $request->getHeaderLine('Secretkey');

	    $stmt = $dbh->prepare("SELECT * FROM ampusers WHERE sections LIKE '%*%' AND username = ?");
	    $stmt->execute(array($given_user));
	    $user = $stmt->fetchAll();
            $password_sha1 = $user[0]['password_sha1'];
            $username = $user[0]['username'];

            # check the user is valid and is an admin (sections = *)
            if ($request->getUri()->getPath() != 'testauth' && !$username ) {
                return $response->withJson(['error' => 'Forbidden: invalid user'], 403);
            }
            $hash = sha1($username . $password_sha1 . $this->secret);
            if ($request->getUri()->getPath() != 'testauth' && $given_secret != $hash) {
                $response = $response->withJson(['error' => 'Forbidden: wrong secret key'], 403);
            } else {
                $response = $next($request, $response);
            }
        }

        return $response;
    }
}
