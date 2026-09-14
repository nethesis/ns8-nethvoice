#!/usr/bin/env php
<?php

/******************************************************************************************
 * This program takes from database messages from PMS to PBX and their parameters
 * Then execute the command with parameters specified in /etc/asterisk/fias.conf configuration file
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
        // LR records advertise protocol capabilities during link negotiation.
        // They do not map to a PBX-side hotel command, so acknowledge them
        // silently instead of reporting a missing LR2PBX configuration section.
        if ($section === 'LR2PBX') {
            $query = "UPDATE messages SET elaborationtime = CURRENT_TIMESTAMP WHERE id = ?";
            $sth = $fiasdb->prepare($query);
            $sth->execute(array($id));
            continue;
        }
        if (!isset($ini_file[$section])) {
            logMessage("Command section $section not defined in configuration file /etc/asterisk/fias.conf", ERROR, "dispatcher");
            continue;
        }
        $command = array();
        try {
            $command = fiasBuildCommand($ini_file[$section]["command"]);
            $format = explode("_", $ini_file[$section]["format"]);
            foreach ($format as $parameter) {
                if (empty($parameter) || !isset($message['parameters'][$parameter])) {
                    $command[] = '';
                } else {
                    $command[] = $message['parameters'][$parameter];
                }
            }
            logMessage(
                "Message $id ($section) launching argv: " . fiasFormatCommandForLog($command),
                INFO,
                "dispatcher"
            );
            $result = fiasRunProcess($command);
        } catch (Throwable $exception) {
            $result = array(
                'exit_code' => -1,
                'output' => array($exception->getMessage()),
                'argv' => isset($command) && is_array($command) ? $command : array(),
            );
        }
        foreach ($result['output'] as $line) {
            logMessage("Message $id ($section) handler: $line", INFO, "dispatcher");
        }
        $query = "UPDATE messages SET elaborationtime = CURRENT_TIMESTAMP WHERE id = ?";
        $sth = $fiasdb->prepare($query);
        $sth->execute(array($id));
        if ($result['exit_code'] != 0) {
            logMessage(
                "Message $id ($section) failed with exit code {$result['exit_code']} for argv "
                    . fiasFormatCommandForLog($result['argv']),
                ERROR,
                "dispatcher"
            );
        } else {
            logMessage("Message $id ($section) completed with exit code 0", INFO, "dispatcher");
        }
    }
}
