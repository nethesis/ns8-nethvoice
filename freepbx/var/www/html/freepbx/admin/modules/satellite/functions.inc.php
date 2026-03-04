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
        /* Satellite STT real time Transcriptions*/
        if (!empty($_ENV['SATELLITE_CALL_TRANSCRIPTION_ENABLED']) && $_ENV['SATELLITE_CALL_TRANSCRIPTION_ENABLED'] == 'True') {
            // Add a call Satellite when call is answered in macro-dial-one adding it in D_OPTIONS variable
            $ext->splice('macro-dial-one','s','dial', new \ext_setvar('D_OPTIONS', '${D_OPTIONS}U(satellite^s^1)'),'', -1);
            // Add mixmonitor to record the call
            $ext->splice('macro-dial-one', 's', 'dial', new \ext_mixmonitor('','br(/var/run/nethvoice/satellite-r-${SAT_SAFE_UID}.wav)t(/var/run/nethvoice/satellite-t-${SAT_SAFE_UID}.wav)','/var/lib/asterisk/bin/satellite_transcription -u ${SAT_SAFE_UID} -c0 "${SAT_SAFE_DST}" -c1 "${SAT_SAFE_SRC}"'),'', -1);
            // Sanitize variables to prevent shell injection in mixmonitor command
            $ext->splice('macro-dial-one', 's', 'dial', new \ext_setvar('SAT_SAFE_SRC', '${FILTER(A-Za-z0-9 ._\-\(\),${CDR(cnam)})}'), '', -1);
            $ext->splice('macro-dial-one', 's', 'dial', new \ext_setvar('SAT_SAFE_DST', '${FILTER(A-Za-z0-9 ._\-\(\),${CDR(dst_cnam)})}'), '', -1);
            $ext->splice('macro-dial-one', 's', 'dial', new \ext_setvar('SAT_SAFE_UID', '${FILTER(A-Za-z0-9._-,${UNIQUEID})}'), '', -1);
            // Add call to Satellite macro in macro-dialout-trunk if there is at least one route with at least one trunk
            $routes = core_routing_list();
            if (!empty($routes)) {
                foreach ($routes as $route) {
                    $routetrunks = core_routing_getroutetrunksbyid($route['route_id']);
                    if (!empty($routetrunks)) {
                        $ext->splice('macro-dialout-trunk', 's', '', new \ext_setvar('DIAL_TRUNK_OPTIONS', '${DIAL_TRUNK_OPTIONS}U(satellite^s^1)'),'', 28);
                        // Add mixmonitor to record the call
                        $ext->splice('macro-dialout-trunk', 's', '', new \ext_mixmonitor('','br(/var/run/nethvoice/satellite-r-${SAT_SAFE_UID}.wav)t(/var/run/nethvoice/satellite-t-${SAT_SAFE_UID}.wav)','/var/lib/asterisk/bin/satellite_transcription -u ${SAT_SAFE_UID} -c0 "${SAT_SAFE_DST}" -c1 "${SAT_SAFE_SRC}"'),'', 28);
                        // Sanitize variables to prevent shell injection in mixmonitor command
                        $ext->splice('macro-dialout-trunk', 's', '', new \ext_setvar('SAT_SAFE_SRC', '${FILTER(A-Za-z0-9 ._\-\(\),${CDR(cnam)})}'), '', 28);
                        $ext->splice('macro-dialout-trunk', 's', '', new \ext_setvar('SAT_SAFE_DST', '${FILTER(A-Za-z0-9 ._\-\(\),${CDR(dst_cnam)})}'), '', 28);
                        $ext->splice('macro-dialout-trunk', 's', '', new \ext_setvar('SAT_SAFE_UID', '${FILTER(A-Za-z0-9._-,${UNIQUEID})}'), '', 28);
                        break;
                    }
                }
            }
            // Create the Satellite context
            $ext->add('satellite', 's', '', new \ext_noop('Satellite STT'));
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
