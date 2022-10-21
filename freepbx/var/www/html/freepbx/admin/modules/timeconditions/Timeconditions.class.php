<?php
namespace FreePBX\modules;
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.

class Timeconditions implements \BMO {
	public function __construct($freepbx = null) {
		if ($freepbx == null) {
			throw new Exception("Not given a FreePBX Object");
		}
		$this->FreePBX = $freepbx;
		$this->db = $freepbx->Database;
		$this->astman = $freepbx->astman;
		$this->errormsg ='';
	}
	public function install() {
		$this->cleanuptcmaint();
		$sql = "DELETE FROM timegroups_details WHERE timegroupid = '0'";
		$sth = $this->db->prepare($sql);
		$sth->execute();
	}
	public function uninstall() {}
	public function backup() {}
	public function restore($backup) {}
	public function doConfigPageInit($page) {
		$request = $_REQUEST;
		switch($page) {
			case "timeconditions":
				isset($request['action'])?$action = $request['action']:$action='';
				isset($request['itemid'])?$itemid=$request['itemid']:$itemid='';
				isset($request['view'])?$view=$request['view']:$view='';
				$invert_hint = isset($request['invert_hint'])?$request['invert_hint']:'0';
				$fcc_password = isset($request['fcc_password'])?$request['fcc_password']:'';
				//if submitting form, update database
				switch ($action) {
					case "add":
						$itemid = $this->addTimeCondition($request);
						$_REQUEST['extdisplay'] = $itemid;
						\needreload();
					break;
					case "delete":
						$this->delTimeCondition($itemid);
						$_REQUEST['extdisplay'] = NULL;
						\needreload();
					break;
					case "edit":  //just delete and re-add
						$this->editTimeCondition($itemid,$request);
						\needreload();
					break;
					case "duplicate":
						$this->duplicateTimeCondition($itemid,$request);
						\needreload();
					break;
				}
			break;
			case "timegroups":
				$action= isset($request['action'])?$request['action']:null;
				$timegroup= isset($request['extdisplay'])?$request['extdisplay']:null;
				$description= isset($request['description'])?htmlspecialchars_decode($request['description']):null;
				$times = isset($request['times'])?$request['times']:null;
				switch($action){
					case 'duplicate':
						$this->duplicateTimeGroup($description,$times);
						unset($_REQUEST['view']);
						break;
					case 'add':
						$this->addTimeGroup($description,$times);
						unset($_REQUEST['view']);
						break;
					case 'edit':
						$this->editTimeGroup($timegroup,$description);
						$this->editTimes($timegroup,$times);
						unset($_REQUEST['view']);
						break;
					case 'del':
						$usage =  timeconditions_timegroups_list_usage($timegroup);
						if(isset($usage) && sizeof($usage) >= 1){
							$this->errormsg = _("Could not delete time group as it is in use");
							return;
						}
						$this->delTimeGroup($timegroup);
						unset($_REQUEST['view']);
						break;
					case 'getJSON':
						header('Content-Type: application/json');
						switch ($request['jdata']) {
							case 'grid':
								$timegroupslist = timeconditions_timegroups_list_groups();
								$rdata = array();
								foreach($timegroupslist as $tg){
									$rdata[] = array('text' => $tg['text'],'value' => $tg['value'], 'link' => array($tg['text'],$tg['value']));
								}
								echo json_encode($rdata);
								exit();
								break;
							default:
								echo json_encode(array("error"=>"Unknown Request"));
								exit();
								break;
						}
						break;
				}
			break;
		}
	}

	/**
	 * Gets rid of the millions of rows of tc-maint
	 * slowly over time
	 */
	public function cleanuptcmaint($limit = 4000) {
		$ASTVARLIBDIR = $this->FreePBX->Config->get("ASTVARLIBDIR");
		foreach($this->FreePBX->Cron->getAll() as $cron) {
			$str = str_replace("/", "\/", $ASTVARLIBDIR."/bin/cleanuptcmaint.php");
			if(preg_match("/cleanuptcmaint.php$/",$cron)) {
				$this->FreePBX->Cron->remove($cron);
			}
		}
		try {
			$dbh = $this->FreePBX->Cel->cdrdb;
			$limit = !empty($limit) ? " LIMIT ".$limit : "";
			$del = $dbh->prepare("DELETE from asteriskcdrdb.cel WHERE context LIKE '%tc-maint%'".$limit);
			$del->execute();
			$count = $del->rowCount();
			if($count > 0 && !empty($limit)) {
				$this->FreePBX->Cron->add("0 */6 * * * ".$ASTVARLIBDIR."/bin/cleanuptcmaint.php");
				return true;
			}
		} catch(\Exception $e) {
			return;
		}
		return false;
	}

