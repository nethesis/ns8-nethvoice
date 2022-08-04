<?PHP
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright (C) 2014 Schmooze Com Inc.
namespace FreePBX\modules;
class Miscapps implements \BMO {
	public function __construct($freepbx = null) {
		if ($freepbx == null) {
			throw new Exception("Not given a FreePBX Object");
		}
		$this->FreePBX = $freepbx;
		$this->db = $freepbx->Database;
	}
	public function install() {
		$sql = "CREATE TABLE IF NOT EXISTS miscapps (miscapps_id INTEGER NOT NULL PRIMARY KEY AUTO_INCREMENT, ext VARCHAR( 50 ) , description VARCHAR( 50 ) , dest VARCHAR( 255 ))";
		$q = $this->db->prepare($sql);
		$q = $q->execute();
		unset($sql);
		unset($q);
		//Migration... Is this still needed
		global $db;
		$results = array();
		$sql = "SELECT miscapps_id, dest FROM miscapps";
		$results = $db->getAll($sql, DB_FETCHMODE_ASSOC);
		if (!\DB::IsError($results)) { // error - table must not be there
			foreach ($results as $result) {
				$old_dest    = $result['dest'];
				$this->id = $result['miscapps_id'];

				$new_dest = merge_ext_followme(trim($old_dest));
				if ($new_dest != $old_dest) {
					$sql = "UPDATE miscapps SET dest = '$new_dest' WHERE miscapps_id = $miscapps_id  AND dest = '$old_dest'";
					$results = $db->query($sql);
					if(DB::IsError($results)) {
						die_freepbx($results->getMessage());
					}
				}
			}
		}
	}
	public function uninstall() {
		echo _("Removing Settings table");
		$sql = "DROP TABLE IF EXISTS miscapps";
		$q = $this->db->prepare($sql);
		$q->execute();
	}
	public function backup() {}
	public function restore($backup) {}
	public function doConfigPageInit($page) {
		$action = isset($_REQUEST['action']) ? $_REQUEST['action'] :  '';
		$miscapp_id = isset($_REQUEST['miscapp_id']) ? $_REQUEST['miscapp_id'] :  false;
		$description = isset($_REQUEST['description']) ? $_REQUEST['description'] :  '';
		$ext = isset($_REQUEST['ext']) ? $_REQUEST['ext'] :  '';
		$dest = isset($_REQUEST['dest']) ? $_REQUEST['dest'] :  '';
		$enabled = isset($_REQUEST['enabled']) ? (!empty($_REQUEST['enabled'])) : true;

		if (isset($_REQUEST['goto0']) && $_REQUEST['goto0']) {
			$dest = $_REQUEST[ $_REQUEST['goto0'].'0' ];
		}
		switch ($action) {
			case 'add':
				if(isset($_POST['extdisplay'])){
					$conflict_url = array();
					$usage_arr = framework_check_extension_usage($ext);
					if (!empty($usage_arr)) {
						$conflict_url = framework_display_extension_usage_alert($usage_arr);
					} else {
						$id = $this->add($description, $ext, $dest);
						$_REQUEST['action'] = null;
						$_REQUEST['view'] = null;
						needreload();
					}
				}
			break;
			// TODO: need to lookup the current extension based on the id and if it is changing
			//       do a check to make sure it doesn't conflict. If not changing, np.
			//
			case 'edit':
				if(isset($_POST['extdisplay'])){
					$fc = new \featurecode('miscapps', 'miscapp_'.$miscapp_id);
					$conflict_url = array();
					if ($fc->getDefault() != $ext) {
						$usage_arr = framework_check_extension_usage($ext);
						if (!empty($usage_arr)) {
							$conflict_url = framework_display_extension_usage_alert($usage_arr);
						}
					}
					if (empty($conflict_url)) {
						$this->edit($miscapp_id, $description, $ext, $dest, $enabled);
						needreload();
						$_REQUEST['action'] = null;
						$_REQUEST['view'] = null;
					}
				}
			break;
			case 'delete':
				$this->delete($_REQUEST['extdisplay']);
				needreload();
				$_REQUEST['action'] = null;
				$_REQUEST['view'] = null;
			break;
		}
	}
	public function doDialplanHook(&$ext, $engine, $priority) {
		$addit = false;
		foreach ($this->malist(true) as $row) {
			if ($row['enabled']) {
				$ext->add('app-miscapps', $row['ext'], '', new ext_noop('Running miscapp '.$row['miscapps_id'].': '.$row['description']));
				$ext->add('app-miscapps', $row['ext'], '', new ext_macro('user-callerid'));
				$ext->add('app-miscapps', $row['ext'], '', new ext_goto($row['dest']));
				$addit = true;
			}
		}
		if ($addit) {
			$ext->addInclude('from-internal-additional', 'app-miscapps');
		}
	}
	public function getActionBar($request) {
		$buttons = array();
		if (!isset($request['action'])) return $buttons;
		switch($request['display']) {
			case 'miscapps':
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
				if (empty($request['extdisplay'])) {
					unset($buttons['delete']);
				}
				if ($request['action'] != 'add' && $request['action'] != 'edit') {
					unset($buttons);
					$buttons = array();
				}
			break;
		}
		return $buttons;
	}
	public function contexts() {
		// return an associative array with context and description
		foreach ($this->malist() as $row) {
			$contexts[] = array(
				'context' => 'app-miscapps-'.$row['miscapps_id'],
				'description'=> 'Misc Application: '.$row['description'],
				'source' => 'Misc Applications',
			);
		}
		return $contexts;
	}

