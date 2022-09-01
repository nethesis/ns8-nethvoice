<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

function queues_add(
	$account,
	$name,
	$password,
	$prefix,
	$goto,
	$agentannounce_id,
	$members,
	$joinannounce_id,
	$maxwait,
	$alertinfo='',
	$cwignore='0',
	$qregex='',
	$queuewait='0',
	$use_queue_context='0',
	$dynmembers = '',
	$dynmemberonly = 'no',
	$togglehint = '0',
	$qnoanswer = '0',
	$callconfirm = '0',
	$callconfirm_id = '',
	$monitor_type = '',
	$monitor_heard = '0',
	$monitor_spoken = '0',
	$answered_elsewhere = '0',
	$recording = 'dontcare',
	$rvolume = '',
	$rvol_mode=''
) {
 	global $db,$astman,$amp_conf;

	$ast_ge_11 = version_compare($amp_conf['ASTVERSION'] , '11', 'ge');
	$ast_ge_120 = version_compare($amp_conf['ASTVERSION'] , '12', 'ge');

	if (trim($account) == '') {
		echo "<script>javascript:alert('"._("Bad Queue Number, can not be blank")."');</script>";
		return false;
	}

	//add to extensions table
	if (empty($agentannounce_id)) {
		$agentannounce_id=NULL;
	}
	$fields = array(
		array($account,'maxlen',($_REQUEST['maxlen'])?$_REQUEST['maxlen']:'0',0),
		array($account,'joinempty',($_REQUEST['joinempty'])?$_REQUEST['joinempty']:'yes',0),
		array($account,'leavewhenempty',($_REQUEST['leavewhenempty'])?$_REQUEST['leavewhenempty']:'no',0),
		array($account,'strategy',($_REQUEST['strategy'])?$_REQUEST['strategy']:'ringall',0),
		array($account,'timeout',(isset($_REQUEST['timeout']))?$_REQUEST['timeout']:'15',0),
		array($account,'retry',(isset($_REQUEST['retry']) && $_REQUEST['retry'] != '')?$_REQUEST['retry']:'5',0),
		array($account,'wrapuptime',($_REQUEST['wrapuptime'])?$_REQUEST['wrapuptime']:'0',0),
		array($account,'announce-frequency',($_REQUEST['announcefreq'])?$_REQUEST['announcefreq']:'0',0),
		array($account,'min-announce-frequency',($_REQUEST['min-announce'])?$_REQUEST['min-announce']:'15',0),
		array($account,'announce-holdtime',($_REQUEST['announceholdtime'])?$_REQUEST['announceholdtime']:'no',0),
		array($account,'announce-position',($_REQUEST['announceposition'])?$_REQUEST['announceposition']:'no',0),
		array($account,'queue-youarenext',($_REQUEST['announceposition']=='no')?'silence/1':'queue-youarenext',0),  //if no, play no sound
		array($account,'queue-thereare',($_REQUEST['announceposition']=='no')?'silence/1':'queue-thereare',0),  //if no, play no sound
		array($account,'queue-callswaiting',($_REQUEST['announceposition']=='no')?'silence/1':'queue-callswaiting',0),  //if no, play no sound
		array($account,'queue-thankyou',($_REQUEST['announceposition']=='no')?'':'queue-thankyou',0),  //if no, play no sound
		array($account,'periodic-announce-frequency',($_REQUEST['pannouncefreq'])?$_REQUEST['pannouncefreq']:'0',0),
		array($account,'recording',($_REQUEST['recording'])?$_REQUEST['recording']:'dontcare',0),
		array($account,'monitor-join','yes',0),
		array($account,'weight',(isset($_REQUEST['weight']))?$_REQUEST['weight']:'0',0),
		array($account,'autofill',(!empty($_REQUEST['autofill']))?'yes':'no',0),
		array($account,'ringinuse',($cwignore == 2 || $cwignore == 3)?'no':'yes',0),
		array($account,'reportholdtime',(isset($_REQUEST['reportholdtime']))?$_REQUEST['reportholdtime']:'no',0),
		array($account,'autopause',(isset($_REQUEST['autopause']))?$_REQUEST['autopause']:'no',0),
		array($account,'autopausedelay',(isset($_REQUEST['autopausedelay']))?$_REQUEST['autopausedelay']:'0',0),
		array($account,'servicelevel',(isset($_REQUEST['servicelevel']))?$_REQUEST['servicelevel']:60,0),
		array($account,'memberdelay',(isset($_REQUEST['memberdelay']))?$_REQUEST['memberdelay']:'0',0),
		array($account,'timeoutrestart',(isset($_REQUEST['timeoutrestart']))?$_REQUEST['timeoutrestart']:'no',0),
		array($account,'skip_joinannounce',(isset($_REQUEST['skip_joinannounce']))?$_REQUEST['skip_joinannounce']:'',0),
		array($account,'answered_elsewhere',(isset($_REQUEST['answered_elsewhere']))?$_REQUEST['answered_elsewhere']:'0',0),
		array($account,'timeoutpriority',(isset($_REQUEST['timeoutpriority']))?$_REQUEST['timeoutpriority']:'app',0),
		array($account,'penaltymemberslimit',(isset($_REQUEST['penaltymemberslimit']))?$_REQUEST['penaltymemberslimit']:'0',0),
		array($account,'rvolume',(isset($_REQUEST['rvolume']))?$_REQUEST['rvolume']:'',0),
		array($account,'rvol_mode',(isset($_REQUEST['rvol_mode']))?$_REQUEST['rvol_mode']:'',0),
	);
	/*
	 * FREEPBX - 8216. As of Asterisk 12 eventmemberstatus and eventwhencalled are always true and
	 * are not a user option. These fields will only show up if the user is running version 11 or lower.
	 * TODO: Remove this code once we drop 11 support in the future
	 */
	if(!$ast_ge_120){
		$fields[] = array($account,'eventwhencalled',($_REQUEST['eventwhencalled'])?$_REQUEST['eventwhencalled']:$amp_conf['QUEUES_EVENTS_MEMEBER_STATUS_DEFAULT'],0);
		$fields[] = array($account,'eventmemberstatus',($_REQUEST['eventmemberstatus'])?$_REQUEST['eventmemberstatus']:$amp_conf['QUEUES_EVENTS_MEMEBER_STATUS_DEFAULT'],0);
	}

	// manage queue stats reset
	$cron_arr = array("cron_schedule", "cron_random", "cron_month", "cron_minute", "cron_hour", "cron_dow", "cron_dom");
	foreach ($cron_arr as $key => $value) {
		if (!empty($_REQUEST[$value])) {
			$fields[] = array($account, $value, $_REQUEST[$value], 0);
		}
	}

	if ($ast_ge_11) {
		$fields[] = array($account,'autopausebusy',(isset($_REQUEST['autopausebusy']))?$_REQUEST['autopausebusy']:'no',0);
		$fields[] = array($account,'autopauseunavail',(isset($_REQUEST['autopauseunavail']))?$_REQUEST['autopauseunavail']:'no',0);
	}

	if ($_REQUEST['music'] != 'inherit') {
		$fields[] = array(
			$account,
			'music',
			($_REQUEST['music'])?$_REQUEST['music']:'default',
			0);
	}

	//there can be multiple members
	if (isset($members)) {
		$count = 0;
		$members = array_unique($members);
		foreach ($members as $member) {
			$fields[] = array($account,'member',$member,$count);
			$count++;
		}
	}

	// set lazymembers when enabled
	if (!empty($_REQUEST['lazymembers'])) {
		$fields[] = array($account,'lazymembers', $_REQUEST['lazymembers'], 0);
	}

	$compiled = $db->prepare('INSERT INTO queues_details (id, keyword, data, flags) values (?,?,?,?)');
	$result = $db->executeMultiple($compiled,$fields);

	if($db->IsError($result)) {
		die_freepbx($result->getMessage()."<br><br>error adding to queues_details table");
	}
	$extension		= $account;
	$descr			= isset($name) ? $name:'';
	$grppre			= isset($prefix) ? $prefix:'';
	$alertinfo		= isset($alertinfo) ? $alertinfo:'';
	if (isset($joinannounce_id)) {
		if ($joinannounce_id == "None" || $joinannounce_id == "") {
			$joinannounce_id = NULL;
		}
	} else {
		$joinannounce_id = NULL;
	}
	$ringing		= isset($_REQUEST['rtone']) ? $_REQUEST['rtone']:0;
	if (isset($agentannounce_id)) {
		if ($agentannounce_id == "None" || $agentannounce_id == "") {
			$agentannounce_id = NULL;
		}
	} else {
		$agentannounce_id = NULL;
	}
	if (isset($callconfirm_id)) {
		if ($callconfirm_id == "None" || $callconfirm_id == "") {
			$callconfirm_id = NULL;
		}
	} else {
		$callconfirm_id = NULL;
	}
	$maxwait		= isset($maxwait) ? $maxwait:'';
	$password		= isset($password) ? $password:'';
	$ivr_id			= isset($_REQUEST['announcemenu']) ? $_REQUEST['announcemenu']:'none';
	if (isset($_REQUEST['breakouttype']) && $_REQUEST['breakouttype'] == 'callback') {
		$callback_id	= isset($_REQUEST['callback']) ? $_REQUEST['callback']:'none';
		$ivr_id		= 'none';
	} else {
		$callback_id    = 'none';
	}
	$dest			= isset($goto) ? $goto:'';
	$cwignore		= isset($cwignore) ? $cwignore:'0';
	$queuewait		= isset($queuewait) ? $queuewait:'0';
	$qregex			= isset($qregex) ? $qregex:'';
	$use_queue_context = isset($use_queue_context) ? $use_queue_context:'0';
	if (isset($togglehint) && $togglehint == "") {
		$togglehint = 0;
	}
	if (isset($callconfirm) && $callconfirm == "") {
		$callconfirm = 0;
	}
	$qnoanswer		= isset($qnoanswer) ? $qnoanswer:'0';
	$monitor_type	= isset($monitor_type) ? $monitor_type:'';
	$monitor_heard	= isset($monitor_heard) ? $monitor_heard:'0';
	$monitor_spoken	= isset($monitor_spoken) ? $monitor_spoken:'0';
	// Assumes it has just been deleted
	$sql = "INSERT INTO queues_config (
			extension, descr, grppre, alertinfo, joinannounce_id,
			ringing, agentannounce_id, maxwait, password, ivr_id,
			callback_id, dest, cwignore, qregex, queuewait,
			use_queue_context, togglehint, qnoanswer, callconfirm,
			callconfirm_id, monitor_type, monitor_heard,
			monitor_spoken
		) VALUES (
			?, ?, ?, ?, ?,
			?, ?, ?, ?, ?,
			?, ?, ?, ?, ?,
			?, ?, ?, ?,
			?, ?, ?,
			?
		)";
	$sth = $db->prepare($sql);
	$values = array(
		$extension, $descr, $grppre, $alertinfo, $joinannounce_id,
		$ringing, $agentannounce_id, $maxwait, $password, $ivr_id,
		$callback_id, $dest, $cwignore, $qregex, $queuewait,
		$use_queue_context, $togglehint, $qnoanswer, $callconfirm,
		$callconfirm_id, $monitor_type, $monitor_heard,
		$monitor_spoken
	);
	$results = $sth->execute($values);

  // store dynamic member data in astDB
	if ($astman) {
		$dynmembers = array_unique($dynmembers);
		foreach($dynmembers as $member){
			$mem = explode(',',$member);
			if (isset($mem[0]) && trim($mem[0]) != '') {
				$penalty = isset($mem[1]) && ctype_digit(trim($mem[1])) ? $mem[1] : 0;
 				$astman->database_put('QPENALTY/'.$account.'/agents',trim($mem[0]),trim($penalty));
			}
		}
		$astman->database_put('QPENALTY/'.$account,'dynmemberonly',$dynmemberonly);
	} else {
		fatal("Cannot connect to Asterisk Manager with ".$amp_conf["AMPMGRUSER"]."/".$amp_conf["AMPMGRPASS"]);
	}

	return true;
}

