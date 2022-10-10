<?php

/**
 * This script is used to:
 * - extract asterisk elements informations using the freepbx functions and
 * - return the object used by draw2D library
 * - render the figures in the visualplan
 */

// INCLUDE FREEPBX FUNCTIONS
if (!@include_once(getenv('FREEPBX_CONF') ? getenv('FREEPBX_CONF') : '/etc/freepbx.conf')) {
    include_once('/etc/asterisk/freepbx.conf');
}

// check auth
session_start();
if (!isset($_SESSION['AMP_user']) || !$_SESSION['AMP_user']->checkSection('visualplan')) {
    exit(1);
}

// bypass freepbx authentication
define('FREEPBX_IS_AUTH', 1);

// include all installed modules class
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

// read i18n data
$lang = $_COOKIE['lang'];
if (empty($lang)) {
    $lang = "en";
}
$langParts = explode("_", $lang);
$languages = file_get_contents("i18n/".$langParts[0].".js");
$languages = substr($languages, 0, -1);
$langParts = explode("=", $languages);
$language = trim($langParts[1]);
$langArray = json_decode($language, true);

/**
 *  GET ELEMENTS ALL DATA AND CREATE DATA OBJECT 
 */

// incoming data (inbound routes)
$get_data = FreePBX::Core()->getAllDIDs('extension');
foreach ($get_data as $key => $row) {
    if ($row['cidnum'] != "") {
        $data['incoming'][$row['extension']." / ".$row['cidnum']]['destination'] = $row['destination'];
        $data['incoming'][$row['extension']." / ".$row['cidnum']]['description'] = $row['description'];
    } else {
        $data['incoming'][$row['extension']." / "]['destination'] = $row['destination'];
        $data['incoming'][$row['extension']." / "]['description'] = $row['description'];
    }
}

// internal data - from-did-direct,id,1
$get_data = FreePBX::Core()->listUsers(false);
foreach ($get_data as $key => $row) {
    if (preg_match('/^9\d(\d){3,}$/', $row[0]) < 1) {
        $data['from-did-direct'][$row[0]] = array(
            "name" => $row[1],
            "voicemail" => $row[2]
        );
    }
}

// voicemail - ext-local,vm(b|s|u)201,1
$get_data = FreePBX::Core()->listUsers(false);
foreach ($get_data as $key => $row) {
    if ($row[2] != "novm") {
        $data['ext-local'][$row[0]] = array(
            "name" => $row[1],
            "voicemail" => $row[2]
        );
    }
}

// ivr - ivr-id,s,1
$get_data = FreePBX::Ivr()->getDetails();
foreach ($get_data as $key => $row) {
    $data['ivr'][$row['id']]["name"] = $row['name'];
    $data['ivr'][$row['id']]["id"] = $row['id'];
    $data['ivr'][$row['id']]["description"] = $row['description'];
    $data['ivr'][$row['id']]["announcement"] = $row['announcement'];
    $data['ivr'][$row['id']]["invalid_destination"] = $row['invalid_destination'];
    $data['ivr'][$row['id']]["timeout_destination"] = $row['timeout_destination'];
    $selection_data = ivr_get_entries($row['id']);
    foreach ($selection_data as $key => $value) {
        $data['ivr'][$row['id']]['selections'][$value['selection']] = array(
            "selection" => $value['selection'],
            "dest" => $value['dest']
        );
    }
}

// cqr - nethcqr-id,s,1
$get_cqr = nethcqr_get_details();
foreach ($get_cqr as $row) {
    $data['cqr'][$row['id_cqr']]["id"] = $row['id_cqr'];
    $data['cqr'][$row['id_cqr']]["name"] = $row['name'];
    $data['cqr'][$row['id_cqr']]["description"] = $row['description'];
    $data['cqr'][$row['id_cqr']]["announcement"] = $row['announcement'];
    $data['cqr'][$row['id_cqr']]["default_destination"] = $row['default_destination'];
    $get_entries = nethcqr_get_entries($row['id_cqr']);
    foreach ($get_entries as $key => $value) {
        $data['cqr'][$row['id_cqr']]['selections'][$value['position']] = array( "position" => $value['pisition'],
            "condition" => $value['condition'],
            "dest" => $value['destination']
        );
    }
}

// time conditions
$get_data = FreePBX::Timeconditions()->listTimeconditions(false);
foreach ($get_data as $key => $row) {
    $data['timeconditions'][$row['timeconditions_id']] = array(
        "displayname" => $row['displayname'],
        "time" => $row['time'],
        "truegoto" => $row['truegoto'],
        "falsegoto" => $row['falsegoto']
    );
}
$timegroups = FreePBX::Timeconditions()->listTimegroups();
foreach ($timegroups as $key => $row) {
    $data['timegroups'][$row[0]] = array(
        "id" => $row[0],
        "description" => $row[1]
    );
}

// announcement - app-announcement-1,s,1
$get_data = FreePBX::Announcement()->getAnnouncements();
foreach ($get_data as $key => $row) {
    $rec_details = recordings_get($row['recording_id']);
    $data['app-announcement'][$row['announcement_id']] = array(
        "description" => $row['description'],
        "id" => $row['announcement_id'],
        "postdest" => $row['post_dest'],
        "rec_name" => $rec_details['displayname'],
        "rec_id" => $row['recording_id']
    );
}
$recordings = FreePBX::Recordings()->getAllRecordings(true);
foreach ($recordings as $key => $row) {
    $data['recordings'][$row[0]] = array(
        "name" => $row[1],
        "description" => $row[3]
    );
}

