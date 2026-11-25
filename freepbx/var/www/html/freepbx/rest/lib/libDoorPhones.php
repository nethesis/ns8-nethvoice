<?php
#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

/*
 * Door phones for the video sources: inventory, Tancredi variables and SIP
 * registration of the provisioned devices whose model has the
 * "cap_door_phone" capability. See libStreaming.php for the pure helpers.
 */

require_once __DIR__ . '/libStreaming.php';

class DoorPhoneException extends \RuntimeException
{
}

/* Call the local Tancredi API as the FreePBX admin, return [code, decoded body] */
function door_phone_tancredi(string $method, string $path, ?array $body = null): array
{
    include '/var/www/html/freepbx/rest/config.inc.php';
    $dbh = FreePBX::Database();
    $stmt = $dbh->prepare("SELECT `username`, `password_sha1` FROM `ampusers` WHERE `username` = 'admin'");
    $stmt->execute();
    $admin = $stmt->fetch(\PDO::FETCH_ASSOC);
    if (!$admin) {
        throw new DoorPhoneException('FreePBX admin user not found');
    }
    $secretKey = sha1($admin['username'] . $admin['password_sha1'] . $config['settings']['secretkey']);
    $port = $_ENV['TANCREDIPORT'] ?? getenv('TANCREDIPORT');
    if (!$port) {
        throw new DoorPhoneException('TANCREDIPORT is not set');
    }
    $ch = curl_init('http://127.0.0.1:' . $port . '/tancredi/api/v1' . $path);
    $headers = [
        'Accept: application/json',
        'User: ' . $admin['username'],
        'SecretKey: ' . $secretKey,
    ];
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json;charset=utf-8';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $response = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($response === false) {
        throw new DoorPhoneException("Tancredi $method $path failed");
    }
    $decoded = json_decode((string) $response, true);
    return [$code, is_array($decoded) ? $decoded : []];
}

/*
 * Tancredi variables of a phone, null if the phone does not exist:
 * "variables" merged with the model and the defaults.
 */
function door_phone_variables(string $mac): ?array
{
    [$code, $phone] = door_phone_tancredi('GET', '/phones/' . $mac . '?inherit=1');
    if ($code === 404) {
        return null;
    }
    if ($code !== 200) {
        throw new DoorPhoneException("Tancredi phone $mac: HTTP $code");
    }
    $phone['variables'] = isset($phone['variables']) && is_array($phone['variables']) ? $phone['variables'] : [];
    return $phone;
}

/* Registrar contacts of an extension, decoded from the Asterisk database */
function door_phone_contacts(string $extension): array
{
    global $astman;
    $contacts = [];
    if (!$astman || !preg_match('/^\d+$/', $extension)) {
        return $contacts;
    }
    foreach ((array) $astman->database_show('registrar/contact') as $key => $value) {
        if (strpos((string) $key, '/registrar/contact/' . $extension . ';') !== 0) {
            continue;
        }
        $contact = json_decode((string) $value, true);
        if (is_array($contact) && (string) ($contact['endpoint'] ?? '') === $extension) {
            $contacts[] = $contact;
        }
    }
    return $contacts;
}

/*
 * Provisioned devices assigned to an extension, with a model of the door
 * phone kind, as API items (no secrets). Keyed by MAC (AA-BB-CC-DD-EE-FF).
 */
