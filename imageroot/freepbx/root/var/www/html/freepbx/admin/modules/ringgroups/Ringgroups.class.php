<?php
namespace FreePBX\modules;
class Ringgroups implements \BMO {
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

	public function doConfigPageInit($page) {
		$request = $_REQUEST;
		isset($request['action'])?$action = $request['action']:$action='';
		//the extension we are currently displaying
		isset($request['extdisplay'])?$extdisplay=$request['extdisplay']:$extdisplay='';
		isset($request['account'])?$account = $request['account']:$account='';
		isset($request['grptime'])?$grptime = $request['grptime']:$grptime='';
		isset($request['progress'])?$progress = $request['progress']:$progress='yes';
		isset($request['elsewhere'])?$elsewhere = $request['elsewhere']:$elsewhere='no';
		isset($request['grppre'])?$grppre = $request['grppre']:$grppre='';
		isset($request['strategy'])?$strategy = $request['strategy']:$strategy='';
		isset($request['annmsg_id'])?$annmsg_id = $request['annmsg_id']:$annmsg_id='';
		isset($request['description'])?$description = $request['description']:$description='';
		isset($request['alertinfo'])?$alertinfo = $request['alertinfo']:$alertinfo='';
		isset($request['needsconf'])?$needsconf = $request['needsconf']:$needsconf='';
		isset($request['cwignore'])?$cwignore = $request['cwignore']:$cwignore='';
		isset($request['cpickup'])?$cpickup = $request['cpickup']:$cpickup='';
		isset($request['cfignore'])?$cfignore = $request['cfignore']:$cfignore='';
		isset($request['remotealert_id'])?$remotealert_id = $request['remotealert_id']:$remotealert_id='0';
		isset($request['toolate_id'])?$toolate_id = $request['toolate_id']:$toolate_id='';
		isset($request['ringing'])?$ringing = $request['ringing']:$ringing='';
		isset($request['rvolume'])?$rvolume = $request['rvolume']:$rvolume='';

		isset($request['changecid'])?$changecid = $request['changecid']:$changecid='default';
		isset($request['fixedcid'])?$fixedcid = $request['fixedcid']:$fixedcid='';
		isset($request['recording'])?$recording = $request['recording']:$recording='dontcare';
		if (isset($request['goto0']) && isset($request[$request['goto0']."0"])) {
						$goto = $request[$request['goto0']."0"];
		} else {
						$goto = '';
		}

		if (isset($request["grplist"])) {
			$grplist = explode("\n",$request["grplist"]);

			if (!$grplist) {
				$grplist = null;
			}

			foreach (array_keys($grplist) as $key) {
				//trim it
				$grplist[$key] = trim($grplist[$key]);

				// remove invalid chars
				$grplist[$key] = preg_replace("/[^0-9#*]/", "", $grplist[$key]);

				if ($grplist[$key] == ltrim($extdisplay,'GRP-').'#')
					$grplist[$key] = rtrim($grplist[$key],'#');

				// remove blanks
				if ($grplist[$key] == "") unset($grplist[$key]);
			}

			// check for duplicates, and re-sequence
			$grplist = array_values(array_unique($grplist));
		}

		// do if we are submitting a form
		if(isset($request['action'])){
			//check if the extension is within range for this user
			if (isset($account) && !checkRange($account)){
				echo "<script>javascript:alert('". _("Warning! Extension")." ".$account." "._("is not allowed for your account").".');</script>";
			} else {
				//add group
				if ($action == 'addGRP') {

					$conflict_url = array();
					$usage_arr = framework_check_extension_usage($account);
					if (!empty($usage_arr)) {
						$conflict_url = framework_display_extension_usage_alert($usage_arr);

					} elseif ($this->add($account,$strategy,$grptime,implode("-",$grplist),$goto,$description,$grppre,$annmsg_id,$alertinfo,$needsconf,$remotealert_id,$toolate_id,$ringing,$cwignore,$cfignore,$changecid,$fixedcid,$cpickup,$recording, $progress,$elsewhere,$rvolume)) {

						// save the most recent created destination which will be picked up by
						//
						$this_dest = ringgroups_getdest($account);
						\fwmsg::set_dest($this_dest[0]);
						needreload();
						$_REQUEST['extdisplay'] = $account;
						unset($_REQUEST['view']);
					}

				}

				//del group
				if ($action == 'delGRP') {
					ringgroups_del($account);
					needreload();
					unset($_REQUEST['view']);
					unset($_REQUEST['extdisplay']);
				}

				//edit group - just delete and then re-add the extension
				if ($action == 'edtGRP') {
					ringgroups_del($account);
					$this->add($account,$strategy,$grptime,implode("-",$grplist),$goto,$description,$grppre,$annmsg_id,$alertinfo,$needsconf,$remotealert_id,$toolate_id,$ringing,$cwignore,$cfignore,$changecid,$fixedcid,$cpickup,$recording,$progress,$elsewhere,$rvolume);
					needreload();
					$_REQUEST['extdisplay'] = $account;
					unset($_REQUEST['view']);
				}
			}
		}
	}

	public function search($query, &$results) {
		if(!ctype_digit($query)) {
			$sql = "SELECT * FROM ringgroups WHERE description LIKE ?";
			$sth = $this->db->prepare($sql);
			$sth->execute(array("%".$query."%"));
			$rows = $sth->fetchAll(\PDO::FETCH_ASSOC);
			foreach($rows as $row) {
				$results[] = array("text" => _("RingGroup")." ".$row['grpnum'], "type" => "get", "dest" => "?display=ringgroups&view=form&extdisplay=GRP-".$row['grpnum']);
			}
		} else {
			$sql = "SELECT * FROM ringgroups WHERE grpnum LIKE ?";
			$sth = $this->db->prepare($sql);
			$sth->execute(array("%".$query."%"));
			$rows = $sth->fetchAll(\PDO::FETCH_ASSOC);
			foreach($rows as $row) {
				$results[] = array("text" => $row['description'] . " (".$row['grpnum'].")", "type" => "get", "dest" => "?display=ringgroups&view=form&extdisplay=GRP-".$row['grpnum']);
			}
		}
	}

