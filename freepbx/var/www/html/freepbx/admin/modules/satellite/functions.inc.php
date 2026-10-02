<?php
require_once __DIR__ . '/lib/AgentValidation.php';

function satellite_get_config($engine) {
    // Intentionally left as a no-op. Configuration handling is done in satellite_get_config_late().
}

function satellite_get_config_late($engine) {
    global $ext;
    global $amp_conf;
    global $db;
    switch($engine) {
        case "asterisk":
        /* satellite STT real time Transcriptions*/
        if (!empty($_ENV['SATELLITE_CALL_TRANSCRIPTION_ENABLED']) && $_ENV['SATELLITE_CALL_TRANSCRIPTION_ENABLED'] == 'True') {
            $satellite_mixmonitor_options = 'br(/var/run/nethvoice/satellite-r-${UNIQUEID}-${CHANNEL(linkedid)}.wav)t(/var/run/nethvoice/satellite-t-${UNIQUEID}-${CHANNEL(linkedid)}.wav)i(${SATELLITE_LOCAL_MIXMON_ID})';
            $satellite_transcription_command = '/var/lib/asterisk/bin/satellite_transcript -u ${UNIQUEID} -l ${CHANNEL(linkedid)}';

            // Add a call Satellite when call is answered in macro-dial-one adding it in D_OPTIONS variable
            $ext->splice('macro-dial-one','s','dial', new \ext_setvar('D_OPTIONS', '${D_OPTIONS}U(satellite^s^1)'),'', -1);

            // extension-to-extension and trunk-to-extension delivery.
            $ext->splice('macro-exten-vm', 's', 'checkrecord', new ext_gosub('1', 's', 'sub-satellite-record-check', 'exten,${EXTTOCALL},yes'), 'satellite-check', 0);

            if (function_exists('queues_list') && count(queues_list(true)) > 0) {
                foreach (\FreePBX::Queues()->listQueues() as $queue) {
                    if (!isset($queue[0]) || $queue[0] === '') {
                        continue;
                    }

                    // calls an extension makes to a queue.
                    $ext->splice('ext-queues', $queue[0], 'qposition', new ext_gosub('1', 's', 'sub-satellite-record-check', 'q,${EXTEN},yes'), 'satellite-check', 3);
                }

                $sql = "SELECT LENGTH(extension) as len FROM users GROUP BY len";
                $sth = \FreePBX::Database()->prepare($sql);
                $sth->execute();
                $rows = $sth->fetchAll(\PDO::FETCH_ASSOC);
                foreach ($rows as $row) {
                    if (empty($row['len'])) {
                        continue;
                    }

                    $pattern = '_' . str_repeat('X', (int) $row['len']);
                    // queue calls delivered to an extension.
                    $ext->splice('from-queue-exten-only', $pattern, 'qposition', new ext_gosub('1', 's', 'sub-satellite-record-check', 'q,${EXTEN},yes'), 'satellite-check', 3);
                }
            }

            $routes = core_routing_list();
            if (!empty($routes)) {
                foreach ($routes as $route) {
                    $routetrunks = core_routing_getroutetrunksbyid($route['route_id']);
                    if (!empty($routetrunks)) {
                        $ext->splice('macro-dialout-trunk', 's', '', new \ext_setvar('DIAL_TRUNK_OPTIONS', '${DIAL_TRUNK_OPTIONS}U(satellite^s^1)'),'', 28);
                        $ext->splice('macro-dialout-trunk', 's', '', new \ext_gosub('1', 's', 'sub-satellite-record-check', 'out,${DIAL_NUMBER},yes'),'', 28);
                        break;
                    }
                }
            }

            $context = 'satellite-ext-callrecording';
            # TODO list all extension with recording enabled in profile
            foreach (FreePBX::Core()->listUsers(false) as $user) {
                if (!isset($user[0]) || $user[0] === '') {
                    continue;
                }

                $extension = $user[0];
                $ext->add($context, $extension, '', new ext_noop_trace('satellite Call Recording Event'));
                # TODO if transcription is disabled, continue
                $ext->add($context, $extension, '', new ext_gosub('1','s','sub-satellite-record-check','generic,${FROM_DID},yes'));
            }

            /*
            ; ARG1: type
            ;       exten, out, rg, q, conf
            ; ARG2: called_exten
            ; ARG3: action (if we know it)
            ;       yes, no
            */
            $context = 'sub-satellite-record-check';
            $exten = 's';

            $ext->add($context, $exten, '', new ext_gotoif('$["${ARG3}" != "yes"]', 'return'));
            // check if there is a recording for this call already
            $ext->add($context, $exten, '', new ext_gotoif('$["${HASH(SATELLITE_ACTIVE_RECORDINGS,${UNIQUEID})}" != ""]', 'return'));

            // start recording
            $ext->add($context, $exten, 'startrec', new ext_noop('satellite starting recording'));
            // add ${UNIQUEID} to an array of active recordings
            $ext->add($context, $exten, '', new ext_set('HASH(__SATELLITE_ACTIVE_RECORDINGS,${UNIQUEID})', '${CHANNEL(name)}'));
            $ext->add($context, $exten, '', new ext_set('__SATELLITE_LOCAL_MIXMON_ID', '${UNIQUEID}-${CHANNEL(linkedid)}'));
            $ext->add($context, $exten, 'monitorcmd', new \ext_mixmonitor('', $satellite_mixmonitor_options, $satellite_transcription_command));
            $ext->add($context, $exten, 'return', new ext_return(''));

            // Create the satellite real time stt context
            $ext->add('satellite', 's', '', new \ext_noop('satellite STT'));
            // TODO: add a check to see if the user is allowed to use the STT
            // Start Stasis
            $ext->add('satellite', 's', '', new \ext_stasis('satellite'));
            $ext->add('satellite', 's', '', new \ext_noop('Stasis satellite end'));
            // Return to the dialplan
            $ext->add('satellite', 's', '', new \ext_return());
        }
        satellite_generate_agent_dialplan();
        break;
    }
}

