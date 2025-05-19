#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';
require_once '/var/www/html/freepbx/hotel/functions.inc.php';
require_once '/etc/freepbx_db.conf';

logMessage(implode(" ",$argv),DEBUG,"cdr");

$cdr_config = $ini_file["cdr"];
$cdrExternalExtensions=explode(',',$cdr_config['cdrExternalExtensions']);
$cdrInternalExtensions=explode(',',$cdr_config['cdrInternalExtensions']);
$cdrExtensionLength=$cdr_config['cdrExtensionLength'];
$cdrExternalPatterns=explode(',',$cdr_config['cdrExternalPatterns']);
$cdrInternalPatterns=explode(',',$cdr_config['cdrInternalPatterns']);
$cdrDstFixedLength=$cdr_config['cdrDstFixedLength'];

if (isset($cdr_config['cdrMode'])) {
    $cdrMode=$cdr_config['cdrMode'];
} else {
    $cdrMode='T';
}

// Add trunks outbound cids to internal patterns
$query = "SELECT outcid FROM `trunks` WHERE `outcid` != ''";
$sth = $db->prepare($query);
$sth->execute();
$res = $sth->fetchAll(PDO::FETCH_COLUMN);
$cdrInternalExtensions = array_filter(array_merge($cdrInternalExtensions,$res));

/*
"07211838279" "PJSIP/307-00000010" "2020-11-04 09:55:53" "10" "DOCUMENTATION" "1604480141.42" "\"\" <07211838279>" "2020-11-04 09:55:42" "2020-11-04 09:55:51" "03285434977" "ANSWERED" "Dial" "1" "hotel" "PJSIP/Hotel-00000011"
 */

$src = (string) $argv[1];		// source. Sample: "07211838279"
$channel = (string) $argv[2];		// channel. Sample: "PJSIP/307-00000010"
$endtime = (string) $argv[3];		// end time. Sample: "2020-11-04 09:55:53"
$duration = (string) $argv[4];		// duration. Sample: "10"
//$amaflags = (string) $argv[5];	// NOT USED amaflags. Sample: "DOCUMENTATION"
$uniqueid = (string) $argv[6];		// CDR uniqueid. Sample: "1604480141.42"
//$callerid = (string) $argv[7];	// NOT USED callerid. Sample: "\"\" <07211838279>"
$starttime = (string) $argv[8];		// start time. Sample: "2020-11-04 09:55:42"
//$answertime = (string) $argv[9];	// NOT USED answertime. Sample: "2020-11-04 09:55:51"
$dst = (string) $argv[10];		// destination. Sample: "03285434977"
$disposition = (string) $argv[11];	// disposition. Sample: "ANSWERED"
//$lastapp = (string) $argv[12];	// NOT USED lastapplication. Sample: "Dial"
$billableseconds = (int) $argv[13];	// billable seconds. Sample: "1"
//$dstcontext = (string) $argv[14];	// NOT USED destinationcontext. Sample: "hotel"
//$dstchannel = (string) $argv[15];	// NOT USED destinationchannel. Sample: "PJSIP/Hotel-00000011"
$accountcode = isset($argv[16]) ? (string) $argv[16] : ""; // accountcode. Sample: "307"

$tmp = preg_replace('/( |:)/','-',$starttime);
$tmp = explode ("-",$tmp);
$startts = mktime($tmp[3],$tmp[4],$tmp[5],$tmp[1],$tmp[2],(int) $tmp[0]);

$da = date("ymd",$startts);
$ti = date("His",$startts);

/* Get source of the call */
if (!empty($accountcode)) {
    $source = $accountcode;
} else {
    $source = $src;
}

if (is_internal($source) === 1 && is_internal($dst) === 1) $calltype = "Internal";
elseif (is_internal($source) === 1 && is_internal($dst) === 0) $calltype = "Outgoing";
elseif (is_internal($source) === 0 && is_internal($dst) === 1) $calltype = "Incoming";
else $calltype = "Unknown";

logMessage("cdr event: src=$source dst=$dst billable=$billableseconds type=$calltype",INFO,"cdr");

