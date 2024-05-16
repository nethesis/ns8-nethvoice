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

include_once '/var/www/html/freepbx/rest/lib/libCTI.php';

function getExtension($extension) {
    $extensions = FreePBX::create()->Core->getAllUsers();
    foreach ($extensions as $e) {
        if ($e['extension'] == (string) $extension) {
            return $e;
        }
    }
    return false;
}

function getAllExtensions($mainextension) {
    $extensions = array($mainextension);
    foreach (FreePBX::create()->Core->getAllUsers() as $ext) {
            if (substr($ext['extension'], 2) === $mainextension) {
                $extensions[] = $ext['extension'];
            }
        }
    return $extensions;
}

function getSipTableData($id,$keyword){
    $dbh = FreePBX::Database();
    $sql = 'SELECT `data` FROM `sip` WHERE `id`=? AND `keyword`=?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($id,$keyword));
    $data = $sth->fetchAll()[0][0];
    return $data;
}

function writeSipTableData($id,$keyword,$value){
    $dbh = FreePBX::Database();
    $sql = 'UPDATE `sip` SET `data`=? WHERE (`id`=? OR `id` LIKE ?) AND `keyword`=?';
    $sth = $dbh->prepare($sql);
    $res = $sth->execute(array($value,$id,"9%$id",$keyword));
    if ($res === FALSE) {
        return new Exception($sth->errorInfo()[2]);
    }
    return true;
}

function get_displayname($mainextension) {
    //change device displayname
    $dbh = FreePBX::Database();
    $sql = 'SELECT `name` FROM `users` WHERE `extension`=?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($mainextension));
    $displayname = $sth->fetchAll()[0][0];
    $displayname = str_replace($mainextension,preg_replace('/./','?',$mainextension),$displayname);
    $displayname = str_replace(substr($mainextension,-3),preg_replace('/./','?',substr($mainextension,-3)),$displayname);
    $displayname = str_replace(substr($mainextension,-2),preg_replace('/./','?',substr($mainextension,-2)),$displayname);
    $displayname = str_replace(substr($mainextension,-1),preg_replace('/./','?',substr($mainextension,-1)),$displayname);
    return $displayname;
}

function get_context($mainextension) {
    return getSipTableData($mainextension,'context');
}

function get_profile($mainextension) {
    $dbh = FreePBX::Database();
    // Get CTI Profile id
    $sql = 'SELECT rest_users.profile_id FROM rest_users JOIN userman_users ON rest_users.user_id = userman_users.id WHERE userman_users.default_extension = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute([$mainextension]);
    $profile_id = $sth->fetchAll()[0][0];
    if (empty($profile_id)) {
        return -1;
    }
    return $profile_id;
}

function get_callwaiting($mainextension) {
    $astman = FreePBX::create()->astman;
    if ($astman->connected()) {
        $cw = $astman->database_get("CW",$mainextension);
        if ($cw === "ENABLED") {
            return true;
        } else {
            return false;
        }
    }
    return -1;
}

function get_ringtime($mainextension) {
    $astman = FreePBX::create()->astman;
    if ($astman->connected()) {
        $rt = $astman->database_get("AMPUSER",$mainextension.'/ringtimer');
        return $rt;
    }
    return -1;
}

function get_callgroup($mainextension) {
    return getSipTableData($mainextension,'namedcallgroup');
}

function get_pickupgroup($mainextension) {
    return getSipTableData($mainextension,'namedpickupgroup');
}

function get_noanswerdest($mainextension) {
    $dbh = FreePBX::Database();
    $sql = 'SELECT `noanswer_dest` FROM `users` WHERE `extension` = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($mainextension));
    $data = $sth->fetchAll()[0][0];
    return $data;
}

function get_busydest($mainextension) {
    $dbh = FreePBX::Database();
    $sql = 'SELECT `busy_dest` FROM `users` WHERE `extension` = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($mainextension));
    $data = $sth->fetchAll()[0][0];
    return $data;
}

function get_notreachabledest($mainextension) {
    $dbh = FreePBX::Database();
    $sql = 'SELECT `chanunavail_dest` FROM `users` WHERE `extension` = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($mainextension));
    $data = $sth->fetchAll()[0][0];
    return $data;
}

function get_outboundcid($mainextension) {
    $dbh = FreePBX::Database();
    $sql = 'SELECT `outboundcid` FROM `users` WHERE `extension` = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($mainextension));
    $data = $sth->fetchAll()[0][0];
    return preg_replace('/^<|>$/','',$data);
}

function post_displayname($mainextensions,$data) {
    if (is_null($data)) {
        return true;
    }
    foreach ($mainextensions as $mainextension) {
        foreach (getExtension($mainextension) as $extension) {
            $displayname = preg_replace('/\?\?\?\?/',$mainextension,$data);
            $displayname = preg_replace('/\?\?\?/',substr($mainextension,-3),$displayname);
            $displayname = preg_replace('/\?\?/',substr($mainextension,-2),$displayname);
            $displayname = preg_replace('/\?/',substr($mainextension,-1),$displayname);
            //change caller ID
            $res = writeSipTableData($mainextension,'callerid',$displayname." <$mainextension>");
            if ($res !== true) {
                $err .= __FUNCTION__." ".$res."\n";
            }
            //change device displayname
            $dbh = FreePBX::Database();
            $sql = 'UPDATE `users` SET `name`=? WHERE `extension`=?';
            $sth = $dbh->prepare($sql);
            $res = $sth->execute(array($displayname,$extension));
            if ($res === FALSE) {
                $err .= __FUNCTION__." ".$sth->errorInfo()[2];
            }
        }
    }
    if (isset($err)) {
        return $err;
    }
    return true;
}

