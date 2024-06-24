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

$reqGet = $_GET['getType'];
$reqPost = $_POST['getType'];


if ($reqGet && ($reqGet === "tools")) {
    switch ($_GET['rest']) {
        case 'getvoices':
            $res = googletts_getAvailableVoices($_GET['lang']);
            echo json_encode($res);
            break;

        case 'getaudio':
            $res = googletts_get_unsaved_audio($_GET['token']);
            echo $res;
            break;
        
        case 'getkey':
            $res = googletts_get_options();
            echo json_encode($res);
        default:
            break;
    }    
} else if ($reqPost && ($reqPost === "tools")) {
    switch ($_POST['rest']) {
        case 'ttstext':
            $res = googletts_tts($_POST['text'], $_POST['lang'], $_POST['voice']);
            echo json_encode($res);
            break;

        case 'savetts':
            $res = googletts_save_recording($_POST['token'], $_POST['lang'], $_POST['name'], $_POST['desc']);
            echo $res;
            break;

        case 'savekey':
            $res = googletts_set_option("API_KEY", $_POST['key']);
            echo $res;
        default:
            break;
    }    
} else {

    $json = file_get_contents("php://input");
    
    if ($json) {
        $jsonArray = json_decode($json, true);
        $type = $jsonArray['type'];
        $rest = $jsonArray['rest'];
    
        switch ($type) {
            case 'timegroup':
    
                if ($rest == "get") {
    
                    $select = FreePBX::Timeconditions()->getTimeGroup($jsonArray['id']);
                    $dbh = FreePBX::Database();
                    $sql = "SELECT * FROM timegroups_details WHERE timegroupid = ".$jsonArray['id'];
                    $final = $dbh->sql($sql, 'getAll', \PDO::FETCH_ASSOC);
    
                    if ($final) {
    
                        foreach ($final as $key => $value) {
                            $explode = explode("|", $value["time"]);

                            $times = explode("-", $explode[0]);
                            $wdays = explode("-", $explode[1]);
                            $mdays = explode("-", $explode[2]);
                            $months = explode("-", $explode[3]);

                            $times_start = explode(":", $times[0]);

                            $final[$key]["hour_start"] = trim($times_start[0], " ");
                            $spliths = str_split($final[$key]["hour_start"]); 
                            if ($spliths[0] == "0") {
                                $final[$key]["hour_start"] = $spliths[1];
                            }

                            $final[$key]["minute_start"] = trim($times_start[1], " ");
                            $splitms = str_split($final[$key]["minute_start"]); 
                            if ($splitms[0] == "0") {
                                $final[$key]["minute_start"] = $splitms[1];
                            }

                            if ($times[1]) {
                                $times_finish = explode(":", $times[1]);
                                $final[$key]["hour_finish"] = trim($times_finish[0], " ");
                                $final[$key]["minute_finish"] = trim($times_finish[1], " ");
                            } else {
                                $final[$key]["hour_finish"] = trim($times_start[0], " ");
                                $final[$key]["minute_finish"] = trim($times_start[1], " ");
                            }

                            $splithf = str_split($final[$key]["hour_finish"]); 
                            if ($splithf[0] == "0") {
                                $final[$key]["hour_finish"] = $splithf[1];
                            }
                            $splitmf = str_split($final[$key]["minute_finish"]); 
                            if ($splitmf[0] == "0") {
                                $final[$key]["minute_finish"] = $splitmf[1];
                            }
                            
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
    
                    $addedTime = FreePBX::Timeconditions()->addTimeGroup($jsonArray["times"][0]['name'], $jsonArray["times"]);
                    echo $addedTime;
    
                } else if ($rest == "update") {
    
                    $updateName = FreePBX::Timeconditions()->editTimeGroup( $jsonArray['id'], $jsonArray["times"][0]['name'] );
                    $updateTime = FreePBX::Timeconditions()->editTimes( $jsonArray['id'], $jsonArray["times"] );
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
        if ($_SERVER['REQUEST_METHOD'] == "POST") {
          $filename = $_FILES['file1']['name'];
          $size = $_FILES['file1']['size'];
          if(strlen($filename)) {
            list($txt, $ext) = explode(".", $filename);
            if(in_array($ext,$valid_formats1)) {
              $actual_image_name = $timevar."-".$txt.".".$ext;
              $tmp = $_FILES['file1']['tmp_name'];
              move_uploaded_file($tmp, $path.$actual_image_name);
            }
          }
        }
        echo $timevar."-".$filename;
    }
} 