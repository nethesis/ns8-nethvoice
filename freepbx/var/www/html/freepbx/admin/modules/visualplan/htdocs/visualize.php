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
$lang = $_COOKIE['lang'] ?? '';
if (empty($lang)) {
    $lang = "en";
}
$langParts = explode("_", (string)$lang);
$langCode = (isset($langParts[0]) && preg_match('/^[a-z]{2}$/', $langParts[0])) ? $langParts[0] : 'en';
$languages = file_get_contents("i18n/".$langCode.".js");
$languages = substr($languages, 0, -1);
$langParts = explode("=", $languages);
$language = trim($langParts[1]);
$langArray = json_decode($language, true);

/**
 *  GET ELEMENTS ALL DATA AND CREATE DATA OBJECT 
 */

$data = array(
    'incoming' => array(),
    'from-did-direct' => array(),
    'ext-local' => array(),
    'ivr' => array(),
    'cqr' => array(),
    'timeconditions' => array(),
    'timegroups' => array(),
    'app-announcement' => array(),
    'recordings' => array(),
    'ext-group' => array(),
    'ext-meetme' => array(),
    'ext-queues' => array(),
    'app-daynight' => array()
);

$loadErrors = [];

// incoming data (inbound routes)
$data['incoming'] = nethvplan_loadRows('incoming', fn() => FreePBX::Core()->getAllDIDs('extension'), fn($row) => $row['extension'] . ' / ' . $row['cidnum'], function ($row, &$block) {
    $block['destination'] = $row['destination'];
    $block['description'] = $row['description'];
});

// internal data - from-did-direct,id,1
$data['from-did-direct'] = nethvplan_loadRows('from-did-direct', fn() => FreePBX::Core()->listUsers(false), 0, function ($row, &$block) {
    if (preg_match('/^9\d(\d){3,}$/', $row[0]) >= 1) { $block = null; return; }
    $block = array(
        "name" => $row[1],
        "voicemail" => $row[2]
    );
});

// voicemail - ext-local,vm(b|s|u)201,1
$data['ext-local'] = nethvplan_loadRows('ext-local', fn() => FreePBX::Core()->listUsers(false), 0, function ($row, &$block) {
    if ($row[2] === 'novm') { $block = null; return; }
    $block = array(
        "name" => $row[1],
        "voicemail" => $row[2]
    );
});

// ivr - ivr-id,s,1
$data['ivr'] = nethvplan_loadRows('ivr', fn() => FreePBX::Ivr()->getDetails(), 'id', function ($row, &$block) {
    $block["name"] = $row['name'];
    $block["id"] = $row['id'];
    $block["description"] = $row['description'];
    $block["announcement"] = $row['announcement'];
    // Required IVR exits must remain drawable even when FreePBX leaves them unset.
    foreach (['invalid_destination', 'timeout_destination'] as $field) {
        $destination = $row[$field] ?? '';
        $block[$field] = trim((string)$destination) === ''
            ? 'app-blackhole,hangup,1' : $destination;
    }
    $selection_data = ivr_get_entries($row['id']);
    foreach ($selection_data as $key => $value) {
        $block['selections'][$value['selection']] = array(
            "selection" => $value['selection'],
            "dest" => $value['dest']
        );
    }
});

// cqr - nethcqr-id,s,1
$data['cqr'] = nethvplan_loadRows('cqr', fn() => nethcqr_get_details(), 'id_cqr', function ($row, &$block) {
    $block["id"] = $row['id_cqr'];
    $block["name"] = $row['name'];
    $block["description"] = $row['description'];
    $block["announcement"] = $row['announcement'];
    $block["default_destination"] = $row['default_destination'];
    $get_entries = nethcqr_get_entries($row['id_cqr']);
    foreach ($get_entries as $key => $value) {
        $block['selections'][$value['position']] = array( "position" => $value['position'],
            "condition" => $value['condition'],
            "dest" => $value['destination']
        );
    }
});

