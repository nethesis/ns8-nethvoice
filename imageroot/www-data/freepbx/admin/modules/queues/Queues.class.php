<?php
namespace FreePBX\modules;
class Queues implements \BMO {
	public function __construct($freepbx = null) {
		if ($freepbx == null) {
			throw new Exception("Not given a FreePBX Object");
		}
		$this->FreePBX = $freepbx;
		$this->db = $freepbx->Database;
	}
		public function install() {}
		public function uninstall() {}
		public function backup() {}
		public function restore($backup) {}
		public function doConfigPageInit($page) {
			$request = $_REQUEST;
			isset($request['action'])?$action = $request['action']:$action='';
			//the extension we are currently displaying
			isset($request['extdisplay'])?$extdisplay=$request['extdisplay']:$extdisplay='';
			isset($request['account'])?$account = $request['account']:$account='';
			isset($request['name'])?$name = $request['name']:$name='';
			isset($request['password'])?$password = $request['password']:$password='';
			isset($request['agentannounce_id'])?$agentannounce_id = $request['agentannounce_id']:$agentannounce_id='';
			isset($request['prefix'])?$prefix = $request['prefix']:$prefix='';
			isset($request['alertinfo'])?$alertinfo = $request['alertinfo']:$alertinfo='';
			isset($request['rvol_mode'])?$rvol_mode = $request['rvol_mode']:$rvol_mode='dontcare';
			isset($request['joinannounce_id'])?$joinannounce_id = $request['joinannounce_id']:$joinannounce_id='';
			$maxwait = isset($request['maxwait'])?$request['maxwait']:'';
			$cwignore = isset($request['cwignore'])?$request['cwignore']:'0';
			$queuewait = isset($request['queuewait'])?$request['queuewait']:'0';
			$rtone = isset($request['rtone'])?$request['rtone']:'0';
			$qregex = isset($request['qregex'])?$request['qregex']:'';
			$weight = isset($request['weight'])?$request['weight']:'0';
			$autofill = isset($request['autofill'])?$request['autofill']:'no';
			$togglehint = isset($request['togglehint'])?$request['togglehint']:0;
			$dynmemberonly = isset($request['dynmemberonly'])?$request['dynmemberonly']:'no';
			$use_queue_context = isset($request['use_queue_context'])?$request['use_queue_context']:'0';
			$exten_context = "from-queue";
			$qnoanswer = isset($request['qnoanswer'])?$request['qnoanswer']:'0';
			$callconfirm = isset($request['callconfirm'])?$request['callconfirm']:'0';
			$callconfirm_id = isset($request['callconfirm_id'])?$request['callconfirm_id']:'';
			$monitor_type = isset($request['monitor_type'])?$request['monitor_type']:'';
			$monitor_heard = isset($request['monitor_heard'])?$request['monitor_heard']:'0';
			$monitor_spoken = isset($request['monitor_spoken'])?$request['monitor_spoken']:'0';
			$answered_elsewhere = isset($request['answered_elsewhere'])?$request['answered_elsewhere']:'0';
			$skip_joinannounce = isset($request['skip_joinannounce'])?$request['skip_joinannounce']:'';

			//cron code
			$cron_schedule = isset($request['cron_schedule'])?$request['cron_schedule']:'never';
			$cron_minute = isset($request['cron_minute'])?$request['cron_minute']:'';
			$cron_hour = isset($request['cron_hour'])?$request['cron_hour']:'';
			$cron_dow = isset($request['cron_dow'])?$request['cron_dow']:'';
			$cron_month = isset($request['cron_month'])?$request['cron_month']:'';
			$cron_dom = isset($request['cron_dom'])?$request['cron_dom']:'';
			$cron_random = isset($request['cron_random'])?$request['cron_random']:false;

			if (isset($request['goto0']) && isset($request[$request['goto0']."0"])) {
				$goto = $request[$request['goto0']."0"];
			} else {
				$goto = '';
			}
			if (isset($request["members"])) {
				$members = explode("\n",$request["members"]);

				if (!$members) {
					$members = null;
				}

				foreach (array_keys($members) as $key) {
					//trim it
					$members[$key] = trim($members[$key]);

					// check if an agent (starts with a or A)

					$exten_prefix = strtoupper(substr($members[$key],0,1));
					$this_member = preg_replace("/[^0-9#\,*]/", "", $members[$key]);
					switch ($exten_prefix) {
					case 'A':
						$exten_type = 'Agent';
						break;
					case 'P':
						$exten_type = 'PJSIP';
						break;
					case 'S':
						$exten_type = 'SIP';
						break;
					case 'X':
						$exten_type = 'IAX2';
						break;
					case 'Z':
						$exten_type = 'ZAP';
						break;
					case 'D':
						$exten_type = 'DAHDI';
						break;
					default;
						$exten_type = 'Local';
					}

					$penalty_pos = strrpos($this_member, ",");
					if ( $penalty_pos === false ) {
							$penalty_val = 0;
					} else {
							$penalty_val = substr($this_member, $penalty_pos+1); // get penalty
							$this_member = substr($this_member,0,$penalty_pos); // clean up ext
							$this_member = preg_replace("/[^0-9#*]/", "", $this_member); //clean out other ,'s
							$penalty_val = preg_replace("/[^0-9*]/", "", $penalty_val); // get rid of #'s if there
							$penalty_val = ($penalty_val == "") ? 0 : $penalty_val;
					}

					// remove blanks // prefix with the channel
					if (empty($this_member))
						unset($members[$key]);
					else {
						switch($exten_type) {
							case 'Agent':
							case 'SIP':
							case 'IAX2':
							case 'PJSIP':
							case 'ZAP':
							case 'DAHDI':
								$members[$key] = "$exten_type/$this_member,$penalty_val";
								break;
							case 'Local':
								$members[$key] = "$exten_type/$this_member@$exten_context/n,$penalty_val";
						}
					}
				}
				// check for duplicates, and re-sequence
				// $members = array_values(array_unique($members));
			}

			if (isset($request["dynmembers"])) {
				$dynmembers=explode("\n",$request["dynmembers"]);
				if (!$dynmembers) {
					$dynmembers = null;
				}
			}


			// do if we are submitting a form
			if(isset($request['action'])){
				//check if the extension is within range for this user
				if (isset($account) && !checkRange($account)){
					echo "<script>javascript:alert('"._("Warning! Extension")." $account "._("is not allowed for your account.")."');</script>";
				} else {

					//if submitting form, update database
					switch ($action) {
						case "add":
							$conflict_url = array();
							$usage_arr = framework_check_extension_usage($account);
							if (!empty($usage_arr)) {
								$conflict_url = framework_display_extension_usage_alert($usage_arr);
							} else {
								queues_add($account,$name,$password,$prefix,$goto,$agentannounce_id,$members,$joinannounce_id,$maxwait,$alertinfo,$cwignore,$qregex,$queuewait,$use_queue_context,$dynmembers,$dynmemberonly,$togglehint,$qnoanswer, $callconfirm, $callconfirm_id, $monitor_type, $monitor_heard, $monitor_spoken, $answered_elsewhere);
								needreload();
								$this_dest = queues_getdest($account);
								\fwmsg::set_dest($this_dest[0]);
								$_REQUEST['extdisplay'] = $account;
							}
						break;
						case "delete":
							queues_del($account);
							unset($_REQUEST['view']);
							unset($_REQUEST['extdisplay']);
							needreload();
						break;
						case "edit":  //just delete and re-add
							queues_del($account);
							queues_add($account,$name,$password,$prefix,$goto,$agentannounce_id,$members,$joinannounce_id,$maxwait,$alertinfo,$cwignore,$qregex,$queuewait,$use_queue_context,$dynmembers,$dynmemberonly,$togglehint,$qnoanswer, $callconfirm, $callconfirm_id, $monitor_type, $monitor_heard, $monitor_spoken, $answered_elsewhere);
							needreload();
						break;
					}
				}
			}
	}