function post_context($mainextensions,$data) {
    if (is_null($data)) {
        return true;
    }
    foreach ($mainextensions as $mainextension) {
        foreach (getExtension($mainextension) as $extension) {
            $res = writeSipTableData($extension,'context',$data);
            if ($res !== true) {
                $err .= __FUNCTION__." ".$res."\n";
            }
        }
    }
    if (isset($err)) {
        return $err;
    }
    return true;
}

function post_profile($mainextensions,$data) {
    if (is_null($data)) {
        return true;
    }
    $dbh = FreePBX::Database();
    foreach ($mainextensions as $mainextension) {
        // Get user_id for mainextension
        $sql = "SELECT id FROM userman_users WHERE default_extension = ?";
        $sth = $dbh->prepare($sql);
        $sth->execute([$mainextension]);
        $user_id = $sth->fetchAll()[0][0];
        if (empty($user_id)) {
            $err .= __FUNCTION__." Can't retrieve user_id for extension $data\n";
        }
        // Set CTI Profile
        $res = setCTIUserProfile($user_id,$data);
        if ($res !== True) {
            $err .= __FUNCTION__." ".$res['error']."\n";
        }
    }
    if (isset($err)) {
        return $err;
    }
    return true;
}

function post_callgroup($mainextensions,$data) {
    if (is_null($data)) {
        return true;
    }
    foreach ($mainextensions as $mainextension) {
        foreach (getAllExtensions($mainextension) as $extension) {
            $res = writeSipTableData($extension,'namedcallgroup',$data);
            if ($res !== true) {
                $err .= __FUNCTION__." ".$res."\n";
            }
        }
    }
    if (isset($err)) {
        return $err;
    }
    return true;
}

function post_pickupgroup($mainextensions,$data) {
    if (is_null($data)) {
        return true;
    }
    foreach ($mainextensions as $mainextension) {
        foreach (getAllExtensions($mainextension) as $extension) {
            $res = writeSipTableData($extension,'namedpickupgroup',$data);
            if ($res !== true) {
                $err .= __FUNCTION__." ".$res."\n";
            }
        }
    }
    if (isset($err)) {
        return $err;
    }
    return true;
}

function post_callwaiting($mainextensions,$data) {
    if (is_null($data)) {
        return true;
    }
    $astman = FreePBX::create()->astman;
    if ($astman->connected()) {
        foreach ($mainextensions as $mainextension) {
            foreach (getAllExtensions($mainextension) as $extension) {
                if ($data === true) {
                    $astman->database_put("CW",$extension,'ENABLED');
                } else {
                    $astman->database_del("CW",$extension);
                }
            }
        }
    } else {
        return __FUNCTION__." [ERROR] Astman not connected";
    }
    return true;
}

function post_ringtime($mainextensions,$data) {
    if (is_null($data)) {
        return true;
    }
    $astman = FreePBX::create()->astman;
    if ($astman->connected()) {
        foreach ($mainextensions as $mainextension) {
            foreach (getAllExtensions($mainextension) as $extension) {
                $astman->database_put("AMPUSER",$extension.'/ringtimer',$data);
            }
        }
    } else {
        return __FUNCTION__." [ERROR] Astman not connected";
    }
    return true;
}

function writeUserTableData($extension,$field,$data){
    $dbh = FreePBX::Database();
    $sql = "UPDATE `users` SET `$field` = ? WHERE `extension` = ?";
    $sth = $dbh->prepare($sql);
    $res = $sth->execute(array($data,$extension));
    return $res;
}

function post_noanswerdest($mainextensions,$data) {
    if (is_null($data)) {
        return true;
    }
    foreach ($mainextensions as $mainextension) {
        $res = writeUserTableData($mainextension,'noanswer_dest',$data);
        if ($res !== true) {
            $err .= __FUNCTION__." ".$res."\n";
        }
    }
    if (isset($err)) {
        return $err;
    }
    return true;
}

function post_busydest($mainextensions,$data) {
    if (is_null($data)) {
        return true;
    }
    foreach ($mainextensions as $mainextension) {
        $res = writeUserTableData($mainextension,'busy_dest',$data);
        if ($res !== true) {
            $err .= __FUNCTION__." ".$res."\n";
        }
    }
    if (isset($err)) {
        return $err;
    }
    return true;
}

function post_notreachabledest($mainextensions,$data) {
    if (is_null($data)) {
        return true;
    }
    foreach ($mainextensions as $mainextension) {
        $res = writeUserTableData($mainextension,'chanunavail_dest',$data);
        if ($res !== true) {
            $err .= __FUNCTION__." ".$res."\n";
        }
    }
    if (isset($err)) {
        return $err;
    }
    return true;
}

function post_outboundcid($mainextensions,$data) {
    global $astman;
    if (is_null($data)) {
        return true;
    }
    foreach ($mainextensions as $mainextension) {
        foreach (getAllExtensions($mainextension) as $extension) {
            $res = writeUserTableData($extension,'outboundcid','<'.$data.'>');
            if ($res !== true) {
                $err .= __FUNCTION__." ".$res."\n";
            }
            $astman->database_put("AMPUSER",$extension."/outboundcid",$data);
        }
    }
    if (isset($err)) {
        return $err;
    }
    return true;
}
