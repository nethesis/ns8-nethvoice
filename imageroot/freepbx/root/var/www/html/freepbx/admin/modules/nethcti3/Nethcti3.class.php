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

namespace FreePBX\modules;

class Nethcti3 implements \BMO
{
    public function __construct($freepbx = null) {
        if ($freepbx == null)
            throw new Exception("Not given a FreePBX Object");

        $this->FreePBX = $freepbx;
        $this->db = $freepbx->Database;
    }

    public function install() {
    }
    public function uninstall() {
    }
    public function backup() {
    }
    public function restore($backup) {
    }
    public function doConfigPageInit($page) {
    }

    /*Write a CTI configuration file in JSON format*/
    public function writeCTIConfigurationFile($filename, $obj) {
    try {
        // Write configuration file
        require('/var/www/html/freepbx/rest/config.inc.php');
        $res = file_put_contents($config['settings']['cti_config_path']. $filename,json_encode($obj, JSON_PRETTY_PRINT),LOCK_EX);
        chown($config['settings']['cti_config_path']. $filename,'asterisk');
        chgrp($config['settings']['cti_config_path']. $filename,'asterisk');
    } catch (Exception $e) {
        error_log($e->getMessage());
        return FALSE;
    }
        return $res;
    }

    /*Get trunks configuration*/
    public function getTrunksConfiguration() {
        try {
            $dbh = \FreePBX::Database();
            $result = array();
            $trunks = \FreePBX::Core()->listTrunks();
            foreach($trunks as $trunk) {
                $result[$trunk['channelid']] = (object)array(
                    "tech"=>$trunk["tech"],
                    "trunkid"=>$trunk["trunkid"],
                    "name"=>$trunk["name"],
                    "usercontext"=>$trunk["usercontext"],
                    "maxchans"=>$trunk["maxchans"],
                    "host"=>"",
                    "username"=>"",
                    "registration"=>"none",
                );
                // Get host, username and registration
                if ($trunk["tech"] == "sip") {
                    $sql = 'SELECT `keyword`,`data` FROM `sip` WHERE (`id` = CONCAT("tr-peer-",?) AND ( `keyword` = "host" OR `keyword` = "username")) OR (`id` = CONCAT("tr-reg-",?) AND `keyword` = "register")';
                    $sth = $dbh->prepare($sql);
                    $sth->execute([$trunk["trunkid"],$trunk["trunkid"]]);
                    $res = $sth->fetchAll(\PDO::FETCH_ASSOC);
                    foreach ($res as $row) {
                        switch ($row['keyword']) {
                            case "host":
                                $result[$trunk['channelid']]->host = $row['data'];
                                break;
                            case "username":
                                $result[$trunk['channelid']]->username = $row['data'];
                                break;
                            case "register":
                                $result[$trunk['channelid']]->registration = "send";
                                break;
                        }
                    }
                } elseif ($trunk["tech"] == "pjsip") {
                    $sql = 'SELECT `keyword`,`data` FROM `pjsip` WHERE `id` = ? AND ( `keyword` = "sip_server" OR `keyword` = "username" OR `keyword` = "registration")';
                    $sth = $dbh->prepare($sql);
                    $sth->execute([$trunk["trunkid"]]);
                    $res = $sth->fetchAll(\PDO::FETCH_ASSOC);
                    foreach ($res as $row) {
                        switch ($row['keyword']) {
                            case "sip_server":
                                $result[$trunk['channelid']]->host = $row['data'];
                                break;
                            case "username":
                                $result[$trunk['channelid']]->username = $row['data'];
                                break;
                            case "registration":
                                $result[$trunk['channelid']]->registration = $row['data'];
                                break;
                        }
                    }
                } elseif ($trunk["tech"] == "iax") {
                    $sql = 'SELECT `keyword`,`data` FROM `iax` WHERE (`id` = CONCAT("tr-peer-",?) AND ( `keyword` = "host" OR `keyword` = "username")) OR (`id` = CONCAT("tr-reg-",?) AND `keyword` = "register")';
                    $sth = $dbh->prepare($sql);
                    $sth->execute([$trunk["trunkid"],$trunk["trunkid"]]);
                    $res = $sth->fetchAll(\PDO::FETCH_ASSOC);
                    foreach ($res as $row) {
                        switch ($row['keyword']) {
                            case "host":
                                $result[$trunk['channelid']]->host = $row['data'];
                                break;
                            case "username":
                                $result[$trunk['channelid']]->username = $row['data'];
                                break;
                            case "register":
                                $result[$trunk['channelid']]->registration = "send";
                                break;
                        }
                    }
                }
            }
        } catch (Exception $e) {
            error_log($e->getMessage());
            return FALSE;
        }
        return $result;
    }