// call group - ext-group,id,1
$get_data = FreePBX::Ringgroups()->listRinggroups(false);
error_log(print_r($get_data, true));

foreach ($get_data as $key => $row) {
    $group_details = ringgroups_get($row['grpnum']);
    $data['ext-group'][$row['grpnum']] = array(
        "num" => $row['grpnum'],
        "description" => $group_details['description'],
        "grplist" => $group_details['grplist'],
        "postdest" => $group_details['postdest'],
        "strategy" => $group_details['strategy'],
        "grptime" => $group_details['grptime']
    );
}

// conference - ext-meetme,id,1
$get_data = FreePBX::Conferences()->listConferences();
foreach ($get_data as $key => $row) {
    $data['ext-meetme'][$row[0]] = array(
        "description" => $row[1],
        "id"=> $row[0]
    );
}

// queues - ext-queues,id,1
$get_data = FreePBX::Queues()->listQueues(false);
foreach ($get_data as $key => $row) {
    $queues_details = queues_get($row[0]);$data['ext-queues'][$row[0]] = array(
        "num" => $row[0],
        "descr" => $queues_details['name'],
        "dest" => $queues_details['goto'],
        "members" => $queues_details['member'],
        "dynmembers" => $queues_details['dynmembers'],
        "strategy" => $queues_details['strategy'],
        "maxwait" => $queues_details['maxwait'],
        "timeout" => $queues_details['timeout']
    );
}

// flow call control - app-daynight,0,1
$get_data = daynight_list();
foreach ($get_data as $key => $row) {
    $daynight_obj = daynight_get_obj($row['ext']);
    $data['app-daynight'][$row['ext']] = array(
        "name"=> $daynight_obj['fc_description'],
        "control_code"=> "*28".$row['ext'],
        "ext"=> $row['ext'],
        "green_flow"=> $daynight_obj['day'],
        "red_flow"=> $daynight_obj['night']
    );
}
$data['codeavailable'] = daynight_get_avail();

// INITIALIZE DRAW2D OBJECT COMPONENTS
$widgets = array(); // 
$connections = array();
$destArray = array();

$xPos = 10;
$yPos = 10;

$widgetTemplate = array(
    "userData"=> array(),
    "bgColor"=> "#95a5a6",
    "radius"=> "20"
);
$connectionTemplate = array(
    "type"=> "MyConnection",
    "userData"=> array(),
    "cssClass"=> "draw2d_Connection",
    "stroke"=> 2,
    "color"=> "#4caf50",
    "outlineStroke"=> 1,
    "router"=> "draw2d.layout.connection.SplineConnectionRouter",
    "source"=> array(
        "node"=> "",
        "port"=> ""
    ),
    "target"=> array(
        "node"=> "",
        "port"=> ""
    )
 );

// START HANDLING REQUESTS
foreach ($_GET as $key => $value) {
    switch ($key) {

        case "readData":
            $name = trim($_GET["readData"]);
            print_r(/*nethvplan_json_pretty(*/json_encode($data[$name], true));
        break;

        case "getAll":
            $name = $_GET["getAll"];
            $widContainer = array();
            foreach ($data[$name] as $key => $value) {
                if ($name == "ext-local") {
                    $key = "vmb".$key;
                }
                $wid = nethvplan_bindData($data, $name, $key);
                array_push($widContainer, $wid);
            }
            print_r(/*nethvplan_json_pretty(*/json_encode($widContainer, true));
        break;

        case "getChild":
            $tmpDestArray = array();

            $dest = base64_decode($_GET["getChild"]);
            $finalDest = base64_decode($_GET["getChildDest"]);
            $pieces = explode("|", $finalDest);
            unset($pieces[count($pieces)-1]);

            foreach ($pieces as $d) {
                $cDest = explode("%", $dest);
                $connection = nethvplan_bindConnection($data, $cDest[0], $cDest[1]);

                if (is_array($connection[0])) {
                    foreach ($connection as $arr) {
                        array_push($connections, $arr);
                    }
                } else {
                    array_push($connections, $connection);
                }

                nethvplan_explore($data, $d, $tmpDestArray);
            }

            // print output
            $merged = array_merge($widgets, $connections);
            $result = array();
            foreach ($merged as $place) {
                if (!array_key_exists($place['id'], $result)) {
                    $result[$place['id']] = $place;
                }
            }
            $merged = $result;
            print_r(/*nethvplan_json_pretty(*/json_encode($merged, true));
        break;

        case "id":
            // start elaboration
            $id = $_GET["id"];
            $destination = $data['incoming'][$id]['destination'];
            $description = $data['incoming'][$id]['description'];

            if ($id != "") {
                // get destination field and id
                $res = nethvplan_getDestination($destination);
                $dest = $res[0];
                $idDest = $res[1];

                $connection = $connectionTemplate;
                $connection['id'] = "incoming%".$id."=".$destination;
                $connection['source'] = array(
                    "node"=> "incoming%".$id,
                    "port"=> "output_route_num-incoming%".$id
                );
                $connection['target'] = array(
                    "node"=> $dest."%".$idDest,
                    "port"=> "input_".$dest."%".$idDest,
                    "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
                );

                // add connection
                array_push($connections, $connection);

                // start exploring of connections
                nethvplan_explore($data, $destination, $destArray);

                $widget = nethvplan_bindData($data, "incoming", $id);
                // add widget
                array_push($widgets, $widget);
            }

            // print output
            $merged = array_merge($widgets, $connections);
            $result = array();
            foreach ($merged as $place) {
                if (!array_key_exists($place['id'], $result)) {
                    $result[$place['id']] = $place;
                }
            }
            $merged = $result;

            // echo("CIAO");
            // print_r($merged);

            print_r(/*nethvplan_json_pretty(*/json_encode($merged, true));
        break;
    }
}

