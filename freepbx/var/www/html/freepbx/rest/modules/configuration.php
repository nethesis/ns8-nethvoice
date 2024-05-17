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

function getLegacyMode() {
    exec("/usr/bin/sudo /sbin/e-smith/config getprop nethvoice LegacyMode", $out);
    return $out[0];
}

function setLegacyMode($value) {
    exec("/usr/bin/sudo /sbin/e-smith/config setprop nethvoice LegacyMode $value", $out, $ret);
}


$app->get('/configuration/userprovider', function (Request $request, Response $response, $args) {
    # Get domain
    $provider_domain = strtolower(getenv('NETHVOICE_LDAP_BASE'));

    # Parse domain
    $dcs = explode("dc=", $provider_domain);
    array_shift($dcs);
    $domain_raw = implode(".", $dcs);
    $domain = str_replace(',', '', $domain_raw);

    # Return user provider object
    return $response->withJson(json_decode('{ "configured":1, "type":"ldap", "local":1, "domain": "'.$domain.'" }'), 200);
});

# get enabled mode
$app->get('/configuration/mode', function (Request $request, Response $response, $args) {
    $mode = getLegacyMode();
    # return 'unknown' if LegacyMode prop is not set
    if ( $mode == "" ) {
        return $response->withJson(['result' => 'unknown'],200);
    }
    exec("/usr/bin/rpm -q nethserver-directory", $out, $ret);
    # return true, if LegacyMode is enabled and nethserver-directory is installed
    if ($mode == "enabled" && $ret === 0) {
        return $response->withJson(['result' => "legacy"],200);
    }
    return $response->withJson(['result' => "uc"],200);
});

#
# GET /configuration/networks return green ip address and netmasks
#
$app->get('/configuration/networks', function (Request $request, Response $response, $args) {
	if (!empty($ENV['NETHVOICE_HOST_LOCAL_NETWORKS'])) {
		// Here a json object like this is expected [{"network":"192.168.5.0","ip":"192.168.5.14","netmask":"255.255.255.0","gateway":"192.168.5.1"},...]
		$networks = json_decode($ENV['NETHVOICE_HOST_LOCAL_NETWORKS']);
	} else {
		$networks = [];
	}
	return $response->withJson($networks,200);
});

