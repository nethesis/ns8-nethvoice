#!/usr/bin/env php
<?php
require_once 'functions.inc.php';
require_once 'fias-server-functions.inc.php';
$config["record_start"] = chr($config["record_start"]);
$config["record_end"] = chr($config["record_end"]);
$config["record_LDLR"] = $ini_file["record_LDLR"];
# Test lock
$fp = fopen("/var/run/" . basename($argv[0]), "a");
if (!$fp || !flock($fp, LOCK_EX | LOCK_NB, $eWouldBlock) || $eWouldBlock) {
    if ($eWouldBlock) {
        logMessage("Daemon already running", DEBUGVERBOSE, "fias-server");
        exit(0);
    } else {
        logMessage("ERROR! Failed to acquire lock!", ERROR, "fias-server");
        exit(1);
    }
}
function getOperationCommand($record) {
    return substr($record, 0, 2);
}
function socketSendMessage($socket, $message, $len) {
    $offset = 0;
    while ($offset < $len) {
        $sent = socket_write($socket, substr($message, $offset), $len - $offset);
        if ($sent === false) {
            // Error occurred, break the while loop
            break;
        }
        $offset+= $sent;
    }
    if ($sent === false) {
        logMessage("error sending message: " . socket_strerror(socket_last_error()), ERROR, "fiasd");
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
        switch ($LRstate) {
            case "stLRAddToRecord":
                $record.= $buf;
                $LRstate = "stLRWaitChar";
            break;
            case "stLRDisconnected":
                $result = - 2;
                $exit = true;
            break;
            case "stLRRecordEnd":
                $result = 0;
                $exit = true;
            break;
            case "stLROutOfSequence":
                $result = - 3;
                $exit = true;
            break;
            case "stLRTimeout":
                $result = - 1;
                $exit = true;
            break;
            case "stLRWaitChar":
                socket_set_option($socket, SOL_SOCKET, SO_RCVTIMEO, array("sec"=>round($config['timeout']), "usec"=>0));
                $bytes = @socket_recv($socket, $buf, 1, MSG_WAITALL);
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
                $bytes = @socket_recv($socket, $buf, 1, MSG_WAITALL);
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
    return $result;
}

function sendData($socket, $val) {
        global $config;
        $val = $config["record_start"] . $val . $config["record_end"];
        $sent = socketSendMessage($socket, $val, strlen($val));
        logMessage("send: " . $val, INFO, "fias-server");
        usleep($config["send_msdelay"] * 1000);
        return (($sent === false) ? $sent : true);
    }

function sendLE($socket) {
        global $config;
    logMessage("Send LE (Link End)", DEBUG, "fias-server");
    $format = $config["record_start"] . "LE<sep>DA%s<sep>TI%s<sep>" . $config["record_end"];
    $format = str_replace("<sep>", $config["separator"], $format);
    $val = sprintf($format, date("ymd"), date("His"));
    $sent = socketSendMessage($socket, $val, strlen($val));
    usleep($config["TimeoutLE_msec"] * 1000);
    return (($sent === false) ? $sent : true);
}

function sendLA($socket) {
    global $config;
    logMessage("Send LA", DEBUGVERBOSE, "fias-server");
    $format = $config["record_start"] . "LA<sep>DA%s<sep>TI%s<sep>" . $config["record_end"];
    $format = str_replace("<sep>", $config["separator"], $format);
    $val = sprintf($format, date("ymd"), date("His"));
    $sent = socketSendMessage($socket, $val, strlen($val));
    usleep($config["send_msdelay"] * 1000);
    return (($sent === false) ? $sent : true);
}

function sendLS($socket) {
    global $config;
    logMessage("Send LS", DEBUGVERBOSE, "fias-server");
    $format = $config["record_start"] . "LS<sep>DA%s<sep>TI%s<sep>" . $config["record_end"];
    $format = str_replace("<sep>", $config["separator"], $format);
    $val = sprintf($format, date("ymd"), date("His"));
    $sent = socketSendMessage($socket, $val, strlen($val));
    usleep($config["send_msdelay"] * 1000);
    return (($sent === false) ? $sent : true);
}

function sendLDLRLA($socket) {
    global $config;
    logMessage("Send LDLR", DEBUGVERBOSE, "fias-server");
    $sent = false;
    while (list($key, $val) = each($config["record_LDLR"])) {
        if (getOperationCommand($val) == "LD") {
            $val = str_replace("DA", "DA" . date("ymd"), $val);
            $val = str_replace("TI", "TI" . date("His"), $val);
        }
        logMessage("sending $val", DEBUGVERBOSE, "fiasd-server");
        $sent = socketSendMessage($socket, $config["record_start"] . $val . $config["record_end"], strlen($val) + 2);
        usleep($config["send_msdelay"] * 1000);
        if ($sent === false) break;
    }
    if ($sent !== false) {
        $sent = sendLA($socket);
    }
    return (($sent === false) ? $sent : true);
}


$sock = socket_create_listen($config["port"]);
if ($sock == FALSE) {
    logMessage("Socket ERROR: " . socket_strerror(socket_last_error()), ERROR, "fias-server");
}
logMessage("Starting daemon", INFO, "fias-server");
while ($socket = socket_accept($sock)) {
    $state = "stStart";
    socket_getpeername($socket, $raddr, $rport);
    logMessage("Received Connection from $raddr:$rport", DEBUG, "fias-server");
    while ($state != 'stDisconnected') {
        logMessage("state: $state", DEBUGVERBOSE, "fias-server");
        switch ($state) {
            case "stStart":
                if (socket_getpeername($socket, $raddr, $rport)) {
                    $state = "stSendLS";
                } else {
                    logMessage("Disconnected", INFO, "fias-server");
                    $state = "stDisconnected";
                }
            break;
            case "stWaitForData":
                $ret = readRecord($socket, $record);
                switch ($ret) {
                    case 0: //record ok
                        logMessage("received: " . $record, INFO, "fias-server");
                        if (getOperationCommand($record) == "LS") {
                            $state = "stSendLDLRLA";
                        } elseif (getOperationCommand($record) == "LE") {
                            $state = "stDisconnected";
                        } elseif (getOperationCommand($record) == "LA") {
                            $state = "stReadDB";
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
                        logMessage("received: " . $record, INFO, "fias-server");
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
            case "stWaitForLDLRLA":
                $ret = readRecord($socket, $record);
                switch ($ret) {
                    case 0:
                        if (getOperationCommand($record) == "LD") {
                            $state = 'stWaitForLDLRLA';
                        } elseif (getOperationCommand($record) == "LR") {
                            $state = 'stWaitForLDLRLA';
                        } elseif (getOperationCommand($record) == "LA") {
                            $state = 'stSendLA';
                        } else {
                            $state = 'stDisconnected';
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
                        logMessage("received: " . $record, INFO, "fias-server");
                        if (getOperationCommand($record) == "LS") {
                            $state = "stSendLDLRLA";
                        } elseif (getOperationCommand($record) == "LA") {
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
            case "stSendSincro":
                sendLS($socket, $config);
            break;
            case "stWaitForSincro":
                $ret = readRecord($socket, $record);
                switch ($ret) {
                    case 0: //record ok
                        logMessage("received: " . $record, INFO, "fias-server");
                        if (getOperationCommand($record) == "LS") {
                            $state = "stSendLDLRLA";
                        } else {
                            $state = "stDisconnected";
                        }
                    break;
                    case -1: // timeout
                        $state = "stSendLS";
                    case -2: // disconnected
                    case -3: // Out of sequence
                        $state = "stDisconnected";
                    break;
                }
            break;
            case "stDisconnected":
                logMessage("Error: " . socket_strerror(socket_last_error($socket)), ERROR, "fias-server");
                socket_close($socket);
                sleep(1);
                $state = "stStart";
            break;
            case "stSendData":
                if (false === sendData($socket, $record)) {
                    $state = "stDisconnected";
                } else {
                    $query = 'UPDATE messages SET elaborationtime = CURRENT_TIMESTAMP, raw = ? WHERE id = ?';
                    $sth = $fiasserverdb->prepare($query);
                    $rs = $sth->execute(array($record, $record_id));
                    if ($rs === false) {
                        logMessage("Error updating record; record_id: $record_id; " . mysql_error(), ERROR, "fias-server");
                    }
                    $state = "stWaitForData";
                }
            break;
            case "stSendLA":
                if (false === sendLA($socket)) {
                    $state = "stDisconnected";
                } else {
                    $state = "stWaitForData";
                }
            break;
            case "stSendLDLRLA":
                if (false === sendLDLRLA($socket)) {
                    $state = "stDisconnected";
                } else {
                    $state = "stWaitForLA";
                }
            break;
            case "stSendLS":
                if (false === sendLS($socket)) {
                    $state = "stDisconnected";
                } else {
                    $state = "stWaitForLDLRLA";
                }
            break;
            case "stReadDB":
                try {
                    $query = "SELECT * FROM messages WHERE elaborationtime IS NULL AND dir = 'PBX' ORDER BY id LIMIT 1";
                    $sth = $fiasserverdb->prepare($query);
                    $rs = $sth->execute(array());
                    if (!$rs) {
                        throw new Exception('Mysql Error reading messages; ' . mysql_error());
                    }
                    $data = $sth->fetchAll();
                    if (count($data) == 0) {
                        $state = "stWaitForData";
                    } else {
                        $record = $data[0]["cmd"] . $config["separator"];
                        $record_id = $data[0]["id"];
                        $query = "SELECT * FROM messagesparameters WHERE msgid = ?";
                        $sth = $fiasserverdb->prepare($query);
                        $sth->execute(array($record_id));
                        while ($parameter = $sth->fetch(PDO::FETCH_ASSOC, PDO::FETCH_ORI_NEXT)) {
                            $record.= $parameter["param"] . $parameter["value"] . $config["separator"];
                        }
                        if (strncmp($record, "LE", 2) == 0) {
                            sendLE($socket);
                            $query = 'UPDATE messages SET elaborationtime = CURRENT_TIMESTAMP, raw = ? WHERE id = ?';
                            $sth = $fiasserverdb->prepare($query);
                            $rs = $sth->execute(array($record, $record_id));
                            if ($rs === false) {
                                logMessage('Mysql Error updating messages; ' . mysql_error(), INFO, "fias-server");
                            }
                            logMessage("LE (Link End) message sent. Exiting", INFO, "fias-server");
                            $state = "stDisconnected";
                        } else {
                            $state = "stSendData";
                        }
                    }
                }
                catch(Exception $e) {
                    logMessage($e->getMessage(), ERROR, "fias-server");
                    $state = "stDisconnected";
                }
            break;
            case "stWriteDB":
                try {
                    $params = explode($config["separator"], $record);
                    if (($params === false) or (empty($params))) {
                        throw new Exception('Error: wrong parameters ' . print_r($params, true));
                    }
                    logMessage("INSERT INTO messages (cmd, dir, raw) VALUES (\"{$params[0]}\",\"PMS\",\"{$record}\")'", DEBUGVERBOSE, "fias-server");
                    $query = 'INSERT INTO messages (cmd, dir, raw) VALUES (?,"PMS",?)';
                    $sth = $fiasserverdb->prepare($query);
                    $rs = $sth->execute(array($params[0], $record));
                    if (!$rs) {
                        throw new Exception('Error writing message to DB; ' . mysql_error());
                    }
                    $last_id = $fiasserverdb->lastInsertId();
                    logMessage("INSERT INTO messagesparameters (msgid, param, value) VALUES ({$last_id},\"" . substr($params[$i], 0, 2) . "\",\"" . substr($params[$i], 2) . "\")'", DEBUGVERBOSE, "fias-server");
                    $query = 'INSERT INTO messagesparameters (msgid, param, value) VALUES (?,?,?)';
                    $sth = $fiasserverdb->prepare($query);
                    for ($i = 1;$i < count($params) - 1;$i++) {
                        $rs = $sth->execute(array($last_id, substr($params[$i], 0, 2), substr($params[$i], 2)));
                        if (!$rs) {
                            throw new Exception('Error writing messageparameters to DB; ' . mysql_error());
                        }
                    }
                    $state = "stReadDB";
                }
                catch(Exception $e) {
                    logMessage($e->getMessage(), ERROR, "fias-server");
                    $state = "stDisconnected";
                }
            break;
        }
    }
}

