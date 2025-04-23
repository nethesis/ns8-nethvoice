#!/usr/bin/env php
<?php

/******************************************************************************************
 * This program takes from database messages from PMS to PBX and their parameters
 * Then execute the command with parameters specified in /etc/fias.conf configuration file
 **************************************************************************************** */

require_once dirname(__FILE__) . '/functions.inc.php';

logMessage("Starting daemon", INFO, "dispatcher");

while (TRUE) {
    sleep(2);
    // Get not elaborated messages and parameters
    $query = "SELECT id,CONCAT(cmd,'2',dir) as section, param, value FROM messages INNER JOIN messagesparameters on messages.id = messagesparameters.msgid WHERE elaborationtime IS NULL AND dir = 'PBX' ORDER BY messages.id";
    $sth = $fiasdb->prepare($query);
    $sth->execute(array());
    if ($sth->rowCount()===0) {
        continue;
    }

    $rows = $sth->fetchAll(PDO::FETCH_ASSOC);

    // Shape message and parameters array: group using id and add an array of parameters
    $messages = array();
    foreach ($rows as $row) {
        if (!isset($messages[$row['id']])) {
	    $messages[$row['id']] = array();
        }
        if (!isset($messages[$row['id']]['parameters'])) {
            $messages[$row['id']]['parameters'] = array();
        }
        if (!isset($messages[$row['id']]['section'])) {
            $messages[$row['id']]['section'] = $row['section'];
        }
        $messages[$row['id']]['parameters'][$row['param']] = $row['value'];
    }

    // Launch a command foreach message
    foreach ($messages as $id => $message){
        $section = $message['section'];
        if (!isset($ini_file[$section])) {
            logMessage("Command section $section not defined in configuration file /etc/fias.conf", ERROR, "dispatcher");
            continue;
        }
        $command = $ini_file[$section]["command"];
        $format = explode("_", $ini_file[$section]["format"]);
        foreach ($format as $parameter) {
	    $command .= ' ';
            if (empty($parameter) || !isset($message['parameters'][$parameter])) {
                $command .= "''";
	    } else {
                $command .= escapeshellarg($message['parameters'][$parameter]);
            }
        }
        logMessage("Launching command: $command", INFO, "dispatcher");
        exec($command, $output, $exit_val);
        $query = "UPDATE messages SET elaborationtime = CURRENT_TIMESTAMP WHERE id = ?";
        $sth = $fiasdb->prepare($query);
        $sth->execute(array($id));
        if ($exit_val != 0) {
            logMessage("ERROR executing command \"$command\": ".implode("\n",$output), ERROR, "dispatcher");
        }
    }
}

