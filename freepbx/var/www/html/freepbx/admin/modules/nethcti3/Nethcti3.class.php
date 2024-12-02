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

class Nethcti3 extends \FreePBX_Helpers implements \BMO
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

	// Add custom headers for trunks to trunks module
	public static function myGuiHooks() {
		return array("core", "INTERCEPT" => array("modules/core/page.trunks.php"));
	}

	public function doGuiHook($filename, &$output){}

	public function doGuiIntercept($filename, &$output) {
		# Show the custom field in the trunks module
		if ($filename == "modules/core/page.trunks.php" && $_REQUEST['display'] == "trunks" && strtolower($_REQUEST['tech']) == "pjsip") {
			$trunkid = str_replace("OUT_", "", $_REQUEST['extdisplay']);
			$disable_topos_header = $this->getConfig('disable_topos_header', $trunkid);
			$disable_srtp_header = $this->getConfig('disable_srtp_header', $trunkid);
			$topos_section = '
				<!--DISABLE TOPOS-->
				<div class="element-container">
					<div class="row">
						<div class="col-md-12">
							<div class="row">
								<div class="form-group">
									<div class="col-md-3">
										<label class="control-label" for="disable_topos_header">'._("Disable TOPOS proxy header").'</label>
										<i class="fa fa-question-circle fpbx-help-icon" data-for="disable_topos_header"></i>
									</div>
									<div class="col-md-9 radioset">
										<input type="radio" name="disable_topos_header" id="disable_topos_headeryes" value="yes" '.($disable_topos_header == 1?"CHECKED":"").'>
										<label for="disable_topos_headeryes">'. _("Yes") .'</label>
										<input type="radio" name="disable_topos_header" id="disable_topos_headerno" value="no" '.($disable_topos_header == 0 || empty($disable_topos_header) ? "CHECKED" : "").'>
										<label for="disable_topos_headerno">'._("No").'</label>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-md-12">
							<span id="disable_topos_header-help" class="help-block fpbx-help-block">'. _("If yes, send topos=0 header to nethvoice-proxy to disable TOPOS for this trunk").'</span>
						</div>
					</div>
				</div>
				<!--END DISABLE TOPOS-->';
			$disable_srtp_header_section = '
				<!--DISABLE SRTP-->
				<div class="element-container">
					<div class="row">
						<div class="col-md-12">
							<div class="row">
								<div class="form-group">
									<div class="col-md-3">
										<label class="control-label" for="disable_srtp_header">'._("Disable SRTP proxy header").'</label>
										<i class="fa fa-question-circle fpbx-help-icon" data-for="disable_srtp_header"></i>
									</div>
									<div class="col-md-9 radioset">
										<input type="radio" name="disable_srtp_header" id="disable_srtp_headeryes" value="yes" '.($disable_srtp_header == 1?"CHECKED":"").'>
										<label for="disable_srtp_headeryes">'. _("Yes") .'</label>
										<input type="radio" name="disable_srtp_header" id="disable_srtp_headerno" value="no" '.($disable_srtp_header == 0 || empty($disable_srtp_header) ? "CHECKED" : "").'>
										<label for="disable_srtp_headerno">'._("No").'</label>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-md-12">
							<span id="disable_srtp_header-help" class="help-block fpbx-help-block">'. _("If yes, send srtp=0 header to nethvoice-proxy to disable SRTP for this trunk").'</span>
						</div>
					</div>
				</div>
				<!--END DISABLE SRTP-->';

			$output = str_replace('<!--END OUTBOUND PROXY-->','<!--END OUTBOUND PROXY-->'.$topos_section,$output);
		}
	}

	public static function myConfigPageInits() {
		return array("extensions", "recallonbusy", "trunks");
	
	}

	public function doConfigPageInit($display) {
		global $astman;
		if ($display == "extensions" && !empty($_REQUEST['recallonbusy'])) {
				// Save Recall On Busy option for the extension
				$astman->database_put("ROBconfig",$_REQUEST['extdisplay'],$_REQUEST['recallonbusy']);
		} elseif ($display == "recallonbusy") {
				if (!empty($_REQUEST['default'])) {
						$this->setConfig('default',$_REQUEST['default']);
				}
				if (!empty($_REQUEST['digit'])) {
						$this->setConfig('digit',$_REQUEST['digit']);
				}
				needreload();
		} elseif ($display == "trunks") {
			global $db;
			if ($_REQUEST['action'] == "edittrunk" && !empty($_REQUEST['extdisplay'])) {
				if (!empty($_REQUEST['disable_topos_header'])) {
					// save topos configuratino for the trunk on trunk edit
					$disable_topos_header = $_REQUEST['disable_topos_header'] == "yes" ? 1 : 0;
					$trunkid = str_replace("OUT_", "", $_REQUEST['extdisplay']);
					$this->setConfig('disable_topos_header', $disable_topos_header, $trunkid);
				}
				if (!empty($_REQUEST['disable_srtp_header'])) {
					// save srtp configuration for the trunk on trunk edit
					$disable_srtp_header = $_REQUEST['disable_srtp_header'] == "yes" ? 1 : 0;
					$trunkid = str_replace("OUT_", "", $_REQUEST['extdisplay']);
					$this->setConfig('disable_srtp_header', $disable_srtp_header, $trunkid);
				}
			} elseif ($_REQUEST['action'] == "addtrunk") {
				// Get the future trunk id
				$sql = 'SELECT trunkid FROM trunks';
				$sth = $db->prepare($sql);
				$sth->execute();
				$trunkid = 1;
				while ($res = $sth->fetchColumn()) {
					if ($res > $trunkid) {
						break;
					}
					$trunkid++;
				}
				if ($res == $trunkid) {
					$trunkid++;
				}
				if (!empty($_REQUEST['disable_topos_header'])){
					// save topos configuration for the trunk on trunk add
					$disable_topos_header = $_REQUEST['disable_topos_header'] == "yes" ? 1 : 0;
					$this->setConfig('disable_topos_header', $disable_topos_header, $trunkid);
				}
				if (!empty($_REQUEST['disable_srtp_header'])){
					// save srtp configuration for the trunk on trunk add
					$disable_srtp_header = $_REQUEST['disable_srtp_header'] == "yes" ? 1 : 0;
					$this->setConfig('disable_srtp_header', $disable_srtp_header, $trunkid);
				}
			} elseif ($_REQUEST['action'] == "deltrunk") {
				$trunkid = str_replace("OUT_", "", $_REQUEST['extdisplay']);
				// delete topos configuration for the trunk
				$this->delConfig('disable_topos_header', $trunkid);
				// delete srtp configuration for the trunk
				$this->delConfig('disable_srtp_header', $trunkid);
			}
		}
}
}
