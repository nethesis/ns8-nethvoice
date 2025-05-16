#!/usr/bin/env php
<?php

require_once dirname(__FILE__) . '/functions.inc.php';

$config["record_start"] = chr($config["record_start"]);
$config["record_end"] = chr($config["record_end"]);
$config["record_LDLR"] = $ini_file["record_LDLR"];

function getOperationCommand($record) {
    return substr($record,0,2);
}

function socketSendMessage($socket, $message, $len) {
    $offset = 0;
    while ($offset < $len) {
        $sent = socket_write($socket, substr($message, $offset), $len-$offset);
        if ($sent === false) {
            // Error occurred, break the while loop
            break;
        }
        $offset += $sent;
    }
    if ($sent === false) {
        logMessage("error sending message: ".socket_strerror(socket_last_error()),ERROR, "fiasd");
        return false;
    }
    return $len;
}

/*
 * function readRecord
 * param
 *    $socket: socket to be used
 *    $record: string, is the resulting readed record
 *
 * result
 *    0        ok
 *    -1    timeout
 *    -2    disconnected
 *    -3    Out of sequence
*/
function readRecord($socket, &$record) {
    global $config;
    $LRstate = "stLRWaitStart";
    $exit = false;
    $record = "";
    while ($exit === false) {
        switch ($LRstate)
        {
            case "stLRAddToRecord":
              $record .= $buf;
              $LRstate = "stLRWaitChar";
            break;
            case "stLRDisconnected":
                $result = -2;
                $exit = true;
            break;
            case "stLRRecordEnd":
                $result = 0;
                $exit = true;
            break;
            case "stLROutOfSequence":
                $result = -3;
                $exit = true;
            break;
            case "stLRTimeout":
                $result = -1;
                $exit = true;
            break;
            case "stLRWaitChar":
                socket_set_option($socket, SOL_SOCKET, SO_RCVTIMEO, array("sec"=>round($config['timeout']), "usec"=>0));
                $bytes = @socket_recv($socket, $buf, 1,MSG_WAITALL);
                if ($bytes === false) { // timeout
                    $LRstate = "stLRTimeout";
                } else if ($bytes == 0) { // disconnected
                    $LRstate = "stLRDisconnected";
                } else if ($buf == $config["record_start"]) {
                    $LRstate = "stLROutOfSequence";
                } else if ($buf == $config["record_end"]) {
                    $LRstate = "stLRRecordEnd";
                } else {
                    $LRstate = "stLRAddToRecord";
                }
            break;
            case "stLRWaitStart":
                socket_set_option($socket, SOL_SOCKET, SO_RCVTIMEO, array("sec"=>round($config['timeout']), "usec"=>0));
                $bytes = @socket_recv($socket, $buf, 1,MSG_WAITALL);
                if ($bytes === false) { // timeout
                    $LRstate = "stLRTimeout";
                } else if ($bytes == 0) { //disconnected
                    $LRstate = "stLRDisconnected";
                } else if ($buf == $config["record_start"]) {
                    $LRstate = "stLRWaitChar";
                } else {
                    $LRstate = "stLROutOfSequence";
                }
            break;
        }
    }
    // Convert read record to UTF-8
    $record = mb_convert_encoding($record,'UTF-8',$config['remote_character_encoding']);
    return $result;
}

function sendData($socket,$val) {
    global $config;
    $val = $config["record_start"].$val.$config["record_end"];
    $val = mb_convert_encoding($val,$config['remote_character_encoding'],'auto');
    $sent = socketSendMessage($socket, $val, strlen($val));
    logMessage("send: ".$val, INFO, "fiasd");
    usleep($config["send_msdelay"]*1000);

    return ( ($sent === false) ? $sent : true);
}

function sendLE($socket) {
    global $config;
    logMessage("Send LE (Link End)", DEBUG, "fiasd");
    $format = $config["record_start"]."LE<sep>DA%s<sep>TI%s<sep>".$config["record_end"];
    $format = str_replace("<sep>", $config["separator"], $format);
    $val = sprintf($format,date("ymd"),date("His"));

    $sent = socketSendMessage($socket, $val, strlen($val));
    usleep($config["TimeoutLE_msec"]*1000);

    return ( ($sent === false) ? $sent : true);
}

function sendLA($socket) {
    global $config;
    logMessage("Send LA", DEBUGVERBOSE, "fiasd");
    $format = $config["record_start"]."LA<sep>DA%s<sep>TI%s<sep>".$config["record_end"];
    $format = str_replace("<sep>", $config["separator"], $format);
    $val = sprintf($format,date("ymd"),date("His"));

    $sent = socketSendMessage($socket, $val, strlen($val));
    usleep($config["send_msdelay"]*1000);

    return ( ($sent === false) ? $sent : true);
}