// exit if call is out of scope
if ( $calltype === 'Incoming' || $calltype === 'Internal' || $disposition != 'ANSWERED') {
    logMessage("Call is $calltype and disposition is $disposition. Exit without billing",DEBUG,"cdr");
    exit(0);
}

// Get room number
if (strlen($source) <= 4) {
    // 3-4 digit extensions
    $room_number = $source;
} elseif (strlen($source) <= 6 && strpos($source, '9') === '0') {
    // 3-4 digit extensions, but call is made using a secondary extension
    $room_number = substr($source,2);
} else {
    // 3-4 digit extensions, but src field contains trunks outboundcid
    $room_number = preg_replace('/.*SIP\/([0-9]+)-.*/','$1',$channel);
}

$arguments = array(
    'DA' => $da,
    'DD' => $dst,
    'DU' => gmdate("His",(int)$duration),
    'PT' => $cdrMode,
    'RN' => $room_number,
    'TI' => $ti
);

// Get posting sequence number
try {
    $query = "SELECT COUNT(*) as num FROM messages WHERE `cmd` = 'PS' AND `dir` = 'PMS'";
    $sth = $fiasdb->prepare($query);
    $rs = $sth->execute();
    $res = $sth->fetchAll(PDO::FETCH_ASSOC)[0]['num'];
    $psn = (int) $res + 1;
    // P# max length is 8 byte
    $psn = $psn % 99999999;
    $arguments['P#'] = $psn;
} catch (Exception $e) {
    logMessage("Error getting posting sequence number: ". $e->getMessage(),WARNING, "cdr");
}

/*Remove prefix from dst*/
$options = getOptions();
if (isset($options['prefix'])&& $options['prefix']!='') {
    $dst = substr($dst,count($options['prefix']));
}

$rate = findRate($dst, getAllRates());
$answer_duration = (int) $rate['answer_duration'];
$tick_duration = (int) $rate['duration'];

if ($billableseconds > $answer_duration ) {
    $bs = $billableseconds - $answer_duration;
    $ticks = ($tick_duration != 0 ) ? floor( $bs / $tick_duration) : 0;
    if($tick_duration != 0 && $bs % $tick_duration ) {
        $ticks++;
    }
}

if ($cdrMode === 'C' ) {
    // Direct charge, record must include Total Amount (TA) field
    $arguments['TA'] = floor((float) $rate['answer_price'] + ($ticks * (float) $rate['price']));
} elseif ($cdrMode === 'T' ) {
    // Telephone charge, record must include Meter Pulse (MP) field, call charge is calculated by PMS. (Not supported by PR record only PS record.)
    $arguments['MP'] = ($tick_duration > 0 ) ? $ticks + 1: $ticks ;
} else {
    logMessage("Error: wrong posting type '$cdrMode'",ERROR, "cdr");
    exit(1);
}

if (!insertMessageIntoDB('PS2PMS',$arguments)) {
    exit(1);
}

function is_internal($num){
    #1 = true, 0 = false, -1 = unknow
    global $cdrExternalExtensions;
    global $cdrInternalExtensions;
    global $cdrExtensionLength;
    global $cdrExternalPatterns;
    global $cdrInternalPatterns;

    if (empty($cdrExtensionLength)) $cdrExtensionLength = 4;

    #check if $num is in $cdrInternalExtensions or $cdrExternalExtensions array
    if (in_array($num, $cdrInternalExtensions)) {
        return 1;
    }
    if (in_array($num, $cdrExternalExtensions)) {
        return 0;
    }

    #check if $num match internal patterns or external patterns
    if (!empty($cdrInternalPatterns)) {
        foreach ($cdrInternalPatterns as $pattern) {
            if (!empty($pattern) && preg_match ($pattern,$num)) {
                return 1;
            }
        }
    }

    if (!empty($cdrExternalPatterns)) {
        foreach ($cdrExternalPatterns as $pattern) {
            if (!empty($pattern) && preg_match ($pattern,$num)) {
                return 0;
            }
        }
    }

    #check for  $num lenght
    $numl = strlen($num);
    if ($numl <=$cdrExtensionLength && $numl > 0 ) {
        return 1;
    }
    if ($numl > $cdrExtensionLength ) {
        return 0;
    }
    return -1 ;
}
