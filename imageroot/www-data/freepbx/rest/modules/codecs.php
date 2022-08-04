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

/*
* GET /codecs/voip return allowed codecs for VoIP trunks, ordered and enabled
*/

$app->get('/codecs/voip', function (Request $request, Response $response, $args) {
    $codecs = array(
        array ('codec' => 'alaw', 'enabled' => true),
        array ('codec' => 'ulaw', 'enabled' => true)
    );

    try{
        //check if G729 is installed
        exec('/usr/sbin/asterisk -rx "module show like codec_g729.so"', $out, $ret);
        if ($ret === 0 && strpos(implode($out), 'codec_g729.so') !== false) {
            //codec g729 found
            $codecs = array_map(function($a) { $a['enabled'] = false; return $a; }, $codecs);
            $codecs[] = array('codec' => 'g729', 'enabled' => true);
        }

        return $response->withJson($codecs, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withJson('An error occurred', 500);
    }
});

