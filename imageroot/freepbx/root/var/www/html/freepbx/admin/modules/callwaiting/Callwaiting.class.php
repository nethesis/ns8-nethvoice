<?php
// vim: set ai ts=4 sw=4 ft=php:

class Callwaiting implements BMO {

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
		return $this->FreePBX->astman->database_show('CW');
	}

	public function getStatusByExtension($extension) {
		return $this->FreePBX->astman->database_get('CW', $extension);
	}

	public function setStatusByExtension($extension, $state = '') {
		$state = trim($state);
		if (!empty($state)) {
			$ret = $this->FreePBX->astman->database_put('CW',$extension,$state);
		} else {
			$ret = $this->FreePBX->astman->database_del('CW',$extension);
			$ret = $ret['result'];
		}
		return $ret;
	}
	public function bulkhandlerGetHeaders($type) {
		switch ($type) {
			case 'extensions':
				$headers = array(
					'callwaiting_enable' => array(
						'identifier' => _('Call Waiting Enabled'),
						'description' => _('Call Waiting Enabled: ENABLED to enable, blank to disable'),
					),
				);
				return $headers;
			break;
		}
	}
	public function bulkhandlerExport($type) {
		$data = NULL;
		switch ($type) {
			case 'extensions':
			$data = array();
			$extens = $this->getAllStatuses();
			foreach ($extens as $key => $value) {
				$ext = substr($key,4);
				if($value === 'ENABLED'){
					$data[$ext] = array('callwaiting_enable' => $value);
				}else{
					$data[$ext] = array('callwaiting_enable' => '');
				}
			}
			break;
		}
		return $data;
	}
	public function bulkhandlerImport($type,$rawData, $replaceExisting = true){
		switch ($type) {
			case 'extensions':
				foreach ($rawData as $data) {
					if(isset($data['callwaiting_enable'])) {
						$curVal = trim($data['callwaiting_enable']);
						if($curVal === 'ENABLED'){
							$this->setStatusByExtension($data['extension'], $curVal);
						}else{
							$this->setStatusByExtension($data['extension']);
						}
					}
				}
			break;
		}
	}
}
