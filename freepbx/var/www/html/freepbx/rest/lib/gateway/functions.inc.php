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

function gateway_get_configuration($name, $mac=false){
    try{
        $dbh = FreePBX::Database();
        /*Check if config exists*/
        $sql = "SELECT * FROM `gateway_config` WHERE `name` = ?";
        $prep = array($name);
        if ($mac) {
            $sql .= " AND `mac` = ?";
            $prep[] = $mac;
        }
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute($prep);
        $config = $sth->fetch(\PDO::FETCH_ASSOC);
        if ($config === false){
            /*Configuration doesn't exist*/
            error_log("Configuration not found");
            exit(1);
        }
        $sql = "SELECT `model`,`manufacturer` FROM `gateway_models` WHERE `id` = ?";
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($config['model_id']));
        $res = $sth->fetch(\PDO::FETCH_ASSOC);
        $config['model'] = $res['model'];
        $config['manufacturer'] = $res['manufacturer'];
        $sql = "SELECT a.trunk,a.trunknumber AS trunknumber, b.name as username, secret, `protocol` FROM `gateway_config_isdn` AS a JOIN trunks AS b ON a.trunk=b.trunkid WHERE `config_id` = ?";
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($config['id']));
        while ($row = $sth->fetch(\PDO::FETCH_ASSOC)){
            $config['trunks_isdn'][] = $row;
        }

        $sql = "SELECT a.trunk as trunk,a.trunknumber AS trunknumber, b.name as username, secret  FROM `gateway_config_pri` AS a JOIN trunks AS b ON a.trunk=b.trunkid WHERE `config_id` = ?";
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($config['id']));
        while ($row = $sth->fetch(\PDO::FETCH_ASSOC)){
            $config['trunks_pri'][] = $row;
        }

        $sql = "SELECT a.trunk as trunk,a.trunknumber AS trunknumber, number, b.name as username, secret FROM `gateway_config_fxo` AS a JOIN trunks AS b ON a.trunk=b.trunkid WHERE `config_id` = ?";
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($config['id']));
        while ($row = $sth->fetch(\PDO::FETCH_ASSOC)){
            $config['trunks_fxo'][] = $row;
        }
        $sql = "SELECT `physical_extension`,`secret` FROM `gateway_config_fxs` WHERE `config_id` = ?";
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($config['id']));
        while ($row = $sth->fetch(\PDO::FETCH_ASSOC)){
            $config['trunks_fxs'][] = $row;
        }

        return $config;
    } catch (Exception $e){
        error_log($e->getMessage());
        exit(1);
    }
}

