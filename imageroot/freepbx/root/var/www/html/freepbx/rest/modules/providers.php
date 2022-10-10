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
use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

require_once(__DIR__. '/../../admin/modules/core/functions.inc.php');

/**
 * @api {get} /providers  Retrieve all providers
 */
$app->get('/providers', function (Request $request, Response $response, $args) {
    try {
        global $db;
        $sql = 'SELECT * FROM `rest_pjsip_providers` ORDER BY `description`';
        $results = $db->getAll($sql, DB_FETCHMODE_ASSOC);
        if(DB::IsError($results)) {
            throw new Exception($results->getMessage());
        }
        return $response->withJson($results, 200);
    }
    catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson('An error occurred', 500);
    }
});
