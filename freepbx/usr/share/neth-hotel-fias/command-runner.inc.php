<?php

/*
 * FIAS process execution helpers.
 *
 * Commands are always passed to proc_open() as an argv array. The command
 * configuration is parsed before any FIAS value is substituted, so data from
 * the PMS cannot add arguments or be interpreted by a shell.
 */

function fiasCommandPlaceholders()
{
    return array(
        '%ARG%',
        '%ROOM%',
        '%RESERVATION%',
        '%GUESTNAME%',
        '%GUESTLANGUAGE%',
    );
}

function fiasParseLegacyCommand($command)
{
    if (!is_string($command)) {
        throw new InvalidArgumentException('Legacy command must be a string');
    }
    if (strpos($command, "\0") !== false) {
        throw new InvalidArgumentException('Command contains a NUL byte');
    }

    $arguments = array();
    $current = '';
    $quote = null;
    $escaped = false;
    $started = false;
    $length = strlen($command);

    for ($index = 0; $index < $length; $index++) {
        $character = $command[$index];

        if ($escaped) {
            $current .= $character;
            $escaped = false;
            $started = true;
            continue;
        }

        if ($quote !== null) {
            if ($character === $quote) {
                $quote = null;
            } elseif ($quote === '"' && $character === '\\') {
                $escaped = true;
            } else {
                $current .= $character;
            }
            $started = true;
            continue;
        }

        if ($character === '"' || $character === "'") {
            $quote = $character;
            $started = true;
        } elseif ($character === '\\') {
            $escaped = true;
            $started = true;
        } elseif (ctype_space($character)) {
            if ($started) {
                $arguments[] = $current;
                $current = '';
                $started = false;
            }
        } else {
            $current .= $character;
            $started = true;
        }
    }

    if ($quote !== null) {
        throw new InvalidArgumentException('Command contains an unterminated quote');
    }
    if ($escaped) {
        throw new InvalidArgumentException('Command contains an unterminated escape');
    }
    if ($started) {
        $arguments[] = $current;
    }

    return $arguments;
}

function fiasConfiguredCommandTokens($configuredCommand)
{
    if (is_array($configuredCommand)) {
        $tokens = array_values($configuredCommand);
        foreach ($tokens as $token) {
            if (!is_scalar($token) && $token !== null) {
                throw new InvalidArgumentException('Command arguments must be scalar values');
            }
        }
        return array_map(function ($token) {
            return (string) $token;
        }, $tokens);
    }

    return fiasParseLegacyCommand($configuredCommand);
}

function fiasFindPlaceholders($value)
{
    $found = array();
    foreach (fiasCommandPlaceholders() as $placeholder) {
        if (strpos($value, $placeholder) !== false) {
            $found[] = $placeholder;
        }
    }
    return $found;
}

function fiasValidateKnownPlaceholders($value)
{
    if (preg_match_all('/%[A-Z0-9#+_]+%/', $value, $matches)) {
        $known = fiasCommandPlaceholders();
        foreach ($matches[0] as $placeholder) {
            if (!in_array($placeholder, $known, true)) {
                throw new InvalidArgumentException("Unknown command placeholder {$placeholder}");
            }
        }
    }
}

function fiasPlaceholderValue($placeholder, $values)
{
    $value = array_key_exists($placeholder, $values) ? $values[$placeholder] : '';
    if (!is_scalar($value) && $value !== null) {
        throw new InvalidArgumentException("Invalid value for command placeholder {$placeholder}");
    }
    $value = (string) $value;
    if (strpos($value, "\0") !== false) {
        throw new InvalidArgumentException("Command placeholder {$placeholder} contains a NUL byte");
    }
    return $value;
}

function fiasExpandLegacyToken($token, $values)
{
    fiasValidateKnownPlaceholders($token);
    $placeholders = fiasFindPlaceholders($token);
    if (empty($placeholders)) {
        return array($token);
    }

    $replacementValues = array();
    foreach ($placeholders as $placeholder) {
        $replacementValues[$placeholder] = fiasPlaceholderValue($placeholder, $values);
    }
    return array(strtr($token, $replacementValues));
}

function fiasBuildCommand($configuredCommand, $values = array())
{
    $isArrayConfiguration = is_array($configuredCommand);
    $tokens = fiasConfiguredCommandTokens($configuredCommand);
    if (empty($tokens) || $tokens[0] === '') {
        throw new InvalidArgumentException('Command executable is empty');
    }
    if (!empty(fiasFindPlaceholders($tokens[0]))) {
        throw new InvalidArgumentException('Command executable cannot contain a placeholder');
    }

    $arguments = array();
    foreach ($tokens as $token) {
        if (strpos($token, "\0") !== false) {
            throw new InvalidArgumentException('Command argument contains a NUL byte');
        }
        fiasValidateKnownPlaceholders($token);
        $placeholders = fiasFindPlaceholders($token);

        if ($isArrayConfiguration) {
            if (empty($placeholders)) {
                $arguments[] = $token;
            } elseif (count($placeholders) === 1 && $token === $placeholders[0]) {
                $arguments[] = fiasPlaceholderValue($token, $values);
            } else {
                throw new InvalidArgumentException(
                    'Array-form command placeholders must be standalone arguments'
                );
            }
        } else {
            foreach (fiasExpandLegacyToken($token, $values) as $argument) {
                $arguments[] = $argument;
            }
        }
    }

    return $arguments;
}

function fiasFormatCommandForLog($arguments)
{
    $encoded = json_encode($arguments, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return $encoded === false ? '[unable to encode argv]' : $encoded;
}

function fiasRunProcess($arguments)
{
    if (!is_array($arguments) || empty($arguments) || (string) $arguments[0] === '') {
        throw new InvalidArgumentException('Process argv must contain an executable');
    }
    foreach ($arguments as $argument) {
        if (!is_scalar($argument) && $argument !== null) {
            throw new InvalidArgumentException('Process arguments must be scalar values');
        }
        if (strpos((string) $argument, "\0") !== false) {
            throw new InvalidArgumentException('Process argument contains a NUL byte');
        }
    }
    $arguments = array_map(function ($argument) {
        return (string) $argument;
    }, array_values($arguments));

    $descriptorSpec = array(
        0 => array('pipe', 'r'),
        1 => array('pipe', 'w'),
        2 => array('redirect', 1),
    );
    $pipes = array();

    try {
        $process = proc_open($arguments, $descriptorSpec, $pipes);
    } catch (Throwable $exception) {
        return array(
            'exit_code' => -1,
            'output' => array($exception->getMessage()),
            'argv' => $arguments,
        );
    }

    if (!is_resource($process)) {
        return array(
            'exit_code' => -1,
            'output' => array('Unable to start process'),
            'argv' => $arguments,
        );
    }

    fclose($pipes[0]);
    $combinedOutput = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    $exitCode = proc_close($process);

    $output = array();
    if ($combinedOutput !== false && $combinedOutput !== '') {
        $combinedOutput = rtrim($combinedOutput, "\r\n");
        if ($combinedOutput !== '') {
            $output = preg_split('/\r\n|\n|\r/', $combinedOutput);
        }
    }

    return array(
        'exit_code' => $exitCode,
        'output' => $output,
        'argv' => $arguments,
    );
}
