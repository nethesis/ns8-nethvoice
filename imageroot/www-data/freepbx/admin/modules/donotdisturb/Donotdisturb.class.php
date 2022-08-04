<?php
// vim: set ai ts=4 sw=4 ft=php:

class Donotdisturb implements BMO {

	public function __construct($freepbx = null) {
		if ($freepbx == null) {
			throw new Exception("Not given a FreePBX Object");
		}

		$this->FreePBX = $freepbx;
		$this->db = $freepbx->Database;
	}

	public function doConfigPageInit($page) {

	}

	public function install() {

	}
	public function uninstall() {

	}
	public function backup(){

	}
	public function restore($backup){

	}
	public function genConfig() {

	}

	public function getAllStatuses() {
		return $this->FreePBX->astman->database_show('DND');
	}

	public function getStatusByExtension($extension) {
		return $this->FreePBX->astman->database_get('DND', $extension);
	}

	public function setStatusByExtension($extension, $state = '') {
		if ($state != "") {
			$ret = $this->FreePBX->astman->database_put('DND',$extension,$state);
			$value_opt = 'BUSY';
		} else {
			$ret = $this->FreePBX->astman->database_del('DND',$extension);
			$value_opt = 'NOT_INUSE';
		}

		if ($this->FreePBX->Config->get_conf_setting('USEDEVSTATE')) {
			$AST_FUNC_DEVICE_STATE = $this->FreePBX->Config->get_conf_setting('AST_FUNC_DEVICE_STATE');
			$devices = $this->FreePBX->astman->database_get("AMPUSER", $extension . "/device");
			$device_arr = explode('&', $devices);
			foreach ($device_arr as $device) {
				$ret = $this->FreePBX->astman->set_global($AST_FUNC_DEVICE_STATE . "(Custom:DEVDND$device)", $value_opt);
			}
			// And also handle the state associated with the user
			$ret = $this->FreePBX->astman->set_global($AST_FUNC_DEVICE_STATE . "(Custom:DND$extension)", $value_opt);
		}
		return $ret;
	}
}
