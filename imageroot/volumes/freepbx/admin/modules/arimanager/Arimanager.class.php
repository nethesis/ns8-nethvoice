<?php

//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013-2015 Sangoma Technologies Inc.
//
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;
class Arimanager implements BMO {
	public function __construct($freepbx = null) {
		if ($freepbx == null) {
			throw new Exception("Not given a FreePBX Object");
		}

		$this->FreePBX = $freepbx;
		$this->db = $freepbx->Database;
		$this->Conf = $freepbx->Config;
		$this->astman = $this->FreePBX->astman;
		$this->message = array();
	}

	public function getActionBar($request) {
		$buttons = array();

		switch($request['display']) {
			case 'arimanager':
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
				if (empty($request['user'])) {
					unset($buttons['delete']);
				}
				if(!isset($_REQUEST['view'])){
					$buttons = array();
				}
			break;
		}
		return $buttons;
	}

	public function doConfigPageInit($page) {
		if(!empty($_POST)) {
			$readonly = ($_POST['readonly'] == 'yes') ? 1 : 0;
			if(empty($_POST['id'])) {
				$id = $this->addUser($_POST['name'],$_POST['password'],$_POST['password_type'],$readonly);
			} else {
				if($_POST['password'] == '******') {
					$this->editUser($_POST['id'],$_POST['name'],$readonly);
				} else {
					$this->editUser($_POST['id'],$_POST['name'],$readonly,$_POST['password'],$_POST['password_type']);
				}
			}
			needreload();
		} elseif(isset($_REQUEST['action']) && $_REQUEST['action'] == 'delete') {
			if(!empty($_REQUEST['user'])) {
				$this->deleteUser($_REQUEST['user']);
				needreload();
			}
		}
	}

	/**
	 * Add new ARI User
	 * @param string  $username Username
	 * @param string  $password Password
	 * @param string  $type     Plaintext or cypt password
	 * @param integer $readonly Read Only user
	 */
	public function addUser($username, $password, $type = 'crypt', $readonly = 1) {
		if($this->checkUsername($username)) {
			$this->message = array('type' => 'danger', 'message' => _('User Already Exists!'));
			return false;
		}
		$sql = 'INSERT INTO arimanager (`name`,`password`,`password_format`,`read_only`) VALUES (?, ?, ?, ?)';
		$sth = $this->db->prepare($sql);
		$p = $this->genPassword($password,$type);
		try {
			$sth->execute(array($username,$p['password'],$p['type'],$readonly));
			$id = $this->db->lastInsertId();
		} catch (Exception $e) {
			$this->message = array('type' => 'danger', 'message' => $e->getMessage());
			return false;
		}
		$this->message = array('type' => 'success', 'message' => _('Sucessfully Added User'));
		return $id;
	}

	/**
	 * Add new ARI User
	 * @param integer $id       The ID of the user
	 * @param string  $username Username
	 * @param integer $readonly Read Only user
	 * @param string  $password Password
	 * @param string  $type     Plaintext or cypt password
	 */
	public function editUser($id, $username, $readonly = 1, $password = '', $type = 'crypt') {
		if(empty($password)) {
			$sql = "UPDATE arimanager SET name = ?, read_only = ? WHERE id = ?";
			$sth = $this->db->prepare($sql);
			try {
				$sth->execute(array($username,$readonly,$id));
			} catch (Exception $e) {
				$this->message = array('type' => 'danger', 'message' => $e->getMessage());
				return false;
			}
		} else {
			$p = $this->genPassword($password,$type);
			$sql = "UPDATE arimanager SET name = ?, read_only = ?, password = ?, password_format = ? WHERE id = ?";
			$sth = $this->db->prepare($sql);
			try {
				$sth->execute(array($username,$readonly,$p['password'],$p['type'],$id));
			} catch (Exception $e) {
				$this->message = array('type' => 'danger', 'message' => $e->getMessage());
				return false;
			}
		}
		$this->message = array('type' => 'success', 'message' => _('Sucessfully Updated User'));
		return true;
	}

