<?php

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

            // Cover calls an extension makes to an external trunk.
            if (function_exists('outbound_routes_list') && count(outbound_routes_list(true)) > 0) {
                foreach (\FreePBX::OutboundRoutes()->listOutboundRoutes() as $route) {
                    if (!isset($route[0]) || $route[0] === '') {
                        continue;
                    }

                    $ext->splice('macro-dialout-trunk', 's', 'checkrecord', new ext_gosub('1', 's', 'sub-satellite-record-check', 'out,${DIAL_NUMBER},yes'), 'satellite-check', 0, $route[0]);
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
            $ext->add($context, $exten, '', new ext_dumpchan());

            $ext->add($context, $exten, '', new ext_gotoif('${ARG3} = "yes"', 'startrec'));
            $ext->add($context, $exten, '', new ext_return(''));
            // check if there is a recording for this call already
            $ext->add($context, $exten, '', new ext_gotoif('HASH(SATELLITE_ACTIVE_RECORDINGS,${UNIQUEID})!=""', 'return'));

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
