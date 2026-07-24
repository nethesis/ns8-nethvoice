<?php

if (!@include_once(getenv('FREEPBX_CONF') ? getenv('FREEPBX_CONF') : '/etc/freepbx.conf')) {
    include_once('/etc/asterisk/freepbx.conf');
}

/*check auth*/
session_start();
if (!isset($_SESSION['AMP_user']) || !$_SESSION['AMP_user']->checkSection('visualplan')) {
    exit(1);
}

// bypass freepbx authentication
define('FREEPBX_IS_AUTH', 1);

// Include all installed modules class
if ($handle = opendir(__DIR__. '/../..')) {
    while (false !== ($entry = readdir($handle))) {
        if ($entry != "." && $entry != "..") {
            $moduleClass = __DIR__. '/../../'. $entry. '/'. ucfirst($entry). '.class.php';
            $funcFile = __DIR__. '/../../'. $entry. '/functions.inc.php';

            // include main module class
            if (is_file($moduleClass)) {
                include_once($moduleClass);
            }

            // include functions.inc.php (deprecated but neeeded for some modules)
            if (is_file($funcFile)) {
                include_once($funcFile);
            }
        }
    }
    closedir($handle);
}

$reqGet = $_GET['getType'] ?? '';
$reqPost = $_POST['getType'] ?? '';


