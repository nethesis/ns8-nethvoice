<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

const CTI_PHONEBOOK_IMPORT_TIMEOUT = 900;

function triggerMiddlewareProfilesReload() {
    $token = isset($_ENV['NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN']) ? $_ENV['NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN'] : null;
    $portEnv = isset($_ENV['NETHVOICE_MIDDLEWARE_PORT']) ? $_ENV['NETHVOICE_MIDDLEWARE_PORT'] : null;

    if (!$token || $portEnv === null || $portEnv === '') {
        error_log('middleware profiles reload skipped: missing NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN or NETHVOICE_MIDDLEWARE_PORT');
        return;
    }

    if (!ctype_digit($portEnv)) {
        error_log('middleware profiles reload skipped: invalid NETHVOICE_MIDDLEWARE_PORT (non-numeric value)');
        return;
    }

    $port = (int)$portEnv;
    if ($port < 1 || $port > 65535) {
        error_log('middleware profiles reload skipped: invalid NETHVOICE_MIDDLEWARE_PORT (out of range 1-65535)');
        return;
    }

    $url = 'http://127.0.0.1:' . $port . '/admin/reload/profiles';
    $ch = curl_init($url);
    if ($ch === false) {
        error_log('middleware profiles reload failed: unable to initialize cURL for URL ' . $url);
        return;
    }

    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 2);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
    ));

    curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if (!empty($curlErr) || $httpCode < 200 || $httpCode >= 300) {
        error_log('middleware profiles reload failed: HTTP ' . $httpCode . ' ' . $curlErr);
    }
}

function triggerMiddlewareProfilesReloadAfterUserSync() {
    system('/bin/bash /var/www/html/freepbx/rest/lib/middlewareProfilesReloadHelper.sh > /dev/null 2>&1 &');
}

/**
 * Resolve the local middleware base URL from the environment, or null when the
 * super admin token / port are missing or invalid.
 */
function middlewareSuperAdminBaseUrl(&$token) {
    $token = isset($_ENV['NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN']) ? $_ENV['NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN'] : null;
    $portEnv = isset($_ENV['NETHVOICE_MIDDLEWARE_PORT']) ? $_ENV['NETHVOICE_MIDDLEWARE_PORT'] : null;

    if (!$token || $portEnv === null || $portEnv === '' || !ctype_digit((string)$portEnv)) {
        return null;
    }
    $port = (int)$portEnv;
    if ($port < 1 || $port > 65535) {
        return null;
    }
    return 'http://127.0.0.1:' . $port;
}

/**
 * Upload a CSV file to the middleware admin phonebook import endpoint, assigning
 * every contact to $owner. The CSV must already carry canonical column headers
 * plus a 'type' column encoding the visibility. Returns array('httpCode'=>int,
 * 'body'=>string) or false when the middleware is not reachable.
 */
function importCtiPhonebookCsv($owner, $csvPath) {
    $token = null;
    $base = middlewareSuperAdminBaseUrl($token);
    if ($base === null) {
        error_log('CTI phonebook import skipped: missing/invalid NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN or NETHVOICE_MIDDLEWARE_PORT');
        return false;
    }

    $url = $base . '/admin/phonebook/import';
    $ch = curl_init($url);
    if ($ch === false) {
        error_log('CTI phonebook import failed: unable to initialize cURL for URL ' . $url);
        return false;
    }

    $post = array(
        'username' => $owner,
        'file' => new CURLFile($csvPath, 'text/csv', basename($csvPath)),
    );

    curl_setopt_array($ch, ctiPhonebookImportCurlOptions($token, $post));

    $body = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($body === false || !empty($curlErr)) {
        error_log('CTI phonebook import failed: ' . $curlErr);
        return false;
    }
    return array('httpCode' => $httpCode, 'body' => $body);
}

function ctiPhonebookImportCurlOptions($token, array $post) {
    return array(
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => CTI_PHONEBOOK_IMPORT_TIMEOUT,
        CURLOPT_HTTPHEADER => array('Authorization: Bearer ' . $token),
        CURLOPT_POSTFIELDS => $post,
    );
}

function revokeMiddlewareUser($username) {
    $username = strtolower((string) $username);
    if (preg_match('/^[a-z0-9][a-z0-9._@-]*$/D', $username) !== 1 || strpos($username, '..') !== false) {
        return true;
    }
    $token = null;
    $base = middlewareSuperAdminBaseUrl($token);
    if ($base === null) {
        error_log('CTI user revocation skipped: missing/invalid NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN or NETHVOICE_MIDDLEWARE_PORT');
        return false;
    }
    $ch = curl_init($base . '/admin/2fa/' . rawurlencode($username));
    if ($ch === false) {
        return false;
    }
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Authorization: Bearer ' . $token));
    curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);
    if ($httpCode !== 204) {
        error_log('CTI user revocation failed: HTTP ' . $httpCode . ' ' . $curlErr);
        return false;
    }
    return true;
}

function deleteCtiUserData($username, $db = null, $revoke = 'revokeMiddlewareUser') {
    $deleted = (bool) $revoke($username);
    try {
        $db = $db ?? new \PDO(
            'mysql:host=' . getenv('NETHCTI_DB_HOST') . ';port=' . getenv('NETHCTI_DB_PORT') . ';dbname=nethcti3;charset=utf8',
            getenv('NETHCTI_DB_USER'),
            getenv('NETHCTI_DB_PASSWORD'),
            array(\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION)
        );
        $statements = array(
            'DELETE FROM user_settings WHERE username = ?' => array($username),
            'DELETE FROM user_nethlink WHERE user = ?' => array($username),
            'DELETE FROM auth WHERE user = ? OR user LIKE ?' => array($username, addcslashes((string) $username, '\\%_') . '\_phone-island\_%'),
        );
        foreach ($statements as $sql => $args) {
            $db->prepare($sql)->execute($args);
        }
    } catch (\Throwable $e) {
        error_log('Cannot delete the CTI data of ' . $username . ': ' . $e->getMessage());
        return false;
    }
    return $deleted;
}