	/**
	 * Update or remove the TC-Maint cron job
	 * @return [type]           [description]
	 */
	public function updateCron() {
		$ASTVARLIBDIR = $this->FreePBX->Config->get("ASTVARLIBDIR");
		$TCMAINT = $this->FreePBX->Config->get("TCMAINT");
		$TCINTERVAL = $this->FreePBX->Config->get("TCINTERVAL");

		switch($TCINTERVAL) {
			case "900":
			case "600":
			case "300":
			case "240":
			case "180":
			case "120":
				$t = $TCINTERVAL / 60;
				$time = "*/".$t." * * * *";
			break;
			case "60":
			default:
				$time = "* * * * *";
			break;
		}
		$line = $time." [ -x ".$ASTVARLIBDIR."/bin/schedtc.php ] && ".$ASTVARLIBDIR."/bin/schedtc.php";

		//TODO: fix this when Config hooks are fully implemented
		$removed = false;
		$found = false;
		foreach($this->FreePBX->Cron->getAll() as $cron) {
			$str = str_replace("/", "\/", $ASTVARLIBDIR."/bin/schedtc.php");
			if(preg_match("/schedtc.php/",$cron)) {
				$found = true;
				if(!$TCMAINT || $line != $cron) {
					$removed = true;
					$this->FreePBX->Cron->remove($cron);
				}
			}
		}
		if($TCMAINT && (!$found || $removed)) {
			$this->FreePBX->Cron->add($line);
		}
	}