    /*Get queues configuration*/
    public function getQueuesConfiguration() {
        try {
            $result = array();
            $queues = \FreePBX::Queues()->listQueues();

            //get dynmembers
            global $astman;
            $dbqpenalities = $astman->database_show('QPENALTY');
            $penalities=array();
            //build an array of members for each queue
            foreach ($dbqpenalities as $dbqpenality => $tmp) {
                if (preg_match ('/\/QPENALTY\/([0-9]+)\/agents\/([0-9]+)/',$dbqpenality,$matches)) {
                    $penalities[$matches[1]][] = $matches[2];
                }
            }
            //create result object
            foreach ($queues as $queue) {
                $queue_details = queues_get($queue[0]);

                //dynmembers = array() if there isn't dynmembers in $penalities for this queue
                if (!isset($penalities[$queue[0]])) {
                    $penalities[$queue[0]] = array();
                }
                $result[$queue[0]] = (object) array("id" => $queue[0], "name" => $queue[1], "dynmembers" => $penalities[$queue[0]], "sla"=>$queue_details['servicelevel']);
            }
            //add oppanel special queues
            foreach (getCTIPermissionProfiles(false,false,false) as $profile){
                if (isset($profile['macro_permissions']['operator_panel']) && $profile['macro_permissions']['operator_panel']['value'] == true) {
                    $exten = "ctiopqueue".$profile['id'];
                    $result[$exten] = (object) array("id" => $exten, "name" => "Waiting Queue ".$profile['id'], "dynmembers" => array(),"sla" => "60");
                }
            }
        } catch (Exception $e) {
            error_log($e->getMessage());
            return FALSE;
        }
        return $result;
    }

    /*Get FeatureCodes configuration*/
    public function getFeaturecodesConfiguration() {
    try {
        $result = array();
        $codes_to_pick = array("pickup","meetme_conf","que_toggle","dnd_toggle","incall_audio"); //Add here more codes
        $featurecodes = featurecodes_getAllFeaturesDetailed();
        foreach ($featurecodes as $featurcode) {
            if (in_array($featurcode['featurename'],$codes_to_pick)) {
                if (isset($featurcode['customcode']) && $featurcode['customcode'] != '') {
                    $results[$featurcode['featurename']] = $featurcode['customcode'];
                } else {
                    $results[$featurcode['featurename']] = $featurcode['defaultcode'];
                }
            }
        }
    } catch (Exception $e) {
        error_log($e->getMessage());
        return FALSE;
    }
        return (object) $results;
    }

    public function getTransferContext() {
        try {
            $dbh = \FreePBX::Database();
            $sql = 'SELECT `value` FROM `freepbx_settings` WHERE `keyword` = "TRANSFER_CONTEXT"';
            $sth = $dbh->prepare($sql);
            $sth->execute();
            $res = $sth->fetchAll()[0][0];
        } catch (Exception $e) {
            error_log($e->getMessage());
            return FALSE;
        }
        return $res;
    }

    public function writeConfig($conf){
          $this->FreePBX->WriteConfig($conf);
          if (isset($conf['queues_nethcti.conf'])) {
              // Make sure that there is queues_nethcti.conf in queues.conf
              $dir = $this->FreePBX->Config->get('ASTETCDIR');
              $queues_conf = explode("\n",file_get_contents($dir.'/'.'queues.conf'));
              if (! in_array('#include queues_nethcti.conf',$queues_conf)) {
                  $new_queues_conf = array();
                  foreach ($queues_conf as $row) {
                      if ($row === '#include queues_post_custom.conf') $new_queues_conf[] = '#include queues_nethcti.conf';
                      $new_queues_conf[] = $row;
                  }
                  $this->FreePBX->WriteConfig(array('queues.conf' => implode("\n",$new_queues_conf)));
              }
          }
    }

    // Generate configuration for Operator Panel waiting queues
    public function genConfig() {
        $out = array();
        include_once('/var/www/html/freepbx/rest/lib/libCTI.php');
        foreach (getCTIPermissionProfiles(false,false,false) as $profile){
            if (isset($profile['macro_permissions']['operator_panel']) && $profile['macro_permissions']['operator_panel']['value'] == true) {
                $exten = "ctiopqueue".$profile['id'];
                $out['queues_nethcti.conf'] .= "[$exten]\nannounce-frequency=0\nannounce-holdtime=no\nannounce-position=no\njoinempty=yes\nleavewhenempty=no\n\n";
            }
        }
        return $out;
    }
}