function door_phone_list(array $sources): array
{
    $dbh = FreePBX::Database();
    $stmt = $dbh->query("SELECT `mac`, `model`, `extension` FROM `rest_devices_phones`
        WHERE `type` = 'physical' AND `mac` IS NOT NULL AND `mac` != ''
        AND `extension` IS NOT NULL AND `extension` != ''");
    $names = $dbh->prepare('SELECT `description` FROM `devices` WHERE `id` = ?');
    $items = [];
    foreach ($stmt->fetchAll(\PDO::FETCH_ASSOC) as $device) {
        $mac = streaming_door_phone_mac((string) $device['mac']);
        if ($mac === null || isset($items[$mac])) {
            continue;
        }
        $phone = door_phone_variables($mac);
        if ($phone === null || !streaming_is_door_phone($phone['variables'])) {
            continue;
        }
        $names->execute([(string) $device['extension']]);
        $device['name'] = (string) $names->fetchColumn();
        $device['model'] = (string) ($phone['model'] ?? $device['model']);
        $device['model_name'] = door_phone_model_name($device['model']);
        $ip = streaming_contact_address(door_phone_contacts((string) $device['extension']));
        $items[$mac] = streaming_door_phone_item($device, $phone['variables'], $ip, $sources);
    }
    return $items;
}

/* Display name of a Tancredi model, the model id when unknown */
function door_phone_model_name(string $model): string
{
    static $names = null;
    if ($names === null) {
        $names = [];
        [$code, $models] = door_phone_tancredi('GET', '/models');
        if ($code === 200) {
            foreach ($models as $item) {
                if (isset($item['name'])) {
                    $names[$item['name']] = (string) ($item['display_name'] ?? $item['name']);
                }
            }
        }
    }
    return $names[$model] ?? $model;
}

/*
 * Make sure a door phone has its RTSP password: when missing, it is generated,
 * stored as the Tancredi phone variable "door_rtsp_password" and the device is
 * asked to fetch its configuration. Return true when something was generated.
 */
function door_phone_ensure_credentials(string $mac, array $phone, string $extension): bool
{
    $missing = streaming_door_phone_missing_credentials($phone['variables']);
    if (!$missing) {
        return false;
    }
    [$code] = door_phone_tancredi('PATCH', '/phones/' . $mac, ['variables' => $missing]);
    if ($code !== 200) {
        throw new DoorPhoneException("cannot store the password of door phone $mac: HTTP $code");
    }
    door_phone_resync($extension);
    return true;
}

/* Ask a phone to fetch its configuration again, like /phones/reconfigure */
function door_phone_resync(string $extension): bool
{
    global $astman;
    if (!$astman || !preg_match('/^\d+$/', $extension)) {
        return false;
    }
    $res = $astman->send_request('Command', ['Command' => "pjsip send notify generic-reload endpoint $extension"]);
    $data = is_array($res) ? ($res['data'] ?? '') : '';
    if (!is_array($res) || ($res['Response'] ?? '') !== 'Success' || preg_match('/failed.$/m', $data) || preg_match('/^Unable/m', $data)) {
        error_log("door phone $extension: configuration update request failed");
        return false;
    }
    return true;
}

/* Extension of the provisioned device with this MAC, null if none */
function door_phone_extension(string $mac): ?string
{
    $dbh = FreePBX::Database();
    $stmt = $dbh->prepare("SELECT `extension` FROM `rest_devices_phones` WHERE `mac` = ? AND `extension` IS NOT NULL AND `extension` != ''");
    $stmt->execute([str_replace('-', ':', $mac)]);
    $extension = $stmt->fetchColumn();
    return $extension === false ? null : (string) $extension;
}

/*
 * Addresses of a door phone from its current SIP registration: the address
 * it registers from (LAN) and the public address the SIP proxy sees, when
 * different. Empty when the door phone is not registered.
 */
function door_phone_addresses(string $mac): array
{
    $extension = door_phone_extension($mac);
    if ($extension === null) {
        return [];
    }
    $contacts = door_phone_contacts($extension);
    return array_values(array_filter([streaming_contact_address($contacts), streaming_contact_public_address($contacts)]));
}

/*
 * Password of a source sent with "door_phone" (see
 * streaming_door_phone_secret) for the source URL $url: null when the
 * request does not use it. The stored password goes only to the door phone:
 * the host of the URL must be an address of its current registration
 * (door_phone_addresses), or the URL must keep the device of the stored
 * source $current already linked to the same door phone. Otherwise the
 * administrator must type the password (validation error on "secret").
 */
function door_phone_request_secret(array $data, string $url, ?array $current = null, ?callable $variables = null, ?callable $addresses = null): ?string
{
    if (!isset($data['door_phone']) || !is_string($data['door_phone']) || $data['door_phone'] === '') {
        return null;
    }
    $mac = streaming_door_phone_mac($data['door_phone']);
    if ($mac === null) {
        throw new StreamingValidationException('door_phone', 'invalid door phone');
    }
    $phone = ($variables ?? 'door_phone_variables')($mac);
    if ($phone === null || !streaming_is_door_phone($phone['variables'])) {
        throw new StreamingValidationException('door_phone', 'door phone not found');
    }
    $secret = streaming_door_phone_secret($data, $phone['variables']);
    if ($secret === null || streaming_parse_url($url) === null) {
        return null;
    }
    if ($current !== null && (string) ($current['door_phone'] ?? '') === $mac
        && streaming_url_endpoint((string) $current['url']) === streaming_url_endpoint($url)) {
        return $secret;
    }
    if (!streaming_url_host_in($url, ($addresses ?? 'door_phone_addresses')($mac))) {
        throw new StreamingValidationException('secret', 'the door phone password is sent only to the address the door phone registers from: type the password', "door phone $mac, URL host not allowed");
    }
    return $secret;
}

/*
 * Give the sources linked to a door phone ("door_phone") the current password
 * of the door phone: at every configuration reload, and when the
 * administrator saves the settings of a door phone ($mac). Return the number of updated sources. Errors are logged: a source
 * keeps its stored password when Tancredi cannot be read.
 */
function door_phone_sync_sources(\PDO $db, ?string $mac = null, ?callable $variables = null): int
{
    $variables = $variables ?? 'door_phone_variables';
    $updated = 0;
    if ($mac === null) {
        $stmt = $db->query("SELECT `descr`, `user`, `secret`, `door_phone` FROM `rest_cti_streaming` WHERE `door_phone` IS NOT NULL AND `door_phone` != ''");
    } else {
        $stmt = $db->prepare("SELECT `descr`, `user`, `secret`, `door_phone` FROM `rest_cti_streaming` WHERE `door_phone` = ?");
        $stmt->execute([$mac]);
    }
    $update = $db->prepare('UPDATE `rest_cti_streaming` SET `secret` = ? WHERE `descr` = ?');
    foreach ($stmt->fetchAll(\PDO::FETCH_ASSOC) as $row) {
        try {
            $phoneMac = streaming_door_phone_mac((string) $row['door_phone']);
            $phone = $phoneMac !== null ? $variables($phoneMac) : null;
            if ($phone === null || !streaming_is_door_phone($phone['variables'])) {
                continue;
            }
            $secret = streaming_door_phone_secret(['user' => (string) $row['user'], 'secret' => ''], $phone['variables']);
            if ($secret !== null && $secret !== (string) $row['secret']) {
                $update->execute([$secret, $row['descr']]);
                $updated++;
            }
        } catch (\Throwable $e) {
            error_log("video source {$row['descr']}: cannot read the password of door phone {$row['door_phone']}: " . $e->getMessage());
        }
    }
    return $updated;
}

/*
 * Reachability of the URL of a source (TCP connect only, see
 * streaming_tcp_reachability). When the PBX does not reach it and the door
 * phone registers from a public address that the PBX reaches on the same
 * port, that address is suggested ("public_address", "public_url").
 */
function door_phone_reachability(string $url, ?string $mac): array
{
    $result = streaming_tcp_reachability($url);
    $result['public_address'] = null;
    $result['public_url'] = null;
    if ($result['reachable'] || $mac === null) {
        return $result;
    }
    $extension = door_phone_extension($mac);
    if ($extension === null) {
        return $result;
    }
    $public = streaming_contact_public_address(door_phone_contacts($extension));
    if ($public === null || $public === $result['host']) {
        return $result;
    }
    $publicUrl = streaming_url_with_host($url, $public);
    if ($publicUrl !== null && streaming_tcp_reachability($publicUrl)['reachable']) {
        $result['public_address'] = $public;
        $result['public_url'] = $publicUrl;
    }
    return $result;
}