$app->get('/configuration/wizard', function (Request $request, Response $response, $args) {
    try {
        $dbh = FreePBX::Database();
        $sql = 'SELECT * FROM rest_wizard';
        $wizard = $dbh->sql($sql, 'getAll', \PDO::FETCH_ASSOC);
        return $response->withJson($wizard, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

# JSON body: { "step" : <current_wizard_step>, "status": <true|false> } where <status> is the wizard status
$app->post('/configuration/wizard', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        $step = $params['step'];
        $status = $params['status'];
        // Restart nethcti-server if wizard is completed
        if ($step == 13) {
            // Restart Asterisk
            system("/usr/sbin/asterisk -rx 'core restart when convenient' &> /dev/null");
            // Notify nethcti-server restart
            $file = fopen("/notify/restart_nethcti-server", 'w');
            fclose($file);
        }
        // clean table
        sql('TRUNCATE `rest_wizard`');
        // insert wizard data
        $dbh = FreePBX::Database();
        $sql = 'REPLACE INTO `rest_wizard` (`step`,`status`) VALUES (?,?)';
        $stmt = $dbh->prepare($sql);
        if ($res = $stmt->execute(array($step,$status))) {
            return $response->withStatus(200);
        } else {
            return $response->withStatus(500);
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

/*
* GET /configuration/externalip
*/
$app->get('/configuration/externalip', function (Request $request, Response $response, $args) {
    return $response->withJson(\FreePBX::create()->Sipsettings->getConfig('externip'),200);
});

/*
* POST /configuration/externalip/{ip}
*/
$app->post('/configuration/externalip/{ip}', function (Request $request, Response $response, $args) {
    $route = $request->getAttribute('route');
    $ip = $route->getArgument('ip');
    if (\FreePBX::create()->Sipsettings->setConfig('externip',$ip)) {
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return $response->withStatus(200);
    }
    return $response->withStatus(500);
});

/*
* GET /configuration/suggestedip
*/
$app->get('/configuration/suggestedip', function (Request $request, Response $response, $args) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "http://ifconfig.io/ip");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
    curl_setopt($ch, CURLOPT_TIMEOUT, 4);
    $curl_result = trim(curl_exec($ch));
    curl_close($ch);
    $ip_regexp = '/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/';
    if (preg_match($ip_regexp, $curl_result) === 1) {
        return $response->withJson($curl_result,200);
    }
    return $response->withStatus(500);
});

/*
* GET /configuration/allowexternalsips
*/
$app->get('/configuration/allowexternalsips', function (Request $request, Response $response, $args) {
    //TODO remove this API
    return $response->withJson('enabled',200);
});

/*
* POST /configuration/allowexternalsips/<enabled|disabled>
*/
$app->post('/configuration/allowexternalsips/{status:enabled|disabled}', function (Request $request, Response $response, $args) {
    //TODO remove this API
    return $response->withStatus(200);
});

/*
* GET /configuration/localnetworks
*/
$app->get('/configuration/localnetworks', function (Request $request, Response $response, $args) {
    return $response->withJson(\FreePBX::create()->Sipsettings->getConfig('localnets'),200);
});

/*
* POST /configuration/localnetworks
*/
$app->post('/configuration/localnetworks', function (Request $request, Response $response, $args) {
    // Restart asterisk
    include '/etc/freepbx.conf';
    global $astman;
    $astman->Command('core restart when convenient');
    return $response->withStatus(200);
});

#
# POST /configuration/voicemailgooglestt/<enabled|disabled>
#
# enable or disable google speech STT for voicemail attachment
#
$app->post('/configuration/voicemailgooglestt/{status:enabled|disabled}', function (Request $request, Response $response, $args) {
    $route = $request->getAttribute('route');
    $status = $route->getArgument('status');
    if ($status == 'enabled') {
        if ( !file_exists('/home/asterisk/google-auth.json')) {
            return $response->withJson('Missing authentication file',412);
        }
        $vm = \FreePBX::Voicemail()->getVoicemail(false);
        $vm['general']['mailcmd'] = '/var/lib/asterisk/bin/googlestt_sendmail.php';
        \FreePBX::Voicemail()->saveVoicemail($vm);
        //reload
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return $response->withStatus(200);

    } else if ($status == 'disabled') {
        $vm = \FreePBX::Voicemail()->getVoicemail(false);
        unset($vm['general']['mailcmd']);
        \FreePBX::Voicemail()->saveVoicemail($vm);
        //reload
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return $response->withStatus(200);
    }
    return $response->withStatus(500);
});

#
# GET /configuration/voicemailgooglestt
#
# return google speech STT for voicemail attachment status
#
$app->get('/configuration/voicemailgooglestt', function (Request $request, Response $response, $args) {
    $status = "disabled";
    $vm = \FreePBX::Voicemail()->getVoicemail(false);
    if ($vm['general']['mailcmd'] == "/var/lib/asterisk/bin/googlestt_sendmail.php") {
        $status = "enabled";
    }
    return $response->withJson($status,200);
});

#
# POST /configuration/googleauth
#
# upload the google's auth json file into a specific directory
#
$app->post('/configuration/googleauth', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        $base64file = preg_replace('/^data:[a-z\.\-\/]*;base64,/','',$params['file']);
        $currentfile = '/home/asterisk/google-auth.json';
        if (file_exists($currentfile)) {
            unlink($currentfile);
        }
        $str = base64_decode($base64file);
        file_put_contents($currentfile, $str);
        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});
