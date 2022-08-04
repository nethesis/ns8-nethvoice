<?php
namespace FreePBX\modules;
class Queueprio implements \BMO {
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
    $action = isset($_REQUEST['action']) ? $_REQUEST['action'] :  '';
    if (isset($_REQUEST['delete'])) $action = 'delete';

    $queueprio_id = isset($_REQUEST['queueprio_id']) ? $_REQUEST['queueprio_id'] :  false;
    $description = isset($_REQUEST['description']) ? $_REQUEST['description'] :  '';
    $queue_priority = isset($_REQUEST['queue_priority']) ? $_REQUEST['queue_priority'] :  '';
    $dest = isset($_REQUEST['dest']) ? $_REQUEST['dest'] :  '';

    if (isset($_REQUEST['goto0']) && $_REQUEST['goto0']) {
    	$dest = $_REQUEST[ $_REQUEST['goto0'].'0' ];
    }

    switch ($action) {
    	case 'add':
    		$_REQUEST['extdisplay'] = queueprio_add($description, $queue_priority, $dest);
    		needreload();
    	break;
    	case 'edit':
    		queueprio_edit($queueprio_id, $description, $queue_priority, $dest);
        $_REQUEST['extdisplay'] = $queueprio_id;
    		needreload();
    	break;
    	case 'delete':
    		queueprio_delete($queueprio_id);
    		needreload();
    	break;
    }
  }
	public function getActionBar($request) {
		$buttons = array();
		switch($request['display']) {
			case 'queueprio':
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
          case 'grid':
            return array_values($this->listAll());
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
  public function listAll() {
  	$dbh = $this->db;
  	$sql = "SELECT queueprio_id, description, queue_priority, dest FROM queueprio ORDER BY description ";
    $stmt = $dbh->prepare($sql);
    $stmt->execute();
    $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);
  	if(!$results) {
      return array();
  	}
  	return $results;
  }
}