// time conditions
$data['timeconditions'] = nethvplan_loadRows('timeconditions', fn() => FreePBX::Timeconditions()->listTimeconditions(false), 'timeconditions_id', function ($row, &$block) {
    $block = array(
        "displayname" => $row['displayname'],
        "time" => $row['time'],
        "truegoto" => $row['truegoto'],
        "falsegoto" => $row['falsegoto']
    );
});

$data['timegroups'] = nethvplan_loadRows('timegroups', fn() => FreePBX::Timeconditions()->listTimegroups(), 0, function ($row, &$block) {
    $block = array(
        "id" => $row[0],
        "description" => $row[1]
    );
});

$data['recordings'] = nethvplan_loadRows('recordings', fn() => FreePBX::Recordings()->getAllRecordings(true), 0, function ($row, &$block) {
    $block = array(
        "name" => $row[1],
        "description" => $row[3]
    );
});

// announcement - app-announcement-1,s,1
$data['app-announcement'] = nethvplan_loadRows('app-announcement', fn() => FreePBX::Announcement()->getAnnouncements(), 'announcement_id', function ($row, &$block) use (&$data) {
    $recordingId = (string)($row['recording_id'] ?? '');
    $block = array(
        "description" => $row['description'],
        "id" => $row['announcement_id'],
        "postdest" => $row['post_dest'],
        "rec_name" => $data['recordings'][$recordingId]['name'] ?? '',
        "rec_id" => $recordingId
    );
});

// call group - ext-group,id,1
$data['ext-group'] = nethvplan_loadRows('ext-group', fn() => FreePBX::Ringgroups()->listRinggroups(false), 'grpnum', function ($row, &$block) {
    $group_details = ringgroups_get($row['grpnum']);
    $block['postdest'] = $group_details['postdest'];
    $block = array(
        "num" => $row['grpnum'],
        "description" => $group_details['description'],
        "grplist" => $group_details['grplist'],
        "postdest" => $group_details['postdest'],
        "strategy" => $group_details['strategy'],
        "grptime" => $group_details['grptime']
    );
});

// conference - ext-meetme,id,1
$data['ext-meetme'] = nethvplan_loadRows('ext-meetme', fn() => FreePBX::Conferences()->listConferences(), 0, function ($row, &$block) {
    $block = array(
        "description" => $row[1],
        "id"=> $row[0]
    );
});

// queues - ext-queues,id,1
$data['ext-queues'] = nethvplan_loadRows('ext-queues', fn() => FreePBX::Queues()->listQueues(false), 0, function ($row, &$block) {
    $queues_details = queues_get($row[0]);
    $block['dest'] = $queues_details['goto'];
    $block = array(
        "num" => $row[0],
        "descr" => $queues_details['name'],
        "dest" => $queues_details['goto'],
        "members" => $queues_details['member'],
        "dynmembers" => $queues_details['dynmembers'],
        "strategy" => $queues_details['strategy'],
        "maxwait" => $queues_details['maxwait'],
        "timeout" => $queues_details['timeout']
    );
});

// flow call control - app-daynight,0,1
$data['app-daynight'] = nethvplan_loadRows('app-daynight', fn() => daynight_list(), 'ext', function ($row, &$block) {
    $daynight_obj = daynight_get_obj($row['ext']);
    if (!is_array($daynight_obj)) throw new UnexpectedValueException('Invalid day/night data');
    $block = array(
        "name"=> $daynight_obj['fc_description'] ?? "",
        "control_code"=> "*28".$row['ext'],
        "ext"=> $row['ext'],
        "green_flow"=> $daynight_obj['day'] ?? "",
        "red_flow"=> $daynight_obj['night'] ?? ""
    );
});