function queues_del($account) {
	global $db, $astman, $amp_conf;

	$sql = "DELETE FROM queues_details WHERE id = '$account'";
	$result = $db->query($sql);
	if($db->IsError($result)) {
		die_freepbx($result->getMessage().$sql);
    }
	$sql = "DELETE FROM queues_config WHERE extension = '$account'";
	$result = $db->query($sql);
	if($db->IsError($result)) {
 		die_freepbx($result->getMessage().$sql);
    }

	//remove dynamic memebers from astDB
	if ($astman) {
	  $astman->database_deltree('QPENALTY/'.$account);
	} else {
		fatal("Cannot connect to Asterisk Manager with ".$amp_conf["AMPMGRUSER"]."/".$amp_conf["AMPMGRPASS"]);
	}
}

//get the existing queue extensions
//
function queues_list($listall=false) {
	global $db;
	$sql = "SELECT extension, descr,callback_id,use_queue_context FROM queues_config ORDER BY extension";
	$results = $db->getAll($sql);
	if($db->IsError($results)) {
		$results = array();
	}

	foreach($results as $result){
		if ($listall || checkRange($result[0])){
			$extens[] = array($result[0],$result[1],$result[2],$result[3]);
		}
	}
	if (isset($extens)) {
		return $extens;
	} else {
		return array();
	}
}