	/**
	 * Check if username exists
	 * @param  string $username The username to check
	 * @return boolean           If the username exists or not
	 */
	private function checkUsername($username) {
		$sql = "SELECT * FROM arimanager WHERE name = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($username));
		$t = $sth->fetch(PDO::FETCH_ASSOC);
		return !empty($t);
	}

	/**
	 * Generate a crypted password
	 * @param  string $password The cypted password
	 * @param  string $type     If crypt this will be 'crypt'
	 * @return [type]           [description]
	 */
	private function genPassword($password,$type) {
		if($type == 'crypt') {
			$l = $this->astman->Command('ari mkpasswd '.$password);
			if(preg_match('/password =(.*)/i',$l['data'],$matches)) {
				$password = trim($matches[1]);
			} else {
				$type = 'plain';
			}
		}
		return array("password" => $password, "type" => $type);
	}

	/**
	 * Delete User By ID
	 * @param  integer $id The ID of the user
	 */
	public function deleteUser($id) {
		$sql = 'DELETE FROM arimanager WHERE id = ?';
		$sth = $this->db->prepare($sql);
		$sth->execute(array($id));
		$this->message = array('type' => 'success', 'message' => _('Sucessfully Deleted User'));
	}

	/**
	 * Get all users
	 * @return mixed Return array of users
	 */
	public function getAllUsers() {
		$sql = "SELECT * FROM arimanager";
		$sth = $this->db->prepare($sql);
		$sth->execute();
		return $sth->fetchAll(PDO::FETCH_ASSOC);
	}

	/**
	 * Get User data by username
	 * @param  string $username Username
	 * @return mixed           Array of user data or false if no user
	 */
	public function getUserByUsername($username) {
		$sql = "SELECT * FROM arimanager WHERE name = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($username));
		return $sth->fetch(PDO::FETCH_ASSOC);
	}

	/**
	 * Get User by ID
	 * @param  integer $id The ID of the User
	 * @return mixed     Array of user data or false if no user
	 */
	public function getUser($id) {
		$sql = "SELECT * FROM arimanager WHERE id = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($id));
		return $sth->fetch(PDO::FETCH_ASSOC);
	}

	public function display() {
		$array = array(
			"users" => $this->getAllUsers(),
			"arienabled" => $this->Conf->get_conf_setting('ENABLE_ARI'),
			"httpenabled" => $this->Conf->get_conf_setting('HTTPENABLED'),
			"freepbxuser" => $this->Conf->get_conf_setting('FPBX_ARI_USER')
		);
		if(!empty($_REQUEST['user'])) {
			$array['user'] = $this->getUser($_REQUEST['user']);
			$array['password'] = "******";
		} else {
			$array['user'] = array();
			$array['password'] = md5(openssl_random_pseudo_bytes(16));
		}

		$array['usernames'] = array();
		foreach($array['users'] as $user) {
			if(empty($array['user']['name']) || (!empty($array['user']['name']) && ($array['user']['name'] != $user['name']))) {
				$array['usernames'][] = $user['name'];
			}
		}
		$view = isset($_REQUEST['view'])?$_REQUEST['view']:'';
		switch($view){
			case 'form':
				$content = load_view(__DIR__.'/views/form.php',$array);
				return show_view(__DIR__.'/views/main.php',array('content' => $content, 'httpenabled' => $array['httpenabled'], 'arienabled' =>$array['arienabled'], "message" => $this->message));
			break;
			default:
				$content = load_view(__DIR__.'/views/grid.php');
				return show_view(__DIR__.'/views/main.php',array('content' => $content, 'httpenabled' => $array['httpenabled'], 'arienabled' =>$array['arienabled'], "message" => $this->message));
			break;
		}
	}