$data['codeavailable'] = nethvplan_attempt(function () {
    $codes = daynight_get_avail();
    if (!is_array($codes)) throw new UnexpectedValueException('Invalid control code list');
    return $codes;
}, null, 'codeavailable');
if ($data['codeavailable'] === null) {
    $loadErrors['codeavailable'] = true;
    $data['codeavailable'] = [];
}

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
            // An incomplete list cannot establish that an identifier is available.
            if (!empty($loadErrors[$name])) {
                http_response_code(503);
                echo json_encode(['error' => 'visualplan_data_unavailable']);
                break;
            }
            print_r(/*nethvplan_json_pretty(*/json_encode($data[$name] ?? array(), JSON_INVALID_UTF8_SUBSTITUTE));
        break;

        case "getAll":
            $name = $_GET["getAll"];
            $widContainer = array();
            foreach ($data[$name] ?? array() as $key => $value) {
                if ($name == "ext-local") {
                    $key = "vmb".$key;
                }
                $wid = nethvplan_bindData($data, $name, $key);
                array_push($widContainer, $wid);
            }
            if (!$widContainer && !empty($loadErrors[$name])) {
                $widContainer[] = nethvplan_errorBlock($data, $name, '');
            }
            print_r(json_encode($widContainer, JSON_INVALID_UTF8_SUBSTITUTE));
        break;

        case "getChild":
            $tmpDestArray = array();
            $source = explode('%', base64_decode($_GET['getChild']), 2);
            $widget = nethvplan_bindData($data, $source[0], $source[1] ?? '');
            // Replace the cached palette source with this request's data or error placeholder.
            $widgets[] = $widget;
            $connections = nethvplan_connections($widget);
            foreach ($widget['entities'] as $entity) {
                if ($entity['type'] === 'output') {
                    nethvplan_explore($data, $entity['destination'], $tmpDestArray);
                }
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
            print_r(/*nethvplan_json_pretty(*/json_encode($merged, JSON_INVALID_UTF8_SUBSTITUTE));
        break;

        case "id":
            $id = nethvplan_resolveIncomingId($data['incoming'], $_GET['id']) ?? $_GET['id'];
            $widget = nethvplan_bindData($data, 'incoming', $id);
            $widgets[] = $widget;
            $connections = nethvplan_connections($widget);
            foreach ($widget['entities'] as $entity) {
                if ($entity['type'] === 'output') {
                    nethvplan_explore($data, $entity['destination'], $destArray);
                }
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

            print_r(/*nethvplan_json_pretty(*/json_encode($merged, JSON_INVALID_UTF8_SUBSTITUTE));
        break;
    }
}

function nethvplan_splitIncomingId($id)
{
    $parts = explode("/", (string) $id, 2);
    $extension = isset($parts[0]) ? trim($parts[0]) : "";
    $cid = isset($parts[1]) ? trim($parts[1]) : "";

    return array($extension, $cid);
}

// FreePBX converts some warnings to exceptions; keep either failure local to a block.
function nethvplan_attempt($callback, $fallback, $context)
{
    set_error_handler(function ($severity, $message, $file, $line) {
        if (error_reporting() & $severity) {
            throw new ErrorException($message, 0, $severity, $file, $line);
        }
        return false;
    });
    try {
        return $callback();
    } catch (Throwable $error) {
        // Exception messages may contain database credentials or other PBX secrets.
        @error_log('Visualplan: failed to load ' . $context . ' (' . get_class($error) . ')');
        return $fallback;
    } finally {
        restore_error_handler();
    }
}

function nethvplan_loadRows($type, $list, $key, $load)
{
    global $loadErrors;
    $rows = nethvplan_attempt(function () use ($list) {
        $rows = $list();
        if (!is_array($rows)) throw new UnexpectedValueException('Invalid block list');
        return $rows;
    }, null, $type);
    if ($rows === null) {
        $loadErrors[$type] = true;
        return [];
    }
    $blocks = [];
    foreach ($rows as $row) {
        $id = nethvplan_attempt(function () use ($key, $row) {
            $id = is_callable($key) ? $key($row) : $row[$key];
            if (!is_string($id) && !is_int($id)) throw new UnexpectedValueException('Invalid block ID');
            return $id;
        }, null, $type);
        if ($id === null) {
            $loadErrors[$type] = true;
            continue;
        }
        $block = [];
        $loaded = nethvplan_attempt(function () use ($load, $type, $row, &$block) {
            // Keep known exits if loading another field or fetching details fails.
            $block = array_intersect_key($row, array_flip([
                'destination', 'postdest', 'green_flow', 'red_flow', 'truegoto', 'falsegoto',
                'invalid_destination', 'timeout_destination', 'default_destination', 'selections',
            ]));
            if ($type === 'app-announcement') $block['postdest'] = $row['post_dest'] ?? null;
            $load($row, $block);
            return true;
        }, false, $type . '%' . $id);
        if (!$loaded) {
            $block['load_error'] = true;
            $loadErrors[$type] = true;
        }
        if ($block !== null) $blocks[$id] = $block;
    }
    return $blocks;
}