function queues_get_static_members($account = '') {
	global $db;
	if ($account != '') {
		$sql = "SELECT data FROM queues_details WHERE id = $account AND keyword = 'member' ORDER BY flags";
		return $db->getCol($sql);
	} else {
		$sql = "SELECT id, data FROM queues_details WHERE keyword = 'member' ORDER BY id, flags";
		$res = $db->getAll($sql,DB_FETCHMODE_ASSOC);
		$mem_hash = array();
		foreach ($res as $qmp) {
			$mem_hash[$qmp['id']][] = $qmp['data'];
		}
		return $mem_hash;
	}
}

function queues_get($account, $queues_conf_only=false) {
	global $db,$astman,$amp_conf;

    if ($account == "") {
	    return array();
    }

	$account = q($account);
	//get all the variables for the queue
	$sql = "SELECT keyword,data FROM queues_details WHERE id = $account";
	$results = $db->getAssoc($sql);
	if (empty($results)) {
		return array();
	}

	//okay, but there can be multiple member variables ... do another select for them
	$results['member'] = queues_get_static_members($account);

	//if 'queue-youarenext=queue-youarenext', then assume we want to announce position
	if (!$queues_conf_only) {
		if(isset($results['queue-youarenext']) && $results['queue-youarenext'] == 'queue-youarenext') {
			$results['announce-position'] = 'yes';
		} else {
			$results['announce-position'] = 'no';
		}
	}

	//if 'eventmemberstatusoff=Yes', then assume we want to 'eventmemberstatus=no'
	if(isset($results['eventmemberstatusoff'])) {
		if (strtolower($results['eventmemberstatusoff']) == 'yes') {
			$results['eventmemberstatus'] = 'no';
		} else {
			$results['eventmemberstatus'] = 'yes';
		}
	} elseif (!isset($results['eventmemberstatus'])){
		$results['eventmemberstatus'] = 'no';
	}

	if ($queues_conf_only) {
		$sql = "SELECT ivr_id, callback_id FROM queues_config WHERE extension = $account";
		$config = sql($sql, "getRow",DB_FETCHMODE_ASSOC);
	} else {
		$sql = "SELECT * FROM queues_config WHERE extension = $account";
		$config = sql($sql, "getRow",DB_FETCHMODE_ASSOC);

		$results['prefix']        = $config['grppre'];
		$results['alertinfo']     = $config['alertinfo'];
		$results['agentannounce_id'] = $config['agentannounce_id'];
		$results['maxwait']       = $config['maxwait'];
		$results['name']          = $config['descr'];
		$results['joinannounce_id']  = $config['joinannounce_id'];
		$results['password']      = $config['password'];
		$results['goto']          = $config['dest'];
		$results['announcemenu']  = $config['ivr_id'];
		$results['callback']      = $config['callback_id'];
		$results['rtone']         = $config['ringing'];
		$results['cwignore']      = $config['cwignore'];
		$results['qregex']        = $config['qregex'];
		$results['queuewait']     = $config['queuewait'];
		$results['use_queue_context'] = $config['use_queue_context'];
		$results['togglehint']    = $config['togglehint'];
		$results['qnoanswer']     = $config['qnoanswer'];
		$results['callconfirm']    = $config['callconfirm'];
		$results['callconfirm_id'] = $config['callconfirm_id'];
		$results['monitor_type']   = $config['monitor_type'];
		$results['monitor_heard']   = $config['monitor_heard'];
		$results['monitor_spoken']   = $config['monitor_spoken'];

		// TODO: why the str_replace?
    		//
		if ($astman) {
			$account = str_replace("'",'',$account);
			//get dynamic members priority from astDB
			$get = $astman->database_show('QPENALTY/'.$account.'/agents');
			if (empty($get)) {
				$astman->useCaching = false;
				$get = $astman->database_show('QPENALTY/'.$account.'/agents');
			}
			if($get){
				foreach($get as $key => $value){
					$key1=explode('/',$key);
					$mem[$key1[4]]=$value;
				}
				foreach($mem as $mem => $pnlty){
					$dynmem[]=$mem.','.$pnlty;
				}
				$results['dynmembers']=implode("\n",$dynmem);
			} else {
				$results['dynmembers']='';
			}
			$results['dynmemberonly'] = $astman->database_get('QPENALTY/'.$account,'dynmemberonly');
		} else {
			fatal("Cannot connect to Asterisk Manager with ".$amp_conf["AMPMGRUSER"]."/".$amp_conf["AMPMGRPASS"]);
		}
	}

	$results['context'] = '';
	$results['periodic-announce'] = '';

	if ($config['ivr_id'] != 'none' && $config['ivr_id'] != '') {
		if (function_exists('ivr_get_details')) {
			$results['context'] = "ivr-".$config['ivr_id'];
			$arr = ivr_get_details($config['ivr_id']);
			if( isset($arr['announcement']) && $arr['announcement'] != '') {
				$periodic = recordings_get_file($arr['announcement']);
				// We need to strip off all but the first sound file of any compound sound files
				$periodic_arr = explode("&", $periodic);
				$results['periodic-announce'] = $periodic_arr[0];
			}
		}
	} else if ($config['callback_id'] != 'none' && $config['callback_id'] != '') {
		if (function_exists('vqplus_callback_get')) {
			$results['context'] = "queuecallback-".$config['callback_id'];
			$arr = vqplus_callback_get($config['callback_id']);

			if (isset($arr[0]) && is_array($arr[0])) {
				/* Vqplus 13 moved to BMO, which made the return value format different. */
				$arr = $arr[0];
			}

			if (isset($arr['announcement']) && $arr['announcement'] != '') {
				$periodic = recordings_get_file($arr['announcement']);
				// We need to strip off all but the first sound file of any compound sound files
				$periodic_arr = explode("&", $periodic);
				$results['periodic-announce'] = $periodic_arr[0];
			}
		}
	}
	return $results;
}

?>