function satellite_agent_destination_key($id) {
    return 'satellite-agent-destination-' . (int) $id . ',s,1';
}

/** A destination whose flow is invalid never gets a dialplan context. */
function satellite_agent_destination_valid($row) {
    if ($row['agent_type'] !== 'cleverai') {
        return false;
    }
    try {
        AgentValidation::validateFlow($row['cleverai_flow']);
    } catch (\InvalidArgumentException $error) {
        return false;
    }
    return true;
}

function satellite_destinations() {
    $result = array();
    foreach (FreePBX::Satellite()->getAgentDestinations() as $row) {
        if (!empty($row['enabled']) && satellite_agent_destination_valid($row)) {
            $result[] = array(
                'destination' => satellite_agent_destination_key($row['id']),
                'description' => $row['freepbx_name'],
                'edit_url' => 'config.php?display=satellite_agents&view=form&id=' . (int) $row['id']
            );
        }
    }
    return $result;
}

function satellite_getdest($id) {
    return array(satellite_agent_destination_key($id));
}

function satellite_getdestinfo($dest) {
    if (!preg_match('/^satellite-agent-destination-([0-9]+),s,1$/', trim($dest), $match)) {
        return false;
    }
    $row = FreePBX::Satellite()->getAgentDestination((int) $match[1]);
    if (!$row) {
        return array();
    }
    return array(
        'description' => 'Agent: ' . $row['freepbx_name'],
        'edit_url' => 'config.php?display=satellite_agents&view=form&id=' . (int) $row['id']
    );
}

function satellite_check_destinations($dest = true) {
    $result = array();
    if (is_array($dest) && !$dest) {
        return $result;
    }
    foreach (FreePBX::Satellite()->getAgentDestinations() as $row) {
        $fallback = $row['fallback_destination'];
        if ($fallback === null || $fallback === '' || ($dest !== true && !in_array($fallback, (array) $dest, true))) {
            continue;
        }
        $result[] = array(
            'dest' => $fallback,
            'description' => 'Agent: ' . $row['freepbx_name'] . ' fallback',
            'edit_url' => 'config.php?display=satellite_agents&view=form&id=' . (int) $row['id']
        );
    }
    return $result;
}

function satellite_change_destination($old_dest, $new_dest) {
    // FreePBX hands over values already quoted by PDO::quote().
    $old_dest = trim((string) $old_dest, "'");
    $new_dest = trim((string) $new_dest, "'");
    if ($old_dest === '') {
        return 0;
    }
    try {
        return (int) FreePBX::Satellite()->changeAgentFallbackDestination($old_dest, $new_dest);
    } catch (\InvalidArgumentException $error) {
        // Not an Agent fallback value: nothing to update.
        return 0;
    }
}

