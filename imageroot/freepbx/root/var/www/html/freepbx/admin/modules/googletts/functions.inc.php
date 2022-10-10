<?php

#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of GoogleTTS FreePBX module.
#
#    GoogleTTS module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    GoogleTTS module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with GoogleTTS module.  If not, see <http://www.gnu.org/licenses/>.
#

function googletts_get_options() {
    $dbh = FreePBX::Database();
    $sql = 'SELECT keyword,value FROM googletts';
    $sth = $dbh->prepare($sql);
    $sth->execute(array());
    $res = $sth->fetchAll();
    $return = array();
    foreach ($res as $r) {
        $return[$r['keyword']] = $r['value'];
    }
    return $return;
}
function googletts_set_option($keyword, $value) {
    $dbh = FreePBX::Database();
    $sql = 'DELETE FROM googletts WHERE keyword = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($keyword));
    $sql = 'INSERT INTO googletts (keyword,value) VALUES (?,?)';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($keyword,$value));
    return $res;
}

function googletts_getAvailableVoices($lang=FALSE) {
    $voices = array(
        array('nl-NL','nl-NL-Standard-A','FEMALE'),
        array('nl-NL','nl-NL-Wavenet-A','FEMALE'),
        array('en-AU','en-AU-Standard-A','FEMALE'),
        array('en-AU','en-AU-Standard-B','MALE'),
        array('en-AU','en-AU-Standard-C','FEMALE'),
        array('en-AU','en-AU-Standard-D','MALE'),
        array('en-AU','en-AU-Wavenet-A','FEMALE'),
        array('en-AU','en-AU-Wavenet-B','MALE'),
        array('en-AU','en-AU-Wavenet-C','FEMALE'),
        array('en-AU','en-AU-Wavenet-D','MALE'),
        array('en-GB','en-GB-Standard-A','FEMALE'),
        array('en-GB','en-GB-Standard-B','MALE'),
        array('en-GB','en-GB-Standard-C','FEMALE'),
        array('en-GB','en-GB-Standard-D','MALE'),
        array('en-GB','en-GB-Wavenet-A','FEMALE'),
        array('en-GB','en-GB-Wavenet-B','MALE'),
        array('en-GB','en-GB-Wavenet-C','FEMALE'),
        array('en-GB','en-GB-Wavenet-D','MALE'),
        array('en-US','en-US-Standard-B','MALE'),
        array('en-US','en-US-Standard-C','FEMALE'),
        array('en-US','en-US-Standard-D','MALE'),
        array('en-US','en-US-Standard-E','FEMALE'),
        array('en-US','en-US-Wavenet-A','MALE'),
        array('en-US','en-US-Wavenet-B','MALE'),
        array('en-US','en-US-Wavenet-C','FEMALE'),
        array('en-US','en-US-Wavenet-D','MALE'),
        array('en-US','en-US-Wavenet-E','FEMALE'),
        array('en-US','en-US-Wavenet-F','FEMALE'),
        array('fr-FR','fr-FR-Standard-A','FEMALE'),
        array('fr-FR','fr-FR-Standard-B','MALE'),
        array('fr-FR','fr-FR-Standard-C','FEMALE'),
        array('fr-FR','fr-FR-Standard-D','MALE'),
        array('fr-FR','fr-FR-Wavenet-A','FEMALE'),
        array('fr-FR','fr-FR-Wavenet-B','MALE'),
        array('fr-FR','fr-FR-Wavenet-C','FEMALE'),
        array('fr-FR','fr-FR-Wavenet-D','MALE'),
        array('fr-CA','fr-CA-Standard-A','FEMALE'),
        array('fr-CA','fr-CA-Standard-B','MALE'),
        array('fr-CA','fr-CA-Standard-C','FEMALE'),
        array('fr-CA','fr-CA-Standard-D','MALE'),
        array('de-DE','de-DE-Standard-A','FEMALE'),
        array('de-DE','de-DE-Standard-B','MALE'),
        array('de-DE','de-DE-Wavenet-A','FEMALE'),
        array('de-DE','de-DE-Wavenet-B','MALE'),
        array('de-DE','de-DE-Wavenet-C','FEMALE'),
        array('de-DE','de-DE-Wavenet-D','MALE'),
        array('it-IT','it-IT-Standard-A','FEMALE'),
        array('it-IT','it-IT-Wavenet-A','FEMALE'),
        array('ja-JP','ja-JP-Standard-A','FEMALE'),
        array('ja-JP','ja-JP-Wavenet-A','FEMALE'),
        array('ko-KR','ko-KR-Standard-A','FEMALE'),
        array('ko-KR','ko-KR-Wavenet-A','FEMALE'),
        array('pt-BR','pt-BR-Standard-A','FEMALE'),
        array('es-ES','es-ES-Standard-A','FEMALE'),
        array('sv-SE','sv-SE-Standard-A','FEMALE'),
        array('tr-TR','tr-TR-Standard-A','FEMALE')
    );
    if ($lang === FALSE) {
        return $voices;
    }
    $ret = array();
    foreach ($voices as $voice) {
        if (is_array($lang)) {
            foreach ($lang as $l => $name) {
                if (substr($voice[0],0,2) === $l) {
                    $ret[] = $voice;
                }
            }
        } else {
            if (substr($voice[0],0,2) === $lang) {
                $ret[] = $voice;
            }
        }
    }
    return $ret;
}

