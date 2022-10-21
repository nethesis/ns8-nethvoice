<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

class queues_conf {

	private static $obj;
	var $_queues_general = array();
	var $_queues_additional = array();

	// FreePBX magic ::create() call
	public static function create() {
		if (!isset(self::$obj))
			self::$obj = new queues_conf();

		return self::$obj;
	}

	// Load the static object when created.
	public function __construct() {
		self::$obj = $this;
	}

	// return an array of filenames to write
	// files named like pinset_N
	function get_filename() {
		$files = array(
			'queues_additional.conf',
			'queues_general_additional.conf',
			);
		return $files;
	}

	// return the output that goes in each of the files
	function generateConf($file) {
		global $version;

		switch ($file) {
			case 'queues_additional.conf':
				return $this->generate_queues_additional($version);
				break;
			case 'queues_general_additional.conf':
				return $this->generate_queues_general_additional($version);
				break;
		}
	}

	function addQueuesGeneral($key, $value) {
		$this->_queues_general[] = array('key' => $key, 'value' => $value);
	}

	function addQueuesAdditional($section, $key, $value) {
		$this->_queues_additional[$section][] = array('key' => $key, 'value' => $value);
	}

	function generate_queues_additional($ast_version) {

		global $db;
		global $amp_conf;

		$additional = "";
		$output = "";
		$ast_ge_120 = version_compare($ast_version,'12','ge');
		// legacy but in case someone was using this we will leave it
		//TODO: abstract getters/setters from business logic
		$sql = "SELECT keyword,data FROM queues_details WHERE id='-1' AND keyword <> 'account'";
		$results = $db->getAll($sql, DB_FETCHMODE_ASSOC);
		if($db->IsError($results)) {
			die($results->getMessage());
		}
		foreach ($results as $result) {
			if (!$ver12 && trim($result['data']) == '') {
				continue;
			}
			$additional .= $result['keyword']."=".$result['data']."\n";
		}

		$devices = array();
		$device_results = core_devices_list('all','full',true);
		if (is_array($device_results)) {
			foreach ($device_results as $device) {
				if (!isset($devices[$device['user']]) && $device['devicetype'] == 'fixed') {
					$devices[$device['user']] = $device['dial'];
				}
			}
			unset($device_results);
		}

		$users = array();
		$user_results = FreePBX::Core()->listUsers();
		if (is_array($user_results)) {
			foreach ($user_results as $user) {
				$users[$user[0]] = $user[1];
			}
			unset($user_results);
		}

		$results = queues_list(true);
		foreach ($results as $result) {
			$qannouncements = 0;
			if($result[2] >0){
				if(function_exists('vqplus_queue_announcement')){
					$qannouncements = vqplus_queue_announcement($result[2]);
				}else {
					$qannouncements = 1;
				}
			}
			$output .= "[".$result[0]."]\n";

			// passing 2nd param 'true' tells queues_get to send back only queue_conf required params
			// and nothing else
			//
			$results2 = queues_get($result[0], true);

			if(empty($results2['context'])) {
				$results2['context'] = "";
			}
			// memebers is an array of members so we set it asside and remove it
			// and then generate each later
			//
			$members = $results2['member'];
			unset($results2['member']);

			// Queues cannot control their own recordings, it must now be
			// done through sub-record-check
			unset($results2['monitor-format']);
			unset($results2['recording']);
			//Unset Old commands Resolves FREEPBX-8610.
			unset($results2['monitor-join']);
			unset($results2['answered_elsewhere']);
			unset($results2['skip_joinannounce']);
			//These items still exist for backwards compatibility but are useless in 12+
			if($ast_ge_120){
				unset($results2['eventwhencalled']);
				unset($results2['eventmemberstatus']);
			}
			foreach ($results2 as $keyword => $data) {
				if ((trim($data) == '' && $keyword != "context") || substr($keyword, 0, 4) == "cron") {
					// Skip anything that's empty or not required
					continue;
				}

				// Some old commands have been removed. Make sure we
				// don't add them.
				switch($keyword){
					case 'monitor-join':
					case 'answered_elsewhere':
					case 'skip_joinannounce':
					case 'rvolume':
						continue(2);
					break;
					//We dontwant to write to queue conf file (FREEPBX-14194),its, not a queue variable
					case 'rvol_mode':
					        continue(2);
					break;

					case 'music':
						$keyword = 'musicclass';
					break;
				}

				if ($keyword == "retry" && ($data == "none" || $data == 0)) {
					$data = 1;
				}
				//we dont want to write the queue config if the queue is linked to callbackqueue because callback daemon will play the position annoucnement
				if($qannouncements == 1 ) {
					if($keyword =='announce-holdtime' || $keyword == 'announce-position'){
						$output .= $keyword."=no\n";
					}elseif($keyword == 'periodic-announce-frequency' ||$keyword == 'announce-frequency' || $keyword =='min-announce-frequency'){
						$output .= $keyword."=0\n";
					}else{
						$output .= $keyword."=".$data."\n";
					}
				}else{
					$output .= $keyword."=".$data."\n";
				}
			}


			// Now pull out all the memebers, one line for each
			//
			foreach ($members as $member) {
				preg_match("/^Local\/([\d]+)\@*/",$member,$matches);
				if (isset($matches[1]) && isset($users[$matches[1]])) {
					$name = sprintf('"%s"',$users[$matches[1]]);

					//str_replace(',','\,',$name);

					$qnostate = queues_get_qnostate($matches[1]);
					if ($qnostate == 'ignorestate') {
						freepbx_log(FPBX_LOG_NOTICE,"Ignoring State information for Queue Member: ".$matches[1]);
						$output .= "member=$member,$name\n";
					} else {
						$output .= "member=$member,$name,hint:".$matches[1]."@ext-local\n";
					}
				} else {
					$output .= "member=".$member."\n";
				}
			}

			if (isset($this->_queues_additional[$result[0]])) {
				foreach($this->_queues_additional[$result[0]] as $qsetting) {
					$output .= $qsetting['key'] . "=" . $qsetting['value'] . "\n";
				}
			}

			$output .= $additional."\n";
		}

		// Before returning the results, do an integrity check to see
		// if there are any truncated compound recrodings and if so
		// crate a noticication.
		//
		$nt = notifications::create($db);

		$compound_recordings = queues_check_compoundrecordings();
		if (empty($compound_recordings)) {
			$nt->delete('queues', 'COMPOUNDREC');
		} else {
			$str = _('Warning, there are compound recordings configured in '
				. 'one or more Queue configurations. Queues can not play these '
				. 'so they have been truncated to the first sound file. You '
				. 'should correct this problem.<br />Details:<br /><br />');
			foreach ($compound_recordings as $item) {
				$str .= sprintf(_("Queue - %s (%s): %s<br />"), $item['extension'], $item['descr'], $item['error']);
			}
			$nt->add_error('queues', 'COMPOUNDREC', _("Compound Recordings in Queues Detected"), $str);
		}
		return $output;
	}

	function generate_queues_general_additional($ast_version) {
		$output = '';

		if (isset($this->_queues_general) && is_array($this->_queues_general)) {
			foreach ($this->_queues_general as $values) {
				$output .= $values['key']."=".$values['value']."\n";
			}
		}
		return $output;
	}
}