if ($reqGet === "tools") {
    switch ($_GET['rest'] ?? '') {
        case 'getvoices':
            try {
                $lang = strtolower(trim((string)($_GET['lang'] ?? '')));
                $availableVoices = FreePBX::Satellite()->get_available_voices();
                $res = array();

                if ($lang !== '' && isset($availableVoices[$lang]) && is_array($availableVoices[$lang])) {
                    foreach ($availableVoices[$lang] as $voice) {
                        $res[] = array($lang, $voice);
                    }
                }
                echo json_encode($res);
            } catch (\Exception $e) {
                // Return empty voices on any error so the dialog still opens
                error_log("getvoices failed: " . $e->getMessage());
                echo json_encode([]);
            }
            break;

        case 'getaudio':
            try {
                $res = FreePBX::Satellite()->get_unsaved_audio($_GET['token'] ?? '');
                echo $res;
            } catch (\Exception $e) {
                http_response_code(400);
                error_log("Error retrieving unsaved audio: " . $e->getMessage());
                echo json_encode(['error' => $e->getMessage()]);
            }
            break;
        default:
            break;
    }    
} else if ($reqPost === "tools") {
    switch ($_POST['rest'] ?? '') {
        case 'ttstext':
            try {
                $res = FreePBX::Satellite()->tts(
                    $_POST['text'] ?? '',
                    $_POST['voice'] ?? '',
                    $_POST['lang'] ?? ''
                );
                echo json_encode($res);
            } catch (\Exception $e) {
                http_response_code(500);
                error_log("Error generating TTS audio: " . $e->getMessage());
                echo json_encode(['error' => $e->getMessage()]);
            }
            break;

        case 'savetts':
            try {
                $res = FreePBX::Satellite()->save_recording(
                    $_POST['token'] ?? '',
                    $_POST['lang'] ?? '',
                    $_POST['name'] ?? '',
                    $_POST['desc'] ?? ''
                );
                echo $res;
            } catch (\Exception $e) {
                http_response_code(500);
                error_log("Error saving TTS recording: " . $e->getMessage());
                echo json_encode(['error' => $e->getMessage()]);
            }
            break;
        default:
            break;
    }    
} else {

    $json = file_get_contents("php://input");
    
    if ($json) {
        $jsonArray = json_decode($json, true);
        if (!is_array($jsonArray)) {
            http_response_code(400);
            echo json_encode(array('error' => 'Invalid JSON request'));
            return;
        }

        $type = $jsonArray['type'] ?? '';
        $rest = $jsonArray['rest'] ?? '';
    
        switch ($type) {
            case 'timegroup':
    
                if ($rest == "get") {

                    $id = (int)($jsonArray['id'] ?? 0);
                    $select = FreePBX::Timeconditions()->getTimeGroup($id);
                    $dbh = FreePBX::Database();
                    $sql = "SELECT * FROM timegroups_details WHERE timegroupid = ".$id;
                    $final = $dbh->sql($sql, 'getAll', \PDO::FETCH_ASSOC);
    
                    if ($final) {
    
                        foreach ($final as $key => $value) {
                            $explode = array_pad(explode("|", (string)($value["time"] ?? '')), 4, '');

                            $times = array_pad(explode("-", $explode[0]), 2, '');
                            $wdays = explode("-", $explode[1]);
                            $mdays = explode("-", $explode[2]);
                            $months = explode("-", $explode[3]);

                            $times_start = array_pad(explode(":", $times[0]), 2, '');

                            $final[$key]["hour_start"] = trim($times_start[0], " ");
                            $final[$key]["hour_start"] = preg_replace('/^0(?=\d)/', '', $final[$key]["hour_start"]);

                            $final[$key]["minute_start"] = trim($times_start[1], " ");
                            $final[$key]["minute_start"] = preg_replace('/^0(?=\d)/', '', $final[$key]["minute_start"]);

                            if ($times[1] !== '') {
                                $times_finish = array_pad(explode(":", $times[1]), 2, '');
                                $final[$key]["hour_finish"] = trim($times_finish[0], " ");
                                $final[$key]["minute_finish"] = trim($times_finish[1], " ");
                            } else {
                                $final[$key]["hour_finish"] = trim($times_start[0], " ");
                                $final[$key]["minute_finish"] = trim($times_start[1], " ");
                            }

                            $final[$key]["hour_finish"] = preg_replace('/^0(?=\d)/', '', $final[$key]["hour_finish"]);
                            $final[$key]["minute_finish"] = preg_replace('/^0(?=\d)/', '', $final[$key]["minute_finish"]);
                            
                            $final[$key]["wday_start"] = isset($wdays[0]) ? trim($wdays[0], " ") : "-";
                            $final[$key]["wday_finish"] = isset($wdays[1]) ? trim($wdays[1], " ") : (isset($wdays[0]) ? trim($wdays[0], " ") : "-");
    
                            $final[$key]["mday_start"] = isset($mdays[0]) ? trim($mdays[0], " ") : "-";
                            $final[$key]["mday_finish"] = isset($mdays[1]) ? trim($mdays[1], " ") : (isset($mdays[0]) ? trim($mdays[0], " ") : "-");
    
                            $final[$key]["month_start"] = isset($months[0]) ? trim($months[0], " ") : "-";
                            $final[$key]["month_finish"] = isset($months[1]) ? trim($months[1], " ") : (isset($months[0]) ? trim($months[0], " ") : "-");
                        }
                    }
    
                    echo json_encode($final);
    
                } else if ($rest == "set") {

                    $times = is_array($jsonArray['times'] ?? null) ? $jsonArray['times'] : array();
                    $name = $times[0]['name'] ?? '';
                    $addedTime = FreePBX::Timeconditions()->addTimeGroup($name, $times);
                    echo $addedTime;

                } else if ($rest == "update") {

                    $id = (int)($jsonArray['id'] ?? 0);
                    $times = is_array($jsonArray['times'] ?? null) ? $jsonArray['times'] : array();
                    $name = $times[0]['name'] ?? '';
                    $updateName = FreePBX::Timeconditions()->editTimeGroup($id, $name);
                    $updateTime = FreePBX::Timeconditions()->editTimes($id, $times);
                    echo json_encode($updateName);
    
                }
    
                break;
            
            default:
                break;
        }
        
    } else {
        $timevar = time();
        $path = "/var/spool/asterisk/tmp/";
        $valid_formats1 = array("mp3", "wav");
        $actual_image_name = "";
        if (($_SERVER['REQUEST_METHOD'] ?? '') == "POST" && isset($_FILES['file1']) && is_array($_FILES['file1'])) {
          $filename = (string)($_FILES['file1']['name'] ?? '');
          if(strlen($filename)) {
            // Derive the extension safely (handles names with multiple/zero dots)
            // and strip any unsafe characters from the base so a client-controlled
            // filename can never influence the on-disk path. Dots are removed too:
            // the client re-applies its own dot-collapsing to the returned name, so
            // the stored name must have a single dot (before the extension) to match.
            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            $base = preg_replace('/[^A-Za-z0-9_-]/', '_', pathinfo($filename, PATHINFO_FILENAME));
            if($base !== "" && in_array($ext, $valid_formats1, true)) {
              $candidate = $timevar."-".$base.".".$ext;
              $tmp = $_FILES['file1']['tmp_name'] ?? '';
              // Only advertise the name to the client if the file is actually stored.
              if(move_uploaded_file($tmp, $path.$candidate)) {
                $actual_image_name = $candidate;
              }
            }
          }
        }
        // Return the exact on-disk name as plain text: the client (View.js) uses this value
        // verbatim as the temp filename for the recordings convert/remove API, so it must match
        // the stored file byte-for-byte. text/plain also prevents any HTML rendering of the name.
        header('Content-Type: text/plain; charset=utf-8');
        echo $actual_image_name;
    }
}