	public function getActionBar($request){
		switch($request['display']){
			case 'ringgroups':
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
		if($request['view'] != 'form'){
			unset($buttons);
		}
		return $buttons;
	}

	public function listRinggroups($get_all=false) {
		$sql = "SELECT grpnum, description FROM ringgroups ORDER BY CAST(grpnum as UNSIGNED)";
		$stmt = $this->db->prepare($sql);
		$stmt->execute();
		$results = $stmt->fetchall(\PDO::FETCH_ASSOC);
		foreach ($results as $result) {
			if ($get_all || (isset($result['grpnum']) && checkRange($result['grpnum']))) {
				$grps[] = array(
					0 => $result['grpnum'],
					1 => $result['description'],
					'grpnum' => $result['grpnum'],
					'description' => $result['description'],
				);
			}
		}
		if (isset($grps))
			return $grps;
		else
			return array();
	}

	public function getExtensionLists($grpnum) {
	    $sql = "SELECT grplist FROM ringgroups WHERE grpnum = ?";
	    $sth = $this->db->prepare($sql);
	    $sth->execute(array($grpnum));
	    $rows = $sth->fetch(\PDO::FETCH_ASSOC);
	    return $rows;
	}

	public function updateExtensionLists($grpnum, $extensions) {
	    $sql = "UPDATE ringgroups SET grplist = ? WHERE grpnum = ?";
	    $sth = $this->db->prepare($sql);
	    $sth->execute(array($extensions, $grpnum));
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
						return array_values($this->listRinggroups());
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

	public function getRightNav($request) {
		if(isset($request['view']) && $request['view'] == 'form'){
			return load_view(__DIR__."/views/bootnav.php",array());
		}
	}
	public function add($grpnum,$strategy,$grptime,$grplist,$postdest,$desc,$grppre='',$annmsg_id='0',$alertinfo,$needsconf,$remotealert_id,$toolate_id,$ringing,$cwignore,$cfignore,$changecid='default',$fixedcid='',$cpickup='', $recording='dontcare',$progress='yes',$elsewhere,$rvolume){
		$extens = $this->listRinggroups(false);
		if(is_array($extens)) {
			foreach($extens as $exten) {
				if ($exten[0]===$grpnum) {
					echo "<script>javascript:alert('"._("This ringgroup")." ({$grpnum}) "._("is already in use")."');</script>";
					return false;
				}
			}
		}

		// Random error that can crop up, so we fix it here, this probably
		// happens if something went wrong with announcements.
		$annmsg_id = (!empty($annmsg_id) && ctype_digit($annmsg_id)) ? $annmsg_id : 0;
		// XXX: Kludge to force to zero if unset or not numeric
		$remotealert_id = (!empty($remotealert_id) && ctype_digit($remotealert_id)) ? $remotealert_id : 0;
		$toolate_id = (!empty($toolate_id) && ctype_digit($toolate_id)) ? $toolate_id : 0;

		$sql = "INSERT INTO ringgroups (grpnum, strategy, grptime, grppre, grplist, annmsg_id, postdest, description, alertinfo, needsconf, remotealert_id, toolate_id, ringing, cwignore, cfignore, cpickup, recording, progress, elsewhere, rvolume) VALUES (:grpnum, :strategy, :grptime, :grppre, :grplist, :annmsg_id, :postdest, :desc, :alertinfo, :needsconf, :remotealert_id, :toolate_id, :ringing, :cwignore, :cfignore, :cpickup, :recording, :progress, :elsewhere, :rvolume)";
		$vars = array(
			":grpnum" => $grpnum,
			":strategy" => $strategy,
			":grptime" => $grptime,
			":grppre" => $grppre,
			":grplist" => $grplist,
			":annmsg_id" => $annmsg_id,
			":postdest" => $postdest,
			":desc" => $desc,
			":alertinfo" => $alertinfo,
			":needsconf" => $needsconf,
			":remotealert_id" => $remotealert_id,
			":toolate_id" => $toolate_id,
			":ringing" => $ringing,
			":cwignore" => $cwignore,
			":cfignore" => $cfignore,
			":cpickup" => $cpickup,
			":recording" => $recording,
			":progress" => $progress,
			":elsewhere" => $elsewhere,
			":rvolume" => $rvolume,
		);
		$stmt = $this->db->prepare($sql);
		$stmt->execute($vars);
		if($this->astman){
			$this->astman->database_put("RINGGROUP",$grpnum."/changecid",$changecid);
			$fixedcid = preg_replace("/[^0-9\+]/" ,"", trim($fixedcid));
			$this->astman->database_put("RINGGROUP",$grpnum."/fixedcid",$fixedcid);
		}else{
			die_freepbx("Cannot connect to Asterisk Manager");
		}
		return true;
	}

	public function delDevice($account, $editmode=false) {
		if(!$editmode){
			$grouplist = $this->listRinggroups();
			if(isset($grouplist)) {
			    foreach($grouplist as $list => $group) {
			        $extensionlist = $this->getExtensionLists($group['grpnum']);
			        $extensions = explode('-', $extensionlist['grplist']);
			        $key = array_search($account, $extensions);
			        if ($key !== FALSE) {
			            unset($extensions[$key]);
			            $new_grplist = implode('-',$extensions);
			            $this->updateExtensionLists($group['grpnum'], $new_grplist);
			        }
			    }
			}
		}
    }
}