function nethvplan_cmpAnnun($a, $b)
{
    if ($a['announcement_id'] == $b['announcement_id']) {
        return 0;
    }
    return ($a['announcement_id'] < $b['announcement_id']) ? -1 : 1;
}
function nethvplan_cmpTime($a, $b)
{
    if ($a['timeconditions_id'] == $b['timeconditions_id']) {
        return 0;
    }
    return ($a['timeconditions_id'] < $b['timeconditions_id']) ? -1 : 1;
}

// get destination from asterisk destination id
function nethvplan_getDestination($destination)
{
    if (preg_match('/ivr-*/', $destination)) {
        $values = explode(",", $destination);
        $dests = explode("-", $values[0]);
        $dest = $dests[0];
        $id = $dests[1];
    } elseif (preg_match('/app-announcement-*/', $destination)) {
        $values = explode(",", $destination);
        $dests = explode("-", $values[0]);
        $dest = $dests[0]."-".$dests[1];
        $id = $dests[2];
    } elseif (preg_match('/^night/', $destination)) {
        $values = explode(",", $destination);
        $dest = $values[0];
        $id = substr($values[1], 1, -1);
    } elseif (preg_match('/nethcqr*/', $destination)) {
        $values = explode(",", $destination);
        $dest = "cqr";
        $id = $values[1];
    } else {
        $values = explode(",", $destination);
        $dest = $values[0];
        $id = $values[1];
    }

    return array($dest, $id);
}

function nethvplan_timeZoneOffset()
{
    global $amp_conf;
    try {
        $tz = $amp_conf['timezone'];
        $dtz = new DateTimeZone($tz);
        $dt = new DateTime("now", $dtz);
    } catch (Exception $e) {
        $tz = date_default_timezone_get();
        $dtz = new DateTimeZone($tz);
        $dt = new DateTime("now", $dtz);
    }
    $utc_dtz = new DateTimeZone("UTC");
    $utc_dt = new DateTime("now", $utc_dtz);
    $offset = $dtz->getOffset($dt) - $utc_dtz->getOffset($utc_dt);
    $now = time() + $offset;

    return $offset;
}

/**
 * @method
 * 
 * Creates draw2D objects for figures creation.
 * 
 * @param {Object} $data - All asterisk elements data.
 * @param {string} $dest - The element destination/name.
 * @param {string} $id - The element id .
 **/