function satellite_generate_agent_dialplan() {
    global $ext;
    $satellite = FreePBX::Satellite();
    $destinations = $satellite->getAgentDestinations();
    if (!$destinations) {
        return;
    }
    $trunks = array();
    foreach ($satellite->getAgentTrunks() as $trunk) {
        $trunks[(int) $trunk['id']] = $trunk;
    }

    $headers = 'satellite-agent-add-headers';
    $ext->add($headers, 's', '', new ext_noop('Add headers to Agent SIP leg'));
    $ext->add($headers, 's', '', new ext_set('__AGENT_CALLED_NUMBER', '${AGENT_ORIGINAL_DID}'));
    $ext->add($headers, 's', '', new ext_execif('$["${AGENT_CALLED_NUMBER}"=""]', 'Set', '__AGENT_CALLED_NUMBER=${AGENT_EXTENSION}'));
    foreach (array(
        'X-OS-Caller' => '${AGENT_ORIGINAL_CALLER}',
        'X-OS-Caller-Name' => '${AGENT_ORIGINAL_CALLER_NAME}',
        'X-OS-DID' => '${AGENT_CALLED_NUMBER}',
        'X-OS-Extension' => '${AGENT_EXTENSION}',
        'X-OS-FLOW' => '${AGENT_FLOW}',
        'X-OS-Agent-ID' => '${AGENT_DESTINATION_ID}',
        'X-OS-Session-ID' => '${CHANNEL(linkedid)}',
        'isTrunk' => '1'
    ) as $name => $value) {
        $ext->add($headers, 's', '', new ext_set('PJSIP_HEADER(add,' . $name . ')', $value));
    }
    $ext->add($headers, 's', '', new ext_return());

    foreach ($destinations as $row) {
        if (empty($row['enabled']) || !satellite_agent_destination_valid($row)) {
            function_exists('freepbx_log') && freepbx_log(FPBX_LOG_WARNING, 'Satellite Agent destination ' . (int) $row['id'] . ' skipped: invalid CleverAI flow');
            continue;
        }
        $context = 'satellite-agent-destination-' . (int) $row['id'];
        $trunk = isset($trunks[(int) $row['cleverai_trunk_id']]) ? $trunks[(int) $row['cleverai_trunk_id']] : null;
        $ext->add($context, 's', '', new ext_noop('Satellite Agent destination ' . $row['freepbx_name']));
        $ext->add($context, 's', '', new ext_set('__AGENT_DESTINATION_ID', (int) $row['id']));
        $ext->add($context, 's', '', new ext_set('__AGENT_TYPE', 'cleverai'));
        $ext->add($context, 's', '', new ext_set('__AGENT_FLOW', $row['cleverai_flow']));
        $ext->add($context, 's', '', new ext_set('__AGENT_ORIGINAL_CALLER', '${CALLERID(num)}'));
        $ext->add($context, 's', '', new ext_set('__AGENT_ORIGINAL_CALLER_NAME', '${CALLERID(name)}'));
        $ext->add($context, 's', '', new ext_set('__AGENT_ORIGINAL_DID', '${FROM_DID}'));
        $ext->add($context, 's', '', new ext_set('__AGENT_EXTENSION', ''));

        if ($trunk && !empty($trunk['enabled']) &&
            preg_match('/^AgentTrunk_[0-9]+$/D', (string) $trunk['freepbx_trunk_name'])) {
            try {
                $user = $trunk['provider'] === 'openai'
                    ? AgentValidation::validateProjectId($trunk['openai_project_id'])
                    : AgentValidation::validateGrokPhoneNumber($trunk['grok_phone_number']);
                $valid = in_array($trunk['provider'], array('openai', 'grok'), true);
            } catch (\InvalidArgumentException $error) {
                $valid = false;
            }
            if ($valid) {
                $host = $trunk['provider'] === 'openai' ? 'sip.api.openai.com' : 'sip.voice.x.ai';
                $ext->add($context, 's', '', new ext_dial(
                    'PJSIP/' . $trunk['freepbx_trunk_name'] . '/sip:' . $user . '@' . $host
                        . ':5061\;transport=tls,',
                    'b(satellite-agent-add-headers^s^1)'
                ));
                $ext->add($context, 's', '', new ext_gotoif('$["${DIALSTATUS}"="ANSWER"]', 'end'));
            }
        }

        try {
            $fallback = AgentValidation::validateFallback($row['fallback_destination']);
        } catch (\InvalidArgumentException $error) {
            $fallback = null;
        }
        if ($fallback !== null) {
            list($fallbackContext, $fallbackExten, $fallbackPriority) = explode(',', $fallback);
            // This context is entered at 's': the dialed number is in FROM_DID.
            if ($fallbackExten === '${EXTEN}') {
                $fallbackExten = '${AGENT_ORIGINAL_DID}';
            }
            $ext->add($context, 's', '', new ext_goto($fallbackPriority, $fallbackExten, $fallbackContext));
        }
        $ext->add($context, 's', 'end', new ext_hangup());
    }
}
