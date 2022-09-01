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

require_once(__DIR__. '/../lib/SystemTasks.php');

/*
* POST /settings/language {"lang":"it"}
*/
$app->post('/settings/language', function (Request $request, Response $response, $args) {
    try {
        $data = $request->getParsedBody();
        $lang = $data['lang'];
        $st = new SystemTasks();
        $task = $st->startTask("/usr/bin/sudo /usr/libexec/nethserver/pkgaction --install nethvoice-lang-$lang");
        return $response->withJson(['result' => $task], 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
* POST /settings/defaultlanguage {"lang":"it"}
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

        # Set lang as installed in soundlang module
        $dbh = FreePBX::Database();
        $sql="REPLACE INTO soundlang_packages set type='asterisk',module='extra-sounds',language=?,license='',author='www.asterisksounds.org',authorlink='www.asterisksounds.org',format='',version='1.9.0',installed='1.9.0'";
        $stmt = $dbh->prepare($sql);
        $stmt->execute(array($lang));

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
        exec('/usr/bin/rpm -qa | grep "nethvoice-lang"', $out, $ret);
        $defaultLanguage = FreePBX::create()->Soundlang->getLanguage();
        $res = array();
        foreach ($out as $package) {
            $lang = preg_replace('/^nethvoice-lang-([a-z]*)-.*\.noarch$/', '${1}${2}',$package);
            if ($lang == $defaultLanguage) {
                $res[$lang] = array('default' => true);
            } else {
                $res[$lang] = array('default' => false);
            }
            # Set lang as installed in soundlang module
            $dbh = FreePBX::Database();
            $sql="REPLACE INTO soundlang_packages set type='asterisk',module='extra-sounds',language=?,license='',author='www.nethesis.it',authorlink='www.nethesis.it',format='sln',version='1.9.0',installed='1.9.0'";
            $stmt = $dbh->prepare($sql);
            $stmt->execute(array($lang));
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
    try {
        exec("/usr/bin/sudo /sbin/e-smith/config getprop conference JitsiUrl", $out, $return);
        if ($return === 0) {
            return $response->withJson($out[0] ? $out[0] : $out, 200);
        }
        throw new Exception("Command execution error: $return");
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/**
 * POST /settings/conferenceurl set the conference JitsiUrl
 */
$app->post('/settings/conferenceurl', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        $url = escapeshellarg($params["url"]);

        exec("/usr/bin/sudo /sbin/e-smith/config setprop conference JitsiUrl $url", $out, $return);
        if ($return === 0) {
            exec("/usr/bin/sudo /sbin/e-smith/signal-event nethserver-conference-save", $out, $return);
            if ($return === 0) {
                return $response->withStatus(200);
            }
        }
        throw new Exception("Command execution error: $return");
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});
