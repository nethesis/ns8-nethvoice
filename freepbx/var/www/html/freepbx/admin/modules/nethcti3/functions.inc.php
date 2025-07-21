<?php
#
# Copyright (C) 2017 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

function nethcti3_get_config($engine) {
    global $ext;
    global $amp_conf;
    global $db;
    global $core_conf;
    global $conferences_conf;

    include_once('/var/www/html/freepbx/rest/lib/libCTI.php');
    switch($engine) {
        case "asterisk":
            /*Configure conference*/
            $defaultVal = $amp_conf['ASTCONFAPP'];
            $amp_conf['ASTCONFAPP'] = 'app_confbridge';
            $query='SELECT featurename,IF(customcode IS NULL OR customcode = "",defaultcode,customcode) as defaultcode FROM featurecodes WHERE ( modulename="nethcti3" OR modulename="donotdisturb" ) AND ( featurename="confbridge_conf" OR featurename="incall_audio" OR featurename="dnd_on" OR featurename="dnd_off" OR featurename="dnd_toggle") AND enabled="1"';
            $codes = array();
            foreach ($db->getAll($query) as $feature) {
                $codes[$feature[0]] = $feature[1];
            }
            if (isset($codes['confbridge_conf']) && $codes['confbridge_conf'] != '') {
                $exten='_'.$codes['confbridge_conf'].'X.';
                $exten2=$codes['confbridge_conf'];
                $context='cti-conference';
                $ext->addInclude('from-internal-additional', $context);
                $ext->add($context, $exten, '', new ext_noop('conference'));
                $ext->splice($context, $exten, 'n', new ext_answer());
                $ext->splice($context, $exten, 'n', new ext_playback('beep'));
                $ext->splice($context, $exten, 'n', new ext_confbridge('${EXTEN}','cti_bridge_conf','cti_user_conf'));
                $ext->splice($context, $exten, 'n', new ext_hangup());
                $ext->add($context, $exten2, '', new ext_noop('conference'));
                $ext->splice($context, $exten2, 'n', new ext_answer());
                $ext->splice($context, $exten2, 'n', new ext_playback('beep'));
                $ext->splice($context, $exten2, 'n', new ext_confbridge('${EXTEN}${CALLERID(number)}','cti_admin_bridge_conf','cti_admin_user_conf'));
                $ext->splice($context, $exten2, 'n', new ext_hangup());
                $ext->add($context, 'h', '', new ext_hangup());
                $amp_conf['ASTCONFAPP'] = $defaultVal;
            }
            if (isset($codes['incall_audio']) && $codes['incall_audio'] != '') {
                $exten='_'.$codes['incall_audio'].'.';
                $context='incall-audio-spy';
                $ext->add($context, $exten, '', new ext_noop('Incall Audio Spy'));
                $ext->add($context, $exten, '', new ext_set('CHANNEL(language)','${MASTER_CHANNEL(CHANNEL(language))'));
                $ext->add($context, $exten, '', new ext_answer());
                $ext->add($context, $exten, '', new ext_chanspy('PJSIP/${EXTEN:4},Bqs'));

                $exten2='_X.';
                $context2='incall-audio-play';
                $ext->add($context2, $exten2, '', new ext_noop('Incall Audio Play'));
                $ext->add($context2, $exten2, '', new ext_playback('beep'));
                $ext->add($context2, $exten2, '', new ext_playback('nethcti/incall_audio/file-${EXTEN}'));
                $ext->add($context2, $exten2, '', new ext_hangup());
            }
            /* add user and admin profile to confbridge_additional.conf */
            if (isset($conferences_conf) && is_a($conferences_conf, "conferences_conf")) {
                /* get default language */
                $dbh = \FreePBX::Database();
                $stmt = $dbh->prepare('SELECT value FROM soundlang_settings WHERE keyword = "language"');
                $stmt->execute();
                $res = $stmt->fetch();

                /* set admin bridge */
                $conferences_conf->addConfBridge("cti_admin_bridge_conf", 'record_conference', 'yes');
                $conferences_conf->addConfBridge("cti_admin_bridge_conf", 'language', $res['value']);

                /* set admin bridge */
                $conferences_conf->addConfBridge("cti_bridge_conf", 'language', $res['value']);

                /* set admin user conf*/
                $conferences_conf->addConfUser("cti_admin_user_conf", 'marked', 'yes');
                $conferences_conf->addConfUser("cti_admin_user_conf", 'denoise', 'yes');
                $conferences_conf->addConfUser("cti_admin_user_conf", 'music_on_hold_when_empty', 'yes');
                $conferences_conf->addConfUser("cti_admin_user_conf", 'music_on_hold_class', 'default');

                /* set user conf*/
                $conferences_conf->addConfUser("cti_user_conf", 'marked', 'no');
                $conferences_conf->addConfUser("cti_user_conf", 'music_on_hold_when_empty', 'yes');
                $conferences_conf->addConfUser("cti_user_conf", 'music_on_hold_class', 'default');
                $conferences_conf->addConfUser("cti_user_conf", 'wait_marked', 'yes');
                $conferences_conf->addConfUser("cti_user_conf", 'end_marked', 'no');
                $conferences_conf->addConfUser("cti_user_conf", 'denoise', 'yes');
            }

            /*Intra company routes context*/
            $context='from-intracompany';
            $ext->add($context, '_X.', '', new ext_noop('intracompany'));
            $ext->add($context, '_X.', '', new ext_set('AMPUSERCIDNAME','${CALLERID(name)}'));
            $ext->add($context, '_X.', '', new ext_goto('1','${EXTEN}','from-internal'));
            /* Add Waiting Queues for Operator Panel*/
            $context = 'ctiopqueue';
            $profiles = getCTIPermissionProfiles(false,false,false);
            if (!empty($profiles)){
                foreach($profiles as $profile){
                    if (isset($profile['macro_permissions']['operator_panel']) && $profile['macro_permissions']['operator_panel']['value'] == true) {
                        $exten = "ctiopqueue".$profile['id'];
                        // Queue(queuename[,options[,URL[,announceoverride[,timeout[,AGI[,macro[,gosub[,rule[,position]]]]]]]]])
                        $ext->add($context, $exten,'',new ext_queue($exten, 't', '', '', '9999', '', '', '', '',''));
                    }
                }
            }
            /* Add generic reload SIP NOTIFY */
            if (isset($core_conf) && (method_exists($core_conf, 'addSipNotify'))) {
                $core_conf->addSipNotify('generic-reload', array('Event' => 'check-sync\;reboot=false', 'Content-Length' => '0'));
            }
        /*Add contexts for gateway trunks identity*/
            $context = 'from-pstn-identity';
            $ext->add($context, '_X!', '', new ext_noop('P-Preferred-Identity ${CUT(CUT(PJSIP_HEADER(read,P-Preferred-Identity),@,1),:,2)}'));
            $ext->add($context, '_X!', '', new ext_noop('P-Asserted-Identity ${CUT(CUT(PJSIP_HEADER(read,P-Asserted-Identity),@,1),:,2)}'));
            $ext->add($context, '_X!', '', new ext_gotoif('$[$[ "${CUT(CUT(PJSIP_HEADER(read,P-Asserted-Identity),@,1),:,2)}" != ""]]','from-pstn-asserted,${EXTEN},1'));
            $ext->add($context, '_X!', '', new ext_gotoif('$[$[ "${CUT(CUT(PJSIP_HEADER(read,P-Preferred-Identity),@,1),:,2)}" != ""]]','from-pstn-preferred,${EXTEN},1'));
            $ext->add($context, '_X!', '', new ext_goto('from-pstn,${EXTEN},1'));
            $context = 'from-pstn-preferred';
            $ext->add($context, '_X!', '', new ext_set('CALLERID(num)','${CUT(CUT(PJSIP_HEADER(read,P-Preferred-Identity),@,1),:,2)}'));
            $ext->add($context, '_X!', '', new ext_goto('from-pstn,${EXTEN},1'));
            $context = 'from-pstn-asserted';
            $ext->add($context, '_X!', '', new ext_set('CALLERID(num)','${CUT(CUT(PJSIP_HEADER(read,P-Asserted-Identity),@,1),:,2)}'));
            $ext->add($context, '_X!', '', new ext_goto('from-pstn,${EXTEN},1'));
        break;
    }
}

