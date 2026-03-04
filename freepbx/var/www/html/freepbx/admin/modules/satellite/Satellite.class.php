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

class Satellite extends \FreePBX_Helpers implements \BMO
{
    public function __construct($freepbx = null) {
        if ($freepbx == null)
            throw new Exception("Not given a FreePBX Object");

        $this->FreePBX = $freepbx;
        $this->db = $freepbx->Database;
    }

    public function install() {
    }
    public function uninstall() {
    }
    public function backup() {
    }
    public function restore($backup) {
    }

    public function get_available_voices() {
        $satellitePort = getenv('SATELLITE_HTTP_PORT') ?: '8080';
        $satelliteToken = getenv('SATELLITE_API_TOKEN') ?: '';
        $url = 'http://127.0.0.1:' . $satellitePort . '/api/get_models';

        $headers = array('Accept: application/json');
        if ($satelliteToken !== '') {
            $headers[] = 'Authorization: Bearer ' . $satelliteToken;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPGET, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errmsg = curl_error($ch);
        curl_close($ch);

        if ($errmsg) {
            throw new \Exception($errmsg);
        }

        if ($httpCode !== 200 || $response === false || $response === '') {
            throw new \Exception(is_string($response) ? $response : 'Satellite get_models request failed');
        }

        $payload = json_decode($response, true);
        if (!is_array($payload) || !isset($payload['models']) || !is_array($payload['models'])) {
            throw new \Exception('Invalid response from Satellite get_models API');
        }

        $voicesByLanguage = array();
        foreach ($payload['models'] as $model) {
            if (!is_string($model) || trim($model) === '') {
                continue;
            }

            $model = trim($model);
            $parts = explode('-', $model);
            $language = strtolower(end($parts));

            if ($language === '') {
                continue;
            }

            if (!isset($voicesByLanguage[$language])) {
                $voicesByLanguage[$language] = array();
            }
            $voicesByLanguage[$language][] = $model;
        }

        foreach ($voicesByLanguage as $language => $voices) {
            $voices = array_values(array_unique($voices));
            sort($voices);
            $voicesByLanguage[$language] = $voices;
        }

        ksort($voicesByLanguage);

        return $voicesByLanguage;
    }

    public function tts($text, $model = '', $language = 'en', $force = false) {
        $text = trim((string) $text);
        $model = trim((string) $model);
        $language = trim((string) $language);

        if ($text === '') {
            throw new \Exception('Missing required field: text');
        }

        $checksum = md5($text . '|' . $model . '|' . $language);
        if (!$force && file_exists('/tmp/satellite-' . $checksum . '.mp3')) {
            return $checksum;
        }

        $tmpfilepath = '/tmp/satellite-' . $checksum . '.mp3';

        $satellitePort = getenv('SATELLITE_HTTP_PORT') ?: '8080';
        $satelliteToken = getenv('SATELLITE_API_TOKEN') ?: '';
        $url = 'http://127.0.0.1:' . $satellitePort . '/api/get_speech';

        $payload = array('text' => $text);
        if ($model !== '') {
            $payload['model'] = $model;
        }
        if ($language !== '') {
            $payload['language'] = $language;
        }

        $headers = array(
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: audio/mpeg',
        );
        if ($satelliteToken !== '') {
            $headers[] = 'Authorization: Bearer ' . $satelliteToken;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 300);

        $audio = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errmsg = curl_error($ch);
        curl_close($ch);

        if ($errmsg) {
            throw new \Exception($errmsg);
        }

        if ($httpCode !== 200 || $audio === false || $audio === '') {
            throw new \Exception(is_string($audio) ? $audio : 'Satellite TTS request failed');
        }

        if (file_put_contents($tmpfilepath, $audio) === false) {
            throw new \Exception('Failed to save TTS audio file to ' . $tmpfilepath);
        }

        return $checksum;
    }

    public function get_unsaved_audio($checksum) {
        $checksum = trim((string) $checksum);
        if ($checksum === '') {
            throw new \Exception('Missing required field: checksum');
        }

        if (!preg_match('/^[a-f0-9]{32}$/', $checksum)) {
            throw new \Exception('Invalid checksum format');
        }

        $tmpfilepath = '/tmp/satellite-' . $checksum . '.mp3';
        if (!file_exists($tmpfilepath)) {
            throw new \Exception('TTS audio file not found: ' . $tmpfilepath);
        }

        $contents = file_get_contents($tmpfilepath);
        if ($contents === false) {
            throw new \Exception('Failed to read TTS audio file: ' . $tmpfilepath);
        }

        return base64_encode($contents);
    }

    public function delete_temp_audio($checksum) {
        $checksum = trim((string) $checksum);
        if ($checksum === '') {
            throw new \Exception('Missing required field: checksum');
        }

        if (!preg_match('/^[a-f0-9]{32}$/', $checksum)) {
            throw new \Exception('Invalid checksum format');
        }

        $tmpfilepath = '/tmp/satellite-' . $checksum . '.mp3';
        if (!file_exists($tmpfilepath)) {
            throw new \Exception('TTS audio file not found: ' . $tmpfilepath);
        }

        if (!@unlink($tmpfilepath)) {
            throw new \Exception('Failed to delete TTS audio file: ' . $tmpfilepath);
        }

        return true;
    }

    public function save_recording($filename='', $language = 'en', $name = '', $description = '', $text = '', $model = '') {
        global $amp_conf;

        $filename = trim((string) $filename);
        if ($filename !== '' && !preg_match('/^[a-zA-Z0-9._-]+$/', $filename)) {
            throw new \Exception('Invalid filename format');
        }

        if ($language === '') {
            $language = 'en';
        } else {
            $language = trim((string) $language);
            if (!preg_match('/^[a-z]{2}$/', $language)) {
                throw new \Exception('Invalid language format');
            }
        }

        $tmpfilepath = '/tmp/satellite-' . $filename . '.mp3';

        if ($filename === '' || !file_exists($tmpfilepath)) {
            if ($text === '') {
                throw new \Exception('Missing required field: filename or text');
            } else {
                $checksum = $this->tts($text, $model, $language);
                $tmpfilepath = '/tmp/satellite-' . $checksum . '.mp3';
                if (!file_exists($tmpfilepath)) {
                    throw new \Exception('Generated TTS audio file not found');
                }
                $filename = $checksum;
            }
        }

        if ($name === '') {
            $name = 'TTS Recording ' . date('Y-m-d H:i:s') . ' ' . $filename;
        }
        if ($description === '') {
            $description = 'TTS recording ' . date('Y-m-d H:i:s');
        }

        $dstfilepath = $amp_conf['ASTVARLIBDIR'] . '/sounds/' . $language . '/custom/' . $filename . '.wav';
        $dstdir = dirname($dstfilepath);
        if (!is_dir($dstdir)) {
            mkdir($dstdir, 0755, true);
        }

        $media = FreePBX::Media();
        $media->load($tmpfilepath);
        $media->convert($dstfilepath);

        FreePBX::Recordings()->addRecording($name, $description, 'custom/' . $filename);
        foreach (FreePBX::Recordings()->getAll() as $recording) {
            if ($recording['filename'] === 'custom/' . $filename) {
                return $recording['id'];
            }
        }

        return false;
    }


}