function googletts_tts($text,$lang='it',$voicename=FALSE){
    $voice = FALSE;
    if ($voicename === FALSE) {
        $availableVoicesa = googletts_getAvailableVoices($lang);
        foreach (googletts_getAvailableVoices($lang) as $v) {
            $voice = $v;
        }
    } else {
        foreach (googletts_getAvailableVoices() as $v) {
            if ($voicename == $v[1]) {
                $voice = $v;
                break;
            }
        }
    }
    if ($voice === FALSE) {
        return FALSE;
    }

    $checksum = md5($text.$lang.$voice[1]);
    $tmpfilepath = '/tmp/'.$checksum . '.mp3';
    //ask Google for audio
    $options = googletts_get_options();
    $google_api_key = $options['API_KEY'];
    $baseurl = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    $url = $baseurl . '?key=' . $google_api_key;
    $data = array(
        'input' => array(
            'text' => $text),
        'voice' => array(
            'languageCode' => $voice[0],
            'name' => $voice[1],
            'ssmlGender' => $voice[2]
            ),
        'audioConfig' => array(
            'audioEncoding' => 'MP3')
        );
    $data = json_encode($data);
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HEADER, FALSE);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
    curl_setopt( $ch, CURLOPT_HTTPHEADER, array('Content-Type:application/json'));
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $return = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_errno($ch);
    $errmsg = curl_error($ch);
    $header = curl_getinfo($ch);
    curl_close($ch);

    if ($errmsg) {
        throw new Exception($errmsg);
    }
    if ($httpCode != 200) {
        throw new Exception($return);
    }
    $return = json_decode($return);

    // save audio into $filepath
    if (file_put_contents($tmpfilepath, base64_decode($return->audioContent)) !== FALSE ) {
        return $checksum;
    } 
    return FALSE;
}

function googletts_get_unsaved_audio($checksum) {
    if (file_exists('/tmp/'.$checksum . '.mp3')) {
        return base64_encode(file_get_contents('/tmp/'.$checksum . '.mp3'));
    }
    return FALSE;
}

function googletts_save_recording($filename,$langdir,$name,$description) {
    global $amp_conf;
    $tmpfilepath = '/tmp/'.$filename.'.mp3';
    $dstfilepath = $amp_conf['ASTVARLIBDIR'] . '/sounds/' . $langdir . '/custom/' . $filename . '.wav';
    $media = FreePBX::Media();
    $media->load($tmpfilepath);
    $media->convert($dstfilepath);
    FreePBX::Recordings()->addRecording($name,$description,'custom/' . $filename);
    foreach (FreePBX::Recordings()->getAll() as $recording) {
        if ($recording['filename'] === 'custom/' . $filename) {
            return $recording['id'];
        }
    }
    
    return FALSE;
}



