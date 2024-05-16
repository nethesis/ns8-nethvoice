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

require_once('/etc/freepbx.conf');

function getUserPortalUrl() {
    $host = getenv('NETHVOICE_HOST');

    # get domain
    $provider_domain = strtolower(getenv('NETHVOICE_LDAP_BASE'));

    # parse domain
    $dcs = explode("dc=", $provider_domain);
    array_shift($dcs);
    $domain_raw = implode(".", $dcs);
    $domain = str_replace(',', '', $domain_raw);

    return 'https://'. $host .'/users-admin/' . $domain . '/api';
}

function getToken() {
    $post = [
        "username" => getenv('NETHVOICE_USER_PORTAL_USERNAME'),
        "password" => getenv('NETHVOICE_USER_PORTAL_PASSWORD'),
    ];

    $ch = curl_init(getUserPortalUrl() . '/login');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($post));
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    // execute!
    $response = curl_exec($ch);
    $resJSON = json_decode($response);

    // close the connection, release resources used
    curl_close($ch);

    // return token
    return $resJSON->token;
}

function getUser($username) {
    # add domain part if needed
    if (strpos($username, '@') === false && !empty($ENV['NETHVOICE_LDAP_HOST'])) {
        return "$username@{$ENV['NETHVOICE_LDAP_HOST']}";
    }
    return $username;
}

function userExists($username) {
    $header = array();
    $header[] = 'Content-type: application/json';
    $header[] = 'Authorization: Bearer '. getToken();

    $ch = curl_init(getUserPortalUrl() . '/list-users');
    curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array()));
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    // execute!
    $response = curl_exec($ch);
    $resJson = json_decode($response);

    // close the connection, release resources used
    curl_close($ch);

    foreach ($resJson->users as $user => $props) {
        if ($props->user == $username) {
            return true;
        }
    }
    return false;
}

function getPassword($username) {
    $dbh = FreePBX::Database();
    $sql = 'SELECT rest_users.password FROM rest_users JOIN userman_users ON rest_users.user_id = userman_users.id WHERE userman_users.username = ?';
    $stmt = $dbh->prepare($sql);
    $stmt->execute([getUser($username)]);
    return $stmt->fetchAll()[0][0];
}

function setPassword($username, $password) {
    $dbh = FreePBX::Database();

    // Check if we already know user id, sync userman if not
    $sql =  'SELECT id FROM userman_users WHERE username = ?' ;
    $stmt = $dbh->prepare($sql);
    $stmt->execute(array($username));
    $id = $stmt->fetchAll()[0][0];
    if (empty($id)) {
        system('fwconsole userman --syncall --force > /dev/null &');
    }

    $sql =  'INSERT INTO rest_users (user_id,password)'.
            ' SELECT id, ?'.
            ' FROM userman_users'.
            ' WHERE username = ?'.
            ' ON DUPLICATE KEY UPDATE password = ?';
    $stmt = $dbh->prepare($sql);
    $stmt->execute(array($password, $username, $password));
}

function _generateRandomPassword($length,$characters) {
    $charactersLength = strlen($characters);
    $randomString = '';
    for ($i = 0; $i < $length; $i++) {
        $randomString .= $characters[rand(0, $charactersLength - 1)];
    }
    return $randomString;
}

function generateRandomPassword($length = 8, $complex = true) {
    $characters = array(
        'abcdefghijklmnopqrstuvwxyz',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        '0123456789',
        '!#?,.'
    );

    if (!$complex) {
        return _generateRandomPassword($length,$characters[0].$characters[1]);
    }

    if ($length < count($characters)) {
        $length = count($characters); // length can't be less than 4 char if we want at least one between lowercase, uppercase, numbers and symbols
    }
    $typesCharNum = array();
    foreach ($characters as $c) {
        $typesCharNum[] = 1; //number of chars for each of types (lowercase, uppercase, numbers and symbols)
    }
    while (array_sum($typesCharNum) < $length) {
        $typesCharNum[rand(0,3)] += 1; //add chars count to a random type of chars
    }
    $password = '';
    foreach ($characters as $index => $c) {
        $password .= _generateRandomPassword($typesCharNum[$index],$c);
    }
    $password = str_split($password); //convert string to array
    shuffle($password); //mix array element
    return implode('', $password); //return imploded array
}

function getUserID($username) {
    $dbh = FreePBX::Database();
    $sql = 'SELECT `id` FROM `userman_users` WHERE `username` = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($username));
    $data = $sth->fetchAll()[0][0];
    return $data;
}

function getAllUsers() {
    global $astman;
    $blacklist = ['admin', 'administrator', 'guest', 'krbtgt','ldapservice', getenv('NETHVOICE_USER_PORTAL_USERNAME')];
    $users = FreePBX::create()->Userman->getAllUsers();
    $dbh = FreePBX::Database();
    $i = 0;
    // Get registration status of extensions
    if (empty($astman->memAstDB)) {
        $astman->LoadAstDB();
    }
    $registrations = array();
    foreach ($astman->getDBCache() as $key => $value) {
        if (strpos($key,'/registrar/contact/') === 0) {
            $registrations[] = preg_replace('/^\/registrar\/contact\/([0-9]*);@[a-z0-9]*$/', '$1' ,$key);
        }
    }
    foreach ($users as $user) {
        if (in_array(strtolower($users[$i]['username']), $blacklist)) {
            unset($users[$i]);
        } else {
            if($all == "false" && $users[$i]['default_extension'] == 'none') {
                unset($users[$i]);
            } else {
                $users[$i]['password'] = getPassword($users[$i]['username']);
                $sql = 'SELECT rest_devices_phones.*'.
                  ' FROM rest_devices_phones'.
                  ' JOIN userman_users ON rest_devices_phones.user_id = userman_users.id'.
                  ' WHERE userman_users.default_extension = ?';
                $stmt = $dbh->prepare($sql);
                $stmt->execute(array($users[$i]['default_extension']));
                $users[$i]['devices'] = array();
                while ($d = $stmt->fetch(\PDO::FETCH_ASSOC)) {
                    if (array_search($d['extension'],$registrations)!==FALSE) {
                        $d['registered'] = TRUE;
                    } else {
                        $d['registered'] = FALSE;
                    }
                    $users[$i]['devices'][] = $d;
                }
                $sql = 'SELECT rest_users.profile_id'.
                  ' FROM rest_users'.
                  ' JOIN userman_users ON rest_users.user_id = userman_users.id'.
                  ' WHERE userman_users.username = ?';
                $stmt = $dbh->prepare($sql);$stmt->execute(array($users[$i]['username']));
                $users[$i]['profile'] = $stmt->fetch(\PDO::FETCH_ASSOC)['profile_id'];
            }
        }
        $i++;
    }
    return $users;
}
