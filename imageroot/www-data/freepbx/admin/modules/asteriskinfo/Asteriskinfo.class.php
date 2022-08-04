<?php
namespace FreePBX\modules;
class Asteriskinfo implements \BMO {
	public function __construct($freepbx = null) {
		if ($freepbx == null) {
			throw new Exception("Not given a FreePBX Object");
		}
		$this->FreePBX = $freepbx;
		$this->db = $freepbx->Database;
		$this->astman = $this->FreePBX->astman;

	}
	public function install() {}
	public function uninstall() {}
	public function backup() {}
	public function restore($backup) {}
	public function doConfigPageInit($page) {}
	public function showPage(){}
	public function buildAsteriskInfo(){
		$astman = $this->astman;
		global $astver;
		$sipActive = true;
		$pjsipActive = false;
		if (version_compare($astver, '12', 'ge')) {
			$pjsip_mod_check = $astman->send_request('Command', array('Command' => 'module show like chan_pjsip'));
			$pjsip_module = preg_match('/[1-9] modules loaded/', $pjsip_mod_check['data']);
			if ($pjsip_module) {
				$pjsipActive = true;
			}

			$sip_mod_check = $astman->send_request('Command', array('Command' => 'module show like chan_sip'));
			$sip_module = preg_match('/[1-9] modules loaded/', $sip_mod_check['data']);
			if (!$sip_module) {
				$sipActive = false;
			}
		}
		$uptime = _("Uptime: ");
		$activesipchannels = _("Active SIP Channel(s): ");
		$sipregistry = _("Sip Registry: ");
		$sippeers = _("Sip Peers: ");

		$activepjsipchannels = _("Active PJSIP Channel(s): ");
		$pjsipregistrations = _("PJSip Registrations: ");
		$pjsipendpoints = _("PJSip Endpoints: ");

		$activeiax2channels = _("Active IAX2 Channel(s): ");
		$iax2registry = _("IAX2 Registry: ");
		$iax2peers = _("IAX2 Peers: ");

		$arr = array(
			$uptime => "show uptime",
			$activesipchannels => "sip show channels",
			$activepjsipchannels => "pjsip show channels",
			$activeiax2channels => "iax2 show channels",
			$sipregistry => "sip show registry",
			$pjsipregistrations => "pjsip show registrations",
			$iax2registry => "iax2 show registry",
			$sippeers => "sip show peers",
			$pjsipendpoints => "pjsip show endpoints",
			$iax2peers => "iax2 show peers",
		);

		if(!$sipActive) {
			unset($arr[$activesipchannels]);
			unset($arr[$sipregistry]);
			unset($arr[$sippeers]);
		}
		if(!$pjsipActive) {
			unset($arr[$activepjsipchannels]);
			unset($arr[$pjsipregistrations]);
			unset($arr[$pjsipendpoints]);
		}

		if (version_compare($astver, '1.4', 'ge')) {
			$arr[$uptime] = 'core show uptime';
		}

		$htmlOutput  = '<table>';

		foreach ($arr as $key => $value) {

			$response = $astman->send_request('Command',array('Command'=>$value));
			$astout = explode("\n",$response['data']);

			switch ($key) {
				case $uptime:
					$uptime = $astout;
					$colspan = ($sipActive && $pjsipActive) ? 3 : 2;
					$htmlOutput .= '<tr><td colspan="' . $colspan . '">Asterisk '.$uptime[1]."<br />".$uptime[2]."<br /></td>";
					$htmlOutput .= '</tr>';
				break;
				case $activepjsipchannels:
					$activePJSipChannel = $astout;
					$activePJSipChannel_count = $this->getActiveChannel($activePJSipChannel, $channelType = 'PJSIP');
					if(!$sipActive) {
						$htmlOutput .= '<tr>';
					}
					$htmlOutput .= "<td>".$key.$activePJSipChannel_count."</td>";
				break;
				case $activesipchannels:
					$activeSipChannel = $astout;
					$activeSipChannel_count = $this->getActiveChannel($activeSipChannel, $channelType = 'SIP');
					$htmlOutput .= '<tr>';
					$htmlOutput .= "<td>".$key.$activeSipChannel_count."</td>";
				break;
				case $activeiax2channels:
					$activeIAX2Channel = $astout;
					$activeIAX2Channel_count = $this->getActiveChannel($activeIAX2Channel, $channelType = 'IAX2');
					$htmlOutput .= "<td>".$key.$activeIAX2Channel_count."</td>";
					$htmlOutput .= '</tr>';
				break;
				break;
				case $sipregistry:
					$sipRegistration = $astout;
					$sipRegistration_count = $this->getRegistration($sipRegistration, $channelType = 'SIP');
					$htmlOutput .= '<tr>';
					$htmlOutput .= "<td>".$key.$sipRegistration_count."</td>";
				break;
				case $pjsipregistrations:
					$pjsipRegistration = $astout;
					$pjsipRegistration_count = $this->getRegistration($pjsipRegistration, $channelType = 'PJSIP');
					$htmlOutput .= "<td>".$key.$pjsipRegistration_count."</td>";
				break;
				case $iax2registry:
					$iax2Registration = $astout;
					$iax2Registration_count = $this->getRegistration($iax2Registration, $channelType = 'IAX2');
					$htmlOutput .= "<td>".$key.$iax2Registration_count."</td>";
					$htmlOutput .= '</tr>';
				break;
				case $sippeers:
					$sipPeer = $astout;
					$sipPeer_arr = $this->getPeer($sipPeer, $channelType = 'SIP');
					if($sipPeer_arr['offline'] != 0){
						$sipPeerColor = 'red';
					}else{
						$sipPeerColor = '#000000';
					}
					$htmlOutput .= '<tr>';
					$htmlOutput .= "<td>".$key."<br />&nbsp;&nbsp;&nbsp;&nbsp;"._("Online: ").$sipPeer_arr['online']."<br />&nbsp;&nbsp;&nbsp;&nbsp;"._("Online-Unmonitored: ").$sipPeer_arr['online-unmonitored'];
					$htmlOutput .= "<br />&nbsp;&nbsp;&nbsp;&nbsp;"._("Offline: ")."<span style=\"color:".$sipPeerColor.";font-weight:bold;\">".$sipPeer_arr['offline']."</span><br />&nbsp;&nbsp;&nbsp;&nbsp;"._("Offline-Unmonitored: ")."<span style=\"color:".$sipPeerColor.";font-weight:bold;\">".$sipPeer_arr['offline-unmonitored']."</span></td>";
				break;
				case $pjsipendpoints:
					$pjsipPeer = $astout;
					$pjsipPeer_arr = $this->getPeer($pjsipPeer, $channelType = 'PJSIP');
					if($pjsipPeer_arr['unavailable'] != 0){
						$pjsipPeerColor = 'red';
					}else{
						$pjsipPeerColor = '#000000';
					}
					$htmlOutput .= "<td>".$key."<br />&nbsp;&nbsp;&nbsp;&nbsp;"._("Available: ").$pjsipPeer_arr['available']."<br />";
					$htmlOutput .= "&nbsp;&nbsp;&nbsp;&nbsp;"._("Unavailable: ")."<span style=\"color:".$pjsipPeerColor.";font-weight:bold;\">".$pjsipPeer_arr['unavailable']."</span><br />&nbsp;&nbsp;&nbsp;&nbsp;"._("Unknown: ")."<span style=\"color:".$pjsipPeerColor.";font-weight:bold;\">".$pjsipPeer_arr['unknown']."</span></td>";

				break;
				case $iax2peers:
					$iax2Peer = $astout;
					$iax2Peer_arr = $this->getPeer($iax2Peer, $channelType = 'IAX2');
					if($iax2Peer_arr['offline'] != 0){
						$iax2PeerColor = 'red';
					}else{
						$iax2PeerColor = '#000000';
					}
					$htmlOutput .= "<td>".$key."<br />&nbsp;&nbsp;&nbsp;&nbsp;"._("Online: ").$iax2Peer_arr['online']."<br />&nbsp;&nbsp;&nbsp;&nbsp;"._("Offline: ")."<span style=\"color:".$iax2PeerColor.";font-weight:bold;\">".$iax2Peer_arr['offline']."</span><br />&nbsp;&nbsp;&nbsp;&nbsp;"._("Unmonitored: ").$iax2Peer_arr['unmonitored']."</td>";
					$htmlOutput .= '</tr>';
				break;
				default:
				}
			}
		$htmlOutput .= '</table>';
		return $htmlOutput."</div>";
	}
	public function getActiveChannel($channel_arr, $channelType = NULL){
		if(count($channel_arr) > 1){
			if($channelType == NULL || $channelType == 'SIP'){
				$sipChannel_arr = $channel_arr;
				$sipChannel_arrCount = count($sipChannel_arr);
				$sipChannel_string = $sipChannel_arr[$sipChannel_arrCount - 2];
				$sipChannel = explode(' ', $sipChannel_string);
				return $sipChannel[0];
			}elseif($channelType == 'IAX2'){
				$iax2Channel_arr = $channel_arr;
				$iax2Channel_arrCount = count($iax2Channel_arr);
				$iax2Channel_string = $iax2Channel_arr[$iax2Channel_arrCount - 2];
				$iax2Channel = explode(' ', $iax2Channel_string);
				return $iax2Channel[0];
			}elseif($channelType == 'PJSIP'){
				$channels = 0;
				foreach($channel_arr as $ln => $line) {
					if(preg_match('/no objects found/i',$line)) {
						return 0;
					}
					if(preg_match('/channel:/i',$line) && $ln > 2) {
						$channels++;
					}
				}
				return $channels;
			}
		}
	}