	public function getActionBar($request) {
		switch($request['display']) {
			case 'timeconditions':
			case 'timegroups':
				$buttons = array(
					'delete' => array(
						'name' => 'delete',
						'id' => 'delete',
						'value' => _('Delete')
					),
					'reset' => array(
						'name' => 'reset',
						'id' => 'reset',
						'value' => _('Reset')
					),
					'duplicate' => array(
						'name' => 'duplicate',
						'id' => 'duplicate',
						'value' => _('Duplicate')
					),
					'submit' => array(
						'name' => 'submit',
						'id' => 'submit',
						'value' => _('Submit')
					)
				);
				if (empty($request['itemid']) && $request['display'] == 'timeconditions') {
					unset($buttons['delete']);
				}
				if (empty($request['extdisplay']) && $request['display'] == 'timegroups') {
					unset($buttons['delete']);
				}
				if ($request['view'] != 'form'){
					unset($buttons);
				}
			break;
		}
		return $buttons;
	}
	public function serverTime(){
		return localtime();
	}
	public function ajaxRequest($req, &$setting) {
		switch ($req) {
			case 'getGroups':
			case 'getJSON':
				return true;
			break;
			default:
				return false;
			break;
		}
	}
	public function ajaxHandler(){
		$request = $_REQUEST;
		switch ($_REQUEST['command']) {
			case 'getGroups':
				$sql = 'SELECT id FROM timegroups_groups order by id desc limit 1';
				$sth = $this->db->prepare($sql);
				$sth->execute();
				$row = $sth->fetch(\PDO::FETCH_ASSOC);
				$timegroupslist = $this->listTimegroups(false, true);
				return array("status" => true, "groups" => $timegroupslist, "last" => $row['id']);
			break;
			case 'getJSON':
			switch ($request['jdata']) {
				case 'tggrid':
					$timegroupslist = $this->listTimegroups(false, true);
					$rdata = array();
					foreach($timegroupslist as $tg){
					$rdata[] = array('text' => $tg['text'],'value' => $tg['value'], 'link' => array($tg['text'],$tg['value']));
					}
					return $rdata;
				case 'tcgrid':
					$timeconditions = $this->listTimeconditions();
					$timegroups = $this->listTimegroups();
					$tgs = array();
					foreach($timegroups as $tg){
						$tgs[$tg['value']] = $tg['text'];
					}
					$tcs = $this->astman->database_show("TC");
					foreach ($timeconditions as $key => $value) {
						$id = $value['timeconditions_id'];
						$state = isset($tcs['/TC/'.$id]) ? $tcs['/TC/'.$id] : '';
						$tgstime = isset($tgs[$value['time']])?$tgs[$value['time']]:'';
						$timeconditions[$key]['group'] = $tgstime;
						$timeconditions[$key]['state'] = $state;
					}
					return array_values($timeconditions);
				default:
					return false;
			}

			default:
				return false;
		}
	}
	public function listTimegroups($assoc = false, $ajrq = false){
		$tmparray = array();
		$sql = "SELECT id, description FROM timegroups_groups ORDER BY description";
		$stmt = $this->db->prepare($sql);
		$stmt->execute();
		$results = $stmt->fetchall();
		if(!$results) {
			$results = array();
		}
		if($assoc !== true){
			foreach ($results as $val) {
				if ($ajrq){
					$tmparray[] = array($val[0], $val[1], "value" => $val[0], "text" => $val[1]);
				}
				else{
					// Used for link. Need to send index and not the label.
					$tmparray[] = array($val[0], $val[1], "value" => $val[0], "text" => $val[0]);
				}

			}
		}else{
			foreach ($results as $val) {
				$tmparray[] = array("id" => $val[0], "description" => htmlspecialchars($val[1],ENT_QUOTES));
			}
		}
		return $tmparray;
	}
	public function listTimeconditions($getall=false) {
		$sql = "SELECT * FROM timeconditions ORDER BY priority ASC";
		$stmt = $this->db->prepare($sql);
		$stmt->execute();
		$results = $stmt->fetchall(\PDO::FETCH_ASSOC);
		if(is_array($results)){
			return $results;
		}
		return array();
	}
	public function getRightNav($request) {
		switch ($request['display']) {
			case 'timegroups':
				if(isset($request['view']) && $request['view'] == 'form'){
					return load_view(__DIR__."/views/timegroups/bootnav.php",array('request'=>$request));
				}
			break;
			case 'timeconditions':
				if(isset($request['view']) && $request['view'] == 'form'){
					return load_view(__DIR__."/views/timeconditions/bootnav.php",array('request'=>$request));
				}
			break;
		}
	}

	/**
	* isBetween:
	* Helper for checkTime()
	* @a one end of range
	* @b other end of range
	* @v value to check
	* return bool
	*/
	private function isBetween($a, $b, $v) {
		$a = (int)$a;
		$b = (int)$b;
		$v = (int)$v;
		$res = false;

		if($a == $b) {
			$res = $v == $a;
		} else {
			$invert = $a > $b;
			$res = false;

			if($invert) {
				$tmp = $a;
				$a = $b;
				$b = $tmp;

				$res = $v > $a && $v < $b;
			} else {
				$res = $v >= $a && $v <= $b;
			}

			if($invert) {
				$res = !$res;
			}
		}
		return $res;
	}

