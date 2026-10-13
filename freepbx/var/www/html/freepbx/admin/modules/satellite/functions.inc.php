<?php

function satellite_get_config($engine) {
    // Intentionally left as a no-op. Configuration handling is done in satellite_get_config_late().
}

function satellite_get_config_late($engine) {
    if ($engine === 'asterisk') satellite_generate_agent_dialplan();
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
        break;
    }
}

// Native destinations are references to PHP-owned agents, not separate records.
function satellite_agent_destination_key($id) {
    if (!is_string($id) || !preg_match('/^[a-z][a-z0-9_-]{0,47}$/D', $id)) throw new InvalidArgumentException('invalid_identifier');
    return 'voice-agent-' . $id . ',s,1';
}
function satellite_destinations() {
    $result = [];
    foreach (FreePBX::Satellite()->agentDestinations() as $agent) {
        if ($agent['routable']) $result[] = ['destination'=>satellite_agent_destination_key($agent['agent_id']),
            'description'=>'Agent: '.$agent['name'], 'edit_url'=>'/freepbx/agents-ui/#/agents/'.rawurlencode($agent['agent_id'])];
    }
    return $result;
}
function satellite_getdest($id) { return [satellite_agent_destination_key($id)]; }
function satellite_getdestinfo($dest) {
    if (!preg_match('/^voice-agent-([a-z][a-z0-9_-]{0,47}),s,1$/D', (string)$dest, $match)) return false;
    foreach (FreePBX::Satellite()->agentDestinations() as $agent) {
        if ($agent['agent_id']===$match[1]) return ['description'=>'Agent: '.$agent['name'],'edit_url'=>'/freepbx/agents-ui/#/agents/'.rawurlencode($match[1])];
    }
    return [];
}
function satellite_check_destinations($dest = true) {
    $result=[];
    foreach (FreePBX::Satellite()->agentDestinations() as $agent) {
        $target=$agent['published']['fallback_destination_id']??null;
        if (!$target || !preg_match('/^extension:([0-9]{1,20})$/D',$target,$match)) continue;
        $native='from-did-direct,'.$match[1].',1';
        if ($dest===true || in_array($native,(array)$dest,true)) $result[]=['dest'=>$native,'description'=>'Agent: '.$agent['name'].' fallback', 'edit_url'=>'/freepbx/agents-ui/#/agents/'.rawurlencode($agent['agent_id'])];
    }
    return $result;
}
function satellite_generate_agent_dialplan() {
    global $ext;
    $ext->add('voice-agent-headers','s','',new ext_noop('Correlate provider leg'));
    foreach (['X-OS-Session-ID'=>'${AGENT_SESSION_ID}', 'X-OS-Provider-Leg-ID'=>'${AGENT_PROVIDER_LEG_ID}', 'X-OS-Agent-ID'=>'${VOICE_AGENT_ID}'] as $name=>$value) {
        $ext->add('voice-agent-headers','s','',new ext_set('PJSIP_HEADER(add,'.$name.')',$value));
    }
    $ext->add('voice-agent-headers','s','',new ext_return());
    $ext->add('voice-agent-provider','_!','',new ext_dial('PJSIP/${AGENT_PROVIDER_USER}@${AGENT_PROVIDER_TRUNK},20','b(voice-agent-headers^s^1)'));
    $ext->add('voice-agent-provider','_!','',new ext_hangup());
    foreach (FreePBX::Satellite()->agentExtensions() as $target) {
        $number=substr($target['id'],strlen('extension:'));
        $ext->add('voice-agent-transfer',$number,'',new ext_set('TIMEOUT(absolute)','0'));
        $ext->add('voice-agent-transfer',$number,'',new ext_goto('1',$number,'from-did-direct'));
    }
    foreach (FreePBX::Satellite()->agentDestinations() as $agent) {
        // Draft-only agents have no generated destination.
        if (!$agent['published']) continue;
        $context='voice-agent-'.$agent['agent_id'];
        $ext->add($context,'s','',new ext_noop('Voice agent'));
        if ($agent['enabled']) {
            $ext->add($context,'s','',new ext_answer());
            $ext->add($context,'s','',new ext_set('TIMEOUT(absolute)','35'));
            $ext->add($context,'s','',new ext_stasis('voice-agent','caller,'.$agent['agent_id']));
        }
        $ext->add($context,'s','fallback',new ext_set('TIMEOUT(absolute)','0'));
        // Missing/offline runtime or a disabled agent always reaches native fallback.
        $fallback=$agent['published']['fallback_destination_id'];
        if (preg_match('/^extension:([0-9]{1,20})$/D',$fallback,$match) &&
            in_array($fallback,array_column(FreePBX::Satellite()->agentExtensions(),'id'),true)) {
            $ext->add($context,'s','',new ext_goto('1',$match[1],'from-did-direct'));
        } else {
            $ext->add($context,'s','',new ext_hangup());
        }
    }
}