function nethcti3_get_config_late($engine) {
    global $ext;
    global $amp_conf;
    global $db;
    switch($engine) {
        case "asterisk":
            /* Change CF for CTI voicemail status */
            $ext->replace('macro-dial-one', 'cf', '2', new ext_execif('$["${DB(AMPUSER/${DB_RESULT}/cidnum)}" == "" && "${DB_RESULT:0:2}" != "vm"]', 'Set','__REALCALLERIDNUM=${DEXTEN}'));

            /* Use main extension on login/logout/pause*/
            if (!empty(\FreePBX::Queues()->listQueues())) {
                $ext->splice('app-queue-toggle', 's', 'start', new ext_setvar('QUEUEUSER', '${IF($[${LEN(${DB(AMPUSER/${AMPUSER}/accountcode)})}>0]?${DB(AMPUSER/${AMPUSER}/accountcode)}:${QUEUEUSER})}'),'mainext',4);

                $ext->replace('app-all-queue-toggle', 's', '4', new ext_agi('queue_devstate.agi,getall,${QUEUEUSER}'));
                $ext->replace('app-all-queue-toggle', 's', '17', new ext_execif('$["${QUEUESTAT}"="LOGGEDOUT"]', 'SayDigits', '${QUEUEUSER}'));
                $ext->splice('app-all-queue-toggle', 's', 'start', new ext_setvar('QUEUEUSER', '${IF($[${LEN(${DB(AMPUSER/${AMPUSER}/accountcode)})}>0]?${DB(AMPUSER/${AMPUSER}/accountcode)}:${AMPUSER})}'),'mainext',3);

                $ext->splice('macro-toggle-del-agent', 's', '1', new ext_noop('Main Extension'),'mainext',1);
                $ext->splice('macro-toggle-del-agent', 's', 'mainext', new ext_setvar('QUEUEUSER', '${IF($[${LEN(${DB(AMPUSER/${AMPUSER}/accountcode)})}>0]?${DB(AMPUSER/${AMPUSER}/accountcode)}:${QUEUEUSER})}'),'mainext2',2);

                $ext->splice('macro-toggle-add-agent', 's', 'invalid', new ext_setvar('QUEUEUSER', '${IF($[${LEN(${DB(AMPUSER/${AMPUSER}/accountcode)})}>0]?${DB(AMPUSER/${AMPUSER}/accountcode)}:${QUEUEUSER})}'),'mainext',-7);

                $ext->splice('app-queue-pause-toggle', 's', 'start', new ext_setvar('QUEUEUSER', '${IF($[${LEN(${DB(AMPUSER/${AMPUSER}/accountcode)})}>0]?${DB(AMPUSER/${AMPUSER}/accountcode)}:${QUEUEUSER})}'),'mainext',4);

                $ext->replace('app-all-queue-pause-toggle', 's', '4', new ext_agi('queue_devstate.agi,toggle-pause-all,${QUEUEUSER}'));
                $ext->splice('app-all-queue-pause-toggle', 's', 'start', new ext_setvar('QUEUEUSER', '${IF($[${LEN(${DB(AMPUSER/${AMPUSER}/accountcode)})}>0]?${DB(AMPUSER/${AMPUSER}/accountcode)}:${AMPUSER})}'),'mainext',3);
            }
            if (!isset($amp_conf['ATX_CID_OVERRIDE']) || $amp_conf['ATX_CID_OVERRIDE'] == 1) {
                $ext->splice('macro-dial-one','s','dial', new ext_execif('$["${DB(AMPUSER/${ARG3}/cidname)}" != "" && "${DB(AMPUSER/${CALLERID(num)}/cidname)}" = "" && "${ATTENDEDTRANSFER}" != "" && "${DB(AMPUSER/${FROMEXTEN}/cidname)}" != ""]', 'Set', 'CALLERID(num)=${DB(AMPUSER/${FROMEXTEN}/cidnum)}'),'',-1);
                $ext->splice('macro-dial-one','s','dial', new ext_execif('$["${DB(AMPUSER/${CALLERID(num)}/cidname)}" != "" && "${ATTENDEDTRANSFER}" != ""]', 'Set', 'CALLERID(name)=${DB(AMPUSER/${CALLERID(num)}/cidname)}'),'',-1);
            }
            $nethcti3 = \FreePBX::Nethcti3();
            $trunks = FreePBX::Core()->listTrunks();
            foreach ($trunks as $trunk) {
                try {
                    /*Add isTrunk = 1 header to VoIP trunks that doesn't require SRTP encryption*/
                    $disable_srtp_header = $nethcti3->getConfig('disable_srtp_header', $trunk['trunkid']);
                    if ($disable_srtp_header==1) {
                        $ext->splice('macro-dialout-trunk', 's', 'gocall', new ext_gosubif('$["${DIAL_TRUNK}" = "' . $trunk['trunkid'] . '"]', 'func-set-sipheader,s,1', false, 'isTrunk,1'),'',6);
                        $add_unset_istrunk = true;
                    }
                    /*Add topos=0 header to voip trunks with disabled TOPOS for compatibility*/
                    $disable_topos_header = $nethcti3->getConfig('disable_topos_header', $trunk['trunkid']);
                    if ($disable_topos_header==1) {
                        $ext->splice('macro-dialout-trunk', 's', 'gocall', new ext_gosubif('$["${DIAL_TRUNK}" = "' . $trunk['trunkid'] . '"]', 'func-set-sipheader,s,1', false, 'topos,0'),'',6);
                        $add_unset_topos = true;
                    }
                } catch (Exception $e) {
                    error_log('Error adding additional headers to trunk: '.$e->getMessage());
                }
            }
            /* unset topos and isTrunk headers for calls to local extensions */
            if ($add_unset_istrunk) {
                $ext->splice('macro-dial-one', 's', 'setexttocall', new ext_gosub(1,'s','func-set-sipheader', 'isTrunk,unset'), '', 1);
            }
            if ($add_unset_topos) {
                $ext->splice('macro-dial-one', 's', 'setexttocall', new ext_gosub(1,'s','func-set-sipheader', 'topos,unset'), '', 1);
            }
        /* Add isTrunk for non encrypted extensions */
        // extensions with encryption disabled on wizard
        $sql = "SELECT extension FROM rest_devices_phones WHERE srtp = 0 AND type = 'physical'";
        $stmt = $db->prepare($sql);
        $stmt->execute();
        $res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        $no_srtp_extensions = array_column($res, 'extension');
        // add FROMMACRODIALONE variable before the Dial() in macro-dial-one
        $ext->splice('macro-dial-one', 's', 'dial', new ext_setvar('__FROMMACRODIALONE','1'), '',0);
        if (!empty($no_srtp_extensions)) {
            // add isTrunk header to calls to extensions with encryption disabled
            $ext->splice('func-apply-sipheaders', 's', '', new ext_gosubif('$["${FROMMACRODIALONE}" = "1" & x${REGEX("^(' . implode('|', $no_srtp_extensions) . ')$" ${CALLERID(num)})}x = x1x]', 'func-set-sipheader,s,1', false, 'isTrunk,1'), '',2);
            $ext->splice('func-apply-sipheaders', 's', '', new ext_gosubif('$["${FROMMACRODIALONE}" = "1" & x${REGEX("^(' . implode('|', $no_srtp_extensions) . ')$" ${CALLERID(num)})}x = x0x]', 'func-set-sipheader,s,1', false, 'isTrunk,unset'), '',3);
        }

        /* Add inboundlookup agi for each inbound routes*/
        $dids = FreePBX::Core()->getAllDIDs();
        if (!empty($dids)) {
            $ext->splice('macro-user-callerid', 's','cnum', new ext_gotoif('$["${CDR(cnam)}" != ""]', 'cnum'),"",-2);
            foreach($dids as $did) {
                $exten = trim($did['extension']);
                $cidnum = trim($did['cidnum']);
                if ($cidnum != '' && $exten == '') {
                    $exten = 's';
                    $pricid = ($did['pricid']) ? true:false;
                } else if (($cidnum != '' && $exten != '') || ($cidnum == '' && $exten == '')) {
                    $pricid = true;
                } else {
                    $pricid = false;
                }
                $context = ($pricid) ? "ext-did-0001":"ext-did-0002";
                if (function_exists('empty_freepbx')) {
                    $exten = (empty_freepbx($exten)?"s":$exten);
                } else {
                    $exten = (empty($exten)?"s":$exten);
                }
                $exten = $exten.(empty($cidnum)?"":"/".$cidnum); //if a CID num is defined, add it
                $ext->splice($context, $exten, 'did-cid-hook', new ext_agi('/var/lib/asterisk/agi-bin/lookup.php,in,${CALLERID(number)}'),"inbound-lookup",1);
                $ext->splice($context, $exten, 'inbound-lookup', new ext_setvar('__REAL_CNAM','${CDR(cnam)}'),"",1);
                $ext->splice($context, $exten, 'inbound-lookup', new ext_setvar('__REAL_CCOMPANY','${CDR(ccompany)}'),"",1);
            }
        }
        /* Add outboundlookup to outbound routes*/
        $routes = core_routing_list();
        if (!empty($routes)) {
            foreach (core_routing_list() as $route) {
                $routetrunks = core_routing_getroutetrunksbyid($route['route_id']);
                if (!empty($routetrunks)) {
                    $ext->splice('macro-dialout-trunk', 's','customtrunk', new ext_agi('/var/lib/asterisk/agi-bin/lookup.php,out,${DIAL_NUMBER},${DB(AMPUSER/${AMPUSER}/cidname)}'),"",-4);
                    break;
                }
            }
        }
        /*Add name resolution between extensions*/
        $userlist = core_users_list();
        if (is_array($userlist)) {
            foreach($userlist as $item) {
                $exten = \FreePBX::Core()->getUser($item[0]);
                $ext->splice('ext-local', $exten['extension'], '', new ext_set('CDR(cnam)','${IF($["${CDR(cnam)}" = ""]?${DB(AMPUSER/${AMPUSER}/cidname)}:${CDR(cnam)})}'));
                $ext->splice('ext-local', $exten['extension'], '', new ext_set('AMPUSER','${IF($["${AMPUSER}" = ""]?${CALLERID(number)}:${AMPUSER})}'));
                $ext->splice('ext-local', $exten['extension'], '', new ext_set('CDR(dst_cnam)','${DB(AMPUSER/'.$exten['extension'].'/cidname)}'));
            }
        }
        /* ADD lookup for queue agent calls */
        if (function_exists('queues_list') and count(queues_list(true)) > 0 ) {
            $sql = "SELECT LENGTH(extension) as len FROM users GROUP BY len";
            $sth = FreePBX::Database()->prepare($sql);
            $sth->execute();
            $rows = $sth->fetchAll(\PDO::FETCH_ASSOC);
            foreach($rows as $row) {
                $ext->splice("from-queue-exten-only", '_'.str_repeat('X',$row['len']), 'checkrecord', new ext_set('CDR(cnum)','${CALLERID(num)}'),"cnum");
                $ext->splice("from-queue-exten-only", '_'.str_repeat('X',$row['len']), 'checkrecord', new ext_set('CDR(cnam)','${REAL_CNAM}'),"cnam");
                $ext->splice("from-queue-exten-only", '_'.str_repeat('X',$row['len']), 'checkrecord', new ext_set('CDR(ccompany)','${REAL_CCOMPANY}'),"ccompany");
            }
        }
        /*Off-Hour*/
        $routes = FreePBX::Core()->getAllDIDs();
        foreach ($routes as $did) {
            /*add off-hour agi for each inbound routes*/
            if($did['extension'] && $did['cidnum'])
                $exten = $did['extension']."/".$did['cidnum'];
            else if (!$did['extension'] && $did['cidnum'])
                $exten = "s/".$did['cidnum'];
            else if ($did['extension'] && !$did['cidnum'])
                $exten = $did['extension'];
            else if (!$did['extension'] && !$did['cidnum'])
                $exten = "s";

            if (($did['cidnum'] != '' && $did['extension'] != '') || ($did['cidnum'] == '' && $did['extension'] == '')) {
                $pricid = true;
            } else {
                $pricid = false;
            }
            $context = ($pricid) ? "ext-did-0001":"ext-did-0002";
            $ext->splice($context, $exten, "did-cid-hook", new ext_userevent('CallIn', 'value: ${FROM_DID}'),'cti-event',2);
            $ext->splice($context, $exten, "did-cid-hook", new ext_agi('offhour.php,'.$did['cidnum'].','.$did['extension']),'offhour',3);
            /*Execute custom agi when call arrives*/
            if (!empty($_ENV['NETHCTI_CDR_SCRIPT_CALL_IN'])) {
                # inser agi before exten => s,n(hangup),Hangup
                $agi_cmd = [
                    $_ENV['NETHCTI_CDR_SCRIPT_CALL_IN'],
                    '${CDR(src)}', # source
                    '${CDR(channel)}', # channel
                    '', # endtime
                    '', # duration
                    '${CDR(amaflags)}', # amaflags
                    '${CDR(uniqueid)}', # uniqueid
                    '${CDR(cnum)}', # callerid
                    '${CDR(uniqueid)}', # starttime
                    '', # answertime
                    '', # destination
                    '', # disposition
                    '${CDR(lastapp)}', # lastapplication
                    '', # billableseconds
                    '${CDR(dcontext)}', # destinationcontext
                    '${CDR(dstchannel)}', # destinationchannel
                    '${CDR(accountcode)}', # accountcode
                    '${CDR(cnam)}', # caller name
                    '${CDR(dst_cnum)}', # called number
                    '${CDR(dst_cnam)}', # called name
                ];
                $ext->splice($context, $exten, "did-cid-hook", new ext_agi(join(',',$agi_cmd)),'nethcti-cdr-script-call-in',3);
            }
        }
        /*Execute custom agi on call hangup*/
        if (!empty($_ENV['NETHCTI_CDR_SCRIPT'])) {
            # inser agi before exten => s,n(hangup),Hangup
            $agi_cmd = [
                $_ENV['NETHCTI_CDR_SCRIPT'],
                '${CDR(src)}', # source
                '${CDR(channel)}', # channel
                '${EPOCH}', # endtime
                '${CDR(duration)}', # duration
                '${CDR(amaflags)}', # amaflags
                '${CDR(uniqueid)}', # uniqueid
                '${CDR(cnum)}', # callerid
                '${CDR(uniqueid)}', # starttime
                '$[${EPOCH} - ${CDR(billsec)}]', # answertime
                '${CDR(dst)}', # destination
                '${CDR(disposition)}', # disposition
                '${CDR(lastapp)}', # lastapplication
                '${CDR(billsec)}', # billableseconds
                '${CDR(dcontext)}', # destinationcontext
                '${CDR(dstchannel)}', # destinationchannel
                '${CDR(accountcode)}', # accountcode
                '${CDR(cnam)}', # caller name
                '${CDR(dst_cnum)}', # called number
                '${CDR(dst_cnam)}', # called name
            ];
            $ext->splice('macro-hangupcall', 's', 'hangup', new ext_agi(join(',',$agi_cmd)),'nethcti-cdr-script');
        }
        /* Change SIP response for unregistered extensions #7321*/
        $ext->replace('macro-exten-vm', '_s-!', '4', new extension('HangUp(20)'));
        /* Add Answer() and Ringing() to macro-dial-one on call forwarding #7321*/
        $ext->splice('macro-dial-one', 'cf', '', new ext_answer(), '', 7);
        $ext->splice('macro-dial-one', 'cf', '', new ext_ringing(), '', 8);
        break;
    }

    // Write cti configuration file
    include_once('/var/www/html/freepbx/rest/lib/libCTI.php');
    $nethcti3 = \FreePBX::Nethcti3();

    /*
    *    Write user configuration json
    */
    try {
        $json = array();
        $users = \FreePBX::create()->Userman->getAllUsers();
        $dbh = \FreePBX::Database();
        $freepbxVoicemails = \FreePBX::Voicemail()->getVoicemail();
        $enabledVoicemails = ($freepbxVoicemails['default'] != null) ? array_keys($freepbxVoicemails['default']) : array();
        $domainName = end(explode('.', gethostname(), 2));
        $enableJanus = false;

        foreach ($users as $user) {
            try {
                if ($user['default_extension'] !== 'none') {

                    // Retrieve profile id and mobile
                    $stmt = $dbh->prepare('SELECT profile_id,mobile FROM rest_users WHERE user_id = ?');
                    $stmt->execute(array($user['id']));
                    $profileRes = $stmt->fetch();

                    // Skip user if he doesn't have a profile associated
                    if ($profileRes['profile_id'] == null) {
                        continue;
                    }

                    $endpoints = array(
                        'mainextension' => (array($user['default_extension'] => (object)array()))
                    );

                    // Retrieve physical extensions
                    $stmt = $dbh->prepare('SELECT extension, type, web_user, web_password, mac FROM rest_devices_phones WHERE user_id = ?');
                    $stmt->execute(array($user['id']));
                    $res = $stmt->fetchAll();

                    $extensions = array();
                    if (count($res) > 0) {
                        foreach ($res as $e) {
                            if ($e['type'] === 'temporaryphysical') {
                                $e['type'] = 'physical';
                            }
                            $settings = array(
                                'type' => $e['type']
                            );

                            if ($e['type'] === 'physical') {
                                if (!is_null($e['web_user']) && !is_null($e['web_password'])) {
                                    $settings['web_user'] = $e['web_user'];
                                    $settings['web_password'] = $e['web_password'];
                                } else {
                                    $settings['web_user'] = 'admin';
                                    $settings['web_password'] = 'admin';
                                }
                                $settings['mac'] = $e['mac'];
                            } else if ($e['type'] === 'webrtc' || $e['type'] === 'mobile' || $e['type'] === 'nethlink') {
                                // Retrieve webrtc sip credentials
                                $stmt = $dbh->prepare('SELECT data FROM sip WHERE keyword IN ("account", "secret") AND id = ?');
                                $stmt->execute(array($e['extension']));
                                $sipres = $stmt->fetchAll();

                                if ($sipres[0]['data'] && $sipres[1]['data']) {
                                    $settings['user'] = $sipres[0]['data'];
                                    $settings['password'] = $sipres[1]['data'];
                                } else {
                                    continue;
                                }
                                $enableJanus = true;
                            }

                            $extensions[$e['extension']] = (object)$settings;
                        }

                    }
                    $endpoints['extension'] = (object)$extensions;

                    // Set voicemail
                    if (in_array($user['default_extension'], $enabledVoicemails)) {
                        $endpoints['voicemail'] = array($user['default_extension'] => (object)array());
                    }

                    // Set email
                    $endpoints['email'] = ($user['email'] ? array($user['email'] => (object) array()) : (object)array());
                    $endpoints['jabber'] = array($user['username']."@".$domainName => (object)array());

                    // Set cellphone
                    $endpoints['cellphone'] = ($profileRes['mobile'] ? array($profileRes['mobile'] => (object) array()) : (object)array());

                    // Join configuration
                    $userJson = array(
                        'name' => $user['displayname'],
                        'endpoints' => $endpoints,
                        'profile_id' => $profileRes['profile_id']
                    );

                    $json[preg_replace('/@[\.a-zA-Z0-9]*/','',$user['username'])] = $userJson;
                    // error_log(print_r($user, true));
                }
            } catch (Exception $e) {
                error_log($e->getMessage());
            }
        }

        // Write users.json configuration file
        $res = $nethcti3->writeCTIConfigurationFile('/users.json',$json);

        if ($res === FALSE) {
            error_log('fail to write users config');
        }

        // Write operator.json configuration file
        $results = getCTIGroups();
        if (!$results) {
            error_log('Empty operator config');
        }
        foreach ($results as $r) {
            $out[$r['name']][] = $r['username'];
        }
        $final['groups'] = $out;
        // Write operator.json configuration file
        $res = $nethcti3->writeCTIConfigurationFile('/operator.json',$final);
        if ($res === FALSE) {
            error_log('fail to write operator config');
        }

        /*
        *    Write permissions json
        */
        $out = [];
        $results = getCTIPermissionProfiles(false,true,false);
        if (!$results) {
            error_log('Empty profile config');
        }
        foreach ($results as $r) {
            // Add oppanel waiting queue
            if ($r['macro_permissions']['operator_panel']['value']) {
                $r['macro_permissions']['operator_panel']['permissions'][] = array('name' => 'waiting_queue_'.$r['id'], 'value' => true);
            }

            $out[$r['id']] = $r;
        }

        // Write profiles.json configuration file
        $res = $nethcti3->writeCTIConfigurationFile('/profiles.json',$out);
        if ($res === FALSE) {
            error_log('fail to write profiles config');
        }

        /*
        *    Write cti configuration in ast_objects.json: trunks, queues
        */
        $obj = new \stdClass();
        $obj->trunks = $nethcti3->getTrunksConfiguration();
        $obj->queues = $nethcti3->getQueuesConfiguration();
        $obj->feature_codes = $nethcti3->getFeaturecodesConfiguration();
        $obj->transfer_context = $nethcti3->getTransferContext();
        $res = $nethcti3->writeCTIConfigurationFile('/ast_objects.json',$obj);
        if ($res === FALSE) {
            error_log('fail to write trunks config');
        }

        // write streaming.json
        $out = [];
        $dbh = FreePBX::Database();
        $sql = 'SELECT * FROM rest_cti_streaming';
        $sth = $dbh->prepare($sql);
        $sth->execute();
        $results = $sth->fetchAll(PDO::FETCH_ASSOC);

        if (!$results) {
            error_log('Empty profile config');
        }
        foreach ($results as $r) {
            $pername = 'vs_'. strtolower(str_replace(' ', '_', preg_replace('/[^a-zA-Z0-9\s]/','',$r['descr'])));
            $out[$pername] = $r;
        }
        // Write streaming.json configuration file
        $res = $nethcti3->writeCTIConfigurationFile('/streaming.json',(object) $out);
        if ($res === FALSE) {
            error_log('fail to write streaming config');
        }

        // Write recallonbusy.json configuration file
        $out = [];
        global $astman;
        try {
            $defaultROB = \FreePBX::Recallonbusy()->getConfig('default');
        } catch (Exception $e) {
            $defaultROB = 'disabled';
        }

        foreach ($users as $user) {
            if ($user['default_extension'] !== 'none') {
                $enabled = $astman->database_get("ROBconfig",$user['default_extension']);
                $enabled = !empty($enabled) ? $enabled : $defaultROB;
                $out[$user['username']]['recallonbusy'] = $enabled;
            }
        }

        $res = $nethcti3->writeCTIConfigurationFile('/recallonbusy.json',(object) $out);
        if ($res === FALSE) {
            error_log('fail to write recallonbusy config');
        }

        // Generate nethvoice report based on NethCTI configuration
        nethvoice_report_config();

    // Convert /etc/asterisk symlinks to file copied
    if (file_exists('/var/lib/asterisk/bin/symlink2copies.sh')) {
            system("/var/lib/asterisk/bin/symlink2copies.sh");
    }

        //Reload CTI
        system("/var/www/html/freepbx/rest/lib/ctiReloadHelper.sh > /dev/null 2>&1 &");
    } catch (Exception $e) {
        error_log($e->getMessage());
    }
}

