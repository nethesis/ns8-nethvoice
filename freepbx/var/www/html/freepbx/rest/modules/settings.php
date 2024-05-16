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
#
use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

// TODO remove
$app->post('/settings/language', function (Request $request, Response $response, $args) {
	return $response->withStatus(200);
});

/*
* POST /settings/language {"lang":"it"}
*/
$app->post('/settings/defaultlanguage', function (Request $request, Response $response, $args) {
    try {
        global $amp_conf;
        $data = $request->getParsedBody();
        $lang = $data['lang'];
        FreePBX::create()->Soundlang->setLanguage($lang);
        # Set tonescheme
        switch ($lang) {
            case 'en':
                $tonescheme = 'us';
            break;
            default:
                $tonescheme = $lang;
            break;
        }
        FreePBX::create()->Core->config->set_conf_values(array('TONEZONE'=>$tonescheme),true,$amp_conf['AS_OVERRIDE_READONLY']);
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
* GET /settings/languages return installed languages default
*/
$app->get('/settings/languages', function (Request $request, Response $response, $args) {
    try {
        $defaultLanguage = FreePBX::create()->Soundlang->getLanguage();
        $res = array();
        foreach (['it','en'] as $lang) {
            if ($lang == $defaultLanguage) {
                $res[$lang] = array('default' => true);
            } else {
                $res[$lang] = array('default' => false);
            }
        }
        return $response->withJson($res,200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/**
 * GET /settings/conferenceurl return the conference JitsiUrl
 */
$app->get('/settings/conferenceurl', function (Request $request, Response $response, $args) {
    return $response->withJson($ENV['NETHVOICE_CONFERENCEURL'], 200);
});

