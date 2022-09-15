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
require_once(__DIR__. '/../lib/SystemTasks.php');
require_once(__DIR__. '/../lib/freepbxFwConsole.php');

function getUser($username) {
    # add domain part if needed
    if (strpos($username, '@') === false) {
        exec('/usr/bin/hostname -d', $out, $ret);
        $domain = $out[0];
        return "$username@$domain";
    }
    return $username;
}

function userExists($username) {
    $needle = getUser($username);
    $users = shell_exec("/usr/bin/sudo /usr/libexec/nethserver/list-users");
    foreach (json_decode($users) as $user => $props) {
        if ($user == $needle) {
            return true;
        }
    }
    return false;
}

function getPassword($username) {
    return sql(
      'SELECT rest_users.password'.
      ' FROM rest_users'.
      ' JOIN userman_users ON rest_users.user_id = userman_users.id'.
      ' WHERE userman_users.username = \''. getUser($username). '\'', 'getOne'
    );
}

function setPassword($username, $password) {
    $dbh = FreePBX::Database();

    // Check if we already know user id, sync userman if not
    $sql =  'SELECT id FROM userman_users WHERE username = ?' ;
    $stmt = $dbh->prepare($sql);
    $stmt->execute(array($username));
    $id = $stmt->fetchAll()[0][0];
    if (empty($id)) {
        fwconsole('userman --syncall --force');
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
    $blacklist = ['admin', 'administrator', 'guest', 'krbtgt','ldapservice'];
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
                $users[$i]['password'] = getPassword(getUser($users[$i]['username']));
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