function nethcti3_get_config_early($engine) {
    include_once('/var/www/html/freepbx/rest/lib/libCTI.php');
    global $amp_conf;
    // Call Tancredi API to set variables that needs to be set on FreePBX retrieve conf
    // get featurecodes
    $dbh = FreePBX::Database();
    $sql = 'SELECT modulename,featurename,defaultcode,customcode FROM featurecodes';
    $stmt = $dbh->prepare($sql);
    $stmt->execute(array());
    $res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    $featurecodes = array();
    foreach ($res as $featurecode) {
        $featurecodes[$featurecode['modulename'].$featurecode['featurename']] = (!empty($featurecode['customcode'])?$featurecode['customcode']:$featurecode['defaultcode']);
    }

    /***********
    * Defaults *
    ************/
    $variables = array();

    //featurcodes
    $variables['cftimeouton'] = $featurecodes['callforwardcfuon'];
    $variables['cftimeoutoff'] = $featurecodes['callforwardcfuoff'];
    $variables['cfbusyoff'] = $featurecodes['callforwardcfboff'];
    $variables['cfbusyon'] = $featurecodes['callforwardcfbon'];
    $variables['cfalwaysoff'] = $featurecodes['callforwardcfoff'];
    $variables['cfalwayson'] = $featurecodes['callforwardcfon'];
    $variables['dndoff'] = $featurecodes['donotdisturbdnd_off'];
    $variables['dndon'] = $featurecodes['donotdisturbdnd_on'];
    $variables['dndtoggle'] = $featurecodes['donotdisturbdnd_toggle'];
    $variables['call_waiting_off'] = $featurecodes['callwaitingcwoff'];
    $variables['call_waiting_on'] = $featurecodes['callwaitingcwon'];
    $variables['pickup_direct'] = $featurecodes['corepickup'];
    $variables['pickup_group'] = $featurecodes['corepickupexten'];
    $variables['queuetoggle'] = $featurecodes['queuesque_toggle'];

    // FreePBX settings
    $variables['cftimeout'] = $amp_conf['CFRINGTIMERDEFAULT'];

    /*********************
    * Extension specific *
    *********************/
    $sql = 'SELECT userman_users.username as username,
                userman_users.default_extension as mainextension,
                rest_devices_phones.mac,
                rest_devices_phones.extension,
                rest_devices_phones.secret,
                rest_devices_phones.web_password,
                rest_users.profile_id
            FROM
                rest_devices_phones JOIN userman_users ON rest_devices_phones.user_id = userman_users.id
                LEFT JOIN rest_users ON rest_devices_phones.user_id = rest_users.user_id
            WHERE rest_devices_phones.type = "physical"';
    $stmt = $dbh->prepare($sql);
    $stmt->execute(array());
    $extdata = $stmt->fetchAll(\PDO::FETCH_ASSOC);

    // Get CTI profile permissions
    $permissions = getCTIPermissionProfiles(false,true,true);

    $tancrediUrl = 'http://127.0.0.1:'.getenv('TANCREDIPORT').'/tancredi/api/v1/';

    // Get Tancredi authentication variables
    include_once '/var/www/html/freepbx/rest/config.inc.php';
    $user = 'admin';
    $secret = $config['settings']['secretkey'];

    $stmt = $dbh->prepare("SELECT * FROM ampusers WHERE sections LIKE '%*%' AND username = ?");
    $stmt->execute(array($user));
    $user = $stmt->fetchAll();
    $password_sha1 = $user[0]['password_sha1'];
    $username = $user[0]['username'];
    $secretkey = sha1($username . $password_sha1 . $secret);

    // loop for each physical device
    foreach ($extdata as $ext) {
        $extension = $ext['extension'];
        $mainextension = $ext['mainextension'];

        // Get extension sip parameters
        $sql = 'SELECT keyword,data FROM sip WHERE id = ?';
        $stmt = $dbh->prepare($sql);
        $stmt->execute(array($extension));
        $res = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        $sip = array();
        foreach ($res as $value) {
            $sip[$value['keyword']] = $value['data'];
        }

        $user_variables = array();
        $user_variables['account_extension_1'] = $extension;

        // Set dnd and fwd permission from CTI permissions if they exists
        $user_variables['account_dnd_allow_1'] = '1';
        $user_variables['account_fwd_allow_1'] = '1';
        if (array_key_exists('profile_id',$ext)
            && is_array($permission)
            && array_key_exists($ext['profile_id'],$permission)
            && array_key_exists('macro_permissions',$permissions[$ext['profile_id']])
            && array_key_exists('settings',$permissions[$ext['profile_id']]['macro_permissions'])
            && array_key_exists('permissions',$$permissions[$ext['profile_id']]['macro_permissions']['settings']))
        {
            foreach ($permissions[$ext['profile_id']]['macro_permissions']['settings']['permissions'] as $permission) {
                if ($permission['name'] == 'dnd') {
                    $user_variables['account_dnd_allow_1'] = $permission['value'] ? '1' : '';
                } elseif ($permission['name'] == 'call_forward') {
                    $user_variables['account_fwd_allow_1'] = $permission['value'] ? '1' : '';
                }
            }
        }
        // srtp
        $sql = 'SELECT srtp FROM rest_devices_phones WHERE extension = ?';
        $stmt = $dbh->prepare($sql);
        $stmt->execute(array($extension));
        $res = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (!empty($res) && !empty($res['srtp']) && $res['srtp'] == 1) {
            $user_variables['account_encryption_1'] = '1';
        } else {
            $user_variables['account_encryption_1'] = '';
        }

        if (array_key_exists('callerid', $sip)) {
            $user_variables['account_display_name_1'] = preg_replace('/<[0-9]*>$/', "<$mainextension>", $sip['callerid']);
        } else {
            $user_variables['account_display_name_1'] = "<$mainextension>";
        }

        $user_variables['account_username_1'] = $extension;
        $user_variables['account_password_1'] = $sip['secret'];
        $user_variables['account_dtmf_type_1'] = 'rfc4733';
        if (array_key_exists('dtmfmode',$sip)) {
            if ($sip['dtmfmode'] == 'inband') $user_variables['account_dtmf_type_1'] = 'inband';
            elseif ($sip['dtmfmode'] == 'rfc2833') $user_variables['account_dtmf_type_1'] = 'rfc4733';
            elseif ($sip['dtmfmode'] == 'info') $user_variables['account_dtmf_type_1'] = 'sip_info';
            elseif ($sip['dtmfmode'] == 'rfc4733') $user_variables['account_dtmf_type_1'] = 'rfc4733';
        }
        $user_variables['account_voicemail_1'] = $featurecodes['voicemailmyvoicemail'];
        $res = nethcti_tancredi_patch($tancrediUrl . 'phones/' . str_replace(':','-',$ext['mac']), $username, $secretkey, array("variables" => $user_variables));
    }
    /***********************************
    * call Tancredi /defaults REST API *
    ************************************/
    $res = nethcti_tancredi_patch($tancrediUrl . 'defaults', $username, $secretkey, $variables);
}

