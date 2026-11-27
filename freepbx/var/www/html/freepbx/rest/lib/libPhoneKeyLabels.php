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

class TancrediKeyLabelsClient {
    const CONCURRENCY = 20;

    private $url;
    private $headers;

    public function __construct($restConfigFile = '/var/www/html/freepbx/rest/config.inc.php') {
        global $config;
        $settings = is_array($config['settings'] ?? null) ? $config['settings'] : tancrediRestSettings($restConfigFile);
        $port = getenv('TANCREDIPORT') ?: ($settings['tancredi_port'] ?? '');
        $secret = $settings['secretkey'] ?? ($_ENV['NETHVOICESECRETKEY'] ?? getenv('NETHVOICESECRETKEY'));
        if (empty($port) || empty($secret)) {
            throw new RuntimeException('Missing Tancredi credentials');
        }
        $passwordHash = FreePBX::Database()
            ->query("SELECT `password_sha1` FROM `ampusers` WHERE `username` = 'admin'")
            ->fetchColumn();
        if (empty($passwordHash)) {
            throw new RuntimeException('Missing Tancredi credentials');
        }
        $this->url = 'http://127.0.0.1:'.$port.'/tancredi/api/v1/';
        $this->headers = array(
            'Accept: application/json;charset=utf-8',
            'User: admin',
            'SecretKey: '.sha1('admin'.$passwordHash.$secret),
        );
    }

    public function get($path) {
        $result = $this->getMany(array($path));
        if (!is_array($result[$path])) {
            throw new RuntimeException('Cannot read '.$path.' from Tancredi');
        }
        return $result[$path];
    }

    public function getMany(array $paths) {
        $results = array();
        foreach (array_chunk($paths, self::CONCURRENCY) as $chunk) {
            $multi = curl_multi_init();
            $handles = array();
            foreach ($chunk as $path) {
                $handle = curl_init($this->url.$path);
                curl_setopt_array($handle, array(
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HTTPHEADER => $this->headers,
                    CURLOPT_CONNECTTIMEOUT => 2,
                    CURLOPT_TIMEOUT => 5,
                ));
                curl_multi_add_handle($multi, $handle);
                $handles[$path] = $handle;
            }
            do {
                $status = curl_multi_exec($multi, $running);
                if ($running && curl_multi_select($multi, 1.0) === -1) {
                    usleep(10000);
                }
            } while ($running && $status === CURLM_OK);
            foreach ($handles as $path => $handle) {
                $body = curl_multi_getcontent($handle);
                $decoded = curl_getinfo($handle, CURLINFO_HTTP_CODE) === 200 && is_string($body) ? json_decode($body, true) : null;
                $results[$path] = is_array($decoded) ? $decoded : null;
                curl_multi_remove_handle($multi, $handle);
                curl_close($handle);
            }
            curl_multi_close($multi);
        }
        return $results;
    }

    public function patch($path, array $body) {
        $data = json_encode($body);
        $handle = curl_init($this->url.$path);
        curl_setopt_array($handle, array(
            CURLOPT_CUSTOMREQUEST => 'PATCH',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POSTFIELDS => $data,
            CURLOPT_HTTPHEADER => array_merge($this->headers, array('Content-Type: application/json;charset=utf-8')),
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_TIMEOUT => 5,
        ));
        curl_exec($handle);
        $code = curl_getinfo($handle, CURLINFO_HTTP_CODE);
        curl_close($handle);
        if ($code < 200 || $code >= 300) {
            throw new RuntimeException('Cannot write '.$path.' to Tancredi: HTTP '.$code);
        }
    }
}

function tancrediRestSettings($file) {
    if (!is_readable($file)) {
        return array();
    }
    $config = null;
    include $file;
    return is_array($config['settings'] ?? null) ? $config['settings'] : array();
}

function isCustomPhoneModelName($name) {
    return count(explode('-', (string) $name)) > 2 && !in_array((string) $name, array('fanvil-X3SG-PRO'), true);
}

function phoneKeyLabelChanges(array $variables, $extension, $oldLabel, $newLabel) {
    $changes = array();
    foreach ($variables as $name => $value) {
        if (!is_scalar($value) || !preg_match('/^(linekey|expkey)_value_([0-9]+)$/', (string) $name, $matches)) {
            continue;
        }
        $label = $matches[1].'_label_'.$matches[2];
        if (trim((string) $value) === $extension && isset($variables[$label]) && is_scalar($variables[$label]) && trim((string) $variables[$label]) === $oldLabel) {
            $changes[$label] = $newLabel;
        }
    }
    return $changes;
}

function updatePhoneKeyLabels($extension, $oldLabel, $newLabel, $client) {
    $result = array('key_labels_updated' => 0, 'key_labels_incomplete' => false);
    $extension = trim((string) $extension);
    $oldLabel = trim((string) $oldLabel);
    $newLabel = trim((string) $newLabel);
    if ($extension === '' || $oldLabel === '' || $oldLabel === $newLabel) {
        return $result;
    }

    try {
        $paths = array();
        foreach ($client->get('phones') as $phone) {
            if (is_array($phone) && isset($phone['mac']) && is_string($phone['mac']) && $phone['mac'] !== '') {
                $paths[] = 'phones/'.rawurlencode($phone['mac']);
            }
        }
        foreach ($client->get('models') as $model) {
            if (is_array($model) && isset($model['name']) && is_string($model['name']) && isCustomPhoneModelName($model['name'])) {
                $paths[] = 'models/'.rawurlencode($model['name']);
            }
        }
        $scopes = $client->getMany($paths);
    } catch (Throwable $e) {
        error_log('Cannot read the phone key labels from Tancredi: '.$e->getMessage());
        $result['key_labels_incomplete'] = true;
        return $result;
    }

    foreach ($paths as $path) {
        $scope = $scopes[$path] ?? null;
        if (!is_array($scope) || !isset($scope['variables']) || !is_array($scope['variables'])) {
            error_log('Cannot read '.$path.' from Tancredi to update the phone key labels');
            $result['key_labels_incomplete'] = true;
            continue;
        }
        $changes = phoneKeyLabelChanges($scope['variables'], $extension, $oldLabel, $newLabel);
        if (empty($changes)) {
            continue;
        }
        try {
            $client->patch($path, array('variables' => $changes));
            $result['key_labels_updated'] += count($changes);
        } catch (Throwable $e) {
            error_log('Cannot update the phone key labels: '.$e->getMessage());
            $result['key_labels_incomplete'] = true;
        }
    }
    return $result;
}

function updateReassignedKeyLabels($extension, $oldLabel, $newLabel, $client = null) {
    $oldLabel = trim((string) $oldLabel);
    if ($oldLabel === '' || $oldLabel === trim((string) $newLabel)) {
        return array('key_labels_updated' => 0, 'key_labels_incomplete' => false);
    }
    try {
        return updatePhoneKeyLabels($extension, $oldLabel, $newLabel, $client ?? new TancrediKeyLabelsClient());
    } catch (Throwable $e) {
        error_log('Cannot update the phone key labels: '.$e->getMessage());
        return array('key_labels_updated' => 0, 'key_labels_incomplete' => true);
    }
}