	/**
	* checkTime:
	* Attempts to faithfully replicate the logic portion of the dialplan application
	* gotoiftime. You pass a string with the same format and it returns true or false.
	* most items can be a *, single (mon), or range (mon-fri) see the gotiftime docs.
	* @time: <time range>,<days of week>,<days of month>,<months>
	* return bool
	*/
	public function checkTime($time) {
		$monthA = array(
			'jan' => 1,
			'feb' => 2,
			'mar' => 3,
			'apr' => 4,
			'may' => 5,
			'jun' => 6,
			'jul' => 7,
			'aug' => 8,
			'sep' => 9,
			'oct' => 10,
			'nov' => 11,
			'dec' => 12
		);
		$daysA = array(
			'sun' => 0,
			'mon' => 1,
			'tue' => 2,
			'wed' => 3,
			'thu' => 4,
			'fri' => 5,
			'sat' => 6,
		);
		//match all don't take time to parse out anything
		// Time zone doesn't matter in this case
		if(substr( $time, 0, 7) == '*|*|*|*') {
			return true;
		}

		$match = false;
		$result = explode("|", $time);
		$hour = $result[0];
		$dow = $result[1];
		$dom = $result[2];
		$month = $result[3];
		if (isset($result[4])) {
			$tz = $result[4];
		} else {
			$tz = '*';
		}
		// Ensure valid time zone
		if($tz==='*' || !in_array($tz, timezone_identifiers_list())) {
			$dtnow = new \DateTime(); //use system timezone
		} else {
			$dtnow = new \DateTime("now", new \DateTimeZone($tz));
		}



		// Note that all conditions must be checked; they're AND connected

		// Check month first
		if($month === '*') {
			$match = true;
		} else {
			$months = explode('-',$month);
			$range = isset($months[1]);
			$cur = $dtnow->format('n');
			$match = $range ? $this->isBetween($monthA[$months[0]], $monthA[$months[1]], $cur) : $monthA[$month] == $cur;
		}

		// Can still fail (Day of month)
		if($match) {
			if($dom === '*') {
				$match = true;
			} else {
				$daysom = explode('-',$dom);
				$range = isset($daysom[1]);
				$cur = $dtnow->format('j');

				$match = $range ? $this->isBetween($daysom[0], $daysom[1], $cur)	: $dom == $cur;
			}
		}

		// Can still fail (Day of week)
		if($match) {
			if($dow === '*') {
				$match = true;
			} else {
				$dows = explode('-',$dow);
				$range = isset($dows[1]);
				$cur = $dtnow->format('w');

			$match = $range ? $this->isBetween($daysA[$dows[0]], $daysA[$dows[1]], $cur) : $daysA[$dow] == $cur;
			}
		}

		// Can still fail (time)
		if($match) {
			if($hour === '*') {
				$match = true;
			} else {
				$hours = explode('-',$hour);
				$range = isset($hours[1]);
				// All calculations in minutes of day
				$cur = explode(':', $dtnow->format('H:i'));
				$cur = $cur[0] * 60 + $cur[1];

				$mods = array();
				$mods[0] = explode(':',$hours[0]);
				$mods[0] = $mods[0][0] * 60 + $mods[0][1];
				if($range) {
					$mods[1] = explode(':',$hours[1]);
					$mods[1] = $mods[1][0] * 60 + $mods[1][1];
				}

				$match = $range ? $this->isBetween($mods[0], $mods[1], $cur) : $mods == $cur;
			}
		}
		return $match;
	}

