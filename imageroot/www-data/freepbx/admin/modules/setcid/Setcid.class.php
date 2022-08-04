<?php
// vim: set ai ts=4 sw=4 ft=php:
/**
 * Set CID
 */
namespace FreePBX\modules;
class Setcid implements \BMO {
	public function __construct($freepbx = null) {
		if ($freepbx == null) {
			throw new \Exception("Not given a FreePBX Object");
		}

		$this->FreePBX = $freepbx;
		$this->db = $freepbx->Database;
	}

	public function install() {}
	public function uninstall() {}
	public function backup(){}
	public function restore($backup){}
	public function doConfigPageInit($display) {}

	public function ajaxRequest($req, &$setting) {
		switch($req) {
			case "getable":
				return true;
			break;
		}
		return false;
	}

	public function ajaxHandler() {
		switch($_REQUEST['command']) {
			case "getable":
				$cids = $this->getAll();
				foreach($cids as &$cid) {
					$cid['actions'] = '<a href="?display=setcid&amp;view=form&amp;id='.$cid['cid_id'].'"><i class="fa fa-edit"></i></i></a> <a href="?display=setcid&amp;action=delete&amp;id='.$cid['cid_id'].'"><i class="fa fa-trash"></i></a>';
				}
				return $cids;
			break;
		}
	}

	public function showPage() {
		if(isset($_REQUEST['action'])) {
			if($_REQUEST['action'] == "delete") {
				$this->delete($_REQUEST['id']);
				\needreload();
			} elseif($_REQUEST['action'] == "save") {
				$id = !empty($_REQUEST['id']) ? $_REQUEST['id'] : null;
				$goto = $_REQUEST[$_REQUEST['goto0'].'0'];
				$this->update($id, $_REQUEST['description'], $_REQUEST['cid_name'], $_REQUEST['cid_num'], $goto);
				\needreload();
			}
		}
		$view = !empty($_REQUEST['view']) ? $_REQUEST['view'] : "";
		$usage_list = '';
		switch($view) {
			case "form":
				if(isset($_REQUEST['id'])) {
					$usage_list = $this->FreePBX->View->destinationUsage(setcid_getdest($_REQUEST['id']));
					$item = $this->get($_REQUEST['id']);
				} else {
					$item = array(
						"cid_name" => '${CALLERID(name)}',
						"cid_num" => '${CALLERID(num)}'
					);
				}
				$content = load_view(__DIR__."/views/form.php",array("item" => $item));
			break;
			default:
				$content = load_view(__DIR__."/views/grid.php",array());
			break;
		}
		return load_view(__DIR__."/views/main.php",array("content" => $content, "usage_list" => $usage_list));
	}

	public function getAll() {
		$sql = "SELECT cid_id, description, cid_name, cid_num, dest FROM setcid ORDER BY description ";
		$sth = $this->db->prepare($sql);
		$sth->execute();
		$results = $sth->fetchAll(\PDO::FETCH_ASSOC);
		return !empty($results) ? $results : array();
	}

	public function get($id) {
		$sql = "SELECT cid_id, description, cid_name, cid_num, dest FROM setcid WHERE cid_id = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($id));
		$results = $sth->fetch(\PDO::FETCH_ASSOC);
		return !empty($results) ? $results : array();
	}

	public function update($id=null, $description, $name, $number, $dest) {
		$sql = "REPLACE INTO setcid (cid_id, description, cid_name, cid_num, dest) VALUES (?, ?, ?, ?, ?)";
		$sth = $this->db->prepare($sql);
		return $sth->execute(array($id, $description, $name, $number, $dest));
	}

	public function delete($id) {
		$sql = "DELETE FROM setcid WHERE cid_id = ?";
		$sth = $this->db->prepare($sql);
		return $sth->execute(array($id));
	}

	public function getActionBar($request) {
		$buttons = array();
		if($request['display'] == 'setcid' && isset($request['view'])) {
			switch($request['view']) {
				case 'form':
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
				break;
			}
		}
		if(empty($request['id'])) {
			unset($buttons['delete']);
		}
		return $buttons;
	}
	public function getRightNav($request) {
	  if(isset($request['view']) && $request['view'] == 'form'){
	    return load_view(__DIR__."/views/rnav.php",array());
	  }
	}

}