	/* Assorted stubs to validate the BMO Interface */
	public function install() {
		$sql = "CREATE TABLE IF NOT EXISTS `arimanager` (
			`id` int(11) NOT NULL AUTO_INCREMENT,
			`name` varchar(15) NOT NULL,
			`password` varchar(255) DEFAULT NULL,
			`password_format` varchar(255) DEFAULT NULL,
			`read_only` int(1) DEFAULT '1',
			PRIMARY KEY (`id`),
			UNIQUE KEY `name_UNIQUE` (`name`)
		)";

		out(_('Creating ARI Manager Table'));
		$this->db->query($sql);

		$set['value'] = false;
		$set['defaultval'] =& $set['value'];
		$set['options'] = '';
		$set['readonly'] = 0;
		$set['hidden'] = 0;
		$set['level'] = 0;
		$set['module'] = '';
		$set['category'] = _('Asterisk REST Interface');
		$set['emptyok'] = 0;
		$set['name'] = _('Enable the Asterisk REST Interface');
		$set['description'] = _("Asterisk 12 introduces the Asterisk REST Interface, a set of RESTful API's for building Asterisk based applications. This will enable the ARI server as long as the HTTP server is enabled as well.");
		$set['type'] = CONF_TYPE_BOOL;
		$this->Conf->define_conf_setting('ENABLE_ARI',$set);

		$set['value'] = 'freepbxuser';
		$set['defaultval'] =& $set['value'];
		$set['options'] = '';
		$set['readonly'] = 1;
		$set['hidden'] = 0;
		$set['level'] = 0;
		$set['module'] = '';
		$set['category'] = _('Asterisk REST Interface');
		$set['emptyok'] = 0;
		$set['name'] = _('ARI Username');
		$set['description'] = _("Username for internal ARI calls");
		$set['type'] = CONF_TYPE_TEXT;
				$set['sortorder'] = 98;
		$this->Conf->define_conf_setting('FPBX_ARI_USER',$set);

		$set['value'] = md5(openssl_random_pseudo_bytes(16));
		$set['defaultval'] =& $set['value'];
		$set['options'] = '';
		$set['readonly'] = 1;
		$set['hidden'] = 0;
		$set['level'] = 0;
		$set['module'] = '';
		$set['category'] = _('Asterisk REST Interface');
		$set['emptyok'] = 0;
		$set['name'] = _('ARI Password');
		$set['description'] = _("Password for internal ARI calls");
		$set['type'] = CONF_TYPE_TEXT;
				$set['sortorder'] = 99;
		$this->Conf->define_conf_setting('FPBX_ARI_PASSWORD',$set);

		$set['value'] = false;
		$set['defaultval'] =& $set['value'];
		$set['options'] = '';
		$set['readonly'] = 0;
		$set['hidden'] = 0;
		$set['level'] = 0;
		$set['module'] = '';
		$set['category'] = _('Asterisk REST Interface');
		$set['emptyok'] = 0;
		$set['name'] = _('Pretty Print JSON Responses');
		$set['description'] = _("Enable pretty-printing of the JSON responses from Asterisk");
		$set['type'] = CONF_TYPE_BOOL;
		$this->Conf->define_conf_setting('ENABLE_ARI_PP',$set);

		$set['value'] = '100';
		$set['defaultval'] =& $set['value'];
		$set['options'] = array(100,10000);
		$set['readonly'] = 0;
		$set['hidden'] = 0;
		$set['level'] = 0;
		$set['module'] = '';
		$set['category'] = _('Asterisk REST Interface');
		$set['emptyok'] = 0;
		$set['name'] = _('Web Socket Write Timeout');
		$set['description'] = _("The timeout (in milliseconds) to set on WebSocket connections.");
		$set['type'] = CONF_TYPE_INT;
		$this->Conf->define_conf_setting('ARI_WS_WRITE_TIMEOUT',$set);