function nethvplan_bindData($data, $dest, $id)
{
    global $langArray;
    global $widgetTemplate;
    $widget = $widgetTemplate;
    if (!empty($data[$dest][$id]['userData'])) {
        $widget['userData'] = $data[$dest][$id]['userData'];        
    }

    switch ($dest) {
        case "incoming":
            $widget['type'] = "Base";
            $widget['id'] = "incoming%".$id;
            $widget['radius'] = "20";
            $widget['bgColor'] = "#87d37c";
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_incoming_string"];
            $widget['entities'][] = array(
                "text"=> $id." ( ".$data[$dest][$id]['description']." )",
                "id"=> "route_num-incoming%".$id,
                "type"=> "output",
                "destination"=> $data[$dest][$id]['destination']
            );
            $widget['entities'][] = array(
              "text"=> $langArray["base_details_string"],
              "id"=> $id,
              "type"=> "text",
              "destination"=> "",
              "cssClass"=> "link"
            );
        break;
        
        case "from-did-direct":
            $widget['type'] = "Base";
            $widget['radius'] = "20";
            $widget['bgColor'] = "#27ae60";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_from_did_direct_string"];
            $widget['entities'][] = array(
                "text"=> $data[$dest][$id]['name']." ( ".$id." )",
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
            $widget['entities'][] = array(
              "text"=> $langArray["base_details_string"],
              "id"=> $id,
              "type"=> "text",
              "destination"=> "",
              "cssClass"=> "link"
            );
        break;
        
        case "ext-meetme":
            $widget['type'] = "Base";
            $widget['radius'] = "20";
            $widget['bgColor'] = "#65c6bb";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_ext_meetme_string"];
            $widget['entities'][] = array(
                "text"=> $data[$dest][$id]['description']." ( ".$data[$dest][$id]['id']." )",
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
            $widget['entities'][] = array(
              "text"=> $langArray["base_details_string"],
              "id"=> $id,
              "type"=> "text",
              "destination"=> "",
              "cssClass"=> "link"
            );
            $widget['userData'] = array(
                "name"=> html_entity_decode($data[$dest][$id]['description']),
                "extension"=> $data[$dest][$id]['id']
            );
        break;
        
        case "app-blackhole":
            $widget['type'] = "Base";
            $widget['radius'] = "20";
            $widget['bgColor'] = "#cf000f";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_hangup_string"];
            $widget['entities'][] = array(
                "text"=> $langArray["base_hangup_string"],
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
        break;
        
        case "ext-local":
            $idUsers = substr($id, 3);

            $widget['type'] = "Base";
            $widget['radius'] = "20";
            $widget['bgColor'] = "#16a085";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_ext_local_string"];
            $widget['entities'][] = array(
                "text"=> $data['from-did-direct'][$idUsers]['name']." ( ".$idUsers." ) - ".$langArray["base_busy_string"],
                "id"=> $dest."%vmb".$idUsers,
                "type"=> "input"
            );
            $widget['entities'][] = array(
                "text"=> $data['from-did-direct'][$idUsers]['name']." ( ".$idUsers." ) - ".$langArray["base_nomsg_string"],
                "id"=> $dest."%vms".$idUsers,
                "type"=> "input"
            );
            $widget['entities'][] = array(
                "text"=> $data['from-did-direct'][$idUsers]['name']." ( ".$idUsers." ) - ".$langArray["base_unavailable_string"],
                "id"=> $dest."%vmu".$idUsers,
                "type"=> "input"
            );
        break;
        
        case "app-announcement":
            $widget['type'] = "Base";
            $widget['radius'] = "0";
            $widget['bgColor'] = "#f4b350";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_app_announcement_string"];
            $widget['entities'][] = array(
                "text"=> html_entity_decode($data[$dest][$id]['description']) ." - ".$id,
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["view_recording_string"].": ".html_entity_decode($data[$dest][$id]['rec_name'])." ( ".$data[$dest][$id]['rec_id']." )",
                "id"=> $dest."%".$id,
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_destination_string"],
                "id"=> "postdest-".$dest."%".$id,
                "type"=> "output",
                "destination"=> $data[$dest][$id]['postdest']
            );
            $widget['entities'][] = array(
              "text"=> $langArray["base_details_string"],
              "id"=> $id,
              "type"=> "text",
              "destination"=> "",
              "cssClass"=> "link"
            );
            $widget['userData'] = array(
                "id"=> html_entity_decode($data[$dest][$id]['id']),
                "description"=> html_entity_decode($data[$dest][$id]['description']),
                "announcement"=> html_entity_decode($data[$dest][$id]['rec_id'])
            );
        break;
        
        case "app-daynight":
            $widget['type'] = "Base";
            $widget['radius'] = "0";
            $widget['bgColor'] = "#2c3e50";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_app_daynight_string"];
            $widget['entities'][] = array(
                "text"=> $data[$dest][$id]['name']." ( ".$data[$dest][$id]['control_code']." )",
                "id"=> $dest."%".$id,
                "type" => "input"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_normal_flow_string"],
                "id"=> "green_flow-".$dest."%".$id,
                "type" => "output",
                "destination"=> $data[$dest][$id]['green_flow']
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_alternative_flow_string"],
                "id"=> "red_flow-".$dest."%".$id,
                "type" => "output",
                "destination"=> $data[$dest][$id]['red_flow']
            );
            $widget['entities'][] = array(
              "text"=> $langArray["base_details_string"],
              "id"=> $id,
              "type"=> "text",
              "destination"=> "",
              "cssClass"=> "link"
            );
            $widget['userData'] = array(
                "name"=> html_entity_decode($data[$dest][$id]['name']),
                "code"=> html_entity_decode($data[$dest][$id]['ext']),
            );
        break;
        
        case "timeconditions":
            $widget['type'] = "Base";
            $widget['radius'] = "0";
            $widget['bgColor'] = "#D35400";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_timeconditions_string"];
            $widget['entities'][] = array(
                "text"=> html_entity_decode($data[$dest][$id]['displayname']) ." - ".$id,
                "id"=> $dest."%".$id,
                "type" => "input"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["view_timegroup_string"].": ".html_entity_decode($data['timegroups'][$data[$dest][$id]['time']]['description'])." ( ".$data['timegroups'][$data[$dest][$id]['time']]['id']." )",
                "id"=> $dest."%".$id,
                "type" => "text"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_true_dest_string"],
                "id"=> "truegoto-".$dest."%".$id,
                "type" => "output",
                "destination"=> $data[$dest][$id]['truegoto']
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_false_dest_string"],
                "id"=> "falsegoto-".$dest."%".$id,
                "type" => "output",
                "destination"=> $data[$dest][$id]['falsegoto']
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_details_string"],
                "id"=> $id,
                "type"=> "text",
                "destination"=> "",
                "cssClass"=> "link"
            );
            $widget['userData'] = array(
                "id"=> $id, 
                "name"=> html_entity_decode($data[$dest][$id]['displayname']),
                "time"=> $data['timegroups'][$data[$dest][$id]['time']]['id']
            );
        break;
        
        case "ivr":
            $widget['type'] = "Base";
            $widget['radius'] = "0";
            $widget['bgColor'] = "#7f8c8d";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_ivr_string"];
            $widget['entities'][] = array(
                "text"=> html_entity_decode($data[$dest][$id]['name'])." ( ".html_entity_decode($data[$dest][$id]['description'])." ) - ".html_entity_decode($data[$dest][$id]['id']),
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_app_announcement_string"].": ".html_entity_decode($data['recordings'][$data[$dest][$id]['announcement']]['name'])." ( ".html_entity_decode($data[$dest][$id]['announcement'])." )",
                "id"=> "announcement-".$dest."%".$id,
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_inv_dest_string"],
                "id"=> "invalid_destination-".$dest."%".$id,
                "type"=> "output",
                "destination"=> $data[$dest][$id]['invalid_destination']
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_time_dest_string"],
                "id"=> "timeout_destination-".$dest."%".$id,
                "type"=> "output",
                "destination"=> $data[$dest][$id]['timeout_destination']
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_ivr_suggest_string"],
                "id"=> "suggest-".$dest."%".$id,
                "type"=> "text"
            );
            $widget['entities'][] = array(
              "text"=> $langArray["base_details_string"],
              "id"=> $id,
              "type"=> "text",
              "destination"=> "",
              "cssClass"=> "link"
            );
            $widget['userData'] = array(
              "id"=> html_entity_decode($data[$dest][$id]['id']),
              "name"=> html_entity_decode($data[$dest][$id]['name']),
              "description"=> html_entity_decode($data[$dest][$id]['description']),
              "announcement"=> html_entity_decode($data[$dest][$id]['announcement'])
            );
            if (array_key_exists('selections', $data[$dest][$id])) {
                foreach ($data[$dest][$id]['selections'] as $value) {
                    $widget['entities'][] = array(
                        "text"=> $value['selection'],
                        "id"=> "selection_".$value['selection']."-".$dest."%".$id,
                        "type"=> "output",
                        "destination"=> $value['dest']
                    );
                }
            }
        break;
        
        case "cqr":
            $widget['type'] = "Base";
            $widget['radius'] = "0";
            $widget['bgColor'] = "#528ba7";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_cqr_string"];
            $widget['entities'][] = array(
                "text"=> html_entity_decode($data[$dest][$id]['name'])." ( ".html_entity_decode($data[$dest][$id]['description'])." ) - ".html_entity_decode($data[$dest][$id]['id']),
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_app_announcement_string"].": ".html_entity_decode($data['recordings'][$data[$dest][$id]['announcement']]['name'])." ( ".html_entity_decode($data[$dest][$id]['announcement'])." )",
                "id"=> "announcement-".$dest."%".$id,
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_def_dest_string"],
                "id"=> "default_destination-".$dest."%".$id,
                "type"=> "output",
                "destination"=> $data[$dest][$id]['default_destination']
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_ivr_suggest_string"],
                "id"=> "suggest-".$dest."%".$id,
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_details_string"],
                "id"=> $id,
                "type"=> "text",
                "destination"=> "",
                "cssClass"=> "link"
            );
            $widget['userData'] = array(
                "id"=> html_entity_decode($data[$dest][$id]['id']),
                "name"=> html_entity_decode($data[$dest][$id]['name']),
                "description"=> html_entity_decode($data[$dest][$id]['description']),
                "announcement"=> html_entity_decode($data[$dest][$id]['announcement'])
            );
            if (array_key_exists('selections', $data[$dest][$id])) {
                foreach ($data[$dest][$id]['selections'] as $value) {
                    $widget['entities'][] = array(
                        "text"=> $value['condition'],
                        "id"=> "selection_".$value['condition']."-".$dest."%".$id,
                        "type"=> "output",
                        "destination"=> $value['dest']
                    );
                }
            }
        break;
        
        case "ext-queues":
            $widget['type'] = "Base";
            $widget['radius'] = "0";
            $widget['bgColor'] = "#9b59b6";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_ext_queues_string"];

            if ($data[$dest][$id]['timeout'] == 1) {
                $timeout = "1 ".$langArray["view_queuesTimeString_second"];
            } else if ($data[$dest][$id]['timeout'] < 60) {
                $timeout = $data[$dest][$id]['timeout']." ".$langArray["view_queuesTimeString_seconds"];
            } else {
                $tmpTimeout = "view_queuesTimeString_minutes_".$data[$dest][$id]['timeout'];
                $timeout = $langArray[$tmpTimeout];
            }

            if ($data[$dest][$id]['maxwait'] == 1) {
                $maxwait = "1 ".$langArray["view_queuesTimeString_second"];
            } else if ($data[$dest][$id]['maxwait'] < 60) {
                $maxwait = $data[$dest][$id]['maxwait']." ".$langArray["view_queuesTimeString_seconds"];
            } else {
                $tmpMaxwait = "view_queuesTimeString_minutes_".$data[$dest][$id]['maxwait'];
                $maxwait = $langArray[$tmpMaxwait];
            }

            $timeoutString = "view_queuesTimeString_minutes_".$data[$dest][$id]['timeout'];
            $widget['entities'][] = array(
                "text"=> $data[$dest][$id]['descr']." ( ".$data[$dest][$id]['num']." )",
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_static_memb_string"],
                "id"=> $dest."%".$id."stext",
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> implode(",", $data[$dest][$id]['members']),
                "id"=> $dest."%".$id."slist",
                "type"=> "list"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_dyn_memb_string"],
                "id"=> $dest."%".$id."dtext",
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $data[$dest][$id]['dynmembers'],
                "id"=> $dest."%".$id."dlist",
                "type"=> "list"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["view_strategy_string"]." ( ".$data[$dest][$id]['strategy']." )",
                "id"=> $dest."%".$id."stext",
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["view_agenttimeout_string"]." ( ".($data[$dest][$id]['timeout'] == '0' ? $langArray["view_queuesTimeString_unlimited"] : $timeout)." )",
                "id"=> "%".$id."attext|".$data[$dest][$id]['timeout'],
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["view_queuesTimeString_maxWait"]." ( ".($data[$dest][$id]['maxwait'] == '' ? $langArray["view_queuesTimeString_unlimited"] : $maxwait)." )",
                "id"=> "%".$id."mwtext|".$data[$dest][$id]['maxwait'],
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_fail_dest_string"],
                "id"=> "faildest-".$dest."%".$id,
                "type"=> "output",
                "destination"=> $data[$dest][$id]['dest']
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_details_string"],
                "id"=> $id,
                "type"=> "text",
                "destination"=> ""
            );
            $staticExt = preg_replace("/Local\//", "\n", implode(",", $data[$dest][$id]['members']));
            $staticExt = preg_replace("/@from-queue\/n/", "", $staticExt);
            $staticExt = preg_replace("/,\n/", "\n", $staticExt);
            $staticExt = preg_replace("/^\n/", "", $staticExt);
            $widget['userData'] = array(
                "name"=> html_entity_decode($data[$dest][$id]['descr']),
                "extension"=> $data[$dest][$id]['num'],
                "staticExt"=> $staticExt,
                "dynamicExt"=> $data[$dest][$id]['dynmembers'],
                "strategy"=> $data[$dest][$id]['strategy'],
                "timeout"=> $data[$dest][$id]['timeout'],
                "maxwait"=> $data[$dest][$id]['maxwait'],
            );
        break;
        
        case "ext-group":
            $widget['type'] = "Base";
            $widget['radius'] = "0";
            $widget['bgColor'] = "#2980b9";
            $widget['id'] = $dest."%".$id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray["base_ext_group_string"];
            $widget['entities'][] = array(
                "text"=> html_entity_decode($data[$dest][$id]['description'])." ( ".$data[$dest][$id]['num']." )",
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_ext_list_string"],
                "id"=> $dest."%".$id."dtext",
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $data[$dest][$id]['grplist'],
                "id"=> $dest."%".$id,
                "type"=> "list"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["view_strategy_string"]." ( ".$data[$dest][$id]['strategy']." )",
                "id"=> $dest."%".$id."strategy",
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["view_ringtime_string"]." ( ".$data[$dest][$id]['grptime']." )",
                "id"=> $dest."%".$id."grptime",
                "type"=> "text"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_fail_dest_string"],
                "id"=> "faildest-".$dest."%".$id,
                "type"=> "output",
                "destination"=> $data[$dest][$id]['postdest']
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_details_string"],
                "id"=> $id,
                "type"=> "text",
                "destination"=> "",
                "cssClass"=> "link"
            );
            $widget['userData'] = array(
                "name"=> html_entity_decode($data[$dest][$id]['description']),
                "extension"=> $data[$dest][$id]['num'],
                "list"=> $data[$dest][$id]['grplist'],
                "strategy"=> $data[$dest][$id]['strategy'],
                "ringtime"=> $data[$dest][$id]['grptime']
            );
        break;
    }

    return $widget;
}

/**
 * @method
 * 
 * Creates draw2D objects for connection arrows between figures creation.
 * 
 * @param {Object} $data - All asterisk elements data.
 * @param {string} $dest - The element destionation/name.
 * @param {string} $id - The element id .
 **/
function nethvplan_bindConnection($data, $dest, $id)
{
    global $connectionTemplate;
    $connection = $connectionTemplate;

    switch ($dest) {
        
        case "app-announcement":
            $res = nethvplan_getDestination($data[$dest][$id]['postdest']);
            $destNew = $res[0];
            $idDest = $res[1];

            $connection['id'] = $dest."%".$id."=".$data[$dest][$id]['postdest'];
            $connection['source'] = array(
                "node"=> $dest."%".$id,
                "port"=> "output_postdest-".$dest."%".$id
            );
            $connection['target'] = array(
                "node"=> $destNew."%".$idDest,
                "port"=> "input_".$destNew."%".$idDest,
                "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
            );
        break;

        case "app-daynight":
            $arrayTmp = array();
            $res = nethvplan_getDestination($data[$dest][$id]['green_flow']);
            $destNew = $res[0];
            $idDest = $res[1];

            $con1 = $connectionTemplate;
            $con1['id'] = $dest."%".$id."=".$data[$dest][$id]['green_flow'];
            $con1['source'] = array(
                "node"=> $dest."%".$id,
                "port"=> "output_green_flow-".$dest."%".$id
            );
            $con1['target'] = array(
                "node"=> $destNew."%".$idDest,
                "port"=> "input_".$destNew."%".$idDest,
                "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
            );

            array_push($arrayTmp, $con1);

            $res = nethvplan_getDestination($data[$dest][$id]['red_flow']);
            $destNew = $res[0];
            $idDest = $res[1];

            $con2 = $connectionTemplate;
            $con2['id'] = $dest."%".$id."=".$data[$dest][$id]['red_flow'];
            $con2['source'] = array(
                "node"=> $dest."%".$id,
                "port"=> "output_red_flow-".$dest."%".$id
            );
            $con2['target'] = array(
                "node"=> $destNew."%".$idDest,
                "port"=> "input_".$destNew."%".$idDest,
                "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
            );

            array_push($arrayTmp, $con2);

            $connection = $arrayTmp;
        break;
        
        case "timeconditions":
                $arrayTmp = array();
                $res = nethvplan_getDestination($data[$dest][$id]['truegoto']);
                $destNew = $res[0];
                $idDest = $res[1];

                $con1 = $connectionTemplate;
                $con1['id'] = $dest."%".$id."=".$data[$dest][$id]['truegoto'];
                $con1['source'] = array(
                    "node"=> $dest."%".$id,
                    "port"=> "output_truegoto-".$dest."%".$id
                );
                $con1['target'] = array(
                    "node"=> $destNew."%".$idDest,
                    "port"=> "input_".$destNew."%".$idDest,
                    "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
                );

                array_push($arrayTmp, $con1);

                $res = nethvplan_getDestination($data[$dest][$id]['falsegoto']);
                $destNew = $res[0];
                $idDest = $res[1];

                $con2 = $connectionTemplate;
                $con2['id'] = $dest."%".$id."=".$data[$dest][$id]['falsegoto'];
                $con2['source'] = array(
                    "node"=> $dest."%".$id,
                    "port"=> "output_falsegoto-".$dest."%".$id
                );
                $con2['target'] = array(
                    "node"=> $destNew."%".$idDest,
                    "port"=> "input_".$destNew."%".$idDest,
                    "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
                );

                array_push($arrayTmp, $con2);

                $connection = $arrayTmp;
        break;
        
        case "ivr":
            $arrayTmp = array();
            $res = nethvplan_getDestination($data[$dest][$id]['invalid_destination']);
            $destNew = $res[0];
            $idDest = $res[1];

            $con1 = $connectionTemplate;
            $con1['id'] = $dest."%".$id."=".$data[$dest][$id]['invalid_destination']."-invalid";
            $con1['source'] = array(
                "node"=> $dest."%".$id,
                "port"=> "output_invalid_destination-".$dest."%".$id
            );
            $con1['target'] = array(
                "node"=> $destNew."%".$idDest,
                "port"=> "input_".$destNew."%".$idDest,
                "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
            );

            array_push($arrayTmp, $con1);

            $res = nethvplan_getDestination($data[$dest][$id]['timeout_destination']);
            $destNew = $res[0];
            $idDest = $res[1];

            $con2 = $connectionTemplate;
            $con2['id'] = $dest."%".$id."=".$data[$dest][$id]['timeout_destination']."-timeout";
            $con2['source'] = array(
                "node"=> $dest."%".$id,
                "port"=> "output_timeout_destination-".$dest."%".$id
            );
            $con2['target'] = array(
                "node"=> $destNew."%".$idDest,
                "port"=> "input_".$destNew."%".$idDest,
                "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
            );

            array_push($arrayTmp, $con2);

            if (array_key_exists('selections', $data[$dest][$id])) {
                foreach ($data[$dest][$id]['selections'] as $value) {
                    $res = nethvplan_getDestination($value['dest']);
                    $destNew = $res[0];
                    $idDest = $res[1];

                    $con3 = $connectionTemplate;
                    $con3['id'] = $dest."%".$id."=".$value['dest']."-".$value['selection'];
                    $con3['source'] = array(
                        "node"=> $dest."%".$id,
                        "port"=> "output_selection_".$value['selection']."-".$dest."%".$id
                    );
                    $con3['target'] = array(
                        "node"=> $destNew."%".$idDest,
                        "port"=> "input_".$destNew."%".$idDest,
                        "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
                    );

                    array_push($arrayTmp, $con3);
                }
            }
            $connection = $arrayTmp;
        break;
        
        case "cqr":
            $arrayTmp = array();
            $res = nethvplan_getDestination($data[$dest][$id]['default_destination']);
            $destNew = $res[0];
            $idDest = $res[1];

            $con1 = $connectionTemplate;
            $con1['id'] = $dest."%".$id."=".$data[$dest][$id]['default_destination']."-default";
            $con1['source'] = array(
                "node"=> $dest."%".$id,
                "port"=> "output_default_destination-".$dest."%".$id
            );
            $con1['target'] = array(
                "node"=> $destNew."%".$idDest,
                "port"=> "input_".$destNew."%".$idDest,
                "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
            );

            array_push($arrayTmp, $con1);

            if (array_key_exists('selections', $data[$dest][$id])) {
                foreach ($data[$dest][$id]['selections'] as $value) {
                    $res = nethvplan_getDestination($value['dest']);
                    $destNew = $res[0];
                    $idDest = $res[1];

                    $con2 = $connectionTemplate;
                    $con2['id'] = $dest."%".$id."=".$value['dest']."-".$value['condition'];
                    $con2['source'] = array(
                        "node"=> $dest."%".$id,
                        "port"=> "output_selection_".$value['condition']."-".$dest."%".$id
                    );
                    $con2['target'] = array(
                        "node"=> $destNew."%".$idDest,
                        "port"=> "input_".$destNew."%".$idDest,
                        "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
                    );

                    array_push($arrayTmp, $con2);
                }
            }
            $connection = $arrayTmp;
        break;
        
        case "ext-queues":
            $res = nethvplan_getDestination($data[$dest][$id]['dest']);
            $destNew = $res[0];
            $idDest = $res[1];

            $connection['id'] = $dest."%".$id."=".$data[$dest][$id]['dest'];
            $connection['source'] = array(
                "node"=> $dest."%".$id,
                "port"=> "output_faildest-".$dest."%".$id,
            );
            $connection['target'] = array(
                "node"=> $destNew."%".$idDest,
                "port"=> "input_".$destNew."%".$idDest,
                "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
            );
        break;
        
        case "ext-group":
            $res = nethvplan_getDestination($data[$dest][$id]['postdest']);
            $destNew = $res[0];
            $idDest = $res[1];

            $connection['id'] = $dest."%".$id."=".$data[$dest][$id]['postdest'];
            $connection['source'] = array(
                "node"=> $dest."%".$id,
                "port"=> "output_faildest-".$dest."%".$id,
            );
            $connection['target'] = array(
                "node"=> $destNew."%".$idDest,
                "port"=> "input_".$destNew."%".$idDest,
                "decoration"=> "draw2d.decoration.connection.ArrowDecorator"
            );
        break;
    }

    //print_r($connection);
    return $connection;
}

/**
 * @method
 * 
 * Creates final object for draw2D using the functions above.
 * 
 * @param {Object} $data - All asterisk elements data.
 * @param {string} $destination - The element destination/name.
 * @param {Objext} $destArray - Elements destinations/names array.
 **/
function nethvplan_explore($data, $destination, $destArray)
{
    // initialize global variables
    global $xPos;
    global $xOffset;
    global $yPos;
    global $matrixPos;

    global $widgets;
    global $connections;
    global $widgetTemplate;
    global $connectionTemplate;
    global $langArray;

    if (!in_array($destination, $destArray)) {
        // insert elem in array
        array_push($destArray, $destination);

        // get destination field and id
        $res = nethvplan_getDestination($destination);
        $dest = $res[0];
        $id = $res[1];

        // choose correct destination and
        // add widget and connections
        switch ($dest) {
            case "from-did-direct":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);
            break;
            
            case "ext-meetme":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);
            break;
            
            case "app-blackhole":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);
            break;
            
            case "ext-local":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);
            break;

            case "app-announcement":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);

                $connection = nethvplan_bindConnection($data, $dest, $id);
                array_push($connections, $connection);

                nethvplan_explore($data, $data[$dest][$id]['postdest'], $destArray);
            break;
            
            case "app-daynight":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);

                $connection = nethvplan_bindConnection($data, $dest, $id);
                foreach ($connection as $arr) {
                    // add connection
                    array_push($connections, $arr);
                }

                nethvplan_explore($data, $data[$dest][$id]['green_flow'], $destArray);
                nethvplan_explore($data, $data[$dest][$id]['red_flow'], $destArray);
            break;
            
            case "timeconditions":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);

                $connection = nethvplan_bindConnection($data, $dest, $id);
                foreach ($connection as $arr) {
                    // add connection
                    array_push($connections, $arr);
                }

                nethvplan_explore($data, $data[$dest][$id]['truegoto'], $destArray);
                nethvplan_explore($data, $data[$dest][$id]['falsegoto'], $destArray);
            break;
            
            case "ivr":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);

                $connection = nethvplan_bindConnection($data, $dest, $id);
                foreach ($connection as $arr) {
                    // add connection
                    array_push($connections, $arr);
                }

                nethvplan_explore($data, $data[$dest][$id]['invalid_destination'], $destArray);
                nethvplan_explore($data, $data[$dest][$id]['timeout_destination'], $destArray);
                if (array_key_exists('selections', $data[$dest][$id])) {
                    foreach ($data[$dest][$id]['selections'] as $value) {
                        nethvplan_explore($data, $value['dest'], $destArray);
                    }
                }
            break;
            
            case "cqr":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);

                $connection = nethvplan_bindConnection($data, $dest, $id);
                foreach ($connection as $arr) {
                    // add connection
                    array_push($connections, $arr);
                }

                nethvplan_explore($data, $data[$dest][$id]['default_destination'], $destArray);
                if (array_key_exists('selections', $data[$dest][$id])) {
                    foreach ($data[$dest][$id]['selections'] as $value) {
                        nethvplan_explore($data, $value['dest'], $destArray);
                    }
                }
            break;
            
            case "ext-queues":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);

                $connection = nethvplan_bindConnection($data, $dest, $id);
                array_push($connections, $connection);

                nethvplan_explore($data, $data[$dest][$id]['dest'], $destArray);
            break;
            
            case "ext-group":
                $widget = nethvplan_bindData($data, $dest, $id);
                // add widget
                array_push($widgets, $widget);

                $connection = nethvplan_bindConnection($data, $dest, $id);
                array_push($connections, $connection);

                nethvplan_explore($data, $data[$dest][$id]['postdest'], $destArray);
            break;

            default:
                $widget = $widgetTemplate;
                $widget['type'] = "Base";
                $widget['id'] = $dest."%".$id;
                $widget['radius'] = "20";
                $widget['x'] = $xPos;
                $widget['y'] = $yPos;
                if ($dest != "") {
                    $widget['name'] = $langArray["base_alternative_string"];
                    $text = $dest;
                } else {
                    $widget['name'] = $langArray["base_disable_string"];
                    $text = strtolower($langArray["base_disable_string"]);
                }
                $widget['entities'][] = array(
                    "text"=> $text,
                    "id"=> $dest."%".$id,
                    "type"=> "input"
                );

                // add widget
                array_push($widgets, $widget);
        }
    }
}