function nethcti_tancredi_patch($url, $username, $secretkey, $data) {
    $data = json_encode($data);
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE);
    curl_setopt($ch, CURLOPT_HEADER, FALSE);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        "Content-Type: application/json;charset=utf-8",
        "Accept: application/json;charset=utf-8",
        "Content-length: ".strlen($data),
        "User: $username",
        "SecretKey: $secretkey",
    ));
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return array('code'=>$httpCode, 'response' => $response);
}

function nethvoice_report_config() {
    include_once('/var/www/html/freepbx/rest/lib/libCTI.php');

    # skip execution if nethvoice-report is not installed
    if (!is_dir("/opt/nethvoice-report/api/")) {
        return;
    }

    $fbx_users = \FreePBX::create()->Userman->getAllUsers();
    $dbh = \FreePBX::Database();
    $users = array();
    $queues = array();
    $groups = getCTIGroups();
    $profiles = getCTIPermissionProfiles();

    // Add special X and admin users for API access
    $config = array(
        array("username" => "X", "queues" => array(), "groups" => array(), "agents" => array(), "users" => array()),
        array("username" => "admin", "queues" => array(), "groups" => array(), "agents" => array(), "users" => array())
    );

    // Prepare queue details
    foreach (\FreePBX::Queues()->listQueues() as $q) {
        $queues[$q[0]] = array();
        $queue_details = queues_get($q[0]);
        foreach (explode(PHP_EOL,$queue_details['dynmembers']) as $m) {
            // $m format is 201,0
            $tmp = explode(",",$m);
            if ($tmp[0]) {
                $queues[$q[0]][] = $tmp[0];
            }
        }
        foreach($queue_details['member'] as $m) {
            // $m format Local/200@from-queue/n,0
            $tmp = explode("@",$m);
            $tmp = explode("/",$tmp[0]);
            if ($tmp[1]) {
                $queues[$q[0]][] = $tmp[1];
            }
        }
        $queues[$q[0]] = array_unique($queues[$q[0]]);
    }

    // Get users list and create the extension-user map
    $user_list = array();
    $ext2user = array();
    foreach (\FreePBX::create()->Userman->getAllUsers() as $user) {
        if ($user['default_extension'] !== 'none') {
            $user_list[$user['id']] = $user['username'];
            $ext2user[$user["default_extension"]] = $user["displayname"];
            foreach ($groups as $key => $group) {
                if ($user['username'] == $group["username"]) {
                    $groups[$key]["id"] = $user['id'];
                }
            }
        }
    }

    // Retrieve all extensions
    $stmt = $dbh->prepare('SELECT user_id, extension FROM rest_devices_phones WHERE extension != "NULL" AND extension != ""');
    $stmt->execute();
    $res_devices = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    $all_extensions = array_column($res_devices, 'extension');

    // Create permissions for every user
    foreach ($user_list as $user_id => $username) {
        $user = array(
            "username" => $username,
            "queues" => array(),
            "groups" => array(),
            "agents" => array(),
            "users" => array(),
            "cdr" => ""
        );
        // Get user permission profile
        $stmt = $dbh->prepare('SELECT profile_id FROM rest_users WHERE user_id = ?');
        $stmt->execute(array($user_id));
        $profileRes = $stmt->fetch();
        // Skip user if he doesn't have a profile associated
        if ($profileRes['profile_id'] == null) {
            continue;
        }
        foreach ($profiles as $p) {
            if ($p['id'] === $profileRes['profile_id']) {
                $profile = $p;
                break;
            }
        }

        // Get queuemanager queues from permission profile
        if ( isset($profile['macro_permissions']['qmanager'])
            && $profile['macro_permissions']['qmanager']['value'] == 1
            && !empty($profile['macro_permissions']['qmanager']['permissions']))
        {
            foreach ($profile['macro_permissions']['qmanager']['permissions'] as $perm) {
                if ($perm["value"] != True) {
                    continue;
                }
                $queue_name = substr($perm["name"],9);
                // Add queue to user queues list
                $user['queues'][] = $queue_name;
                // Add agent displaynames from queues
                foreach ($queues[$queue_name] as $member_extension) {
                    if (isset($ext2user[$member_extension])) {
                        $user['agents'][] = $ext2user[$member_extension];
                    }
                }
            }
        }

        if (isset($profile['macro_permissions']['cdr'])
            && isset($profile['macro_permissions']['cdr']['value'])
            && $profile['macro_permissions']['cdr']['value'] == 1)
        {
            if (!empty($profile['macro_permissions']['cdr']['permissions'])) {
                // Check if user has CDR admin permission or group CDR permission
                $ad_cdr = False;
                $group_cdr = False;
                foreach ($profile['macro_permissions']['cdr']['permissions'] as $perm) {
                    if ($perm['name'] == 'ad_cdr' && $perm['value'] == 1) {
                        $ad_cdr = True;
                    }
                    if ($perm['name'] == 'group_cdr' && $perm['value'] == 1) {
                        $group_cdr = True;
                    }
                }
                if ($ad_cdr) {
                    $user["cdr"] = "global";
                    // Add everyone if admin CDR permission is enable
                    $user["users"] = $all_extensions;
                    foreach ($groups as $group) {
                        $user["groups"][] = $group["name"];
                    }
                } elseif ($group_cdr) {
                    $user["cdr"] = "group";
                    // Add groups user is member of
                    foreach ($groups as $group) {
                        if ($group["username"] == $username) {
                            $user["groups"][] = $group["name"];
                            foreach ($groups as $g) {
                                if($g["name"] == $group["name"]) {
                                    foreach ($res_devices as $device) {
                                        if ($g["id"] == $device["user_id"]) {
                                            $user["users"][] = $device["extension"];
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    $user["cdr"] = "personal";
                    // Add self if admin CDR permission is disabled but cdr permision is enabled
                    foreach ($res_devices as $device) {
                        if ($user_id == $device["user_id"]) {
                            $user["users"][] = $device["extension"];
                        }
                    }
                }
            }
        }
        // remove duplicates
        $user["groups"] = array_values(array_unique($user["groups"]));
        $user["users"] = array_values(array_unique($user["users"]));
        $user["agents"] = array_values(array_unique($user["agents"]));

        $config[] = $user;
    }

    // Write the file
    if (file_put_contents("/opt/nethvoice-report/api/user_authorizations.json", json_encode($config)) === false) {
        error_log("Can't write 'user_authorizations.json' file");
    }
}
