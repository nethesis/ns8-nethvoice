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

include_once('lib/libUsers.php');
include_once('lib/libExtensions.php');

use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

# Get final wizard report for created users
$app->get('/final', function (Request $request, Response $response, $args) {
    try {
        $dbh = FreePBX::Database();
        $sql = ' SELECT u.username, u.displayname, r.password, u.default_extension
                 FROM userman_users u JOIN rest_users r ON r.user_id = u.id
                 WHERE u.default_extension != "none"
                 ORDER BY u.default_extension ';
        $final = $dbh->sql($sql, 'getAll', \PDO::FETCH_ASSOC);
        //get voicemail password
        $vm = FreePBX::Voicemail();
        foreach ($final as $key => $value) {
            $vmpwd = $vm->getVoicemailBoxByExtension($value['default_extension'])['pwd'];
            if (isset($vmpwd) && !is_null($vmpwd)) {
                $final[$key]['voicemailpwd'] = $vmpwd;
            } else {
                $final[$key]['voicemailpwd'] = '';
            }
        }
        return $response->withJson($final, 200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

# Count all users

$app->get('/users/count', function (Request $request, Response $response, $args) {
    $blacklist = ['admin', 'administrator', 'guest', 'krbtgt','ldapservice'];
    $users = FreePBX::create()->Userman->getAllUsers();
    $dbh = FreePBX::Database();
    $i = 0;
    foreach ($users as $user) {
        if (in_array(strtolower($users[$i]['username']), $blacklist)) {
            unset($users[$i]);
        }
        $i++;
    }
    return $response->withJson(count(array_values($users)),200);
});

# List all users

$app->get('/users/{all}', function (Request $request, Response $response, $args) {
    $all = $request->getAttribute('all');
    if($all == "true") {
        system('fwconsole userman --syncall --force > /dev/null &'); // force FreePBX user sync
    }
    return $response->withJson(array_values(getAllUsers()),200);
});


# Create or edit a system user inside OpenLDAP
# Should be used only in legacy mode.
#
# JSON body:
#
# {"username" : "myuser", "fullname" : "my full name"}


$app->post('/users', function (Request $request, Response $response, $args) {
    $params = $request->getParsedBody();
    $username = $params['username'];
    $fullname = $params['fullname'];
    if ( ! $username || ! $fullname || preg_match('/^[0-9]/',$username)) {
        return $response->withJson(['result' => 'User name or full name invalid'], 422);
    }
    $username = strtolower($username);
    if ( userExists($username) ) {
        exec("/usr/bin/sudo /sbin/e-smith/signal-event user-modify ".escapeshellarg($username)." ".escapeshellarg($fullname)." '/bin/false'", $out, $ret);
    } else {
        exec("/usr/bin/sudo /sbin/e-smith/signal-event user-create ".escapeshellarg($username)." ".escapeshellarg($fullname)." '/bin/false'", $out, $ret);
    }
    if ( $ret === 0 ) {
        system('fwconsole userman --syncall --force > /dev/null &');
        return $response->withStatus(201);
    } else {
        return $response->withStatus(422);
    }
});


# Set the password of a given user
# Should be used only in legacy mode.
#
# JSON body:
#
# {"password" : "mypassword"}

$app->post('/users/{username}/password', function (Request $request, Response $response, $args) {
    $params = $request->getParsedBody();
    $username = strtolower($request->getAttribute('username'));
    $password = $params['password'];

    if ($username === 'admin') { # change freepbx admin password
        $dbh = FreePBX::Database();
        $sql = 'UPDATE ampusers SET password_sha1 = sha1(?) WHERE username = \'admin\'';
        $stmt = $dbh->prepare($sql);
        $stmt->execute(array($password));
    } else {
        if ( ! userExists($username) ) {
            return $response->withJson(['result' => "$username user doesn't exist"], 422);
        } else {
            $tmp = tempnam("/tmp","ASTPWD");
            file_put_contents($tmp, $password);

            exec("/usr/bin/sudo /sbin/e-smith/signal-event password-modify '".$username."' $tmp", $out, $ret);
            if ($ret === 0) {
                setPassword($username, $password);
                return $response->withStatus(201);
            }
        }
        return $response->withStatus(422);
    }
    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
    return $response->withStatus(201);
});

# Return the password givent user in clear text
# Should be used only in legacy mode.

$app->get('/users/{username}/password', function (Request $request, Response $response, $args) {
    $params = $request->getParsedBody();
    $username = strtolower($request->getAttribute('username'));
    $password = getPassword($username);
    if ($password) {
        return $response->withJson(['result' => $password]);
    } else {
        return $response->withStatus(404);
    }
});


#
# Sync users from user provider to FreePBX db.
#

$app->post('/users/sync', function (Request $request, Response $response, $args) {
    system('fwconsole userman --syncall --force > /dev/null &');
    return $response->withStatus(200);
});


#
# Import users from csv long running task
#
$app->post('/csv/csvimport', function (Request $request, Response $response, $args) {
    try {
        $params = $request->getParsedBody();
        $base64csv = preg_replace('/^data:[a-z\.\-\/]*;base64,/','',$params['file']);
        $statusfile = '/var/run/nethvoice/csvimport.code';
        if (file_exists($statusfile)) {
            unlink($statusfile);
        }
        system("/usr/local/bin/php /var/www/html/freepbx/rest/lib/csvimport.php ".escapeshellarg($base64csv)." &> /dev/null &");
        return $response->withStatus(200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->get('/csv/csvimport', function (Request $request, Response $response, $args) {
    try {
        $statusfile = '/var/run/nethvoice/csvimport.code';
        if (file_exists($statusfile)) {
            $status = json_decode(file_get_contents($statusfile));
            if (isset($status->exitcode) && $status->exitcode != 0) {
                unlink($statusfile);
                return $response->withJson(['status' => $status->errors],500);
            } elseif (isset($status->exitcode) && $status->exitcode == 0) {
                unlink($statusfile);
                return $response->withJson(['result' => $status->progress],200);
            }
            return $response->withJson(['result' => $status->progress],200);
        } else {
            return $response->withJson(['status' => 'No csv import active'],422);
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});

$app->get('/csv/csvexport', function (Request $request, Response $response, $args) {
    try {
        $csvarray = array();

        $users = getAllUsers();

        // Get mobiles
        $dbh = FreePBX::Database();
        $sql = 'SELECT rest_users.mobile, userman_users.username, userman_users.id'.
          ' FROM rest_users'.
          ' JOIN userman_users ON userman_users.id = rest_users.user_id'.
          ' WHERE rest_users.mobile != \'\' AND rest_users.mobile IS NOT NULL';
        $mobiles = $dbh->sql($sql, 'getAll', \PDO::FETCH_ASSOC);

        // Voicemails
        $tmp = FreePBX::Voicemail()->getVoicemail();
        $voicemails = $tmp['default'];

        // CTI Groups
        $sql = 'SELECT rest_cti_users_groups.user_id, rest_cti_groups.name'.
            ' FROM rest_cti_groups'.
            ' JOIN rest_cti_users_groups ON rest_cti_users_groups.group_id = rest_cti_groups.id';
        $sth = $dbh->prepare($sql);
        $sth->execute();
        $res = $sth->fetchAll(PDO::FETCH_ASSOC);
        $user_groups = array();
        foreach ($res as $ug) {
            if (!isset($user_groups[$ug['user_id']])) $user_groups[$ug['user_id']] = array();
            $user_groups[$ug['user_id']][] = $ug['name'];
        }

        // CTI Profiles
        $sql = 'SELECT id,name FROM rest_cti_profiles';
        $sth = $dbh->prepare($sql);
        $sth->execute();
        $res = $sth->fetchAll(PDO::FETCH_ASSOC);
        foreach ($res as $r) {
            $profiles[$r['id']] = $r['name'];
        }

        foreach ($users as $u) {
            if (!isset($u['username'])) continue;
            $row = array();
            $userid = $u['id'];
            $row[] = $u['username'];
            $row[] = $u['displayname'];
            $row[] = $u['default_extension'];
            $row[] = getPassword($u['username']);
            // mobile cellphone
            $mobile = NULL;
            foreach ($mobiles as $m) {
                if ($m['id'] === $u['id']) {
                    $mobile = $m['mobile'];
                    break;
                }
            }
            $row[] = $mobile;
            // voicemail
            if (isset($voicemails[$u['default_extension']])) {
                $row[] = 'TRUE';
            } else {
                $row[] = 'FALSE';
            }
            // WebRTC extension
            $webrtc = 'FALSE';
            if (isset($u['devices'])) {
                foreach ($u['devices'] as $device) {
                    if ($device['type'] === 'webrtc') {
                        $webrtc = 'TRUE';
                    }
                }
            }
            $row[] = $webrtc;
            // pipe separated CTI Groups
            if (isset($user_groups[$u['id']])) {
                $row[] = implode('|', $user_groups[$u['id']]);
            } else {
                $row[] = '';
            }
            // CTI Profile
            if (isset($u['profile']) && !empty($u['profile'])) {
                $row[] = $profiles[$u['profile']];
            } else {
                $row[] = '';
            }
            // ad " string delimiters
            foreach ($row as $key => $value) {
                $row[$key] = "\"$value\"";
            }

            $csvarray[] = $row;
        }

        $csvstring = '';
        foreach ($csvarray as $row) {
            $csvstring .= implode(',',$row);
            $csvstring .= "\r\n";
        }
        error_log($csvstring);
        return $response->withJson(base64_encode($csvstring),200);
    } catch (Exception $e) {
        error_log($e->getMessage());
        return $response->withStatus(500);
    }
});