	public function search($query, &$results) {
		if(!ctype_digit($query)) {
			$sql = "SELECT * FROM queues_config WHERE descr LIKE ?";
			$sth = $this->db->prepare($sql);
			$sth->execute(array("%".$query."%"));
			$rows = $sth->fetchAll(\PDO::FETCH_ASSOC);
			foreach($rows as $row) {
				$results[] = array("text" => $row['descr'] . " (".$row['extension'].")", "type" => "get", "dest" => "?display=queues&view=form&extdisplay=".$row['extension']);
			}
		} else {
			$sql = "SELECT * FROM queues_config WHERE extension LIKE ?";
			$sth = $this->db->prepare($sql);
			$sth->execute(array("%".$query."%"));
			$rows = $sth->fetchAll(\PDO::FETCH_ASSOC);
			foreach($rows as $row) {
				$results[] = array("text" => _("Queue")." ".$row['extension'], "type" => "get", "dest" => "?display=queues&view=form&extdisplay=".$row['extension']);
			}
		}
	}

	public function getActionBar($request){
		switch($request['display']){
			case 'queues':
				$buttons = array(
					'delete' => array(
						'name' => 'delete',
						'id' => 'delete',
						'value' => _('Delete')
					),
					'submit' => array(
						'name' => 'submit',
						'id' => 'submit',
						'value' => _('Submit')
					),
					'reset' => array(
						'name' => 'reset',
						'id' => 'reset',
						'value' => _('Reset')
					)
				);
			break;
		}
		if (empty($request['extdisplay'])) {
			unset($buttons['delete']);
		}
		$view = isset($request['view'] )?$request['view']:'';
		if($view != 'form'){
			$buttons = array();
		}
		return $buttons;
	}
	public function hookTabs(){
		$module_hook = \moduleHook::create();
		$mods = $this->FreePBX->Hooks->processHooks();
		$sections = array();
		foreach($mods as $mod => $contents) {
			if(empty($contents)) {
				continue;
			}
			if(is_array($contents)) {
				foreach($contents as $content) {
					if(!isset($sections[$content['rawname']])) {
						$sections[$content['rawname']] = array(
							"title" => $content['title'],
							"rawname" => $content['rawname'],
							"content" => $content['content']
						);
					} else {
						$sections[$content['rawname']]['content'] .= $content['content'];
					}
				}
			} else {
				if(!isset($sections[$mod])) {
					$sections[$mod] = array(
						"title" => ucfirst(strtolower($mod)),
						"rawname" => $mod,
						"content" => $contents
					);
				} else {
					$sections[$mod]['content'] .= $contents;
				}
			}
		}
		$hookTabs = '';
		$hookcontent = '';
		foreach ($sections as $data) {
			$hookTabs .= '<li role="presentation"><a href="#queuehook'.$data['rawname'].'" aria-controls="queuehook'.$data['rawname'].'" role="tab" data-toggle="tab">'.$data['title'].'</a></li>';
			$hookcontent .= '<div role="tabpanel" class="tab-pane" id="queuehook'.$data['rawname'].'">';
			$hookcontent .=	 $data['content'];
			$hookcontent .= '</div>';
		}
		return array("hookTabs" => $hookTabs, "hookContent" => $hookcontent, "oldHooks" => $module_hook->hookHtml);
	}
	public function getRightNav($request) {
		if($request['view']=="form"){
			return load_view(__DIR__."/views/bootnav.php",array());
		}
	}
	public function ajaxRequest($req, &$setting) {
       switch ($req) {
           case 'getJSON':
               return true;
           break;
           default:
               return false;
           break;
       }
   }
   public function ajaxHandler(){
       switch ($_REQUEST['command']) {
           case 'getJSON':
               switch ($_REQUEST['jdata']) {
                   case 'grid':
									 	$ret = array();
                     foreach($this->listQueues(true) as $q){
											 $ret[] = array("extension" => $q[0], "description" => $q[1]);
										 }
										 return $ret;
                   break;

                   default:
                       return false;
                   break;
               }
           break;

           default:
               return false;
           break;
       }
   }
	 public function listQueues($listall=false){
		 $sql = "SELECT extension, descr FROM queues_config ORDER BY extension";
		 $stmt = $this->db->prepare($sql);
		 $stmt->execute();
		 $results = $stmt->fetchall(\PDO::FETCH_BOTH);
		 foreach($results as $result){
			 if ($listall || checkRange($result[0])){
				 $extens[] = array($result[0],$result[1]);
			 }
		 }
		 if (isset($extens)) {
			 return $extens;
		 } else {
			 return array();
		 }
	 }