function nethvplan_resolveIncomingId($incoming, $requestedId)
{
    if (isset($incoming[$requestedId])) {
        return $requestedId;
    }

    list($requestedExt, $requestedCid) = nethvplan_splitIncomingId($requestedId);
    foreach ($incoming as $key => $value) {
        list($ext, $cid) = nethvplan_splitIncomingId($key);
        if ($ext === $requestedExt && $cid === $requestedCid) {
            return $key;
        }
    }

    return null;
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
    if (!is_string($destination)) return array('', '');
    if (preg_match('/ivr-*/', $destination)) {
        $values = explode(",", $destination);
        $dests = explode("-", $values[0]);
        $dest = $dests[0];
        $id = $dests[1] ?? '';
    } elseif (preg_match('/app-announcement-*/', $destination)) {
        $values = explode(",", $destination);
        $dests = explode("-", $values[0]);
        $dest = $dests[0]."-".($dests[1] ?? '');
        $id = $dests[2] ?? '';
    } elseif (preg_match('/^night/', $destination)) {
        $values = explode(",", $destination);
        $dest = $values[0];
        $id = substr($values[1] ?? '', 1, -1);
    } elseif (preg_match('/nethcqr*/', $destination)) {
        $values = explode(",", $destination);
        $dest = "cqr";
        $id = $values[1] ?? '';
    } else {
        $values = explode(",", $destination);
        $dest = $values[0];
        $id = $values[1] ?? '';
    }

    return array($dest, $id);
}

// Check whether destination data exists before trying to bind widgets/connections.
function nethvplan_hasDestinationData($data, $dest, $id)
{
    if ($dest === "app-blackhole") {
        return true;
    }

    if ($dest === "ext-local") {
        $idUsers = substr($id, 3);
        return isset($data['from-did-direct'][$idUsers]) && is_array($data['from-did-direct'][$idUsers]);
    }

    if (!nethvplan_isKnownDestinationType($dest)) {
        return true;
    }

    return isset($data[$dest][$id]) && is_array($data[$dest][$id]);
}