	/**
	 * FreePBX chown hooks
	 */
	public function chownFreepbx() {
		$files = array();

		$files[] = array('type' => 'execdir',
			'path' => __DIR__.'/bin',
			'perms' => 0755);

		return $files;
	}
	public function addTimeCondition($post){
		$displayname = empty($post['displayname'])?_("unnamed"):$post['displayname'];
		$invert_hint = ($post['invert_hint'] == '1') ? '1' : '0';
		$vars = array(
		':displayname' => $displayname,
		':time' => $post['time'],
		':timezone' => $post['timezone'],
		':falsegoto' => $post[$post['goto1'].'1'],
		':truegoto' => $post[$post['goto0'].'0'],
		':invert_hint' => $invert_hint,
		':fcc_password' => $post['fcc_password'],
		':deptname' => $post['deptname'],
		':generate_hint' => '1',
		':mode' => $post['mode'],
		':calendar_id' => $post['calendar-id'],
		':calendar_group_id' => $post['calendar-group']
		);
		$sql = "INSERT INTO timeconditions (displayname,time,truegoto,falsegoto,deptname,generate_hint,fcc_password,invert_hint,timezone,mode,calendar_id,calendar_group_id) values (:displayname, :time, :truegoto, :falsegoto, :deptname, :generate_hint, :fcc_password, :invert_hint, :timezone, :mode, :calendar_id, :calendar_group_id)";
		$stmt = $this->db->prepare($sql);
		$stmt->execute($vars);
		$id = $this->db->lastInsertId();
		$this->createFeatureCode($id, $displayname);
		\FreePBX::Hooks()->processHooks(array('id' => $id, 'post' => $post));
		return $id;
	}
	public function duplicateTimeCondition($id,$post) {
		$post['displayname'] = $post['displayname'].'_COPY_';
		return $this->addTimeCondition($post);
	}
	public function editTimeCondition($id,$post){
		$displayname = empty($post['displayname'])?_("unnamed"):$post['displayname'];
		$invert_hint = ($post['invert_hint'] == '1') ? '1' : '0';
		$vars = array(
		':id' => $id,
		':displayname' => $displayname,
		':time' => $post['time'],
		':timezone' => $post['timezone'],
		':falsegoto' => $post[$post['goto1'].'1'],
		':truegoto' => $post[$post['goto0'].'0'],
		':invert_hint' => $invert_hint,
		':fcc_password' => $post['fcc_password'],
		':deptname' => $post['deptname'],
		':generate_hint' => '1',
		':mode' => $post['mode'],
		':calendar_id' => $post['calendar-id'],
		':calendar_group_id' => $post['calendar-group']
	);
		$old = $this->getTimeCondition($id);

		$sql = "UPDATE timeconditions SET displayname = :displayname, time = :time, truegoto = :truegoto, falsegoto = :falsegoto, deptname = :deptname, generate_hint = :generate_hint, invert_hint = :invert_hint, fcc_password = :fcc_password, timezone = :timezone, mode = :mode, calendar_id = :calendar_id, calendar_group_id = :calendar_group_id WHERE timeconditions_id = :id";
		$stmt = $this->db->prepare($sql);
		$stmt->execute($vars);
		//If invert was switched we need to update the asterisk DB
		$post['tcstate_new'] = (($old['invert_hint'] != $invert_hint) && $post['tcstate_new'] == 'unchanged') ? $this->getState($id) : $post['tcstate_new'];
		if (isset($post['tcstate_new']) && $post['tcstate_new'] != 'unchanged') {
			$this->setState($id, $post['tcstate_new'],!empty($invert_hint));
		}

		$fcc = new \featurecode('timeconditions', 'toggle-mode-'.$id);
		if ($displayname) {
			$fcc->setDescription("$id: $displayname");
		} else {
			$fcc->setDescription($id._(": Time Condition Override"));
		}
		$fcc->update();
		unset($fcc);
		\FreePBX::Hooks()->processHooks(array('id' => $id, 'post' => $post));
	}

	public function getTimeCondition($id){
		$sql = "SELECT * FROM timeconditions WHERE timeconditions_id = :id LIMIT 1";
		$stmt = $this->db->prepare($sql);
		$stmt->execute(array(':id' => $id));
		$results = $stmt->fetch();
		$fcc = new \featurecode('timeconditions', 'toggle-mode-'.$id);
		$c = $fcc->getCodeActive();
		$results['tcval'] = $fcc->getCode();
		unset($fcc);
		if ($c == '') {
			$results['tcstate'] = false;
			$results['tccode'] = false;
		} else {
			$results['tccode'] = $c;
			if ($this->astman != null) {
				$results['tcstate'] = $this->getState($id);
			} else {
				die_freepbx("No manager connection, can't get Time Condition State");
			}
		}
		return $results;
	}

	public function createFeatureCode($id, $displayname=''){
		$fcc = new \featurecode('timeconditions', 'toggle-mode-'.$id);
		if ($displayname) {
			$fcc->setDescription("$id: $displayname");
		} else {
			$fcc->setDescription($id._(": Time Condition Override"));
		}
		$fcc->setDefault('*27'.$id);
		$fcc->setProvideDest();
		$fcc->update();
		unset($fcc);
		$this->setState($id, '');
	}

	public function getState($id){
			return $this->astman->database_get("TC", $id);
	}