		$set['value'] = '*';
		$set['defaultval'] =& $set['value'];
		$set['options'] = '';
		$set['readonly'] = 0;
		$set['hidden'] = 0;
		$set['level'] = 0;
		$set['module'] = '';
		$set['category'] = _('Asterisk REST Interface');
		$set['emptyok'] = 0;
		$set['name'] = _('Allowed Origins');
		$set['description'] = _("Comma separated list of allowed origins, for Cross-Origin Resource Sharing. May be set to * to allow all origins.");
		$set['type'] = CONF_TYPE_TEXT;
		$this->Conf->define_conf_setting('ARI_ALLOWED_ORIGINS',$set);

		$this->Conf->commit_conf_settings();
	}

	public function uninstall() {
		out(_("Dropping ARI Manager Table"));
		$sql = "DROP TABLE IF EXISTS arimanager";
		$this->db->query($sql);

		out(_('Remove FreePBX Advanced Settings'));
		//Remove FreePBX Advanced Setting
		$this->Conf->remove_conf_settings('ENABLE_ARI');
		$this->Conf->remove_conf_settings('ENABLE_ARI_PP');
		$this->Conf->remove_conf_settings('ARI_WS_WRITE_TIMEOUT');
		$this->Conf->remove_conf_settings('ARI_ALLOWED_ORIGINS');
		$this->Conf->remove_conf_settings('FPBX_ARI_PASSWORD');
		$this->Conf->remove_conf_settings('FPBX_ARI_USER');
	}

	public function backup() {
	}
	public function restore($config) {
	}

	public function genConfig() {
		$en = $this->Conf->get_conf_setting('ENABLE_ARI') ? 'yes' : 'no';
		$pt = $this->Conf->get_conf_setting('ENABLE_ARI_PP') ? 'yes' : 'no';
		$timeout = $this->Conf->get_conf_setting('ARI_WS_WRITE_TIMEOUT');
		$allowed_origins = $this->Conf->get_conf_setting('ARI_ALLOWED_ORIGINS');
		$array['ari_general_additional.conf'] = "enabled=".$en."\npretty=".$pt."\nwebsocket_write_timeout=".$timeout."\nallowed_origins=".$allowed_origins;
		$ariuser = $this->Conf->get_conf_setting('FPBX_ARI_USER');
		$aripass = $this->genPassword($this->Conf->get_conf_setting('FPBX_ARI_PASSWORD'),'crypt');

		$users = $this->getAllUsers();
		$users[] = array(
			'name' => $ariuser,
			'password' => $aripass['password'],
			'password_format' => $aripass['type'],
			'read_only' => 0
		);
		$array['ari_additional.conf'] = array();
		foreach($users as $user) {
			$array['ari_additional.conf'][$user['name']] = array(
				"type" => "user",
				"password" => $user['password'],
				"password_format" => $user['password_format'],
				"read_only" => !empty($user['read_only']) ? 'yes' : 'no'
			);
		}

		return $array;
	}

	public function writeConfig($conf){
		$this->FreePBX->WriteConfig($conf);
	}
	public function ajaxRequest($req, &$setting) {
		switch ($req) {
		case 'grid':
		case 'listApps':
			return true;
		break;
		default:
			return false;
		break;
		}
	}

	public function ajaxHandler(){
		switch ($_REQUEST['command']) {
			case 'grid':
				$data = array_values($this->getAllUsers());
				if($data){
					return $data;
				}else{
					return array();
				}
			break;
			case 'listApps':
				$ariuser = $this->Conf->get_conf_setting('FPBX_ARI_USER');
				$aripass = $this->Conf->get_conf_setting('FPBX_ARI_PASSWORD');
				$pest = new \Pest('http://localhost:8088/ari/');
				$pest->setupAuth($ariuser, $aripass);
				$apps = $pest->get('/applications');
				return json_decode($apps);
			break;
			default:
			return false;
		break;
		}
	}
	public function loadUsers($data){
		if(!is_array($data)){
			$data = array();
		}
		foreach ($data as $user) {
			$this->addUser($user['username'], $user['password'], $user['type'], $user['readonly']);
		}
	}

	public function getRightNav($request) {
		if(isset($request['view'])) {
			return load_view(__DIR__."/views/rnav.php",array());
		} else {
			return '';
		}
	}
}