function nethvplan_isKnownDestinationType($dest)
{
    $knownDestinations = array(
        "incoming",
        "from-did-direct",
        "ext-meetme",
        "ext-local",
        "app-announcement",
        "app-daynight",
        "timeconditions",
        "ivr",
        "cqr",
        "ext-queues",
        "ext-group"
    );

    return in_array($dest, $knownDestinations);
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

function nethvplan_recordingName($data, &$widget, $recordingId, $required = false)
{
    global $langArray;

    if (!$required && ($recordingId === '' || $recordingId === '0')) {
        return $langArray['base_no_recording_string'];
    }
    if (!isset($data['recordings'][$recordingId]['name'])) {
        $widget['bgColor'] = '#c0392b';
        return $langArray['base_recording_error_string'];
    }

    return html_entity_decode($data['recordings'][$recordingId]['name']);
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
function nethvplan_renderData($data, $dest, $id)
{
    global $langArray;
    global $widgetTemplate;
    global $xPos;
    global $yPos;
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
            $recordingId = (string)($data[$dest][$id]['rec_id'] ?? '');
            $recordingName = nethvplan_recordingName($data, $widget, $recordingId, true);
            $widget['entities'][] = array(
                "text"=> html_entity_decode($data[$dest][$id]['description']) ." - ".$id,
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["view_recording_string"].": ".$recordingName." ( ".$recordingId." )",
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
                "announcement"=> html_entity_decode($recordingId)
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
            $recordingId = (string)($data[$dest][$id]['announcement'] ?? '');
            $recordingName = nethvplan_recordingName($data, $widget, $recordingId);
            $widget['entities'][] = array(
                "text"=> html_entity_decode($data[$dest][$id]['name'])." ( ".html_entity_decode($data[$dest][$id]['description'])." ) - ".html_entity_decode($data[$dest][$id]['id']),
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_app_announcement_string"].": ".$recordingName." ( ".html_entity_decode($recordingId)." )",
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
              "announcement"=> html_entity_decode($recordingId)
            );
            if (!empty($data[$dest][$id]['selections']) && is_array($data[$dest][$id]['selections'])) {
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
            $recordingId = (string)($data[$dest][$id]['announcement'] ?? '');
            $recordingName = nethvplan_recordingName($data, $widget, $recordingId);
            $widget['entities'][] = array(
                "text"=> html_entity_decode($data[$dest][$id]['name'])." ( ".html_entity_decode($data[$dest][$id]['description'])." ) - ".html_entity_decode($data[$dest][$id]['id']),
                "id"=> $dest."%".$id,
                "type"=> "input"
            );
            $widget['entities'][] = array(
                "text"=> $langArray["base_app_announcement_string"].": ".$recordingName." ( ".html_entity_decode($recordingId)." )",
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
                "announcement"=> html_entity_decode($recordingId)
            );
            if (!empty($data[$dest][$id]['selections']) && is_array($data[$dest][$id]['selections'])) {
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

        default:
            $widget['type'] = 'Base';
            $widget['id'] = $dest . '%' . $id;
            $widget['x'] = $xPos;
            $widget['y'] = $yPos;
            $widget['name'] = $langArray[$dest === '' ? 'base_disable_string' : 'base_alternative_string'];
            $widget['entities'][] = array('text' => $dest === '' ? strtolower($widget['name']) : $dest, 'id' => $widget['id'], 'type' => 'input');
    }

    return $widget;
}

// Recover every readable exit even when another field prevents the block from rendering.
function nethvplan_outputs($data, $dest, $id)
{
    global $langArray;
    $fields = [
        'incoming' => ['destination' => ['route_num', 'base_destination_string']],
        'app-announcement' => ['postdest' => ['postdest', 'base_destination_string']],
        'app-daynight' => ['green_flow' => ['green_flow', 'base_normal_flow_string'], 'red_flow' => ['red_flow', 'base_alternative_flow_string']],
        'timeconditions' => ['truegoto' => ['truegoto', 'base_true_dest_string'], 'falsegoto' => ['falsegoto', 'base_false_dest_string']],
        'ivr' => ['invalid_destination' => ['invalid_destination', 'base_inv_dest_string'], 'timeout_destination' => ['timeout_destination', 'base_time_dest_string']],
        'cqr' => ['default_destination' => ['default_destination', 'base_def_dest_string']],
        'ext-queues' => ['dest' => ['faildest', 'base_fail_dest_string']],
        'ext-group' => ['postdest' => ['faildest', 'base_fail_dest_string']],
    ];
    $block = $data[$dest][$id] ?? [];
    if (!is_array($block)) return [];
    $outputs = [];
    foreach ($fields[$dest] ?? [] as $field => [$port, $label]) {
        if (!isset($block[$field]) || !is_string($block[$field])) continue;
        $outputs[] = [
            'text' => $langArray[$label] ?? $field,
            'id' => $port . '-' . $dest . '%' . $id,
            'type' => 'output', 'destination' => $block[$field],
        ];
    }
    if (($dest === 'ivr' || $dest === 'cqr') && is_array($block['selections'] ?? null)) {
        foreach ($block['selections'] as $selection) {
            if (!is_array($selection) || !is_string($selection['dest'] ?? null)) continue;
            $label = $selection[$dest === 'ivr' ? 'selection' : 'condition'] ?? null;
            if (!is_string($label) && !is_int($label)) continue;
            $outputs[] = [
                'text' => $label, 'id' => 'selection_' . $label . '-' . $dest . '%' . $id,
                'type' => 'output', 'destination' => $selection['dest'],
            ];
        }
    }
    return $outputs;
}

function nethvplan_errorBlock($data, $dest, $id)
{
    global $widgetTemplate, $langArray, $xPos, $yPos;
    $widget = $widgetTemplate;
    $widget['type'] = 'Base';
    $widget['id'] = $dest . '%' . $id;
    $widget['name'] = $langArray['base_block_error_string'];
    $widget['bgColor'] = '#c0392b';
    $widget['x'] = $xPos;
    $widget['y'] = $yPos;
    $widget['userData'] = ['visualplanError' => true];
    $widget['entities'] = [
        ['text' => $dest . ' ( ' . $id . ' )', 'id' => $widget['id'], 'type' => 'input'],
        ['text' => $langArray['base_block_unavailable_string'], 'id' => 'error-' . $widget['id'], 'type' => 'text'],
    ];
    $widget['entities'] = array_merge($widget['entities'], nethvplan_outputs($data, $dest, $id));
    if ($dest === 'incoming' || nethvplan_isKnownDestinationType($dest)) {
        $widget['entities'][] = [
            'text' => $langArray['base_details_string'], 'id' => (string)$id,
            'type' => 'text', 'cssClass' => 'link',
        ];
    }
    return $widget;
}

function nethvplan_bindData($data, $dest, $id)
{
    $widget = nethvplan_attempt(function () use ($data, $dest, $id) {
        if (($dest !== '' && $id === '') || !nethvplan_hasDestinationData($data, $dest, $id) || !empty($data[$dest][$id]['load_error'])) {
            throw new UnexpectedValueException('Block data unavailable');
        }
        $widget = nethvplan_renderData($data, $dest, $id);
        foreach ($widget['entities'] as $entity) {
            if (!is_scalar($entity['text']) || ($entity['type'] === 'list' && !is_string($entity['text'])) || ($entity['type'] === 'output' && !is_string($entity['destination']))) {
                throw new UnexpectedValueException('Invalid block entity');
            }
        }
        // Invalid UTF-8 or other JSON failures must also remain local to the block.
        json_encode($widget, JSON_THROW_ON_ERROR);
        return $widget;
    }, null, $dest . '%' . $id);
    if ($widget === null) return nethvplan_errorBlock($data, $dest, $id);
    if ($widget['bgColor'] === '#c0392b') $widget['userData']['visualplanError'] = true;
    return $widget;
}

function nethvplan_connections($widget)
{
    global $connectionTemplate;
    $connections = [];
    foreach ($widget['entities'] as $entity) {
        if ($entity['type'] !== 'output') continue;
        [$dest, $id] = nethvplan_getDestination($entity['destination']);
        $connection = $connectionTemplate;
        // Include the port so different exits to the same destination remain distinct.
        $connection['id'] = $widget['id'] . '=' . $entity['destination'] . '-' . $entity['id'];
        $connection['source'] = ['node' => $widget['id'], 'port' => 'output_' . $entity['id']];
        $connection['target'] = [
            'node' => $dest . '%' . $id, 'port' => 'input_' . $dest . '%' . $id,
            'decoration' => 'draw2d.decoration.connection.ArrowDecorator',
        ];
        $connections[] = $connection;
    }
    return $connections;
}

function nethvplan_explore($data, $destination, $destArray)
{
    global $widgets, $connections;
    if (in_array($destination, $destArray, true)) return;
    $destArray[] = $destination;
    [$dest, $id] = nethvplan_getDestination($destination);
    $widget = nethvplan_bindData($data, $dest, $id);
    $widgets[] = $widget;
    foreach (nethvplan_connections($widget) as $connection) $connections[] = $connection;
    foreach ($widget['entities'] as $entity) {
        if ($entity['type'] === 'output') {
            nethvplan_explore($data, $entity['destination'], $destArray);
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