function gateway_generate_configuration_file($name,$mac = false){
    try{
        $config = gateway_get_configuration($name,$mac);
        # read template
        $template = "/var/www/html/freepbx/rest/lib/gateway/templates/{$config['manufacturer']}/{$config['model']}.txt";
        $handle = fopen($template, "r");
        ob_clean();
        ob_start();
        if ($handle) {
            while (!feof($handle)) {
                $buffer = fgets($handle, 4096);
                $output .= $buffer;
            }
            fclose($handle);
        } else {
            error_log("Template $template not found");
            return false;
        }
        # replace variables in template
        $output = str_replace("ASTERISKIP",$config['ipv4_green'],$output);
        $output = str_replace("GATEWAYIP",$config['ipv4_new'],$output);
        $output = str_replace("DEFGATEWAY",$config['gateway'],$output);
        $output = str_replace("NETMASK",$config['netmask_green'],$output);
        $output = str_replace("DATE",date ('d/m/Y G:i:s'),$output);
        $output = str_replace("PROXY",$config['proxy'],$output);

        #Generate trunks config
        if (!empty($config['trunks_fxo'])){
            $i = 1;
            $n_trunks = count($config['trunks_fxo']);
            if ($n_trunks>0) {
                $j = $n_trunks+1;
            } else {
                $j = 1;
            }
            foreach ($config['trunks_fxo'] as $trunk){
                $output = str_replace("LINENUMBER$i",$trunk['number'],$output);
                $output = str_replace("TRUNKNUMBER$j",$trunk['trunknumber'],$output);
                $output = str_replace("TRUNKUSERNAME$j",$trunk['username'],$output);
                $output = str_replace("TRUNKSECRET$j",$trunk['secret'],$output);
                $i++;
                $j++;
            }
        }
        if (!empty($config['trunks_isdn'])){
            $i = 1;
            foreach ($config['trunks_isdn'] as $trunk) {
                $output = str_replace("TRUNKNUMBER$i",$trunk['trunknumber'],$output);
                $output = str_replace("TRUNKUSERNAME$i",$trunk['username'],$output);
                $output = str_replace("TRUNKSECRET$i",$trunk['secret'],$output);

                if ($trunk['protocol']=="pp") {
                    if ($config['manufacturer'] == 'Sangoma') {
                        $output = str_replace("PROTOCOLTYPE$i","pp",$output);
                    } elseif ($config['manufacturer'] == 'Mediatrix') {
                        $output = str_replace("PROTOCOLTYPE$i","PointToPoint",$output);
                    } elseif ($config['manufacturer'] == 'Patton') {
                        $output = str_replace("PROTOCOLTYPE$i","protocol pp",$output);
                    }
                } elseif ($trunk['protocol']=="pmp") {
                    if ($config['manufacturer'] == 'Sangoma') {
                        $output = str_replace("PROTOCOLTYPE$i","pmp",$output);
                    } elseif ($config['manufacturer'] == 'Mediatrix') {
                        $output = str_replace("PROTOCOLTYPE$i","PointToMultiPoint",$output);
                    } elseif ($config['manufacturer'] == 'Patton' && preg_match ('/^TRI_/', $config['model'])) {
                        $output = str_replace("PROTOCOLTYPE$i","protocol pmp",$output);
                    } elseif ($config['manufacturer'] == 'Patton' && !preg_match ('/^TRI_/', $config['model'])){
                        $output = str_replace("PROTOCOLTYPE$i","",$output);
                    }
                }
                $i++;
            }
        }
        if (!empty($config['trunks_pri'])){
            $i = 1;
            foreach ($config['trunks_pri'] as $trunk){
                $output = str_replace("TRUNKNUMBER$i",$trunk['trunknumber'],$output);
                $output = str_replace("TRUNKUSERNAME$i",$trunk['username'],$output);
                $output = str_replace("TRUNKSECRET$i",$trunk['secret'],$output);
                $i++;
            }
        }
        if (!empty($config['trunks_fxs'])){
            //Split IP address into octets for Grandstream configuration and set the MAC and DATE placeholders nethesis/dev#6196
            $octet_gateway_ip = explode(".",$config['ipv4_new']);
            $octet_gateway_mask = explode(".",$config['netmask_green']);
            $octet_default_gateway_ip = explode(".",$config['gateway']);
            $upper_mac = str_replace(":","",strtoupper($mac));
            $output = str_replace("MAC",$upper_mac,$output);
            $output = str_replace("UTIME",time(),$output);
            for ($i = 0; $i <= 3; $i++) {
                //Set IP octect in the config 
                $output = str_replace("IP{$i}",$octet_gateway_ip[$i],$output);
                $output = str_replace("MASK{$i}",$octet_gateway_mask[$i],$output);
                $output = str_replace("DNS{$i}",$octet_default_gateway_ip[$i],$output);
                $output = str_replace("GATE{$i}",$octet_default_gateway_ip[$i],$output);
            }
            $i=0;
            foreach ($config['trunks_fxs'] as $trunk){
                $output = preg_replace("/FXSEXTENSION{$i}([^0-9])/",$trunk['physical_extension'].'\1',$output);
                $output = preg_replace("/FXSPASS{$i}([^0-9])/",$trunk['secret'].'\1',$output);
                $i++;
            }
        }


    } catch (Exception $e){
        error_log($e->getMessage());
        exit(1);
    }
    return $output;
}

function getPjSipDefaults() {
    return array(
        "aor_contact"=> "",
        "auth_rejection_permanent"=> "on",
        "authentication"=> "inbound",
        "auth_rejection_permanent"=> "off",
        "client_uri"=> "",
        "codecs"=> "g729,alaw,ulaw",
        "contact_user"=> "",
        "context"=> "from-pstn-identity",
        "continue"=> "off",
        "dialoutopts_cb"=> "sys",
        "dialoutprefix"=> "",
        "direct_media"=> "no",
        "disabletrunk"=> "off",
        "dtmfmode"=> "rfc4733",
        "expiration"=> 3600,
        "extdisplay"=> "",
        "fax_detect"=> "no",
        "forbidden_retry_interval"=> 10,
        "force_rport"=> "no",
        "from_domain"=> "",
        "from_user"=> "",
        "hcid"=> "on",
        "identify_by"=> "default",
        "inband_progress"=> "no",
        "keepcid"=> "off",
        "language"=> "",
        "match"=> "",
        "max_retries"=> 10,
        "maxchans"=> "",
        "media_encryption"=> "no",
        "npanxx"=> "",
        "outbound_proxy"=> "",
        "outcid"=> "",
        "pjsip_line"=> "true",
        "provider"=> "",
        "qualify_frequency"=> 60,
        "registration"=> "receive",
        "retry_interval"=> 60,
        "rewrite_contact"=> "no",
        "rtp_symmetric"=> "no",
        "secret"=> "",
        "sendrpid"=> "no",
        "send_connected_line"=> "false",
        "server_uri"=> "",
        "sip_server"=> "",
        "sip_server_port"=> 5060,
        "support_path"=> "no",
        "sv_channelid"=> "",
        "sv_trunk_name"=> "",
        "sv_usercontext"=> "",
        "t38_udptl"=> "no",
        "t38_udptl_ec"=> "none",
        "t38_udptl_nat"=> "no",
        "tech"=> "pjsip",
        "transport"=> "0.0.0.0-udp",
        "trunk_name"=> "",
        "trust_id_outbound"=> "no",
        "trust_rpid"=> "no",
        "username"=> "",
        "user_eq_phone"=> "no",
    );
}