	public function getDynMembersOfQueue($queue) {
		$get = $this->FreePBX->astman->database_show('QPENALTY/'.$queue.'/agents');
		$dynmem =  array();
		if($get){
			foreach($get as $key => $value){
				$key1 = explode('/',$key);
				$mem[$key1[4]] = $value;
			}
			foreach($mem as $mem => $pnlty){
				$dynmem[] = $mem ;
			}
		}
		return $dynmem;
	}

	public function getQueuesDetails($queue) {
		$data = $this->FreePBX->astman->Command('queue show '.$queue);

		$sections = [];
		$current = false;
		$buffer = [];
		$queuestats = [];
		foreach (preg_split("/\\r\\n|\\r|\\n/", $data['data']) as $line) {
			if (strpos($line, "Privilege: ") === 0) {
				continue;
			}
			if (preg_match('/^(.+) has \d* calls/', $line, $out)) {
				if ($current !== false) {
					$sections[$current] = $buffer;
					$buffer = [];
				}
				$current = (string) $out[1];
			}
			$buffer[] = $line;
		}
		if ($current !== false) {
			$sections[$current] = $buffer;
		}
		if(!empty($sections)) {
			foreach($sections as $qnum => $lines)
			{
				$tmparr = $this->parseQueueVal($lines);
				$queuestats[$qnum] = $tmparr;
			}
		}
		return $queuestats;
	}