	public function setState($id, $state,$invert=false){
		if ($this->astman != null) {
			switch ($state) {
			case 'auto':
			case '':
				$state = '';
				$blf = ($invert)?'INUSE':'NOT_INUSE';
				$sticky = ($invert)?'INUSE':'NOT_INUSE';
				break;
			case 'true':
				$blf = 'NOT_INUSE';
				$sticky = 'NOT_INUSE';
				break;
			case 'true_sticky':
				$blf = 'NOT_INUSE';
				$sticky = 'INUSE';
				break;
			case 'false':
				$blf = 'INUSE';
				$sticky = 'NOT_INUSE';
				break;
			case 'false_sticky':
				$blf = 'INUSE';
				$sticky = 'INUSE';
				break;
			default:
				$state = false;
				break;
			}

			if ($state !== false) {
				$this->astman->database_put("TC", $id, $state);
				$DEVSTATE = \FreePBX::Config()->get('AST_FUNC_DEVICE_STATE');
				if ($DEVSTATE) {
					$this->astman->set_global($DEVSTATE . "(Custom:TC" . $id . ")", $blf);
					$this->astman->set_global($DEVSTATE . "(Custom:TCSTICKY" . $id . ")", $sticky);
				}
			}
		} else {
			die_freepbx("No manager connection, can't update Time Condition State");
		}

	}

	public function delTimeCondition($id){
		$sql = "DELETE FROM timeconditions WHERE timeconditions_id = :id";
		$stmt = $this->db->prepare($sql);
		$fcc = new \featurecode('timeconditions', 'toggle-mode-'.$id);
		$fcc->delete();
		unset($fcc);
		if ($this->astman != null) {
			$this->astman->database_del("TC",$id);
		}
		\FreePBX::Hooks()->processHooks($id);
		return $stmt->execute(array(':id' => $id));
	}
	public function addTimeGroup($description, $times=null){
		$sql = "INSERT timegroups_groups(description) VALUES (:description)";
		$stmt = $this->db->prepare($sql);
		try {
			$ret = $stmt->execute(array(':description' => $description));
		} catch (\PDOException $e) {
			//catch duplicates
			if($e->getCode() == '23000'){
				return false;
			}else{
					throw $e;
			}
		}
		$timegroup = $this->db->lastInsertId();
		if (isset($times)) {
			$this->editTimes($timegroup,$times);
		}
		needreload();
		\FreePBX::Hooks()->processHooks($timegroup);
		return $timegroup;
	}
	public function editTimeGroup($id,$description){
		$sql = "UPDATE timegroups_groups SET description = :description WHERE id = :id";
		$stmt = $this->db->prepare($sql);
		$ret = $stmt->execute(array(':description' => $description, ':id' => $id));
		\FreePBX::Hooks()->processHooks($id);
		needreload();
		return $ret;
	}
	public function getTimeGroup($timegroup) {
		$sql = "SELECT id, description FROM timegroups_groups WHERE id = :id LIMIT 1";
		$stmt = $this->db->prepare($sql);
		$ret = $stmt->execute(array(':id' => $timegroup));
		$results = $stmt->fetch();
		$tmparray = array($results[0], $results[1]);
		return $tmparray;
	}
	public function delTimeGroup($id){
		$sql = "delete from timegroups_details where timegroupid = :id";
		$stmt = $this->db->prepare($sql);
		$ret1 = $stmt->execute(array(':id'=>$id));
		$sql = "delete from timegroups_groups where id = :id";
		$stmt = $this->db->prepare($sql);
		$ret2 = $stmt->execute(array(':id'=>$id));
		needreload();
		\FreePBX::Hooks()->processHooks($id);
		return ($ret1 && $ret2);
	}

	public function duplicateTimeGroup($description, $times = null){
		return $this->addTimeGroup($description . '_COPY_', $times);
	}