function sendLS($socket) {
    global $config;
    logMessage("Send LS", DEBUGVERBOSE, "fiasd");
    $format = $config["record_start"]."LS<sep>DA%s<sep>TI%s<sep>".$config["record_end"];
    $format = str_replace("<sep>", $config["separator"], $format);
    $val = sprintf($format,date("ymd"),date("His"));

    $sent = socketSendMessage($socket, $val, strlen($val));
    usleep($config["send_msdelay"]*1000);

    return ( ($sent === false) ? $sent : true);
}

function sendLDLRLA($socket) {
    global $config;
    foreach ($config["record_LDLR"] as $key => $val) {
        if(getOperationCommand($val)=="LD") {
            $val = str_replace("DA","DA".date("ymd"),$val);
            $val = str_replace("TI","TI".date("His"),$val);
        }
        $sent = socketSendMessage($socket, $config["record_start"].$val.$config["record_end"], strlen($val)+2);
        usleep($config["send_msdelay"]*1000);
        if ($sent === false) {
            break;
        }
    }

    if ($sent !== false) {
        $sent = sendLA($socket);
    }
    return ( ($sent === false) ? $sent : true);
}

$state= "stStart";
logMessage("Starting daemon", INFO, "fiasd");
while ( TRUE ) {
    logMessage("state: $state", DEBUGVERBOSE, "fiasd");
    switch($state) {
    case "stStart":
        // Remove waiting LE commands
        $query = "DELETE FROM messages WHERE cmd = 'LE' AND dir = 'PMS' AND elaborationtime IS NULL";
        $fiasdb->query($query);
        if (false===($socket=socket_create(AF_INET, SOCK_STREAM, SOL_TCP))) {
            logMessage("Error creating socket; ".socket_strerror(socket_last_error($socket)), ERROR, "fiasd");
            exit(1);
        }
        if (false===(socket_connect($socket, $config["address"], $config["port"]))) {
            logMessage("Error connecting to socket; ".socket_strerror(socket_last_error($socket)), ERROR, "fiasd");
            $state = "stDisconnected";
        } else {
            $last_communication = time();
            $state = "stWaitForSincro";
            $lock = FALSE;
            logMessage("Connected to {$config["address"]}:{$config["port"]}", INFO, "fiasd");
        }
    break;
    
    case "stWaitForData":
        $ret = readRecord($socket, $record);
        switch ($ret) {
        case 0: //record ok
            logMessage("received: ".$record, INFO, "fiasd");
            $last_communication = time();
            if (getOperationCommand($record) == "LS") {
                $state = "stSendLDLRLA";
            } elseif (getOperationCommand($record) == "LE") {
                $state = "stDisconnected";
            } elseif (getOperationCommand($record) == "LA") {
                $state = "stWaitForData";
            } elseif (getOperationCommand($record) == "DS") {
                $lock = TRUE;
                $state = "stWaitForData";
            } elseif (getOperationCommand($record) == "DE") {
                $lock = FALSE;
                $state = "stWaitForData";
            } else {
                $state = "stWriteDB";
            }
        break;

        case -1: // timeout
            $state = "stReadDB";
        break;

        case -2: // disconnected
        case -3: // out of sequence
             $state = "stDisconnected";
        break;
        }
    break;

    case "stWaitForLA":
        $ret = readRecord($socket, $record);
        switch ($ret) {
        case 0: //record ok
            $last_communication = time();
            logMessage("received: ".$record, INFO, "fiasd");
            if (getOperationCommand($record) == "LA") {
                $state = "stWaitForData";
            } else {
                $state = "stDisconnected";
            }
        break;

        case -1: // timeout
        case -2: // disconnected
        case -3: // out of sequence
            $state = "stDisconnected";
        break;
        }
    break;

    case "stWaitForLSLA":
        $ret = readRecord($socket, $record);
        switch ($ret) {
        case 0: //record ok
            $last_communication = time();
            logMessage("received: ".$record, INFO, "fiasd");
            if (getOperationCommand($record) == "LS") {
                $state = "stSendLDLRLA";
            } elseif (getOperationCommand($record) == "LA") {
                $state = "stWaitForData";
            } elseif (getOperationCommand($record) == "LD") {
                $state = "stSendLA";
            } else {
                $state = "stDisconnected";
            }

        break;

        case -1: // timeout
        case -2: // disconnected
        case -3: // out of sequence
             $state = "stDisconnected";
        break;
        }
    break;

    case "stWaitForSincro":
        $ret = readRecord($socket, $record);
        switch ($ret) {
        case 0: //record ok
            $last_communication = time();
            logMessage("received: ".$record, INFO, "fiasd");
            if (getOperationCommand($record) == "LS") {
                 $state = "stSendLDLRLA";
            } else {
                 $state = "stDisconnected";
            }
        break;

        case -1: // timeout
           $state = "stSendLS";
        break;

        case -2: // disconnected
        case -3: // Out of sequence
           $state = "stDisconnected";
        break;
        }
    break;

    case "stDisconnected":
        socket_close($socket);
        sleep(1);
        $state = "stStart";
    break;

    case "stSendData":
        if (false === sendData($socket,$record)) {
            $state = "stDisconnected";
        } else {
            $last_communication = time();
            $query = 'UPDATE messages SET elaborationtime = CURRENT_TIMESTAMP, raw = ? WHERE id = ?';
            $sth = $fiasdb->prepare($query);
            $rs = $sth->execute(array($record,$record_id));
            if ($rs === false) {
                logMessage("Error updating record; record_id: $record_id; ".mysql_error(), ERROR, "fiasd");
            }
            $state = "stWaitForData";
        }
    break;

    case "stSendLA":
        if (false === sendLA($socket)) {
            $state = "stDisconnected";
        } else {
            $last_communication = time();
            $state = "stWaitForData";
        }
    break;

    case "stSendLDLRLA":
        if (false === sendLDLRLA($socket)) {
            $state = "stDisconnected";
        } else {
            $last_communication = time();
            $state = "stWaitForLA";
        }
    break;

    case "stSendLS":
        if (false === sendLS($socket)) {
            $state = "stDisconnected";
        } else {
            $last_communication = time();
            $state = "stWaitForLSLA";
        }
    break;

    case "stReadDB":
        try {
            if ($lock) {
                $state = "stWaitForData";
            } else {
                $query = "SELECT * FROM messages WHERE elaborationtime IS NULL AND dir = 'PMS' ORDER BY id LIMIT 1";
                $sth = $fiasdb->prepare($query);
                $rs = $sth->execute(array());
                if (!$rs) {
                    throw new Exception('Mysql Error reading messages; '.mysql_error());
                }

                $data = $sth->fetchAll();
                if (count($data) == 0) {
                    if ( $last_communication + $config["link_check_interval"] < time()) {
                        $state = "stSendLS";
                    } else {
                        $state = "stWaitForData";
                    }
                } else {
                    $record = $data[0]["cmd"] . $config["separator"];
                    $record_id = $data[0]["id"];
                    $query = "SELECT * FROM messagesparameters WHERE msgid = ?";
                    $sth = $fiasdb->prepare($query);
                    $sth->execute(array($record_id));
                    while ($parameter = $sth->fetch(PDO::FETCH_ASSOC, PDO::FETCH_ORI_NEXT)) {
                        $record .= $parameter["param"] . $parameter["value"] . $config["separator"];
                    }
                    if (strncmp($record,"LE",2)==0) {
                        sendLE($socket);
                        $query = 'UPDATE messages SET elaborationtime = CURRENT_TIMESTAMP, raw = ? WHERE id = ?';
                        $sth = $fiasdb->prepare($query);
                        $rs = $sth->execute(array($record,$record_id));
                        if ($rs === false) {
                            logMessage('Mysql Error updating messages; '.mysql_error(), INFO, "fiasd");
                        }
                        logMessage("LE (Link End) message sent. Exiting", INFO, "fiasd");
                        exit(0);
                    } else {
                        $state = "stSendData";
                    }
                }
            }
        } catch (Exception $e) {
            logMessage($e->getMessage(), ERROR, "fiasd");
            $state = "stDisconnected";
        }
    break;

    case "stWriteDB":
        try {
            $params = explode($config["separator"],$record);
            if (($params === false) or (empty($params))) {
                throw new Exception('Error: wrong parameters '.print_r($params,true));
            }
            logMessage("INSERT INTO messages (cmd, dir, raw) VALUES (\"{$params[0]}\",\"PBX\",\"{$record}\")'", DEBUGVERBOSE, "fias");
            $query = 'INSERT INTO messages (cmd, dir, raw) VALUES (?,"PBX",?)';
            $sth = $fiasdb->prepare($query);
            $rs = $sth->execute(array($params[0],$record));
            if (!$rs) {
                throw new Exception('Error writing message to DB; '.mysql_error());
            }

            $last_id = $fiasdb->lastInsertId();
            $query = 'INSERT INTO messagesparameters (msgid, param, value) VALUES (?,?,?)';
            $sth = $fiasdb->prepare($query);
            for ($i=1; $i<count($params)-1; $i++) {
                logMessage("INSERT INTO messagesparameters (msgid, param, value) VALUES ({$last_id},\"".substr($params[$i],0,2)."\",\"".substr($params[$i],2)."\")'", DEBUGVERBOSE, "fiasd");
                $rs = $sth->execute(array($last_id, substr($params[$i],0,2), substr($params[$i],2)));
                if (!$rs) {
                    throw new Exception('Error writing messageparameters to DB; '.mysql_error());
                }
            }
            $state = "stReadDB";
        } catch (Exception $e) {
            logMessage($e->getMessage(), ERROR, "fiasd");
            $state = "stDisconnected";
        }
    break;
    }
}
