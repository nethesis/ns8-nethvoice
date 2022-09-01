<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
namespace FreePBX\modules;
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

class Daynight implements \BMO {
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
    $request=$_REQUEST;
		$action = isset($request['action'])?$request['action']:'';
		$password = isset($request['password'])?$request['password']:'';
		$fc_description = isset($request['fc_description'])?$request['fc_description']:'';
		$day_recording_id = isset($request['day_recording_id']) ? $request['day_recording_id'] :  '';
		$night_recording_id = isset($request['night_recording_id']) ? $request['night_recording_id'] :  '';
		isset($request['itemid'])?$itemid=$request['itemid']:$itemid='';
		$extdisplay = isset($request['extdisplay'])? $request['extdisplay']:'';
		switch ($action) {
			case "add":
			case "edit":
			case "edited":
					$this->edit($request,$itemid);
					\needreload();
					$_REQUEST['view'] = null;
					break;
			case "delete":
					$this->del($itemid,true);
					\needreload();
					$_REQUEST['view'] = null;
					break;
		}
  }
	public function getActionBar($request) {
		$buttons = array();

		switch($request['display']) {
			case 'daynight':
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
				if (!isset($request['itemid']) || $request['itemid'] =='') {
					unset($buttons['delete']);
				}
				if(empty($request['view']) || $request['view'] != 'form'){
					$buttons = array();
				}
			break;
		}
		return $buttons;
	}

	public function getRightNav($request) {
		if($request['view']=='form'){
    	return load_view(__DIR__."/views/bootnav.php",array());
		}
	}

	public function listCallFlows() {
		$sql = "SELECT ext, dest FROM daynight WHERE dmode = 'fc_description' ORDER BY ext";
		$stmt = $this->db->prepare($sql);
		$stmt->execute();
		$results = $stmt->fetchall(\PDO::FETCH_ASSOC);
		if(is_array($results)){
			foreach($results as $result){
				$list[] = $result;
			}
		}
		if (isset($list)) {
			return $list;
		} else {
			return array();
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
						return array_values($this->listCallFlows());
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

	public function tcAdd($data){
		if(\FreePBX::Config()->get('DAYNIGHTTCHOOK')){
			$sql = "DELETE FROM `daynight` WHERE `dmode` IN ('timeday', 'timenight') AND dest = :id";
			$stmt = $this->db->prepare($sql);
			$stmt->execute(array(':id' => $data['id']));
			if (isset($data['post']['daynight_ref']) && $data['post']['daynight_ref'] != '') {
				$daynight_vals = explode(',',$data['post']['daynight_ref'],2);
				$sql = "INSERT INTO `daynight` (`ext`, `dmode`, `dest`) VALUES (:ext, :dmode, :dest)";
				$vars = array(':ext' => $daynight_vals[0], ':dmode' => $daynight_vals[1], ':dest' => $data['id'] );
				$stmt = $this->db->prepare($sql);
				$stmt->execute($vars);
			}
		}
	}

	public function tcDelete($data){
		if(\FreePBX::Config()->get('DAYNIGHTTCHOOK')){
			$sql = "DELETE FROM `daynight` WHERE `dmode` IN ('timeday', 'timenight') AND dest = :id";
			$stmt = $this->db->prepare($sql);
			$stmt->execute(array(':id' => $data));
		}
	}

	public function edit($post, $id=0){
		if($post['action'] != "add"){
			$this->del($id);
		}
		$day   = isset($post[$post['goto0'].'0'])?$post[$post['goto0'].'0']:'';
		$night = isset($post[$post['goto1'].'1'])?$post[$post['goto1'].'1']:'';
		$sql = "INSERT INTO daynight (ext, dmode, dest) VALUES (:id, :item, :value)";
		$stmt = $this->db->prepare($sql);
		$returns = array();
		$returns['day'] = $stmt->execute(array(':id' => $id, ':item' => 'day', ':value' => $day));
		$returns['night'] = $stmt->execute(array(':id' => $id, ':item' => 'night', ':value' => $night));
		if (isset($post['password']) && trim($post['password'] != "")) {
			$returns['password'] = $stmt->execute(array(':id' => $id, ':item' => 'password', ':value' => $post['password']));
		}
		$fc_description = isset($post['fc_description']) ? trim($post['fc_description']) : "";
		$returns['fc_description'] = $stmt->execute(array(':id' => $id, ':item' => 'fc_description', ':value' => $fc_description));
		$day_recording_id = isset($post['day_recording_id']) ? trim($post['day_recording_id']) : "";
		$returns['day_recording_id'] = $stmt->execute(array(':id' => $id, ':item' => 'day_recording_id', ':value' => $day_recording_id));
		$night_recording_id = isset($post['night_recording_id']) ? trim($post['night_recording_id']) : "";
		$returns['night_recording_id'] = $stmt->execute(array(':id' => $id, ':item' => 'night_recording_id', ':value' => $night_recording_id));
		$this->delState($id);
		$this->addState($id, $post['state']);
		$fcc = new \featurecode('daynight', 'toggle-mode-'.$id);
		if ($fc_description) {
			$fcc->setDescription("$id: $fc_description");
		} else {
			$fcc->setDescription("$id: Call Flow Toggle Control");
		}
		$fcc->setDefault('*28'.$id);
		$fcc->setProvideDest();
		$fcc->update();
		unset($fcc);
		\needreload();
		return $returns;
	}
	public function del($id, $all=false){
		$sql = "DELETE FROM daynight WHERE dmode IN ('day', 'night', 'password', 'fc_description','day_recording_id','night_recording_id') AND ext = :id";
		if($all){
			$sql = "DELETE FROM daynight WHERE ext = :id";
		}
		$stmt = $this->db->prepare($sql);
		$ret = $stmt->execute(array(':id' => $id));
		if($all){
			$fcc = new \featurecode('daynight', 'toggle-mode-'.$id);
			$fcc->delete();
			unset($fcc);
			$this->delState($id);
		}
		return $ret;
	}

	public function getState($id){
		if ($this->astman != null) {
			$mode = $this->astman->database_get("DAYNIGHT","C".$id);
			if ($mode != "DAY" && $mode != "NIGHT") {
				return false;
			} else {
				return $mode;
			}
		} else {
			die_freepbx("No open connection to asterisk manager, can not access object.");
		}
	}

	public function setState($id, $state){
		if ($this->getState($id) === false) {
			die_freepbx("You must create the object before setting the state.");
			return false;
		} else {
			switch ($state) {
				case "DAY":
				case "NIGHT":
					if ($this->astman != null) {
						$this->astman->database_put("DAYNIGHT","C".$id,$state);
						if ($this->DEVSTATE) {
							$value_opt = ($state  == 'DAY') ? 'NOT_INUSE' : 'INUSE';
							$this->astman->set_global("DEVICE_STATE(Custom:DAYNIGHT".$id.")", $value_opt);
						}
					} else {
						die_freepbx("No open connection to asterisk manager, can not access object.");
					}
					break;
				default:
					die_freepbx("Invalid state: $state");
					break;
			}
		}
	}

	public function addState($id, $state="DAY"){
		$current_state = $this->getState($id);
		if ($current_state !== false) {
			die_freepbx("Object already exists and is in state: $current_state, you must delete it first");
			return false;
		} else {
			switch ($state) {
				case "DAY":
				case "NIGHT":
					if ($this->astman != null) {
						$this->astman->database_put("DAYNIGHT","C".$id,$state);
						$value_opt = ($state  == 'DAY') ? 'NOT_INUSE' : 'INUSE';
						$this->astman->set_global("DEVICE_STATE(Custom:DAYNIGHT".$id.")", $value_opt);

					} else {
						die_freepbx("No open connection to asterisk manager, can not access object.");
					}
					break;
				default:
					die_freepbx("Invalid state: $state");
					break;
			}
		}
	}
	public function delState($id){
		if ($this->astman != null) {
			$this->astman->database_del("DAYNIGHT","C".$id);
		} else {
			die_freepbx("No open connection to asterisk manager, can not access object.");
		}
	}

}