function addEditGateway($params){
    try {
        $errors = array(); $warnings = array(); $infos = array();
        $fpbx = FreePBX::create();
        $dbh = FreePBX::Database();
        /*Check if config exists*/
        $sql = "SELECT `id` FROM `gateway_config` WHERE `name` = ?";
        $prep = array($params['name']);
        if (isset($params['mac'])) {
            $sql .= " AND `mac` = ?";
            $prep[] = strtoupper($params['mac']);
        }
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute($prep);
        $res = $sth->fetch(\PDO::FETCH_ASSOC);
        if ($res !== false) {
            /*Configuration exists, delete it*/
            $id = $res['id'];
            $sqls = array();
            $sqls[] = "DELETE IGNORE FROM `gateway_config` WHERE `id` = ?";
            foreach ($sqls as $sql) {
                $sth = FreePBX::Database()->prepare($sql);
                $sth->execute(array($id));
            }
        }
        /*Create configuration*/
        $sql = "INSERT INTO `gateway_config` (`model_id`,`name`,`ipv4`,`ipv4_new`,`gateway`,`ipv4_green`,`netmask_green`,`mac`,`proxy`) VALUES (?,?,?,?,?,?,?,?,?)";
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($params['model'],$params['name'],$params['ipv4'],$params['ipv4_new'],$params['gateway'],$params['ipv4_green'],$params['netmask_green'],strtoupper($params['mac']),$_ENV['NETHVOICE_PROXY_FQDN']));
        /*get id*/
        $sql = "SELECT `id` FROM `gateway_config` WHERE `name` = ? ORDER BY `id` DESC LIMIT 1";
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($params['name']));
        $res = $sth->fetch(\PDO::FETCH_ASSOC);
        if ($res === false) {
            $errors[] = "Failed to create configuration";
            return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
        }
        $configId = $res['id'];

        // create trunks
        $sql = "SELECT `manufacturer` FROM `gateway_models` WHERE `id` = ?";
        $sth = FreePBX::Database()->prepare($sql);
        $sth->execute(array($params['model']));
        $res = $sth->fetch(\PDO::FETCH_ASSOC);

        // Create unique smart name
        $vendor = $res['manufacturer'];
        $uid = strtolower(substr(str_replace(':', '', $params['mac']), -6, 6));

        $trunksByTypes = array(
          'isdn' => $params['trunks_isdn'],
          'pri' => $params['trunks_pri'],
          'fxo' => $params['trunks_fxo'],
          'fxs' => $params['trunks_fxs']
        );

        foreach ($trunksByTypes as $type=>$trunks) {

            $port = (strtolower($res['manufacturer']) === 'patton' ? 0 : 1);
            if (!empty($trunks)) {
                foreach ($trunks as $trunk) {
                    if($type != 'fxs') {
                        $trunkName = $vendor. '_'. $uid. '_'. $type. '_'. $port;

                        $nextTrunkId = count(core_trunks_list());

                        $trunk['trunknumber'] = intval('20'. str_pad(++$nextTrunkId, 3, '0', STR_PAD_LEFT));
                        $srvip = $_ENV['NETHVOICE_HOST'];
                        $secret = substr(md5(uniqid(rand(), true)),0,13);
                        $defaults = getPjSipDefaults();
                        $defaults['aors'] = $trunkName;
                        $defaults['dialoutprefix'] = $trunk['trunknumber'];
                        $defaults['extdisplay'] = 'OUT_'.$nextTrunkId;
                        $defaults['outbound_proxy'] = 'sip:' . $_ENV['PROXY_IP'] . ':' . $_ENV['PROXY_PORT'] . ';lr';
                        $defaults['secret'] = $secret;
                        $defaults['sip_server'] = $params['ipv4_new'];
                        $defaults['sv_channelid'] = $trunkName;
                        $defaults['sv_trunk_name'] = $trunkName;
                        $defaults['trunk_name'] = $trunkName;
                        $defaults['username'] = $trunkName;

                        // set $_REQUEST and $_POST params for pjsip
                        foreach ($defaults as $k => $v) {
                            $_REQUEST[$k] = $v;
                            $_POST[$k] = $v;
                        }

                        $trunkId = core_trunks_add(
                            'pjsip', // tech
                            $trunkName, // channelid as trunk name
                            $defaults['dialoutprefix'], // dialoutprefix
                            null, // maxchans
                            null, // outcid
                            null, // peerdetails
                            'from-pstn-identity', // usercontext
                            null, // userconfig
                            null, // register
                            'off', // keepcid
                            null, // failtrunk
                            'off', // disabletrunk
                            $trunkName, // name
                            null, // provider
                            'off', // continue
                            false   // dialopts
                        );

                        $dialpattern_insert = array('prepend_digits'=>'','match_pattern_prefix'=>'','match_pattern_pass'=>'','match_cid'=>'');
                        core_trunks_update_dialrules($trunkId, $dialpattern_insert);
                        $port++;
                    }

                    if ($type === 'isdn' && isset($params['trunks_isdn'])) {
                        /*Save isdn trunks parameters*/
                        $sql = "REPLACE INTO `gateway_config_isdn` (`config_id`,`trunk`,`trunknumber`,`protocol`,`secret`) VALUES (?,?,?,?,?)";
                        $sth = FreePBX::Database()->prepare($sql);
                        $sth->execute(array($configId,$trunkId,$trunk['trunknumber'],$trunk['type'],$secret));
                    } elseif ($type === 'pri' && isset($params['trunks_pri'])) {
                        /*Save pri trunks parameters*/
                        $sql = "REPLACE INTO `gateway_config_pri` (`config_id`,`trunk`,`trunknumber`,`secret`) VALUES (?,?,?,?)";
                        $sth = FreePBX::Database()->prepare($sql);
                        $sth->execute(array($configId,$trunkId,$trunk['trunknumber'],$secret));
                    } elseif ($type === 'fxo' && isset($params['trunks_fxo'])) {
                        /*Save fxo trunks parameters*/
                        $sql = "REPLACE INTO `gateway_config_fxo` (`config_id`,`trunk`,`trunknumber`,`number`,`secret`) VALUES (?,?,?,?,?)";
                        $sth = FreePBX::Database()->prepare($sql);
                        $sth->execute(array($configId,$trunkId,$trunk['trunknumber'],$trunk['number'],$secret));
                    } elseif ($type === 'fxs' && isset($params['trunks_fxs'])) {
                        /* create physical extension */
                        $mainextensionnumber = $trunk['linked_extension'];
                        $extension = createExtension($mainextensionnumber,true);
                        if (useExtensionAsCustomPhysical($extension,false,'physical',$web_user,$web_password) === false) {
                            $response->withJson(array("status"=>"Error creating custom extension"), 500);
                        }
                        /* Add fxs extension to fxo AOR */
                        $trunk_number = (strtolower($res['manufacturer']) === 'patton' ? 0 : 2);
                        $trunk_name = $vendor. '_'. $uid. '_fxo_'. $trunk_number;
                        $trunk_pjsip_id = sql('SELECT id FROM `pjsip` WHERE keyword ="trunk_name" AND data = "' . $trunk_name . '"' , "getOne");
                        if (!empty($trunk_pjsip_id)) {
                            $trunk_pjsip_aor = sql('SELECT data FROM `pjsip` WHERE keyword ="aors" AND id = "' . $trunk_pjsip_id . '"', "getOne");
                            $trunk_pjsip_aor .= ",".$extension;
                            $sql = "REPLACE INTO `pjsip` (`id`,`keyword`,`data`,`flags`) VALUES (?,?,?,?)";
                            $sth = FreePBX::Database()->prepare($sql);
                            $sth->execute(array($trunk_pjsip_id,'aors',$trunk_pjsip_aor,'0'));
                        }
                        /*Save fxs trunks parameters*/
                        $extension_secret = sql('SELECT data FROM `sip` WHERE id = "' . $extension . '" AND keyword="secret"', "getOne");
                        $sql = "REPLACE INTO `gateway_config_fxs` (`config_id`,`extension`,`physical_extension`,`secret`) VALUES (?,?,?,?)";
                        $sth = FreePBX::Database()->prepare($sql);
                        $sth->execute(array($configId,$trunk['linked_extension'],$extension,$extension_secret));
                    }
                }
            }
        }
        system('/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null &');
        return array('status' => true, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos, 'id'=>$configId);
    } catch (Exception $e) {
        error_log($e->getMessage());
        $errors[] = $e->getMessage();
        return array('status' => false, 'errors' => $errors, 'warnings' => $warnings, 'infos' => $infos);
    }
}