function nethvplan_json_pretty($json, $options = array())
{
    $tokens = preg_split('|([\{\}\]\[,])|', $json, -1, PREG_SPLIT_DELIM_CAPTURE);
    $result = '';
    $indent = 0;

    $format = 'txt';

    //$ind = "\t";
    $ind = "    ";

    if (isset($options['format'])) {
        $format = $options['format'];
    }

    switch ($format) {
        case 'html':
            $lineBreak = '<br />';
            $ind = '&nbsp;&nbsp;&nbsp;&nbsp;';
            break;
            
        default:
        case 'txt':
            $lineBreak = "\n";
            //$ind = "\t";
            $ind = "    ";
            break;
    }

    // override the defined indent setting with the supplied option
    if (isset($options['indent'])) {
        $ind = $options['indent'];
    }

    $inLiteral = false;
    foreach ($tokens as $token) {
        if ($token == '') {
            continue;
        }

        $prefix = str_repeat($ind, $indent);
        if (!$inLiteral && ($token == '{' || $token == '[')) {
            $indent++;
            if (($result != '') && ($result[(strlen($result) - 1)] == $lineBreak)) {
                $result .= $prefix;
            }
            $result .= $token . $lineBreak;
        } elseif (!$inLiteral && ($token == '}' || $token == ']')) {
            $indent--;
            $prefix = str_repeat($ind, $indent);
            $result .= $lineBreak . $prefix . $token;
        } elseif (!$inLiteral && $token == ',') {
            $result .= $token . $lineBreak;
        } else {
            $result .= ($inLiteral ? '' : $prefix) . $token;

            // Count # of unescaped double-quotes in token, subtract # of
            // escaped double-quotes and if the result is odd then we are
            // inside a string literal
            if ((substr_count($token, "\"") - substr_count($token, "\\\"")) % 2 != 0) {
                $inLiteral = !$inLiteral;
            }
        }
    }
    return $result;
}