	public function getRegistration($registration, $channelType = 'SIP'){
		if($channelType == NULL || $channelType == 'SIP'){
			$sipRegistration_arr = $registration;
			$sipRegistration_count = count($sipRegistration_arr);
			return $sipRegistration_count-3;

		}elseif($channelType == 'IAX2'){
			$iax2Registration_arr = $registration;
			$iax2Registration_count = count($iax2Registration_arr);
			return $iax2Registration_count-3;
		}elseif($channelType == 'PJSIP'){
			$channels = 0;
			$start = false;
			foreach($registration as $ln => $line) {
				if(preg_match('/no objects found/i',$line)) {
					return 0;
				}
				if($start && !empty($line)) {
					$channels++;
				}
				if(preg_match('/===================/i',$line)) {
					$start = true;
				}
			}
			return $channels;
		}
	}

	public function getPeer($peer, $channelType = NULL){
		global $astver_major, $astver_minor;
		global $astver;
		if(count($peer) > 1){
			if($channelType == NULL || $channelType == 'SIP'){
				$sipPeer = $peer;
				$sipPeer_count = count($sipPeer);
				$sipPeerInfo_arr['sipPeer_count'] = $sipPeer_count -3;
				$sipPeerInfo_string = $sipPeer[$sipPeer_count -2];
				$sipPeerInfo_arr2 = explode('[',$sipPeerInfo_string);
				$sipPeerInfo_arr3 = explode(' ',$sipPeerInfo_arr2[1]);
				$sipPeerInfo_arr['online'] = $sipPeerInfo_arr3[1] ;
				$sipPeerInfo_arr['offline'] = $sipPeerInfo_arr3[3];
				$sipPeerInfo_arr['online-unmonitored'] = $sipPeerInfo_arr3[6];
				$sipPeerInfo_arr['offline-unmonitored'] = $sipPeerInfo_arr3[8];
				return $sipPeerInfo_arr;

			}elseif($channelType == 'IAX2'){
				$iax2Peer = $peer;
				$iax2Peer_count = count($iax2Peer);
				$iax2PeerInfo_arr['iax2Peer_count'] = $iax2Peer_count -3;
				$iax2PeerInfo_string = $iax2Peer[$iax2Peer_count -2];
				$iax2PeerInfo_arr2 = explode('[',$iax2PeerInfo_string);
				$iax2PeerInfo_arr3 = explode(' ',$iax2PeerInfo_arr2[1]);
				$iax2PeerInfo_arr['online'] = $iax2PeerInfo_arr3[0];
				$iax2PeerInfo_arr['offline'] = $iax2PeerInfo_arr3[2];
				$iax2PeerInfo_arr['unmonitored'] = $iax2PeerInfo_arr3[4];
				return $iax2PeerInfo_arr;
			}elseif($channelType == 'PJSIP'){
				$endpoint = false;
				$start = false;
				$contact = false;
				$array = array(
					"available" => 0,
					"unavailable" => 0,
					"unknown" => 0
				);
				foreach($peer as $ln => $line) {
					if(preg_match('/no objects found/i',$line)) {
						break;
					}
					if($start) {
						if(preg_match('/endpoint:/i',$line)) {
							$endpoint = true;
						}
						if($endpoint && preg_match('/contact:/i',$line)) {
							$contact = true;
							if(preg_match('/unavail/i',$line)) {
								$array['unavailable']++;
							} elseif(preg_match('/avail/i',$line)) {
								$array['available']++;
							} else {
								$array['unknown']++;
							}
						}
						if(empty($line)) {
							if(!$contact && !empty($peer[$ln-1]) && !preg_match('/===================/i',$peer[$ln-1])) {
								$array['unknown']++;
							}
							$contact = false;
							$endpoint = false;
						}
					}
					if(preg_match('/===================/i',$line)) {
						$start = true;
					}
				}
				return $array;
			}
		}
	}
	public function getOutput($command){
		$response = $this->astman->send_request('Command',array('Command'=>$command));
		$new_value = htmlentities($response['data'],ENT_COMPAT | ENT_HTML401, "UTF-8");
		return ltrim($new_value,'Privilege: Command');
	}
	/**
	 * [asteriskInfoHooks Hooking in to Asterisk Info Module]
	 * @return [array]
	 * 		'mode' => "Mode",
	 * 		'title' => "title",
	 * 		'commands' => array('subtitle' => 'command1', 'subtitle' => 'command2')
	 */
	public function asteriskInfoHooks(){
		$data = \FreePBX::Hooks()->processHooks();
		return $data;
	}
}
