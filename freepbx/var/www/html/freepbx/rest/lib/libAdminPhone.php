<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
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

include_once __DIR__.'/libExtensions.php';

define('ADMINPHONE_KVSTORE_ID', 'adminphone');
define('ADMINPHONE_ACCOUNTCODE', 'nv-admin');
define('ADMINPHONE_DEFAULT_NAME', 'Admin (test)');
define('ADMINPHONE_NAME_MAX_LENGTH', 50);
define('ADMINPHONE_SIP_HOST', '127.0.0.1');
define('ADMINPHONE_CONTEXT', 'nethvoice-adminphone');
define('ADMINPHONE_LOCK', '/var/run/nethvoice/adminphone.lock');
define('ADMINPHONE_AUTH_CONF', '/etc/asterisk/pjsip.auth.conf');

function adminPhoneLocked(callable $callback, $lockFile = ADMINPHONE_LOCK) {
    $lock = fopen($lockFile, 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Cannot lock the administrator phone');
    }
    try {
        return $callback();
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function adminPhoneReload() {
    system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
}

function adminPhoneCandidates() {
    $candidates = array();
    for ($i = 0; $i < 100; $i++) {
        $candidates[] = '77'.sprintf('%04d', $i);
    }
    return $candidates;
}

function adminPhoneStoredExtension() {
    $extension = FreePBX::Nethcti3()->getConfig('extension', ADMINPHONE_KVSTORE_ID);
    return empty($extension) ? null : (string) $extension;
}

function adminPhoneStoredName() {
    $name = FreePBX::Nethcti3()->getConfig('display_name', ADMINPHONE_KVSTORE_ID);
    return empty($name) ? ADMINPHONE_DEFAULT_NAME : (string) $name;
}

function adminPhoneNormalizeName($name) {
    if ($name === null) {
        return null;
    }
    if (!is_string($name)) {
        throw new InvalidArgumentException('display_name must be a string');
    }
    $name = trim(preg_replace('/[\x00-\x1F\x7F<>"]/u', '', $name));
    if ($name === '' || iconv_strlen($name, 'UTF-8') > ADMINPHONE_NAME_MAX_LENGTH) {
        throw new InvalidArgumentException('display_name must be 1-'.ADMINPHONE_NAME_MAX_LENGTH.' characters');
    }
    return $name;
}

function adminPhoneSipData($extension) {
    $dbh = FreePBX::Database();
    $stmt = $dbh->prepare('SELECT `keyword`, `data` FROM `sip` WHERE `id` = ?');
    $stmt->execute(array($extension));
    $data = array();
    foreach ($stmt->fetchAll(\PDO::FETCH_ASSOC) as $row) {
        $data[$row['keyword']] = (string) $row['data'];
    }
    return $data;
}

function adminPhoneExtensionExists($extension) {
    return $extension !== null && array_key_exists('secret', adminPhoneSipData($extension));
}

function adminPhoneStatus() {
    $extension = adminPhoneStoredExtension();
    $enabled = adminPhoneExtensionExists($extension);
    return array(
        'enabled' => $enabled,
        'extension' => $enabled ? $extension : null,
    );
}

function adminPhoneIsFree($candidate) {
    if (checkFreeExtension($candidate) !== true) {
        return false;
    }
    $dbh = FreePBX::Database();
    $stmt = $dbh->prepare('SELECT `id` FROM `sip` WHERE `id` = ? LIMIT 1');
    $stmt->execute(array(substr($candidate, 2)));
    return $stmt->fetchColumn() === false;
}

function adminPhoneChooseExtension($preferred = null) {
    $candidates = adminPhoneCandidates();
    if ($preferred !== null) {
        array_unshift($candidates, $preferred);
    }
    foreach (array_unique($candidates) as $candidate) {
        if (adminPhoneIsFree($candidate)) {
            return $candidate;
        }
    }
    throw new RuntimeException('No free number available for the administrator phone');
}

function adminPhoneDesiredSettings() {
    return array(
        'allow' => NETHVOICE_CODECS_SOFTPHONE,
        'rewrite_contact' => 'yes',
        'media_encryption' => 'no',
        'outbound_proxy' => '',
        'force_rport' => 'yes',
        'rtp_symmetric' => 'yes',
        'transport' => '0.0.0.0-udp',
        'direct_media' => 'no',
        'accountcode' => ADMINPHONE_ACCOUNTCODE,
        'context' => ADMINPHONE_CONTEXT,
    );
}

function adminPhoneApplySettings($extension, $name) {
    global $astman;
    $changed = false;
    $current = adminPhoneSipData($extension);
    foreach (adminPhoneDesiredSettings() as $keyword => $value) {
        if (!array_key_exists($keyword, $current) || $current[$keyword] !== $value) {
            setSipData($extension, $keyword, $value);
            $changed = true;
        }
    }
    if ($astman->database_get('AMPUSER', $extension.'/accountcode') !== ADMINPHONE_ACCOUNTCODE) {
        $astman->database_put('AMPUSER', $extension.'/accountcode', ADMINPHONE_ACCOUNTCODE);
        $changed = true;
    }
    if ($astman->database_get('CW', $extension) !== false) {
        $astman->database_del('CW', $extension);
        $changed = true;
    }
    if (FreePBX::Nethcti3()->setExtensionsDisplayName(array($extension), $name, $extension)) {
        $changed = true;
    }
    return $changed;
}

function adminPhoneNewSecret() {
    return bin2hex(random_bytes(16));
}

function adminPhoneEnsure($name = null) {
    $nethcti3 = FreePBX::Nethcti3();
    $name = adminPhoneNormalizeName($name);
    if ($name === null) {
        $name = adminPhoneStoredName();
    } elseif ($name !== adminPhoneStoredName()) {
        $nethcti3->setConfig('display_name', $name, ADMINPHONE_KVSTORE_ID);
    }

    $extension = adminPhoneStoredExtension();
    $created = false;
    if (!adminPhoneExtensionExists($extension)) {
        $extension = adminPhoneChooseExtension($extension);
        $res = FreePBX::create()->Core->processQuickCreate('pjsip', $extension, array(
            'name' => $name,
            'outboundcid' => '',
            'vm' => 'no',
        ));
        if (!is_array($res) || empty($res['status'])) {
            throw new RuntimeException('Cannot create the administrator phone extension '.$extension);
        }
        setSipData($extension, 'secret', adminPhoneNewSecret());
        $nethcti3->setConfig('extension', $extension, ADMINPHONE_KVSTORE_ID);
        $created = true;
    }

    $changed = adminPhoneApplySettings($extension, $name);
    return array(
        'extension' => $extension,
        'display_name' => $name,
        'created' => $created,
        'changed' => $created || $changed,
    );
}

function adminPhoneWriteAuthSecret($extension, $secret, $file = ADMINPHONE_AUTH_CONF) {
    $config = @file_get_contents($file);
    if (!is_string($config)) {
        return false;
    }
    $header = '/^\['.preg_quote($extension.'-auth', '/').'\][ \t]*\R/m';
    if (preg_match($header, $config, $match, PREG_OFFSET_CAPTURE) !== 1) {
        return false;
    }
    $start = $match[0][1] + strlen($match[0][0]);
    $end = preg_match('/^\[/m', $config, $next, PREG_OFFSET_CAPTURE, $start) === 1 ? $next[0][1] : strlen($config);
    $section = substr($config, $start, $end - $start);
    $updated = preg_replace('/^password=.*$/m', 'password='.$secret, $section, 1, $count);
    if ($count !== 1) {
        return false;
    }
    if ($updated === $section) {
        return true;
    }
    return file_put_contents($file, substr($config, 0, $start).$updated.substr($config, $end), LOCK_EX) !== false;
}

function adminPhoneReloadSip() {
    global $astman;
    $result = $astman->send_request('Command', array('Command' => 'module reload res_pjsip.so'));
    return is_array($result) && ($result['Response'] ?? '') !== 'Error';
}

function adminPhoneDropContacts($extension) {
    global $astman;
    $prefix = '/registrar/contact/'.$extension.';@';
    $dropped = 0;
    foreach ((array) $astman->database_show('registrar/contact') as $key => $value) {
        if (strpos((string) $key, $prefix) === 0 && $astman->database_del('registrar', substr((string) $key, strlen('/registrar/')))) {
            $dropped++;
        }
    }
    return $dropped;
}

function adminPhoneRotateSecret($extension, $authFile = ADMINPHONE_AUTH_CONF) {
    $secret = adminPhoneNewSecret();
    setSipData($extension, 'secret', $secret);
    $live = adminPhoneWriteAuthSecret($extension, $secret, $authFile) && adminPhoneReloadSip();
    adminPhoneDropContacts($extension);
    return $live;
}

function adminPhoneRevoke($lockFile = ADMINPHONE_LOCK, $authFile = ADMINPHONE_AUTH_CONF, ?callable $reload = null) {
    return adminPhoneLocked(function () use ($authFile, $reload) {
        $extension = adminPhoneStoredExtension();
        if (!adminPhoneExtensionExists($extension)) {
            return false;
        }
        if (!adminPhoneRotateSecret($extension, $authFile)) {
            ($reload ?? 'adminPhoneReload')();
        }
        return true;
    }, $lockFile);
}

function adminPhoneSecret($extension) {
    $data = adminPhoneSipData($extension);
    return isset($data['secret']) ? $data['secret'] : null;
}

function adminPhoneSession($env, $name = null, $authFile = ADMINPHONE_AUTH_CONF) {
    $port = isset($env['ASTERISK_SIP_UDP_PORT']) ? (int) $env['ASTERISK_SIP_UDP_PORT'] : 0;
    if ($port <= 0) {
        throw new RuntimeException('ASTERISK_SIP_UDP_PORT is not set');
    }
    $state = adminPhoneEnsure($name);
    if (!$state['created'] && !adminPhoneRotateSecret($state['extension'], $authFile)) {
        $state['changed'] = true;
    }
    return array(
        'session' => array(
            'extension' => $state['extension'],
            'secret' => adminPhoneSecret($state['extension']),
            'display_name' => $state['display_name'],
            'sip_host' => ADMINPHONE_SIP_HOST,
            'sip_port' => $port,
            'cti_host' => isset($env['NETHCTI_UI_HOST']) ? (string) $env['NETHCTI_UI_HOST'] : '',
            'reloading' => $state['changed'],
        ),
        'changed' => $state['changed'],
    );
}

function adminPhoneDelete() {
    global $astman;
    $nethcti3 = FreePBX::Nethcti3();
    $extension = adminPhoneStoredExtension();
    if ($extension === null) {
        return false;
    }
    $existed = adminPhoneExtensionExists($extension);
    if ($existed) {
        $core = FreePBX::create()->Core;
        $core->delUser($extension);
        $core->delDevice($extension);
        $astman->database_del('CW', $extension);
    }
    $nethcti3->setConfig('extension', false, ADMINPHONE_KVSTORE_ID);
    return $existed;
}