	public function parseQueueVal($queue) {
		$header = array_shift($queue);
		if (!preg_match('/(.+) has (\d+) call.+\((.+) holdtime, (.+) talktime\), W:(\d+), C:(\d+), A:(\d+), SL:(.+)% within (.+)$/', $header, $out)) {
			return false;
		}

		$sql = "SELECT * FROM queues_config WHERE extension = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($out[1]));
		$rows = $sth->fetchAll(\PDO::FETCH_ASSOC);
		foreach($rows as $row) {
			$qName = $row['descr'];
		}

		$retarr = [
			"queue" => $out[1], "name" => $qName, "waiting" => $out[2], "holdtime" => $out[3], "talktime" => $out[4],
			"weight" => $out[5], "totalcalls" => ($out[6] + $out[7]), "answered" => $out[6],"abandoned" => $out[7], "members" => [], "callers" => [],
		];

		$callers = false;
		foreach ($queue as $oline) {
			$line = trim($oline);
			if (!$line) {
				continue;
			}
			if ($line === "Callers:" || $line === "No Callers") {
				$callers = true;
				continue;
			}
			if ($callers) {
				$retarr['callers'][] = trim($line);
			} else {
				$tmp = $this->parseMemberVal($line);
				if(empty($tmp['hint'])) {
					continue;
				}
				$retarr['members'][$tmp['hint']] = $tmp['data'];
			}
		}
		return $retarr;
	}

	public function parseMemberVal($line) {
		if (!preg_match("/(.+)\((Local\/.+from-queue\/n) from hint:(\d+)@ext-local\) (.+) has taken (.+$)/", $line, $out)) {
			$retarr = ["user" => "", "localchan" => "", "hint" => "", "callcount" => "", "lastcall" => "", "incall" => "", "ispaused" => ""];
			return ['hint' => '', 'data' => $retarr];
		}
		if (strpos($out[5], "no") === 0) {
			$retarr =  [ "user" => trim($out[1]), "localchan" => $out[2], "hint" => $out[3], "callcount" => 0, "lastcall" => "Never" ];
		} else {
			$tmparr = explode(" ", $out[5]);
			$retarr =  [ "user" => trim($out[1]), "localchan" => $out[2], "hint" => $out[3], "callcount" => (int) $tmparr[0], "lastcall" => $tmparr[4] ];
		}

		$retarr['incall'] = (strpos($out[4], "(in call)") !== false);
		$retarr['ispaused'] = (strpos($out[4], "(paused") !== false);

		return ['hint' => $retarr['hint'], 'data' => $retarr];
	}

	public function queues_member_login($queue, $user, $state) {
		$astman = $this->FreePBX->astman;

		$interface = "Local/" . $user . "@from-queue/n";

		if ($state) {
			$penalty = $astman->database_get("QPENALTY", $queue . "/agents/" . $user);
			$cidname = $astman->database_get('AMPUSER', $user . '/cidname');
			$cidname = $astman->database_get('AMPUSER', $user . '/cidname');

			$ret = $astman->send_request("QueueAdd", array(
				"Queue" => $queue,
				"Interface" => $interface,
				"Penalty" => $penalty,
				"MemberName" => $cidname,
				"StateInterface" => "hint:" . $user . "@ext-local"
			));
		} else {
			$ret = $astman->send_request("QueueRemove", array(
				"Queue" => $queue,
				"Interface" => $interface
			));
		}

		$devices = $astman->database_get("AMPUSER", $user . "/device");

		$device_arr = explode('&', $devices);
		foreach ($device_arr as $device) {
			$ret = $astman->set_global($this->FreePBX->Config->get_conf_setting('AST_FUNC_DEVICE_STATE') . "(Custom:QUEUE" . $device . "*" . $queue . ")", ($state ? 'INUSE' : 'NOT_INUSE'));
		}
	}

	public function queuesMemberPause($queue, $user, $state, $reason = null) {
		$astman = $this->FreePBX->astman;
		$interface = "Local/" . $user . "@from-queue/n";
		$state = $state ? 1 : 0 ;
		$ret = $astman->send_request("QueuePause", array(
			"Interface" => $interface,
			"Paused" => $state,
			"Queue" => $queue,
			"Reason" => $reason
		));
	}
}