	public function editTimes($id,$times){
		$sql = "DELETE FROM timegroups_details WHERE timegroupid = :id";
		$stmt = $this->db->prepare($sql);
		$stmt->execute(array(':id' => $id));
		$times = is_array($times)?$times:array();
		$sql = "INSERT timegroups_details (timegroupid, time) VALUES (:id, :time)";
		$stmt = $this->db->prepare($sql);
		foreach ($times as $key=>$val) {
			extract($val);
			$time = $this->buildTime( $hour_start, $minute_start, $hour_finish, $minute_finish, $wday_start, $wday_finish, $mday_start, $mday_finish, $month_start, $month_finish);
			if (isset($time) && $time != '' && $time <> '*|*|*|*') {
				$stmt->execute(array(':id' => $id, ':time' => $time));
			}
		}
		needreload();
	}
	public function buildTime( $hour_start, $minute_start, $hour_finish, $minute_finish, $wday_start, $wday_finish, $mday_start, $mday_finish, $month_start, $month_finish) {

		//----- Time Hour Interval proccess ----
		//
		if ($minute_start == '-') {
			$time_minute_start = "00";
		} else {
			$time_minute_start = sprintf("%02d",$minute_start);
		}
		if ($minute_finish == '-') {
			$time_minute_finish = "00";
		} else {
			$time_minute_finish = sprintf("%02d",$minute_finish);
		}
		if ($hour_start == '-') {
			$time_hour_start = '*';
		} else {
			$time_hour_start = sprintf("%02d",$hour_start) . ':' . $time_minute_start;
		}
		if ($hour_finish == '-') {
			$time_hour_finish = '*';
		} else {
			$time_hour_finish = sprintf("%02d",$hour_finish) . ':' . $time_minute_finish;
		}
		if ($time_hour_start === '*') {
			$time_hour_start = $time_hour_finish;
		}
		if ($time_hour_finish === '*') {$time_hour_finish = $time_hour_start;}
		if ($time_hour_start == $time_hour_finish) {
			$time_hour = $time_hour_start;
		} else {
			$time_hour = $time_hour_start . '-' . $time_hour_finish;
		}

		//----- Time Week Day Interval proccess -----
		//
		if ($wday_start == '-') {
			$time_wday_start = '*';
		} else {
			$time_wday_start = $wday_start;
		}
		if ($wday_finish == '-') {
			$time_wday_finish = '*';
		} else {
			$time_wday_finish = $wday_finish;
		}
		if ($time_wday_start === '*') {
			$time_wday_start = $time_wday_finish;
		}
		if ($time_wday_finish === '*') {
			$time_wday_finish = $time_wday_start;
		}
		if ($time_wday_start == $time_wday_finish) {
			$time_wday = $time_wday_start;
		} else {
			$time_wday = $time_wday_start . '-' . $time_wday_finish;
		}

		//----- Time Month Day Interval proccess -----
		//
		if ($mday_start == '-') {
			$time_mday_start = '*';
		} else {
			$time_mday_start = $mday_start;
		}
		if ($mday_finish == '-') {
			$time_mday_finish = '*';
		} else {
			$time_mday_finish = $mday_finish;
		}
		if ($time_mday_start === '*') {
			$time_mday_start = $time_mday_finish;
		}
		if ($time_mday_finish === '*') {
			$time_mday_finish = $time_mday_start;
		}
		if ($time_mday_start == $time_mday_finish) {
			$time_mday = $time_mday_start;
		} else {
			$time_mday = $time_mday_start . '-' . $time_mday_finish;
		}

		//----- Time Month Interval proccess -----
		//
		if ($month_start == '-') {
			$time_month_start = '*';
		} else {
			$time_month_start = $month_start;
		}
		if ($month_finish == '-') {
			$time_month_finish = '*';
		} else {
			$time_month_finish = $month_finish;
		}
		if ($time_month_start === '*') {
			$time_month_start = $time_month_finish;
		}
		if ($time_month_finish === '*') {
			$time_month_finish = $time_month_start;
		}
		if ($time_month_start == $time_month_finish) {
			$time_month = $time_month_start;
		} else {
			$time_month = $time_month_start . '-' . $time_month_finish;
		}
		$time = $time_hour . '|' . $time_wday . '|' . $time_mday . '|' . $time_month;
		return $time;
	}

	public function getAllTimeconditonNames($itemid) {
		if($itemid ==NULL){
			$sql = "SELECT displayname FROM timeconditions";
		}
		else{
			$sql = "SELECT displayname FROM timeconditions WHERE timeconditions_id <> '$itemid' ";
		}
		$res = \FreePBX::Database()->query($sql)->fetchAll(\PDO::FETCH_COLUMN, 0);
		return $res;
	}

}