	/**  Get a list of all miscapps
	 * Optional parameter is get_ext. Potentially slow, because each row is extracted from the featurecodes table
	 * one-by-one
	 */
	public function malist($get_ext = false) {
		$db = $this->db;
		$sql = "SELECT miscapps_id, description, dest FROM miscapps ORDER BY description ";
		$q = $db->prepare($sql);
		$q->execute();
		if($q){
			$results = $q->fetchAll();
		}
		if ($get_ext) {
			foreach (array_keys($results) as $idx) {
				$fc = new featurecode('miscapps', 'miscapp_'.$results[$idx]['miscapps_id']);
				$results[$idx]['ext'] = $fc->getDefault();
				$results[$idx]['enabled'] = $fc->isEnabled();
			}
		}

		return $results;
	}

	public function get($miscapps_id) {
		$db = $this->db;
		$sql = "SELECT miscapps_id, description, ext, dest FROM miscapps WHERE miscapps_id = ?";
		$q = $db->prepare($sql);
		$q->execute(array($miscapps_id));
		if($q){
			$row = $q->getRow();
		}

		// we want to get the ext from featurecodes
		$fc = new featurecode('miscapps', 'miscapp_'.$row['miscapps_id']);
		$row['ext'] = $fc->getDefault();
		$row['enabled'] = $fc->isEnabled();

		return $row;
	}

	public function add($description, $ext, $dest) {
		$db = $this->db;
		$sql = "INSERT INTO miscapps (description, ext, dest) VALUES (?,?,?)";
		$q = $db->prepare($sql);
		$q->execute(array($description, $ext, $dest));
		if($q){
			$miscapps_id = $db->lastInsertId();
		}else{
			return false;
		}
		$fc = new \featurecode('miscapps', 'miscapp_'.$miscapps_id);
		$fc->setDescription($description);
		$fc->setDefault($ext, true);
		$fc->update();
		return $miscapps_id;
	}
	public function delete($miscapps_id) {
		$db = $this->db;
		$sql = "DELETE FROM miscapps WHERE miscapps_id = ?";
		$q = $db->prepare($sql);
		$q->execute(array($miscapps_id));
		if($q){
			debug('******* q was true **********');
			$fc = new \featurecode('miscapps', 'miscapp_'.$miscapps_id);
			$fc->delete();
			return true;
		}
		return false;
	}

	public function edit($miscapps_id, $description, $ext, $dest, $enabled=true) {
		$db = $this->db;
		$sql = 'UPDATE miscapps SET description = ?, ext = ?, dest = ? WHERE miscapps_id = ?';
		$q = $db->prepare($sql);
		$q->execute(array($description, $ext, $dest, $miscapps_id));
		if($q){
			$fc = new \featurecode('miscapps', 'miscapp_'.$miscapps_id);
			$fc->setDescription($description);
			$fc->setDefault($ext, true);
			$fc->setEnabled($enabled);
			$fc->update();
		}
	}

