<?php

/*
 * FIAS database helpers.
 *
 * Protocol data is accepted only as a bound value. SQL identifiers and
 * statements remain fixed application data.
 */

function fiasPdoOptions()
{
    $options = array(
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
    );
    if (defined('PDO::MYSQL_ATTR_MULTI_STATEMENTS')) {
        $options[PDO::MYSQL_ATTR_MULTI_STATEMENTS] = false;
    }
    return $options;
}

function insertFiasMessage($database, $command, $direction, $parameters, $raw = null)
{
    if (!preg_match('/^[A-Z]{2}$/', $command)) {
        throw new InvalidArgumentException("Invalid FIAS command {$command}");
    }
    if (!in_array($direction, array('PBX', 'PMS'), true)) {
        throw new InvalidArgumentException("Invalid FIAS direction {$direction}");
    }
    if (!is_array($parameters)) {
        throw new InvalidArgumentException('FIAS parameters must be an array');
    }
    if (!is_scalar($raw) && $raw !== null) {
        throw new InvalidArgumentException('Invalid raw FIAS record');
    }

    $normalizedParameters = array();
    foreach ($parameters as $label => $value) {
        if (is_int($label) && is_array($value) && count($value) === 2) {
            $parameter = array_values($value);
            $label = $parameter[0];
            $value = $parameter[1];
        }
        $label = (string) $label;
        if (!preg_match('/^[A-Z0-9#+]{2}$/', $label)) {
            throw new InvalidArgumentException("Invalid FIAS parameter {$label}");
        }
        if (!is_scalar($value) && $value !== null) {
            throw new InvalidArgumentException("Invalid value for FIAS parameter {$label}");
        }
        $normalizedParameters[] = array($label, $value);
    }

    $query = 'INSERT INTO messages (cmd, dir, raw) VALUES (?, ?, ?)';
    $statement = $database->prepare($query);
    $statement->execute(array($command, $direction, $raw));
    $messageId = $database->lastInsertId();

    if (!empty($normalizedParameters)) {
        $query = 'INSERT INTO messagesparameters (msgid, param, value) VALUES (?, ?, ?)';
        $statement = $database->prepare($query);
        foreach ($normalizedParameters as $parameter) {
            list($label, $value) = $parameter;
            $statement->execute(array($messageId, $label, $value));
        }
    }

    return $messageId;
}
