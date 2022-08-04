<?php
// vim: set ai ts=4 sw=4 ft=php:
namespace FreePBX\modules;

class Customappsreg extends \FreePBX_Helpers implements \BMO {

	private $allDests = false;

	public function install() {
		// Check for old Destinations table
		$db = $this->Database();
		$sql = "SELECT * FROM `custom_destinations` LIMIT 1";
		try {
			$res = $db->query($sql);
			// If we made it here, the table exists, and needs to be converted.
			$this->convertDestDatabase();
		} catch (\Exception $e) {
			if ($e->getCode() != "42S02") { // 42S02 == table doesn't exist. Which is correct
				// We don't know what it is, let someone else deal with it.
				throw $e;
			}
		}
		// Create custom_extensions table
		$sql = "SELECT * FROM `custom_extensions` LIMIT 1";
		try {
			$res = $db->query($sql);
			// If we made it here, the table exists, nothing needs to be done
		} catch (\Exception $e) {
			if ($e->getCode() == "42S02") { // 42S02 == table doesn't exist.
				$sql = "CREATE TABLE `custom_extensions` (
					`custom_exten` varchar(80) NOT NULL default '',
					`description` varchar(40) NOT NULL default '',
					`notes` varchar(255) NOT NULL default '',
					PRIMARY KEY  (`custom_exten`)
				)";
				$res = $db->query($sql);
			} else {
				// We don't know what the error is, pass it up.
				throw $e;
			}
		}
	}

	public function getRightNav($request) {
		$dir = basename($request['display']);
		if(isset($request['view']) && $request['view'] == "form") {
			return load_view(__DIR__."/views/".$dir."/rnav.php",array());
		} else {
			return '';
		}
	}

	public function uninstall() {
	}

	public function backup(){
	}

	public function restore($backup){
	}

	// This is where we handle our POSTs
	public function doConfigPageInit($page) {
		switch($page){
			case 'customdests':
				// Grab the variables we care about.
				$vars = array ("destid", "target", "description", "notes", "destret", "action");
				$postarr = array();
				foreach ($vars as $v) {
					$postarr[$v] = $this->getReq($v);
				}
				// Do we have a dest?
				if (isset($_REQUEST['goto0'])) {
					$postarr['dest'] = $_REQUEST[$_REQUEST['goto0']."0"];
				} else {
					$postarr['dest'] = "";
				}

				if ($page == "customdests") {
					$this->handleDestsPost($postarr);
				} else {
					//$this->handleExtenPost($postarr);
				}
			break;
			case 'customextens':
				$type   = isset($_REQUEST['type']) ? $_REQUEST['type'] : 'tool';
				$action = isset($_REQUEST['action']) ? $_REQUEST['action'] : '';
				if (isset($_REQUEST['delete'])) $action = 'delete';
				$old_custom_exten = isset($_REQUEST['old_custom_exten']) ? preg_replace("/[^0-9*#]/" ,"",$_REQUEST['old_custom_exten']) :  '';
				$custom_exten     = isset($_REQUEST['extdisplay']) ? preg_replace("/[^0-9*#]/" ,"",$_REQUEST['extdisplay']) :  '';
				$description     = isset($_REQUEST['description']) ? htmlentities($_REQUEST['description'],ENT_COMPAT | ENT_HTML401, "UTF-8") :  '';
				$notes           = isset($_REQUEST['notes']) ? htmlentities($_REQUEST['notes'],ENT_COMPAT | ENT_HTML401, "UTF-8") :  '';

				switch ($action) {
					case 'add':
						$this->conflict_url = array();
						$this->usage_arr = framework_check_extension_usage($custom_exten);
						if (!empty($usage_arr)) {
							$this->conflict_url = framework_display_extension_usage_alert($usage_arr);
							$custom_exten='';
						} else {
							if (customappsreg_customextens_add($custom_exten, $description, $notes)) {
								$_REQUEST['extdisplay'] = $custom_exten;
								needreload();
								redirect_standard();
							} else {
								$custom_exten='';
							}
						}
				break;
				case 'edit':
					$this->conflict_url = array();
					if ($old_custom_exten != $custom_exten) {
						$this->usage_arr = framework_check_extension_usage($custom_exten);
						if (!empty($usage_arr)) {
							$this->conflict_url = framework_display_extension_usage_alert($usage_arr);
						}
					}
					if (empty($this->conflict_url)) {
						if (customappsreg_customextens_edit($old_custom_exten, $custom_exten, $description, $notes)) {
							needreload();
						}
					}
				break;
				case 'delete':
					customappsreg_customextens_delete($custom_exten);
					needreload();
				break;
			}
			break;
		}
	}

	// Why yes, we DO want to generate dialplan, thank you very much!
	public static function myDialplanHooks() {
		return true;
	}

	// This is the wrapper around any custom dests that (may) have a return.
	public function doDialplanHook(&$ext, $engine, $priority) {
		$context = 'customdests';
		$allDests = $this->getAllCustomDests();
		foreach ($allDests as $dest) {
			//Convert HTML entities to characters , Fix for (FREEPBX-14599 :Using a & character in a Custom Destination dial string doesn't work)
			$dest['target'] = html_entity_decode($dest['target']);
			$fakedest = "dest-".$dest['destid'];
			$ext->add($context, $fakedest, '', new \ext_noop('Entering Custom Destination '.$dest['description']));
			if (!$dest['destret']) {
				$ext->add($context, $fakedest, '', new \ext_goto($dest['target']));
				continue;
			}
			$gs = explode(',' , $dest['target'], 3);
			switch (count($gs)) {
				case 1:
					$ext->add($context, $fakedest, '', new \ext_gosub('1','s',$gs[0]));
				break;
				case 2:
					$ext->add($context, $fakedest, '', new \ext_gosub('1',$gs[1],$gs[0]));
				break;
				case 3:
					preg_match("/(\d+)\((.+)\)/", $gs[2], $match);
					$pri = $gs[2];
					$args = '';
					if(count($match) == 3){
						$pri = $match[1];
						$args = $match[2];
					}
					$ext->add($context, $fakedest, '', new \ext_gosub($pri,$gs[1],$gs[0],$args));
				break;
				default:
					$ext->add($context, $fakedest, '', new \ext_gosub($dest['target']));
				break;
			}


			$ext->add($context, $fakedest, '', new \ext_noop('Returned from Custom Destination '.$dest['description']));
			$ext->add($context, $fakedest, '', new \ext_goto($dest['dest']));
		}
	}

	private function handleDestsPost($vars) {
		$action = $vars['action'];
		unset($vars['action']);
		switch ($action) {
		case 'delete':
			$this->deleteCustomDest($vars['destid']);
			needreload();
			return;
		case 'edit':
			if (empty($vars['target'])) {
				throw new \Exception("Blank target? How did that happen?");
			}
			$this->setConfig($vars['destid'], $vars, "dests");
			needreload();
			redirect_standard();
			return;
		case 'add':
			$id = $this->addCustomDest($vars);
			needreload();
			$_REQUEST['destid'] = $id;
			redirect_standard();
			return;
		default:
			return;
		}
	}

	private function deleteCustomDest($destid) {
		$this->setConfig($destid, false, "dests");
		return true;
	}

	private function addCustomDest($vars) {
		// Remove any vars that may be hanging around
		unset($vars['action']);

		// Get a new ID
		$currentid = $this->getConfig("currentid");
		if (!$currentid) {
			$currentid = 1;
		}
		$vars['destid'] = $currentid;

		// And save it.
		$this->setConfig($currentid++, $vars, "dests");

		// Invalidate the allDests cache
		$this->allDests = false;

		// Save the new current ID
		$currentid = $this->setConfig("currentid", $currentid);

		// Finally, hand the new ID back, in case anyone wants it.
		return $currentid;
	}

	public function getCustomDest($destid) {
		return $this->getConfig($destid, "dests");
	}

	public function getAllCustomDests() {
		if ($this->allDests === false) {
			$this->allDests = $this->getAll("dests");
			if (!is_array($this->allDests)) {
				$this->allDests = array();
			}
		}
		return $this->allDests;
	}
	public function getAllCustomExtens() {
		$dbh = \FreePBX::Database();
		$sql = "SELECT custom_exten, description, notes FROM custom_extensions ORDER BY custom_exten";
		$stmt = $dbh->prepare($sql);
		$stmt->execute();
		$results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
		if($results) {
			return $results;
		}
		return array();
	}

	public function getUnknownDests() {

		$results = array();

		// Is always an array
		$all_probs = framework_list_problem_destinations();

		foreach ($all_probs as $problem) {
			if ($problem['status'] != "CUSTOM") {
				continue;
			}

			if (substr($problem['dest'], 0, 11) == "customdests") {
				// Assume we know what we're doing
				continue;
			}

			// Otherwise
			$results[$problem['dest']] = true;
		}
		return array_keys($results);
	}

	public function convertDestDatabase() {
		$db = \FreePBX::Database();
		$res = $db->query("SELECT * FROM `custom_destinations`")->fetchAll(\PDO::FETCH_ASSOC);
		foreach ($res as $row) {
			$tmparr = array("target" => $row['custom_dest'], "notes" => $row['notes'],
				"description" => $row['description'], "destret" => false);
			$this->addCustomDest($tmparr);
		}
		// We're done. Delete it, now!
		$res = $db->query("DROP TABLE `custom_destinations`");
	}

	public function getDestTarget($destid = false) {
		if (!$destid) {
			throw new \Exception("No destid provided");
		}

		$dest = $this->getCustomDest($destid);
		if (!$dest) {
			throw new \Exception("Invalid destid provided");
		}
		if ($dest['destret']) {
			return "customdests,dest-".$dest['destid'].",1";
		} else {
			return $dest['target'];
		}
	}
	public function getActionBar($request) {
		$buttons = array();
		switch($request['display']) {
			case 'customdests':
			case 'customextens':
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
					'submit' => array(
						'name' => 'submit',
						'id' => 'submit',
						'value' => _('Submit')
					)
				);
				if (empty($request['destid']) && empty($request['extdisplay'])) {
					unset($buttons['delete']);
				}
				if(!isset($request['view'])){
					$buttons = array();
				}
			break;
		}
		return $buttons;
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
		        case 'destgrid':
		          return array_values($this->getAllCustomDests());
		        break;
						case 'extensgrid':
							return array_values($this->getAllCustomExtens());
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
}