	public function check_destinations($dest=true) {
		global $active_modules;
		$db = $this->db;
		$destlist = array();
		if (is_array($dest) && empty($dest)) {
			return $destlist;
		}
		if($dest === true){
			$sql = "SELECT miscapps_id, dest, description FROM miscapps";
			$q = $db->prepare($sql);
			$q->execute();
			if($q){
				$results = $q->fetchAll();
			}
		} else {
			$where = implode("','", $dest);
			$sql = "SELECT miscapps_id, dest, description FROM miscapps WHERE dest in ?";
			$q = $db->prepare($sql);
			$q->execute(array($where));
			if($q){
				$results = $q->fetchAll();
			}
		}
		$type = isset($active_modules['miscapps']['type'])?$active_modules['miscapps']['type']:'setup';

		foreach ($results as $result) {
			$thisdest = $result['dest'];
			$thisid   = $result['miscapps_id'];
			$destlist[] = array(
				'dest' => $thisdest,
				'description' => sprintf(_("Misc Application: %s"),$result['description']),
				'edit_url' => 'config.php?display=miscapps&type='.$type.'&extdisplay='.urlencode($thisid),
			);
		}
		return $destlist;
	}

	public function change_destination($old_dest, $new_dest) {
		$db = $this->db;
		$sql = 'UPDATE miscapps SET dest = ? WHERE dest = ?';
		$q = $db->prepare($sql);
		$q->execute(array($new_dest, $old_dest));
		if($q){
			return true;
		}
		return false;
	}
	public function getRightNav($request) {
		return load_view(__DIR__."/views/rnav.php",array());
	}
	public function listApps($get_ext = false) {
		$sql = "SELECT miscapps_id, description, dest FROM miscapps ORDER BY description ";
		$stmt = $this->db->prepare($sql);
		$stmt->execute();
		$results = $ret = $stmt->fetchAll(\PDO::FETCH_ASSOC);
		if ($get_ext) {
			foreach ($results as $idx => $v) {
				$fc = new \featurecode('miscapps', 'miscapp_'.$results[$idx]['miscapps_id']);
				$results[$idx]['ext'] = $fc->getDefault();
				$results[$idx]['enabled'] = $fc->isEnabled();
			}
		}
		return $results;
	}
	public function showPage() {
		$action = !empty($_REQUEST['action']) ? $_REQUEST['action'] : "";
		$content = "";
		switch($action) {
			case "add":
			case "edit":
			        $data['id'] = "None";
			        $data['title'] = _("Add Misc Application");
			        $data['delurl'] = '';
				$data['enabled'] = true;
				$data['extdisplay'] = '';

				if($action == "edit") {
					$row = miscapps_get($_REQUEST['extdisplay']);
					$data['id'] = $row['miscapps_id'];
					$data['title'] = _("Edit Misc Application");
			 		$data['delurl'] = 'config.php?display=miscapps&action=delete&extdisplay=' . $row['miscapps_id'];
					$data['enabled'] = $row['enabled'];
					$data['description'] = $row['description'];
					$data['ext'] = $row['ext'];
					$data['dest'] = $row['dest'];
					$data['helptext'] = '';
					$data['extdisplay'] = $row['miscapps_id'];
				} 
				$base_url = ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] == "on") ? "https" : "http") . '://' . $_SERVER['HTTP_HOST'];
				$data['url'] = $base_url;
				$bootnav = '<div class="col-sm-3 bootnav">
					<div class="list-group">
					<a href="?display=miscapps" class="list-group-item"><i class="fa fa-th-list"></i> '._("Misc Application").'</a>
					</div>
					</div>';
				$content = load_view(__DIR__."/views/form.php",array("action" => $action, "data" => $data));
				break;
			default;
				$content = load_view(__DIR__."/views/grid.php",array());
				$bootnav = '';
			break;
		}
		return load_view(__DIR__."/views/main.php",array("content" => $content, "bootnav" => $bootnav));
	}
	public function ajaxRequest($req, &$setting) {
		switch ($req) {
			case 'rnav':
				return true;
			break;
			default:
				return false;
			break;
		}
	}
	public function ajaxHandler() {
		switch ($_REQUEST['command']) {
			case 'rnav':
				$apps = $this->listApps(true);
				if(!empty($apps) && is_array($apps)) {
					foreach($apps as &$app) {
						 $app['actions'] = '<a href="?display=miscapps&action=edit&extdisplay='.$app['miscapps_id'].'"><i class="fa fa-edit fa-fw"></i></a><a href="?display=miscapps&action=delete&extdisplay='.$app['miscapps_id'].'"><i class="fa fa-trash fa-fw"></i></a>';
					}
					return $apps;
				}else{
					return array();
				}
			break;

			default:
				return array('status' => false, 'message' => 'Invalid command');
				break;
		}
	}
}
