<?php
namespace FreePBX\modules;
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
class Languages implements \BMO {
	public function __construct($freepbx = null) {
		if ($freepbx == null) {
			throw new Exception("Not given a FreePBX Object");
		}

		$this->FreePBX = $freepbx;
		$this->db = $freepbx->Database;
	}
	public function doConfigPageInit($page) {
		$request = $_REQUEST;
		$type = isset($request['type']) ? $request['type'] : 'setup';
		$action = isset($request['action']) ? $request['action'] :  '';
		if (isset($request['delete'])) $action = 'delete';

		$language_id = isset($request['language_id']) ? $request['language_id'] :  false;
		$description = isset($request['description']) ? $request['description'] :  '';
		$lang_code = isset($request['lang_code']) ? $request['lang_code'] :  '';
		$dest = isset($request['dest']) ? $request['dest'] :  '';
		$view = isset($request['view']) ? $request['view'] : '';
		if (isset($request['goto0']) && $request['goto0']) {
			$dest = $request[ $request['goto0'].'0' ];
		}

		switch ($action) {
			case 'add':
				$request['extdisplay'] = $this->addLanguage($description, $lang_code, $dest);
				needreload();
			break;
			case 'edit':
				$this->editLanguage($language_id, $description, $lang_code, $dest);
				needreload();
			break;
			case 'delete':
				$this->delLanguage($language_id);
				needreload();
			break;
		}
	}
	public function install() {

	}
	public function uninstall() {

	}
	public function backup(){

	}
	public function restore($backup){

	}
	public function getActionBar($request) {
		switch ($request['display']) {
			case 'languages':
				$buttons = array(
						'submit' => array(
							'name' => 'submit',
							'id' => 'submit',
							'value' => _("Submit")
						),
						'reset' => array(
							'name' => 'reset',
							'id' => 'reset',
							'value' => _("Reset")
						),
						'delete' => array(
							'name' => 'delete',
							'id' => 'delete',
							'value' => _("Delete")
						),
					);
				if($request['extdisplay'] == ''){
					unset($buttons['delete']);
				}
				if($request['view'] != 'form'){
					unset($buttons);
				}
				return $buttons;
			break;
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
						return array_values($this->listLanguages());
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
	/**
	 * Returns list of languaged
	 * @return array Language list
	 */
	public function listLanguages(){
		$sql = "SELECT language_id, description, lang_code, dest FROM languages ORDER BY description ";
		$stmt = $this->db->prepare($sql);
		$stmt->execute();
		$results = $stmt->fetchall(\PDO::FETCH_ASSOC);
		return $results;
	}

	/**
	 * Get language by id
	 * @param  string $language_id The labnguage ID you wish to retrieve
	 * @return array              An associative array of the language settings
	 */
	public function getLanguage($language_id){
		$sql = "SELECT language_id, description, lang_code, dest FROM languages WHERE language_id = :language_id";
		$stmt = $this->db->prepare($sql);
		$stmt->execute(array(':language_id' => $language_id));
		$row = $stmt->fetch(\PDO::FETCH_ASSOC);
		return $row;
	}

	public function addLanguage($description, $lang_code, $dest){
		$sql = "INSERT INTO languages (description, lang_code, dest) VALUES (:description, :lang_code, :dest)";
		$stmt = $this->db->prepare($sql);
		$ret = $stmt->execute(array(':description' => $description, ':lang_code' => $lang_code, ':dest' => $dest ));
		if($ret){
			return $this->db->lastInsertId();
		}
		return $ret;
	}
	public function delLanguage($language_id){
		$sql = "DELETE FROM languages WHERE language_id = :language_id";
		$stmt = $this->db->prepare($sql);
		return $stmt->execute(array(':language_id' => $language_id));
	}
	public function editLanguage($language_id, $description, $lang_code, $dest){
		$sql = "UPDATE languages SET description = :description, lang_code = :lang_code, dest = :dest WHERE language_id = :language_id";
		$stmt = $this->db->prepare($sql);
		return $stmt->execute(array(':description' => $description, ':lang_code' => $lang_code, ':dest' => $dest, ':language_id' => $language_id ));
	}

	public function changeDestination($old_dest, $new_dest){
		$sql = 'UPDATE languages SET dest = :new_dest WHERE dest = :old_dest';
		$stmt = $this->db->prepare($sql);
		return $stmt->execute(array(':old_dest' => $old_dest, ':new_dest' => $new_dest));
	}

	public function getRightNav($request) {
	  if(isset($request['view']) && $request['view'] == 'form'){
	    return load_view(__DIR__."/views/bootnav.php",array());
	  }
	}
	public function getUserLanguage($xtn) {
		$langcode = $this->FreePBX->astman->database_get("AMPUSER",$xtn."/language");
		return $langcode;
	}
	public function getAllUserLanguages() {
		$items = $this->FreePBX->astman->database_show('AMPUSER');
		$final = array();
		foreach($items as $key => $value) {
			if(preg_match('/AMPUSER\/(\d+)\/language/',$key,$matches) && !empty($value)) {
				$final[$matches[1]] = $value;
			}
		}
		return $final;
	}
	public function delUserLanguage($xtn) {
		return $this->FreePBX->astman->database_deltree("AMPUSER/$xtn/language");
	}
	public function updateUserLanguage($ext, $langcode) {
		return $this->FreePBX->astman->database_put("AMPUSER",$ext."/language",$langcode);
	}
	//Bulk functions
	public function getAllLanguages() {
		$au = $this->FreePBX->astman->database_show('AMPUSER');
		$ret = array();
		foreach($au as $k => $v){
			$temp = explode('/',$k);
			if($temp[3] == 'language'){
				$ret[$temp[2]] = $v;
			}
		}
		return $ret;
	}
	public function setLanguageByExtension($extension, $language){
		return $this->FreePBX->astman->database_put('AMPUSER/'.$extension,'language',$language);
	}
	//Bulkhandler hooks
	public function bulkhandlerGetHeaders($type) {
		switch ($type) {
			case 'extensions':
				$headers = array(
					'languages_language' => array(
						'identifier' => _('Language'),
						'description' => _('Valid language string'),
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
			$extens = $this->getAllLanguages();
			foreach ($extens as $key => $value) {
				$data[$key] = array('languages_language' => $value);
			}
			break;
		}
		return $data;
	}
	public function bulkhandlerImport($type,$rawData, $replaceExisting = true){
		switch ($type) {
			case 'extensions':
				foreach ($rawData as $data) {
					if(isset($data['languages_language'])) {
						$curVal = trim($data['languages_language']);
						$this->setLanguageByExtension($data['extension'], $curVal);
					}
				}
			break;
		}
	}

	public function doDialplanHook(&$ext, $engine, $priority) {
		global $core_conf;

		$users = $this->getAllUserLanguages();
		$devices = $this->FreePBX->Core->getAllDevicesByType();
		foreach($devices as $device) {
			if($device['devicetype'] === "fixed" && isset($device['user']) && isset($users[$device['user']])) {
				switch($device['tech']) {
					case 'sip':
						$core_conf->addSipAdditional($device['id'],'language',$users[$device['user']]);
					break;
					case 'iax2':
						$core_conf->addIaxAdditional($device['id'],'language',$users[$device['user']]);
					break;
					case 'dahdi':
						$core_conf->addDahdiAdditional($device['id'],'language',$users[$device['user']]);
					break;
					case 'pjsip':
						$pjsip = $this->FreePBX->Core->getDriver("pjsip");
						if(is_object($pjsip)) {
							$pjsip->addEndpoint($device['id'], 'language', $users[$device['user']]);
						}
					break;
				}
			}
		}
	}

	public static function myDialplanHooks() {
		return true;
	}
}
