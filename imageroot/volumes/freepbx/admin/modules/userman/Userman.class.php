<?php
// vim: set ai ts=4 sw=4 ft=php:
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//
namespace FreePBX\modules;
include __DIR__."/vendor/autoload.php";
class Userman extends \FreePBX_Helpers implements \BMO {
	private $registeredFunctions = array();
	private $message = '';
	private $userTable = 'userman_users';
	private $userSettingsTable = 'userman_users_settings';
	private $groupTable = 'userman_groups';
	private $groupSettingsTable = 'userman_groups_settings';
	private $directoryTable = 'userman_directories';
	private $brand = 'FreePBX';
	private $tokenExpiration = "1 day";
	private $directories = array();
	private $globalDirectory = null;

	private $moduleGroupSettingsCache = array();
	private $moduleUserSettingsCache = array();

	private $allUsersCache = array();
	private $allGroupsByUserCache = array();

	public function __construct($freepbx = null) {
		$this->FreePBX = $freepbx;
		$this->db = $freepbx->Database;
		$this->brand = $this->FreePBX->Config->get("DASHBOARD_FREEPBX_BRAND");

		if(!interface_exists('FreePBX\modules\Userman\Auth\Base')) {
			include(__DIR__."/functions.inc/auth/Base.php");
		}
		if(!class_exists('FreePBX\modules\Userman\Auth\Auth')) {
			include(__DIR__."/functions.inc/auth/Auth.php");
		}

		try {
			$this->loadActiveDirectories();
		} catch(\Exception $e) {}
	}

	/**
	 * Search for users
	 * @param  string $query   The query string
	 * @param  array $results Array of results (note that this is pass-by-ref)
	 */
	public function search($query, &$results) {
		if(!ctype_digit($query)) {
			$sql = "SELECT * FROM ".$this->userTable." WHERE (username LIKE :query or description LIKE :query or fname LIKE :query or lname LIKE :query or displayname LIKE :query or title LIKE :query or company LIKE :query or department LIKE :query or email LIKE :query)";
			$sth = $this->db->prepare($sql);
			$sth->execute(array("query" => "%".$query."%"));
			$rows = $sth->fetchAll(\PDO::FETCH_ASSOC);
			foreach($rows as $entry) {
				$entry['displayname'] = !empty($entry['displayname']) ? $entry['displayname'] : trim($entry['fname'] . " " . $entry['lname']);
				$entry['displayname'] = !empty($entry['displayname']) ? $entry['displayname'] : $entry['username'];
				$results[] = array("text" => $entry['displayname'], "type" => "get", "dest" => "?display=userman&action=showuser&user=".$entry['id']);
			}
		}
	}

	public function getRightNav($request) {
		if(isset($request['action'])) {
			$permissions = $this->getAuthAllPermissions($request['directory']);
			return load_view(__DIR__."/views/rnav.php",array("action" => $request['action'], "directory" => $request['directory'], "permissions" => $permissions));
		} else {
			return '';
		}
	}

	/**
	 * Old create object
	 * Dont use this unless you know what you are doing
	 * Accessibility of Userman should be done through BMO
	 * @return object Userman Object
	 */
	public function create() {
		static $obj;
		if (!isset($obj) || !is_object($obj)) {
			$obj = new \FreePBX\modules\Userman();
		}
		return $obj;
	}

	public function install() {
		$AMPASTERISKWEBUSER = $this->FreePBX->Config->get("AMPASTERISKWEBUSER");
		$AMPSBIN = $this->FreePBX->Config->get("AMPSBIN");
		$freepbxCron = $this->FreePBX->Cron($AMPASTERISKWEBUSER);
		$crons = $freepbxCron->getAll();
		foreach($crons as $cron) {
			if(preg_match("/fwconsole userman sync$/",$cron) || preg_match("/fwconsole userman --syncall -q$/",$cron)) {
				$freepbxCron->remove($cron);
			}
		}
		$freepbxCron->addLine("*/15 * * * * ".$AMPSBIN."/fwconsole userman --syncall -q");

		$auth = $this->getConfig('auth');

		$check = array(
			"authFREEPBXSettings" => "freepbx",
			"authMSADSettings" => 'msad',
			"authOpenLDAPSettings" => 'openldap',
			"authVoicemailSettings" => 'voicemail'
		);

		$inuse = array();
		$sql = "SELECT DISTINCT auth FROM userman_users WHERE auth REGEXP '^[A-Za-z]+$'";
		$sth = $this->FreePBX->Database->prepare($sql);
		$sth->execute();
		$res = $sth->fetchAll(\PDO::FETCH_ASSOC);
		foreach($res as $dat) {
			$inuse[] = strtolower($dat['auth']);
		}

		foreach($check as $key => $driver) {
			$settings = $this->getConfig($key);
			if((strtolower($auth) == $driver) || in_array($driver,$inuse) || !empty($settings)) {
				$active = false;
				if((empty($auth) && ($driver == 'freepbx')) || (!empty($auth) && strtolower($auth) == $driver)) {
					$active = true;
				}
				$id = $this->addDirectory(ucfirst($driver), sprintf(_('Imported %s directory'),$driver), $active, $settings);
				if(!empty($id)) {
					$sql = "UPDATE userman_users SET auth = ? WHERE LOWER(auth) = '".$driver."'";
					$sth = $this->FreePBX->Database->prepare($sql);
					$sth->execute(array($id));
					$sql = "UPDATE userman_groups SET auth = ? WHERE LOWER(auth) = '".$driver."'";
					$sth = $this->FreePBX->Database->prepare($sql);
					$sth->execute(array($id));
					if(strtolower($auth) == $driver) {
						$this->setDefaultDirectory($id);
					}
				}
				$this->setConfig($key,false);
			}
		}
		if(!empty($auth)) {
			$this->setConfig('auth',false);
		}

		$directories = $this->getAllDirectories();
		if(empty($directories)) {
			$id = $this->addDirectory('Freepbx', _("PBX Internal Directory"), true, array());
			$this->setDefaultDirectory($id);
		}

		$dir = $this->getDefaultDirectory();
		if($dir['driver'] == 'Freepbx') {
			$this->addDefaultGroupToDirectory($dir['id']);
		}
	}

	/**
	 * Get the ID of the automatically created group
	 * @return int The group ID
	 */
	public function getAutoGroup() {
		return $this->getConfig("autoGroup");
	}
	public function uninstall() {

	}
	public function backup(){

	}
	public function restore($backup){

	}
	public function genConfig() {

	}

	public function writeConfig($conf){
	}

	/**
	 * Quick create display
	 * @return array The array of the display
	 */
	public function getQuickCreateDisplay() {
		$directory = $this->getDefaultDirectory();
		$groups = $this->getAllGroups($directory['id']);
		$permissions = $this->getAuthAllPermissions($directory['id']);
		$dgroups = $this->getDefaultGroups($directory['id']);
		$dgroups = !empty($dgroups) ? $dgroups : array();
		$usersC = array();  // Initialize the array.
		foreach($this->FreePBX->Core->getAllUsers() as $user) {
			$usersC[] = $user['extension'];
		}
		$userarray['none'] = _("None");
		foreach($this->getAllUsers() as $user) {
			if($user['default_extension'] != 'none' && in_array($user['default_extension'],$usersC)) {
				//continue;
			}
			$userarray[$user['id']] = $user['username'];
		}
		return array(
			1 => array(
				array(
					'html' => load_view(__DIR__.'/views/quickCreate.php',array("users" => $userarray, "dgroups" => $dgroups, "groups" => $groups, "permissions" => $permissions))
				)
			)
		);
	}

	/**
	 * Quick Create hook
	 * @param string $tech      The device tech
	 * @param int $extension The extension number
	 * @param array $data      The associated data
	 */
	public function processQuickCreate($tech, $extension, $data) {
		if(isset($data['um']) && $data['um'] == "yes") {
			$pass = md5(uniqid());
			$directory = $this->getDefaultDirectory();
			$ret = $this->addUserByDirectory($directory['id'], $extension, $pass, $extension, _('Autogenerated user on new device creation'), array('email' => $data['email'], 'displayname' => $data['name']));
			if($ret['status']) {
				$this->setGlobalSettingByID($ret['id'],'assigned',array($extension));
				$autoEmail = $this->getGlobalsetting('autoEmail');
				$autoEmail = is_null($autoEmail) ? true : $autoEmail;
				if($autoEmail) {
					$this->sendWelcomeEmail($ret['id'], $pass);
				}
				$permissions = $this->getAuthAllPermissions($directory['id']);
				if($permissions['modifyGroup']) {
					if(!empty($data['um-groups'])) {
						$groups = $this->getAllGroups();
						foreach($groups as $group) {
							if(in_array($group['id'],$data['um-groups']) && !in_array($ret['id'],$group['users'])) {
								$group['users'][] = $ret['id'];
								$this->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
							}
						}
					}
				}
			}
		} elseif(isset($data['um-link'])) {
			$ret = $this->getUserByID($data['um-link']);
			if(!empty($ret)) {
				$this->updateUser($ret['id'], $ret['username'], $ret['username'], $extension, $ret['description']);
				$this->setGlobalSettingByID($ret['id'],'assigned',array($extension));
				$autoEmail = $this->getGlobalsetting('autoEmail');
				$autoEmail = is_null($autoEmail) ? true : $autoEmail;
				if($autoEmail) {
					$this->sendWelcomeEmail($ret['id']);
				}
			}
		}
	}

	/**
	 * Set display message in user manager
	 * Used when upating or adding a user
	 * @param [type] $message [description]
	 * @param string $type    [description]
	 */
	public function setMessage($message,$type='info') {
		$this->message = array(
			'message' => $message,
			'type' => $type
		);
		return true;
	}

	/**
	 * Config Page Init
	 * @param string $display The display name of the page
	 */
	public function doConfigPageInit($display) {
		$request = $_REQUEST;
		if(isset($request['action']) && $request['action'] == 'deluser') {
			$ret = $this->deleteUserByID($request['user']);
			$this->message = array(
				'message' => $ret['message'],
				'type' => $ret['type']
			);
			return true;
		}
		if(isset($request['action']) && $request['action'] == 'delgroup') {
			$ret = $this->deleteGroupByGID($request['user']);
			$this->message = array(
				'message' => $ret['message'],
				'type' => $ret['type']
			);
			return true;
		}
		if(isset($_POST['submittype'])) {
			switch($_POST['type']) {
				case 'directory':
					$auths = array();
					$config = false;
					foreach($this->getDirectoryDrivers() as $auth) {
						if($auth == $_POST['authtype']) {
							$class = 'FreePBX\modules\Userman\Auth\\'.$auth;
							$config = $class::saveConfig($this, $this->FreePBX);
							break;
						}
					}
					if($config === false) {
						$this->message = array(
							'message' => _("There was an error saving the configuration"),
							'type' => 'danger'
						);
						return false;
					}
					$config['sync'] = !empty($_POST['sync']) ? $_POST['sync'] : '';
					if(!empty($_POST['id'])) {
						$id = $this->updateDirectory($_POST['id'], $_POST['name'], $_POST['enable'], $config);
					} else {
						$id = $this->addDirectory($_POST['authtype'], $_POST['name'], $_POST['enable'], $config);
					}
					if(method_exists($this->directories[$id],'sync')) {
						$this->directories[$id]->sync();
					}
				break;
				case 'group':
					$groupname = !empty($request['name']) ? $request['name'] : '';
					$description = !empty($request['description']) ? $request['description'] : '';
					$prevGroupname = !empty($request['prevGroupname']) ? $request['prevGroupname'] : '';
					$directory = $request['directory'];
					$users = !empty($request['users']) ? $request['users'] : array();
					$extraData = array(
						'language' => isset($request['language']) ? $request['language'] : null,
						'timezone' => isset($request['timezone']) ? $request['timezone'] : null,
						'timeformat' => isset($request['timeformat']) ? $request['timeformat'] : null,
						'dateformat' => isset($request['dateformat']) ? $request['dateformat'] : null,
						'datetimeformat' => isset($request['datetimeformat']) ? $request['datetimeformat'] : null,
					);
					if($request['group'] == "") {
						$ret = $this->addGroupByDirectory($directory, $groupname, $description, $users);
						if($ret['status']) {
							$this->message = array(
								'message' => $ret['message'],
								'type' => $ret['type']
							);
						} else {
							$this->message = array(
								'message' => $ret['message'],
								'type' => $ret['type']
							);
							return false;
						}
					} else {
						$ret = $this->updateGroup($request['group'],$prevGroupname, $groupname, $description, $users, false, $extraData);
						if($ret['status']) {
							$this->message = array(
								'message' => $ret['message'],
								'type' => $ret['type']
							);
						} else {
							$this->message = array(
								'message' => $ret['message'],
								'type' => $ret['type']
							);
							return false;
						}
					}

					$pbx_login = ($_POST['pbx_login'] == "true") ? true : false;
					$this->setGlobalSettingByGID($ret['id'],'pbx_login',$pbx_login);

					$pbx_admin = ($_POST['pbx_admin'] == "true") ? true : false;
					$this->setGlobalSettingByGID($ret['id'],'pbx_admin',$pbx_admin);

					$this->setGlobalSettingByGID($ret['id'],'pbx_low',$_POST['pbx_low']);
					$this->setGlobalSettingByGID($ret['id'],'pbx_high',$_POST['pbx_high']);
					$this->setGlobalSettingByGID($ret['id'],'pbx_landing', $_POST['pbx_landing']);
					$this->setGlobalSettingByGID($ret['id'],'pbx_modules',(!empty($_POST['pbx_modules']) ? $_POST['pbx_modules'] : array()));
				break;
				case 'user':

					$directory = $request['directory'];
					$username = !empty($request['username']) ? $request['username'] : '';
					$password = !empty($request['password']) ? $request['password'] : '';
					$description = !empty($request['description']) ? $request['description'] : '';
					$prevUsername = !empty($request['prevUsername']) ? $request['prevUsername'] : '';
					$assigned = !empty($request['assigned']) ? $request['assigned'] : array();
					$extraData = array(
						'fname' => isset($request['fname']) ? $request['fname'] : null,
						'lname' => isset($request['lname']) ? $request['lname'] : null,
						'title' => isset($request['title']) ? $request['title'] : null,
						'company' => isset($request['company']) ? $request['company'] : null,
						'department' => isset($request['department']) ? $request['department'] : null,
						'language' => isset($request['language']) ? $request['language'] : null,
						'timezone' => isset($request['timezone']) ? $request['timezone'] : null,
						'timeformat' => isset($request['timeformat']) ? $request['timeformat'] : null,
						'dateformat' => isset($request['dateformat']) ? $request['dateformat'] : null,
						'datetimeformat' => isset($request['datetimeformat']) ? $request['datetimeformat'] : null,
						'email' => isset($request['email']) ? $request['email'] : null,
						'cell' => isset($request['cell']) ? $request['cell'] : null,
						'work' => isset($request['work']) ? $request['work'] : null,
						'home' => isset($request['home']) ? $request['home'] : null,
						'fax' => isset($request['fax']) ? $request['fax'] : null,
						'displayname' => isset($request['displayname']) ? $request['displayname'] : null
					);
					$default = !empty($request['defaultextension']) ? $request['defaultextension'] : 'none';
					if($request['user'] == "") {
						$ret = $this->addUserByDirectory($directory, $username, $password, $default, $description, $extraData);
						if($ret['status']) {
							$this->setGlobalSettingByID($ret['id'],'assigned',$assigned);
							$this->message = array(
								'message' => $ret['message'],
								'type' => $ret['type']
							);
						} else {
							$this->message = array(
								'message' => $ret['message'],
								'type' => $ret['type']
							);
						}
					} else {
						$password = ($password != '******') ? $password : null;
						$ret = $this->updateUser($request['user'], $prevUsername, $username, $default, $description, $extraData, $password);
						if($ret['status']) {
							$this->setGlobalSettingByID($ret['id'],'assigned',$assigned);
							$this->message = array(
								'message' => $ret['message'],
								'type' => $ret['type']
							);
						} else {
							$this->message = array(
								'message' => $ret['message'],
								'type' => $ret['type']
							);
						}
					}
					if(!empty($ret['status'])) {
						if($_POST['pbx_login'] != "inherit") {
							$pbx_login = ($_POST['pbx_login'] == "true") ? true : false;
							$this->setGlobalSettingByID($ret['id'],'pbx_login',$pbx_login);
						} else {
							$this->setGlobalSettingByID($ret['id'],'pbx_login',null);
						}

						if($_POST['pbx_admin'] != "inherit") {
							$pbx_admin = ($_POST['pbx_admin'] == "true") ? true : false;
							$this->setGlobalSettingByID($ret['id'],'pbx_admin',$pbx_admin);
						} else {
							$this->setGlobalSettingByID($ret['id'],'pbx_admin',null);
						}

						$this->setGlobalSettingByID($ret['id'],'pbx_low',$_POST['pbx_low']);
						$this->setGlobalSettingByID($ret['id'],'pbx_high',$_POST['pbx_high']);
						$this->setGlobalSettingByID($ret['id'],'pbx_landing',$_POST['pbx_landing']);
						$this->setGlobalSettingByID($ret['id'],'pbx_modules',!empty($_POST['pbx_modules']) ? $_POST['pbx_modules'] : null);
						if(!empty($_POST['groups'])) {
							$groups = $this->getAllGroups();
							foreach($groups as $group) {
								if(in_array($group['id'],$_POST['groups']) && !in_array($ret['id'],$group['users'])) {
									$group['users'][] = $ret['id'];
									$this->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users'], true);
								} elseif(!in_array($group['id'],$_POST['groups']) && in_array($ret['id'],$group['users'])) {
									$group['users'] = array_diff($group['users'], array($ret['id']));
									$this->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users'], true);
								}
							}
						} else {
							$groups = $this->getGroupsByID($ret['id']);
							foreach($groups as $gid) {
								$group = $this->getGroupByGID($gid);
								$group['users'] = array_diff($group['users'], array($ret['id']));
								$this->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users'], true);
							}
						}
						if(isset($_POST['submittype']) && $_POST['submittype'] == "guisend") {
							$data = $this->getUserByID($request['user']);
							$this->sendWelcomeEmail($data['id'], $password);
						}
					}
				break;
				case 'general':
					$this->setGlobalsetting('emailbody',$request['emailbody']);
					$this->setGlobalsetting('emailsubject',$request['emailsubject']);
					$this->setGlobalsetting('hostname', $request['hostname']);
					$this->setGlobalsetting('autoEmail',($request['auto-email'] == "yes") ? 1 : 0);
					$this->setGlobalsetting('mailtype',$request['mailtype']);
					$this->message = array(
						'message' => _('Saved'),
						'type' => 'success'
					);
					if(isset($_POST['sendemailtoall'])) {
						$this->sendWelcomeEmailToAll();
					}
				break;
			}
		}
	}

	/**
	 * Get All Permissions that the Auth Type allows
	 */
	public function getAuthAllPermissions($id='') {
		if(empty($id)) {
			$directory = $this->getDefaultDirectory();
			$id = $directory['id'];
		}
		return $this->directories[$id]->getPermissions();
	}

	/**
	 * Get a Single Permisison that the Auth Type allows
	 * @param [type] $permission [description]
	 */
	public function getAuthPermission($id, $permission=null) {
		if(is_null($permission)) {
			$permission = $id;
			$directory = $this->getDefaultDirectory();
			$id = $directory['id'];
		}
		$settings = $this->directories[$id]->getPermissions();
		return isset($settings[$permission]) ? $settings[$permission] : null;
	}

	/**
	 * Get the Action Bar (13)
	 * @param string $request The action bar
	 */
	public function getActionBar($request){
		$buttons = array();
		$request['action'] = !empty($request['action']) ? $request['action'] : '';
		$request['display'] = !empty($request['display']) ? $request['display'] : '';
		switch($request['display']) {
			case 'userman':
				$buttons = array(
					'submitsend' => array(
						'name' => 'submitsend',
						'id' => 'submitsend',
						'value' => _("Submit & Send Email to User"),
						'class' => array('hidden')
					),
					'submit' => array(
						'name' => 'submit',
						'id' => 'submit',
						'value' => _("Submit"),
						'class' => array('hidden')
					),
					'delete' => array(
						'name' => 'delete',
						'id' => 'delete',
						'value' => _("Delete"),
						'class' => array('hidden')
					),
					'reset' => array(
						'name' => 'reset',
						'id' => 'reset',
						'value' => _("Reset"),
						'class' => array('hidden')
					),
				);

				if($request['action'] != 'showuser' && $request['action'] != 'showgroup'){
					unset($buttons['delete']);
				}

				if($request['action'] == 'showuser' || $request['action'] == 'showgroup') {
					if(!empty($request['user'])) {
						$user = $this->getUserByID($request['user']);
						$directory = $this->getDirectoryByID($user['auth']);
						$permissions = $this->getAuthAllPermissions($user['auth']);
						if($directory['locked']) {
							$buttons = array();
						}
						if(!$permissions['removeUser']) {
							unset($buttons['delete']);
						}
					} elseif(!empty($request['group'])) {
						$group = $this->getGroupByGID($request['group']);
						$directory = $this->getDirectoryByID($group['auth']);
						$permissions = $this->getAuthAllPermissions($group['auth']);
						if(!empty($group['local']) && !empty($directory['config']['localgroups'])) {
							$permissions['addGroup'] = true;
							$permissions['modifyGroup'] = true;
							$permissions['removeGroup'] = true;
						}
						if(!$permissions['removeGroup']) {
							unset($buttons['delete']);
						}

						if($directory['locked']) {
							$buttons = array();
						}
					} else {
						$permissions = $this->getAuthAllPermissions($request['directory']);
					}
				}

				if(empty($request['action'])){
					unset($buttons['submitsend']);
				}
			}
		return $buttons;
	}

	/**
	 * Page Display
	 */
	public function myShowPage() {
		if(!function_exists('core_users_list')) {
			return _("Module Core is disabled. Please enable it");
		}
		$module_hook = \moduleHook::create();
		$mods = $this->FreePBX->Hooks->processHooks();
		$sections = array();
		foreach($mods as $mod => $contents) {
			if(empty($contents)) {
				continue;
			}

			if(is_array($contents)) {
				foreach($contents as $content) {
					if(!isset($sections[$content['rawname']])) {
						$sections[$content['rawname']] = array(
							"title" => $content['title'],
							"rawname" => $content['rawname'],
							"content" => $content['content']
						);
					} else {
						$sections[$content['rawname']]['content'] .= $content['content'];
					}
				}
			} else {
				if(!isset($sections[$mod])) {
					$sections[$mod] = array(
						"title" => ucfirst(strtolower($mod)),
						"rawname" => $mod,
						"content" => $contents
					);
				} else {
					$sections[$mod]['content'] .= $contents;
				}
			}
		}
		$request = $_REQUEST;
		$action = !empty($request['action']) ? $request['action'] : '';
		$html = '';

		switch($action) {
			case 'adddirectory':
			case 'showdirectory':
				if($action == "showdirectory") {
					$directory = $this->getDirectoryByID($request['directory']);
					$class = 'FreePBX\modules\Userman\Auth\\'.$directory['driver'];
					$a = $class::getInfo($this, $this->FreePBX);
					$auth = $directory['driver'];
					if(!empty($a)) {
						$auths[$auth] = $a;
						$directory['config']['id'] = $request['directory'];
						$auths[$auth]['html'] = $class::getConfig($this, $this->FreePBX, $directory['config']);
					}
				} else {
					$directory = array(
						'active' => true
					);
					$auths = array();
					foreach($this->getDirectoryDrivers() as $auth) {
						$class = 'FreePBX\modules\Userman\Auth\\'.$auth;
						$a = $class::getInfo($this, $this->FreePBX);
						if(!empty($a)) {
							$auths[$auth] = $a;
							$auths[$auth]['html'] = $class::getConfig($this, $this->FreePBX, array());
						}
					}
				}

				$html .= load_view(
					dirname(__FILE__).'/views/directories.php',
					array(
						'auths' => $auths,
						'config' => $directory
					)
				);
			break;
			case 'addgroup':
			case 'showgroup':

				$module_list = $this->getModuleList();
				uasort($module_list, function($a,$b){
					return strnatcmp($a['name'],$b['name']);
				});
				$landing_page_list = $module_list;
				unset($landing_page_list[99],$landing_page_list[999]);

				if($action == "showgroup") {
					$group = $this->getGroupByGID($request['group']);
					$directory = $group['auth'];
				} else {
					$group = array();
					$directory = $_GET['directory'];
				}
				$dir = $this->getDirectoryByID($directory);
				$permissions = $this->getAuthAllPermissions($dir['id']);
				if((empty($group) || !empty($group['local'])) && !empty($directory['config']['localgroups'])) {
					$permissions['addGroup'] = true;
					$permissions['modifyGroup'] = true;
					$permissions['removeGroup'] = true;
				}
				$users = $this->getAllUsers($directory);
				$mods = $this->getGlobalSettingByGID($request['group'],'pbx_modules');
				$pbx_landing = $this->getGlobalSettingByGID($request['group'],'pbx_landing');
				$pbx_landing = !empty($pbx_landing) ? $pbx_landing : 'index';
				$html .= load_view(
					dirname(__FILE__).'/views/groups.php',
					array(
						"group" => $group,
						"pbx_modules" => empty($group) ? array() : (!empty($mods) ? $mods : array()),
						"pbx_low" => empty($group) ? '' : $this->getGlobalSettingByGID($request['group'],'pbx_low'),
						"pbx_high" => empty($group) ? '' : $this->getGlobalSettingByGID($request['group'],'pbx_high'),
						"pbx_login" => empty($group) ? false : $this->getGlobalSettingByGID($request['group'],'pbx_login'),
						"pbx_admin" => empty($group) ? false : $this->getGlobalSettingByGID($request['group'],'pbx_admin'),
						"pbx_landing" => $pbx_landing,
						"brand" => $this->brand,
						"users" => $users,
						"modules" => $module_list,
						"sections" => $sections,
						"message" => $this->message,
						"permissions" => $permissions,
						"locked" => $dir['locked'],
						"directory" => $directory,
						"landing_page_list" => $landing_page_list
					)
				);
			break;
			case 'showuser':
			case 'adduser':
				if($action == 'showuser' && !empty($request['user'])) {
					$user = $this->getUserByID($request['user']);
					$assigned = $this->getGlobalSettingByID($request['user'],'assigned');
					$assigned = !(empty($assigned)) ? $assigned : array();
					$default = $user['default_extension'];
					$directory = $user['auth'];
					$usage_html = $this->FreePBX->View->destinationUsage("ext-fax,$request[user],1");
				} else {
					$user = array();
					$assigned = array();
					$default = null;
					$directory = $_GET['directory'];
					$usage_html = '';
				}
				$dir = $this->getDirectoryByID($directory);
				$groups = $this->getAllGroups($directory);
				$extrauserdetails = $this->getExtraUserDetailsDisplay($user);
				$fpbxusers = array();
				$dfpbxusers = array();
				$cul = array();
				foreach($this->FreePBX->Core->listUsers() as $list) {
					$cul[$list[0]] = array(
						"name" => $list[1],
						"vmcontext" => $list[2]
					);
				}
				foreach($cul as $e => $u) {
					$fpbxusers[] = array("ext" => $e, "name" => $u['name'], "selected" => in_array($e,$assigned));
				}

				$module_list = $this->getModuleList();
				uasort($module_list, function($a,$b){
					return strnatcmp($a['name'],$b['name']);
				});
				$landing_page_list = $module_list;
				unset($landing_page_list[99],$landing_page_list[999]);

				$iuext = $this->getAllInUseExtensions();
				$dfpbxusers[] = array("ext" => 'none', "name" => 'none', "selected" => false);
				foreach($cul as $e => $u) {
					if($e != $default && in_array($e,$iuext)) {
						continue;
					}
					$dfpbxusers[] = array("ext" => $e, "name" => $u['name'], "selected" => ($e == $default));
				}
				$pbx_landing = $this->getGlobalSettingByID($request['user'],'pbx_landing',true);
				$pbx_landing = !empty($pbx_landing) ? $pbx_landing : 'index';

				$html .= load_view(
					dirname(__FILE__).'/views/users.php',
					array(
						"users" => $users,
						"groups" => $groups,
						"dgroups" => $this->getDefaultGroups($directory),
						"sections" => $sections,
						"pbx_modules" => empty($request['user']) ? array() : $this->getGlobalSettingByID($request['user'],'pbx_modules'),
						"pbx_low" => empty($request['user']) ? '' : $this->getGlobalSettingByID($request['user'],'pbx_low'),
						"pbx_high" => empty($request['user']) ? '' : $this->getGlobalSettingByID($request['user'],'pbx_high'),
						"pbx_landing" => $pbx_landing,
						"pbx_login" => empty($request['user']) ? false : $this->getGlobalSettingByID($request['user'],'pbx_login',true),
						"pbx_admin" => empty($request['user']) ? false : $this->getGlobalSettingByID($request['user'],'pbx_admin',true),
						"modules" => $module_list,
						"brand" => $this->brand,
						"dfpbxusers" => $dfpbxusers,
						"fpbxusers" => $fpbxusers,
						"user" => $user,
						"message" => $this->message,
						"permissions" => $this->getAuthAllPermissions($directory),
						"extrauserdetails" => $extrauserdetails,
						"locked" => $dir['locked'],
						"directory" => $directory,
						"usage_html" => $usage_html,
						"landing_page_list" => $landing_page_list
					)
				);
			break;
			default:
				$users = $this->getAllUsers();
				$groups = $this->getAllGroups();
				$auths = array();
				foreach($this->getDirectoryDrivers() as $auth) {
					$class = 'FreePBX\modules\Userman\Auth\\'.$auth;
					$a = $class::getInfo($this, $this->FreePBX);
					if(!empty($a)) {
						$auths[$auth] = $a;
					}
				}
				$directories = $this->getAllDirectories(true);
				$activedirectorycount = $directories['active'];
				$directories = $directories['directories'];
				$dirwarn = '';
				if($activedirectorycount === 0){
					$dirwarn = '<div class="alert alert-warning" role="alert"><strong>'._("Warning")."</strong>: "._("You have no directories enabled. This will affect users ability to use features that require a login").'</div>';
				}
				$directoryMap = array();
				foreach($directories as $directory) {
					$directoryMap[$directory['id']]['name'] = $directory['name'];
					$directoryMap[$directory['id']]['driver'] = $directory['driver'];
					$directoryMap[$directory['id']]['permissions'] = $this->getDirectoryObjectByID($directory['id'])->getPermissions();
				}
				$mailtype = $this->getGlobalsetting('mailtype');
				$mailtype = $mailtype === 'html' ? 'html' : 'text';
				$emailbody = $this->getGlobalsetting('emailbody');
				$emailsubject = $this->getGlobalsetting('emailsubject');
				$hostname = $this->getGlobalsetting('hostname');
				$autoEmail = $this->getGlobalsetting('autoEmail');
				$autoEmail = is_null($autoEmail) ? true : $autoEmail;
				$remoteips = $this->getConfig('remoteips');
				$remoteips = is_array($remoteips) ? implode(",", $remoteips) : "";
				$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https" : "http";
				$host = $protocol.'://'.$_SERVER["SERVER_NAME"];
				$html .= load_view(
					dirname(__FILE__).'/views/welcome.php',
					array(
						"directoryMap" => $directoryMap,
						"directories" => $directories,
						"auths" => $auths,
						"hostname" => $hostname,
						"host" => $host,
						"autoEmail" => $autoEmail,
						"remoteips" => $remoteips,
						"sync" => $this->getConfig("sync"),
						"authtype" => $this->getConfig("auth"),
						"auths" => $auths,
						"brand" => $this->brand,
						"groups" => $groups,
						"users" => $users,
						"sections" => $sections,
						"message" => $this->message,
						"emailbody" => $emailbody,
						"emailsubject" => $emailsubject,
						"mailtype" => $mailtype,
						"dirwarn" => $dirwarn
					)
				);
			break;
		}

		return $html;
	}

	public function getExtraUserDetailsDisplay($user) {
		$mods = $this->FreePBX->Hooks->processHooks($user);
		$final = array();
		foreach($mods as $mod) {
			foreach($mod as $item) {
				$final[] = $item;
			}
		}
		return $final;
	}

	/**
	 * Get List of Menu items from said Modules
	 */
	private function getModuleList() {
		$active_modules = $this->FreePBX->Modules->getActiveModules();
		$module_list = array();
		if(is_array($active_modules)){
			$dis = ($this->FreePBX->Config->get('AMPEXTENSIONS') == 'deviceanduser')?_("Add Device"):_("Add Extension");
			$active_modules['au']['items'][] = array('name' => _("Apply Changes Bar"), 'display' => '99');
			$active_modules['au']['items'][] = array('name' => $dis, 'display' => '999');

			foreach($active_modules as $key => $module) {
				//create an array of module sections to display
				if (isset($module['items']) && is_array($module['items'])) {
					foreach($module['items'] as $itemKey => $item) {
						$listKey = (!empty($item['display']) ? $item['display'] : $itemKey);
						if(isset($item['rawname'])) {
							$item['rawname'] = $module['rawname'];
							\modgettext::push_textdomain($module['rawname']);
						}
						$item['name'] = _($item['name']);
						$module_list[ $listKey ] = $item;
						if(isset($item['rawname'])) {
							\modgettext::pop_textdomain();
						}
					}
				}
			}
		}

		// extensions vs device/users ... module_list setting
		if (isset($amp_conf["AMPEXTENSIONS"]) && ($amp_conf["AMPEXTENSIONS"] == "deviceanduser")) {
			unset($module_list["extensions"]);
		} else {
			unset($module_list["devices"]);
			unset($module_list["users"]);
		}
		unset($module_list['ampusers']);
		return $module_list;
	}

	/**
	 * Ajax Request
	 * @param string $req     The request type
	 * @param string $setting Settings to return back
	 */
	public function ajaxRequest($req, &$setting){
		switch($req){
			case "getGuihookInfo":
			case "makeDefault":
			case "getDirectories":
			case "getUsers":
			case "getGroups":
			case "getuserfields":
			case "updateGroupSort":
			case "updateDirectorySort":
			case "updatePassword":
			case "delete":
			case "email":
				return true;
			break;
			case "setlocales":
				$setting['changesession'] = true;
				return true;
			break;
			case "auth":
				$ips = $this->getConfig('remoteips');
				if(empty($ips) || !is_array($ips) || !in_array($_SERVER['REMOTE_ADDR'],$ips)) {
					return false;
				}
				$setting['authenticate'] = false;
				$setting['allowremote'] = true;
				return true;
			break;
			default:
				return false;
			break;
		}
	}

	/**
	 * Handle AJAX
	 */
	public function ajaxHandler(){
		$request = $_REQUEST;
		switch($request['command']){
			case "setlocales":
				if(!empty($_SESSION['AMP_user']->id) && ($_SESSION['AMP_user']->id == $_POST['id'])) {
					$_SESSION['AMP_user']->lang = !empty($_POST['language']) ? $_POST['language'] : $this->getLocaleSpecificSettingByUID($_POST['id'],"language");
					$_SESSION['AMP_user']->tz = !empty($_POST['timezone']) ? $_POST['timezone'] : $this->getLocaleSpecificSettingByUID($_POST['id'],"timezone");
					$_SESSION['AMP_user']->timeformat = !empty($_POST['timeformat']) ? $_POST['timeformat'] : $this->getLocaleSpecificSettingByUID($_POST['id'],"timeformat");
					$_SESSION['AMP_user']->dateformat = !empty($_POST['dateformat']) ? $_POST['dateformat'] : $this->getLocaleSpecificSettingByUID($_POST['id'],"dateformat");
					$_SESSION['AMP_user']->datetimeformat = !empty($_POST['datetimeformat']) ? $_POST['datetimeformat'] : $this->getLocaleSpecificSettingByUID($_POST['id'],"datetimeformat");
				}
				return array("status" => true);
			break;
			case "getGuihookInfo":
				$directory = $this->getDirectoryByID($_POST['directory']);
				$users = $this->getAllUsers($directory['id']);
				$groups = $this->getAllGroups($directory['id']);
				$permissions = $this->getAuthAllPermissions($directory['id']);
				return array(
					"status" => true,
					"users" => $users,
					"groups" => $groups,
					"permissions" => $permissions
				);
			break;
			case "makeDefault":
				$this->setDefaultDirectory($_POST['id']);
				return array("status" => true);
			break;
			case "getDirectories":
				return $this->getAllDirectories();
			break;
			case "auth":
				$out = $this->checkCredentials($_POST["username"],$_POST["password"]);
				if($out) {
					return array("status" => true);
				} else {
					return array("status" => false);
				}
			break;
			case "updateDirectorySort":
				$sort = json_decode($_POST['sort'],true);
				$sql = "UPDATE ".$this->directoryTable." SET `order` = ? WHERE `id` = ?";
				$sth = $this->db->prepare($sql);

				foreach($sort as $order => $gid) {
					$sth->execute(array($order,$gid));
				}
				return array("status" => true);
			case "updateGroupSort":
				$sort = json_decode($_POST['sort'],true);
				$sql = "UPDATE ".$this->groupTable." SET `priority` = ? WHERE `id` = ?";
				$sth = $this->db->prepare($sql);
				foreach($sort as $order => $gid) {
					$sth->execute(array($order,$gid));
				}
				return array("status" => true);
			case "getUsers":
				$directory = !empty($_GET['directory']) ? $_GET['directory'] : '';
				return $this->getAllUsers($directory);
			case "getGroups":
				$directory = !empty($_GET['directory']) ? $_GET['directory'] : '';
				return $this->getAllGroups($directory);
			case "email":
				//FREEPBX-15304 Send email to multiple selected users only sends to the first
				$sendmail = false;
				$maillist = array();
				foreach($_REQUEST['extensions'] as $ext){
					$user = $this->getUserbyID($ext);
					if(!empty($user)) {
						$this->sendWelcomeEmail($user['id']);
						$sendmail = true;
						$maillist[] = $user['username'];
					}
				}
				if($sendmail){
					$list = implode(",",$maillist);
					return array('status' => true,"message" => _("Email Sent to users : $list"));
				}
				return array('status' => false, "message" => _("Invalid User"));

			break;
			case "getuserfields":
				if(empty($request['id'])){
					print json_encode(_("Error: No id provided"));
				}else{
					$user = $this->getUserByID($request['id']);
					return $user;
				}
			break;
			case "updatePassword":
				$uid = $request['id'];
				$newpass = $request['newpass'];
				$extra = array();
				$user = $this->getUserByID($uid);
				return $this->updateUser($uid, $user['username'], $user['username'], $user['default_extension'], $user['description'], $extra, $newpass);
			break;
			case 'delete':
				switch ($_REQUEST['type']) {
					case 'groups':
						$ret = array();
						foreach($_REQUEST['extensions'] as $ext){
							$ret[$ext] = $this->deleteGroupByGID($ext);
						}
						return array('status' => true, 'message' => $ret);
					break;
					case 'users':
						$ret = array();
						foreach($_REQUEST['extensions'] as $ext){
							$ret[$ext] = $this->deleteUserByID($ext);
						}
						return array('status' => true, 'message' => $ret);
					break;
					case 'directories':
						$ret = array();
						foreach($_REQUEST['extensions'] as $ext){
							$ret[$ext] = $this->deleteDirectoryByID($ext);
						}
						return array('status' => true, 'message' => $ret);
					break;
				}
			break;
			default:
				echo json_encode(_("Error: You should never see this"));
			break;
		}
	}

	/**
	 * Registers a hookable call
	 *
	 * This registers a global function to a hook action
	 *
	 * @param string $action Hook action of: addUser,updateUser or delUser
	 * @return bool
	 */
	public function registerHook($action,$function) {
		$this->registeredFunctions[$action][] = $function;
		return true;
	}

	private function loadActiveDirectories() {
		$directories = $this->getAllDirectories();
		foreach($directories as $directory) {
			if(file_exists(__DIR__."/functions.inc/auth/modules/".$directory['driver'].".php")) {
				$class = 'FreePBX\modules\Userman\Auth\\'.$directory['driver'];
				if(!class_exists($class)) {
					include(__DIR__."/functions.inc/auth/modules/".$directory['driver'].".php");
				}
				$o = $this->getDirectoryByID($directory['id']);
				$o['config']['id'] = $directory['id'];
				$this->directories[$directory['id']] = new $class($this, $this->FreePBX, $o['config']);
			}
		}
		$class = 'FreePBX\modules\Userman\Auth\GlobalAuth';
		if(!class_exists($class)) {
			include(__DIR__."/functions.inc/auth/Global.php");
		}
		$this->globalDirectory = new $class($this, $this->FreePBX);
	}

	public function getAllDirectories($withactivecount = false) {
		$sql = "SELECT * FROM ".$this->directoryTable." ORDER BY `order`";
		$sth = $this->db->prepare($sql);
		$sth->execute();
		$directories = $sth->fetchAll(\PDO::FETCH_ASSOC);
		$count = 0;
		foreach($directories as $key => $d) {
			$directories[$key]['config'] = $this->getConfig("auth-settings",$d['id']);
			if($directories[$key]['active'] == 1){
				$count++;
			}
		}
		if($withactivecount){
			return array('active' => $count, 'directories' => $directories);
		}
		return $directories;
	}

	/**
	 * Get All Users
	 *
	 * Get a List of all User Manager users and their data
	 *
	 * @return array
	 */
	public function getAllUsers($directory=null) {
		if(!empty($directory)) {
			$users = $this->directories[$directory]->getAllUsers();
		} else {
			$users = $this->globalDirectory->getAllUsers();
		}
		return $users;
	}

	/**
	* Get All Groups
	*
	* Get a List of all User Manager users and their data
	*
	* @return array
	*/
	public function getAllGroups($directory=null) {
		if (!empty($directory) && empty($this->directories[$directory])) {
			throw new \Exception("Please ask for a valid directory");
		}

		if(!empty($directory)) {
			$groups = $this->directories[$directory]->getAllGroups();
		} else {
			$groups = $this->globalDirectory->getAllGroups();
		}
		return $groups;
	}

	/** Get Default Groups
	 *
	 * Get a list of all default groups
	 *
	 * @return array
	 */
	public function getDefaultGroups($directory=null) {
		if(!empty($directory)) {
			$groups = $this->directories[$directory]->getDefaultGroups();
		} else {
			$groups = $this->globalDirectory->getDefaultGroups();
		}
		return is_array($groups) ? $groups : array();
	}

	/**
	 * Get all Users as contacts
	 *
	 * @return array
	 */
	public function getAllContactInfo($directory=null) {
		if(!empty($directory)) {
			$users = $this->directories[$directory]->getAllContactInfo();
		} else {
			$users = $this->globalDirectory->getAllContactInfo();
		}
		return $users;
	}

	/**
	 * Get additional contact information from other modules that may hook into Userman
	 * @param array $user The User Array
	 */
	public function getExtraContactInfo($user) {
		$mods = $this->FreePBX->Hooks->processHooks($user);
		foreach($mods as $mod) {
			if(!empty($mod) && is_array($mod)) {
				$user = array_merge($user, $mod);
			}
		}
		return $user;
	}

	/**
	 * Get User Information by the Default Extension
	 *
	 * This gets user information from the user which has said extension defined as it's default
	 *
	 * @param string $extension The User (from Device/User Mode) or Extension to which this User is attached
	 * @return bool
	 */
	public function getUserByDefaultExtension($extension, $directory=null) {
		if(!empty($directory)) {
			$user = $this->directories[$directory]->getUserByDefaultExtension($extension);
		} else {
			$user = $this->globalDirectory->getUserByDefaultExtension($extension);
		}
		return $user;
	}

	/**
	 * Get User Information by Username
	 *
	 * This gets user information by username
	 *
	 * @param string $username The User Manager Username
	 * @return bool
	 */
	public function getUserByUsername($username, $directory=null, $extraInfo = true) {
		if(!empty($directory)) {
			$user = $this->directories[$directory]->getUserByUsername($username, $extraInfo);
		} else {
			$user = $this->globalDirectory->getUserByUsername($username, $extraInfo);
		}
		return $user;
	}

	/**
	* Get User Information by Username
	*
	* This gets user information by username
	*
	* @param string $username The User Manager Username
	* @return bool
	*/
	public function getGroupByUsername($groupname, $directory=null) {
		if(!empty($directory)) {
			$user = $this->directories[$directory]->getGroupByUsername($groupname);
		} else {
			$user = $this->globalDirectory->getGroupByUsername($groupname);
		}
		return $user;
	}

	/**
	* Get User Information by Email
	*
	* This gets user information by Email
	*
	* @param string $email The User Manager Email Address
	* @return bool
	*/
	public function getUserByEmail($email, $directory=null, $extraInfo = true) {
		if(!empty($directory)) {
			$user = $this->directories[$directory]->getUserByEmail($email, $extraInfo);
		} else {
			$user = $this->globalDirectory->getUserByEmail($email, $extraInfo);
		}
		return $user;
	}

	/**
	 * Get User Information by User ID
	 *
	 * This gets user information by User Manager User ID
	 *
	 * @param string $id The ID of the user from User Manager
	 * @return bool
	 */
	public function getUserByID($id, $extraInfo = true) {
		$user = $this->globalDirectory->getUserByID($id, $extraInfo);
		return $user;
	}

	/**
	* Get User Information by User ID
	*
	* This gets user information by User Manager User ID
	*
	* @param string $id The ID of the user from User Manager
	* @return bool
	*/
	public function getGroupByGID($gid) {
		return $this->globalDirectory->getGroupByGID($gid);
	}

	/**
	 * Get all Groups that this user is a part of
	 * @param int $uid The User ID
	 */
	public function getGroupsByID($uid) {
		return $this->globalDirectory->getGroupsByID($uid);
	}

	/**
	 * Get User Information by Username
	 *
	 * This gets user information by username.
	 * !!This should never be called externally outside of User Manager!!
	 *
	 * @param string $id The ID of the user from User Manager
	 * @return array
	 */
	public function deleteUserByID($id) {
		if(!is_numeric($id)) {
			throw new \Exception(_("ID was not numeric"));
		}
		set_time_limit(0);
		$status = $this->globalDirectory->deleteUserByID($id);
		if(!$status['status']) {
			return $status;
		}
		$this->callHooks('delUser',$status);
		$this->delUser($id,$status);
		return $status;
	}

	/**
	 * Delete a Group by it's ID
	 * @param int $gid The group ID
	 */
	public function deleteGroupByGID($gid) {
		if(!is_numeric($gid)) {
			throw new \Exception(_("GID was not numeric"));
		}
		set_time_limit(0);
		$data = $this->getGroupByGID($gid);
		$status = $this->globalDirectory->deleteGroupByGID($gid);
		if(!$status['status']) {
			return $status;
		}
		$this->callHooks('delGroup',$data);
		$this->delGroup($gid,$data);
		return $status;
	}

	public function lockDirectory($id) {
		$sql = "UPDATE ".$this->directoryTable." SET `locked` = 1 WHERE `id` = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($id));
	}

	public function unlockDirectory($id) {
		$sql = "UPDATE ".$this->directoryTable." SET `locked` = 0 WHERE `id` = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($id));
	}

	/**
	 * Sets the default directory
	 * @method setDefaultDirectory
	 * @param  integer              $id The directory ID
	 */
	public function setDefaultDirectory($id) {
		$sql = "UPDATE ".$this->directoryTable." SET `default` = 0";
		$sth = $this->db->prepare($sql);
		$sth->execute();
		$sql = "UPDATE ".$this->directoryTable." SET `default` = 1 WHERE `id` = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($id));
	}

	public function getDefaultDirectory() {
		$sql = "SELECT id FROM ".$this->directoryTable." WHERE `default` = 1";
		$sth = $this->db->prepare($sql);
		$sth->execute();
		$dir = $sth->fetch(\PDO::FETCH_ASSOC);
		if(empty($dir)) {
			$sql = "SELECT id FROM ".$this->directoryTable." WHERE `driver` = 'Freepbx' ORDER BY `order` LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute();
			$dir = $sth->fetch(\PDO::FETCH_ASSOC);
			if(empty($dir)) {
				$dir = array(
					"id" => $this->addDirectory('Freepbx', _("PBX Internal Directory"), true, array())
				);
				$this->addDefaultGroupToDirectory($dir['id']);
			} else {
				$this->setDefaultDirectory($dir['id']);
			}
		}
		return !empty($dir['id']) ? $this->getDirectoryByID($dir['id']) : false;
	}

	public function addDefaultGroupToDirectory($dirid) {
		$obj = $this->getDirectoryObjectByID($dirid);
		$dir = $this->getDirectoryByID($dirid);
		$groups = $obj->getAllGroups();
		if(empty($groups)) {
			$users = $obj->getAllUsers();
			$allUsers = array();
			foreach($users as $u) {
				$allUsers[] = $u['id'];
			}
			$g = $obj->addGroup(_("All Users"),_("This group was created on install and is automatically assigned to new users. This can be disabled in User Manager Settings"),$allUsers);
			if(!$g['status']) {
				out(_("Unable to create default group"));
				return false;
			}
			$config = array(
				"default-groups" => array($g['id'])
			);
			$gid = $g['id'];
			$this->updateDirectory($dirid, $dir['name'], 1, $config);
			//Default New Group Settings
			$this->setModuleSettingByGID($gid,'contactmanager','show', true);
			$this->setModuleSettingByGID($gid,'contactmanager','groups',array($gid));
			$this->setModuleSettingByGID($gid,'fax','enabled',true);
			$this->setModuleSettingByGID($gid,'fax','attachformat',"pdf");
			$this->setModuleSettingByGID($gid,'faxpro','localstore',"true");
			//$this->setModuleSettingByGID($gid,'restapi','restapi_token_status', true);
			//$this->setModuleSettingByGID($gid,'restapi','restapi_users',array("self"));
			//$this->setModuleSettingByGID($gid,'restapi','restapi_modules',array("*"));
			//$this->setModuleSettingByGID($gid,'restapi','restapi_rate',"1000");
			$this->setModuleSettingByGID($gid,'xmpp','enable', true);
			$this->setModuleSettingByGID($gid,'ucp|Global','allowLogin',true);
			$this->setModuleSettingByGID($gid,'ucp|Global','originate', true);
			$this->setModuleSettingByGID($gid,'ucp|Settings','assigned', array("self"));
			$this->setModuleSettingByGID($gid,'ucp|Cdr','enable', true);
			$this->setModuleSettingByGID($gid,'ucp|Cdr','assigned', array("self"));
			$this->setModuleSettingByGID($gid,'ucp|Cdr','download', true);
			$this->setModuleSettingByGID($gid,'ucp|Cdr','playback', true);
			$this->setModuleSettingByGID($gid,'ucp|Cel','enable', true);
			$this->setModuleSettingByGID($gid,'ucp|Cel','assigned', array("self"));
			$this->setModuleSettingByGID($gid,'ucp|Cel','download', true);
			$this->setModuleSettingByGID($gid,'ucp|Cel','playback', true);
			$this->setModuleSettingByGID($gid,'ucp|Presencestate','enabled',true);
			$this->setModuleSettingByGID($gid,'ucp|Voicemail','enable', true);
			$this->setModuleSettingByGID($gid,'ucp|Voicemail','assigned', array("self"));
			$this->setModuleSettingByGID($gid,'ucp|Voicemail','download', true);
			$this->setModuleSettingByGID($gid,'ucp|Voicemail','playback', true);
			$this->setModuleSettingByGID($gid,'ucp|Voicemail','settings', true);
			$this->setModuleSettingByGID($gid,'ucp|Voicemail','greetings', true);
			$this->setModuleSettingByGID($gid,'ucp|Voicemail','vmxlocater', true);
			$this->setModuleSettingByGID($gid,'ucp|Conferencespro','enable', true);
			$this->setModuleSettingByGID($gid,'ucp|Endpoint','enable', true);
			$this->setModuleSettingByGID($gid,'ucp|Endpoint','assigned', array("self"));
			$this->setModuleSettingByGID($gid,'ucp|Conferencespro','assigned', array("linked"));
			$this->setModuleSettingByGID($gid,'conferencespro','link', true);
			$this->setModuleSettingByGID($gid,'conferencespro','ivr', true);
			$this->setModuleSettingByGID($gid,'ucp|Sysadmin','vpn_enable', true);
			$tfsettings = array(
				"login",
				"menuover",
				"conference_enable",
				"queue_enable",
				"timecondition_enable",
				"callflow_enable",
				"contact_enable",
				"voicemail_enable",
				"presence_enable",
				"parking_enable",
				"fmfm_enable",
				"dnd_enable",
				"cf_enable",
				"qa_enable",
				"lilo_enable"
			);
			foreach($tfsettings as $setting) {
				$this->setModuleSettingByGID($gid,'restapps',$setting, true);
			}
			$this->setModuleSettingByGID($gid,'restapps','conferences',array('linked'));
			$asettings = array(
				"queues",
				"timeconditions",
				"callflows",
				"contacts"
			);
			foreach($asettings as $setting) {
				$this->setModuleSettingByGID($gid,'restapps',$setting,array('*'));
			}
			$this->setModuleSettingByGID($gid,"contactmanager","showingroups",array("*"));
			$this->setModuleSettingByGID($gid,'contactmanager','groups',array("*"));
			$this->setModuleSettingByGID($gid,'sysadmin','vpn_link', true);
			$this->setModuleSettingByGID($gid,'zulu','enable', true);
			$this->setModuleSettingByGID($gid,'zulu','enable_fax', true);
			$this->setModuleSettingByGID($gid,'zulu','enable_sms', true);
			$this->setModuleSettingByGID($gid,'zulu','enable_phone', true);
		}
	}

	/**
	 * Depreciated function to get the auth object
	 * @method getAuthObject
	 * @return object        The auth object
	 */
	public function getAuthObject() {
		$directory = $this->getDefaultDirectory();
		return $this->getDirectoryObjectByID($directory['id']);
	}

	/**
	 * Get all Direvtory Drivers
	 * @return array Array of valid directory engines
	 */
	private function getDirectoryDrivers() {
		$auths = array();
		foreach(glob(__DIR__."/functions.inc/auth/modules/*.php") as $auth) {
			$name = basename($auth, ".php");
			if(!class_exists('FreePBX\modules\Userman\Auth\\'.$name)) {
				include(__DIR__."/functions.inc/auth/modules/".$name.".php");
			}
			$auths[] = $name;
		}
		return $auths;
	}

	public function getDirectoryObjectByID($id) {
		return $this->directories[$id];
	}

	/**
	 * Delete directory by ID
	 * @method deleteDirectoryByID
	 * @param  int           $id The directory id
	 * @return boolean                  True if deleted
	 */
	public function deleteDirectoryByID($id) {
		$sql = "SELECT * FROM userman_users WHERE `auth` = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($id));
		$users = $sth->fetchAll(\PDO::FETCH_ASSOC);
		foreach($users as $user){
			$this->deleteUserByID($user['id']);
		}

		$sql = "SELECT * FROM userman_groups WHERE `auth` = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($id));
		$groups = $sth->fetchAll(\PDO::FETCH_ASSOC);
		foreach($groups as $group){
			$this->deleteGroupByGID($group['id']);
		}

		$sql = "DELETE FROM ".$this->directoryTable." WHERE `id` = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($id));

		$this->setConfig("auth-settings",$id,false);
		$this->loadActiveDirectories();
		return true;
	}

	/**
	 * Get directory by id
	 * @method getDirectoryByID
	 * @param  int           $id The directory id
	 * @return mixed               Array if found, false if not
	 */
	public function getDirectoryByID($id) {
		$sql = "SELECT * FROM ".$this->directoryTable." WHERE `id` = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($id));
		$settings = $this->getConfig("auth-settings",$id);
		$settings = is_array($settings) ? $settings : array();
		$out = $sth->fetch(\PDO::FETCH_ASSOC);
		if(empty($out)) {
			return false;
		}
		$out['config'] = $settings;
		return $out;
	}

	/**
	 * Add Directory
	 * @method addDirectory
	 * @param  string       $driver   The driver name
	 * @param  string       $name     The directory name
	 * @param  array          $settings Array of diretory settings
	 * @return integer                    The directory ID
	 */
	public function addDirectory($driver, $name, $enable, $settings=array()) {
		$sql = "INSERT INTO ".$this->directoryTable." (`name`,`driver`,`active`) VALUES (?,?,?)";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($name,ucfirst(strtolower($driver)),($enable ? 1 : 0)));
		$id = $this->db->lastInsertId();
		$this->setConfig("auth-settings",$settings,$id);
		$this->loadActiveDirectories();
		return $id;
	}

	/**
	 * Update Directory
	 * @method updateDirectory
	 * @param  integer          $id       The directory ID
	 * @param  string          $name     The directory name
	 * @param  array          $settings Array of diretory settings
	 * @return integer                    The directory ID
	 */
	public function updateDirectory($id, $name, $enable, $settings=array()) {
		$sql = "UPDATE ".$this->directoryTable." SET `name` = ?, `active` = ? WHERE `id` = ?";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($name,($enable ? 1 : 0),$id));
		$this->setConfig("auth-settings",$settings,$id);
		$this->loadActiveDirectories();
		return $id;
	}

	/**
	 * This is here so that the processhooks callback has the right function name to hook into
	 *
	 * Note: Should never be called externally, use the above function!!
	 *
	 * @param {int} $id the user id of the deleted user
	 */
	private function delUser($id,$data) {
		$request = $_REQUEST;
		$display = !empty($request['display']) ? $request['display'] : "";
	}

	/**
	 * This is here so that the processhooks callback has the right function name to hook into
	 *
	 * Note: Should never be called externally, use the above function!!
	 *
	 * @param {int} $gid the group id of the deleted group
	 */
	private function delGroup($gid,$data) {
		$request = $_REQUEST;
		$display = !empty($request['display']) ? $request['display'] : "";
	}

	public function setPrimaryGroup($uid,$gid=null) {

	}

	/**
	 * Add a user to User Manager
	 *
	 * This adds a new user to user manager
	 *
	 * @param int    $directory The directory ID
	 * @param string $username The username
	 * @param string $password The user Password
	 * @param string $default The default user extension, there is an integrity constraint here so there can't be duplicates
	 * @param string $description a short description of this account
	 * @param array $extraData A hash of extra data to provide about this account (work, email, telephone, etc)
	 * @param bool $encrypt Whether to encrypt the password or not. If this is false the system will still assume its hashed as sha1, so this is only useful if importing accounts with previous sha1 passwords
	 * @return array
	 */
	public function addUserByDirectory($directory, $username, $password, $default='none', $description=null, $extraData=array(), $encrypt = true) {
		if(empty($username)) {
			throw new \Exception(_("Username can not be blank"));
		}
		if(empty($password)) {
			throw new \Exception(_("Password can not be blank"));
		}
		set_time_limit(0);
		$dir = $this->getDirectoryByID($directory);
		if($dir['locked']) {
			return array("status" => false, "message" => _("Directory is locked. Can not add user"));
		}
		$display = !empty($_REQUEST['display']) ? $_REQUEST['display'] : "";
		$status = $this->directories[$directory]->addUser($username, $password, $default, $description, $extraData, $encrypt);
		if(!$status['status']) {
			return $status;
		}
		return $status;
	}

	/**
	 * Add a user to User Manager
	 *
	 * This adds a new user to user manager
	 *
	 * @param string $username The username
	 * @param string $password The user Password
	 * @param string $default The default user extension, there is an integrity constraint here so there can't be duplicates
	 * @param string $description a short description of this account
	 * @param array $extraData A hash of extra data to provide about this account (work, email, telephone, etc)
	 * @param bool $encrypt Whether to encrypt the password or not. If this is false the system will still assume its hashed as sha1, so this is only useful if importing accounts with previous sha1 passwords
	 * @return array
	 */
	public function addUser($username, $password, $default='none', $description=null, $extraData=array(), $encrypt = true) {
		if(empty($username)) {
			throw new \Exception(_("Username can not be blank"));
		}
		if(empty($password)) {
			throw new \Exception(_("Password can not be blank"));
		}
		set_time_limit(0);
		$dir = $this->getDefaultDirectory();
		if($dir['locked']) {
			return array("status" => false, "message" => _("Directory is locked. Can not add user"));
		}
		$display = !empty($_REQUEST['display']) ? $_REQUEST['display'] : "";
		$status = $this->directories[$dir['id']]->addUser($username, $password, $default, $description, $extraData, $encrypt);
		if(!$status['status']) {
			return $status;
		}
		return $status;
	}

	/**
	 * Move User to Directory
	 * This only works on directories which allow adding users
	 * @method moveUserToDirectory
	 * @param  integer              $uid         User ID
	 * @param  integer              $directoryid Directory ID
	 * @return boolean                           True if success
	 */
	public function moveUserToDirectory($uid, $directoryid) {
		$user = $this->getUserByID($uid);
		if(empty($user)) {
			throw new \Exception("User does not exist");
		}
		$permissions = $this->getAuthAllPermissions($user['auth']);
		if(!$permissions['removeUser']) {
			throw new \Exception("Cant remove users from this directory");
		}
		$permissions = $this->getAuthAllPermissions($directoryid);
		if(!$permissions['addUser']) {
			throw new \Exception("Cant add users to this directory");
		}
		$sql = "UPDATE ".$this->userTable." SET auth = :directoryid WHERE id = :id";
		$sth = $this->db->prepare($sql);
		return $sth->execute(array(
			":directoryid" => $directoryid,
			":id" => $uid
		));
	}

	/**
	 * Add Group by Directory
	 * @method addGroupByDirectory
	 * @param  int              $directory   The Directory ID
	 * @param  string              $groupname   The group name
	 * @param  string              $description The group description
	 */
	public function addGroupByDirectory($directory, $groupname, $description=null, $users=array()) {
		if(empty($groupname)) {
			throw new \Exception(_("Groupname can not be blank"));
		}
		set_time_limit(0);
		$dir = $this->getDirectoryByID($directory);
		if($dir['locked']) {
			return array("status" => false, "message" => _("Directory is locked. Can not add group"));
		}
		$display = !empty($_REQUEST['display']) ? $_REQUEST['display'] : "";
		//remove faulty users from group
		$fusers = array();
		foreach($users as $u) {
			if(!empty($u)) {
				$fusers[] = $u;
			}
		}
		$status = $this->directories[$directory]->addGroup($groupname, $description, $fusers);
		if(!$status['status']) {
			return $status;
		}
		return $status;
	}

	/**
	 * Add Group
	 * @method addGroup
	 * @param  string   $groupname   The Group Name
	 * @param  string   $description The group description
	 */
	public function addGroup($groupname, $description=null, $users=array(), $extraData=array()) {
		if(empty($groupname)) {
			throw new \Exception(_("Groupname can not be blank"));
		}
		set_time_limit(0);
		$dir = $this->getDefaultDirectory();
		if($dir['locked']) {
			return array("status" => false, "message" => _("Directory is locked. Can not add group"));
		}
		$display = !empty($_REQUEST['display']) ? $_REQUEST['display'] : "";
		//remove faulty users from group
		$fusers = array();
		foreach($users as $u) {
			if(!empty($u)) {
				$fusers[] = $u;
			}
		}

		$status = $this->directories[$dir['id']]->addGroup($groupname, $description, $fusers, $extraData);
		if(!$status['status']) {
			return $status;
		}
		return $status;
	}

	/**
	 * Update User Extra Data
	 *
	 * This updates Extra Data about the user
	 * (fname,lname,title,email,cell,work,home,department)
	 *
	 * @param int $id The User Manager User ID
	 * @param array $data A hash of data to update (see above)
	 */
	public function updateUserExtraData($id,$data=array()) {
		$user = $this->getUserByID($id);
		if(empty($user)) {
			return false;
		}
		$o = $this->updateUser($id, $user['username'], $user['username'], $user['default_extension'], $user['description'], $data);
		return $o['status'];
	}

	/**
	 * Update User Extra Data
	 *
	 * This updates Extra Data about the user
	 * (fname,lname,title,email,cell,work,home,department)
	 *
	 * @param int $id The User Manager User ID
	 * @param array $data A hash of data to update (see above)
	 */
	public function updateGroupExtraData($gid,$data=array()) {
		$group = $this->getGroupByID($id);
		if(empty($group)) {
			return false;
		}
		$o = $this->updateGroup($gid, $group['groupname'], $group['groupname'], $group['groupname'], $group['users'],false,$data);
		return $o['status'];
	}

	/**
	 * Update a User in User Manager
	 *
	 * This Updates a User in User Manager
	 *
	 * @param int $uid The User ID
	 * @param string $username The username
	 * @param string $password The user Password
	 * @param string $default The default user extension, there is an integrity constraint here so there can't be duplicates
	 * @param string $description a short description of this account
	 * @param array $extraData A hash of extra data to provide about this account (work, email, telephone, etc)
	 * @param string $password The updated password, if null then password isn't updated
	 * @return array
	 */
	public function updateUser($uid, $prevUsername, $username, $default='none', $description=null, $extraData=array(), $password=null, $nodisplay = false) {
		if(!is_numeric($uid)) {
			throw new \Exception(_("UID was not numeric"));
		}
		if(empty($prevUsername)) {
			throw new \Exception(_("Previous Username can not be blank"));
		}
		set_time_limit(0);
		/**
		 * Coming from an adaptor that doesnt support username changes
		 */
		if(empty($username)) {
			$username = $prevUsername;
		}
		$u = $this->getUserByID($uid);
		$dir = $this->getDirectoryByID($u['auth']);
		if($dir['locked']) {
			return array("status" => false, "message" => _("Directory is locked. Can not update user"));
		}
		$status = $this->directories[$u['auth']]->updateUser($uid, $prevUsername, $username, $default, $description, $extraData, $password, $nodisplay);
		if(!$status['status']) {
			return $status;
		}
		$id = $status['id'];

		return $status;
	}

	/**
	 * Update Group
	 * @param string $prevGroupname The group's previous name
	 * @param string $groupname     The Groupname
	 * @param string $description   The group description
	 * @param array  $users         Array of users in this Group
	 */
	public function updateGroup($gid, $prevGroupname, $groupname, $description=null, $users=array(), $nodisplay = false, $extraData=array()) {
		if(!is_numeric($gid)) {
			throw new \Exception(_("GID was not numeric"));
		}
		if(empty($prevGroupname)) {
			throw new \Exception(_("Previous Groupname can not be blank"));
		}
		set_time_limit(0);

		/**
		 * Coming from an adaptor that doesnt support groupname changes
		 */
		if(empty($groupname)) {
			$groupname = $prevGroupname;
		}
		//remove faulty users from group
		$fusers = array();
		foreach($users as $u) {
			if(!empty($u)) {
				$fusers[] = $u;
			}
		}

		$g = $this->getGroupByGID($gid);
		$dir = $this->getDirectoryByID($g['auth']);
		if($dir['locked']) {
			return array("status" => false, "message" => _("Directory is locked. Can not update group"));
		}
		$status = $this->directories[$g['auth']]->updateGroup($gid, $prevGroupname, $groupname, $description, $fusers, $nodisplay, $extraData);
		if(!$status['status']) {
			return $status;
		}
		return $status;
	}

	/**
	 * Check Credentials against username with a password
	 * @param {string} $username      The username
	 * @param {string} $password The sha
	 */
	public function checkCredentials($username, $password) {
		$sql = "SELECT u.username, d.id as dirid from userman_users u, userman_directories d WHERE username = ? AND u.auth = d.id AND d.active = 1 ORDER BY d.order LIMIT 1";
		$sth = $this->db->prepare($sql);
		$sth->execute(array($username));
		$user = $sth->fetch(\PDO::FETCH_ASSOC);
		if(empty($user)) {
			return false;
		}
		return $this->directories[$user['dirid']]->checkCredentials($username, $password);
	}

	/**
	 * Get the assigned devices (Extensions or ﻿(device/user mode) Users) for this User
	 *
	 * This funciton is depreciated. it only returns data for default_extension
	 *
	 * @param int $id The ID of the user from User Manager
	 * @return array
	 */
	public function getAssignedDevices($id) {
		$user = $this->getUserbyID($id);
		return !empty($user['default_extension']) ? array($user['default_extension']) : array();
	}

	/**
	 * Set the assigned devices (Extensions or ﻿(device/user mode) Users) for this User
	 *
	 * This function is depreciated and will do nothing
	 *
	 * @param int $id The ID of the user from User Manager
	 * @param array $devices The devices to add to this user as an array
	 * @return array
	 */
	public function setAssignedDevices($id,$devices=array()) {
		return true;
	}

	/**
	 * Get Globally Defined Sub Settings
	 *
	 * Gets all Globally Defined Sub Settings
	 *
	 * @param int $uid The ID of the user from User Manager
	 * @return mixed false if nothing, else array
	 */
	public function getAllGlobalSettingsByID($uid) {
		$sql = "SELECT a.val, a.type, a.key FROM ".$this->userSettingsTable." a, ".$this->userTable." b WHERE b.id = a.uid AND b.id = :id AND a.module = 'global'";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':id' => $uid));
		$result = $sth->fetchAll(\PDO::FETCH_ASSOC);
		if($result) {
			$fout = array();
			foreach($result as $res) {
				$fout[$res['key']] = (isset($result['type']) && $result['type'] == 'json-arr' && $this->isJson($result['val'])) ? json_decode($result['val'],true) : $result;
			}
			return $fout;
		}
		return false;
	}

	/**
	 * Get Globally Defined Sub Settings
	 *
	 * Gets all Globally Defined Sub Settings
	 *
	 * @param int $gid The ID of the group from User Manager
	 * @return mixed false if nothing, else array
	 */
	public function getAllGlobalSettingsByGID($gid) {
		$sql = "SELECT a.val, a.type, a.key FROM ".$this->groupSettingsTable." a, ".$this->groupTable." b WHERE b.id = a.gid AND b.id = :id AND a.module = 'global'";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':id' => $gid));
		$result = $sth->fetchAll(\PDO::FETCH_ASSOC);
		if($result) {
			$fout = array();
			foreach($result as $res) {
				$fout[$res['key']] = (isset($result['type']) && $result['type'] == 'json-arr' && $this->isJson($result['val'])) ? json_decode($result['val'],true) : $result;
			}
			return $fout;
		}
		return false;
	}

	/**
	 * Get a single setting from a User
	 *
	 * Gets a single Globally Defined Sub Setting
	 *
	 * @param int $uid The ID of the user from User Manager
	 * @param string $setting The keyword that references said setting
	 * @param bool $null If true return null if the setting doesn't exist, else return false
	 * @return mixed null if nothing, else mixed
	 */
	public function getGlobalSettingByID($uid,$setting,$null=false) {
		$sql = "SELECT a.val, a.type FROM ".$this->userSettingsTable." a, ".$this->userTable." b WHERE b.id = a.uid AND b.id = :id AND a.key = :setting AND a.module = 'global'";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':id' => $uid, ':setting' => $setting));
		$result = $sth->fetch(\PDO::FETCH_ASSOC);
		if($result) {
			return ($result['type'] == 'json-arr' && $this->isJson($result['val'])) ? json_decode($result['val'],true) : $result['val'];
		}
		return ($null) ? null : false;
	}

	/**
	 * Get a single setting from a Group
	 *
	 * Gets a single Globally Defined Sub Setting
	 *
	 * @param int $gid The ID of the group from User Manager
	 * @param string $setting The keyword that references said setting
	 * @param bool $null If true return null if the setting doesn't exist, else return false
	 * @return mixed null if nothing, else mixed
	 */
	public function getGlobalSettingByGID($gid,$setting,$null=false) {
		$sql = "SELECT a.val, a.type FROM ".$this->groupSettingsTable." a, ".$this->groupTable." b WHERE b.id = a.gid AND b.id = :id AND a.key = :setting AND a.module = 'global'";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':id' => $gid, ':setting' => $setting));
		$result = $sth->fetch(\PDO::FETCH_ASSOC);
		if($result) {
			return ($result['type'] == 'json-arr' && $this->isJson($result['val'])) ? json_decode($result['val'],true) : $result['val'];
		}
		return ($null) ? null : false;
	}

	/**
	 * Get Locale Specific User Setting from Group
	 * @method getLocaleSpecificSetting
	 * @param  integer                   $uid     The User ID
	 * @param  string                   $keyword The keyword to lookup
	 * @return string                            Result of lookup
	 */
	public function getLocaleSpecificGroupSettingByUID($uid, $keyword) {
		$user = $this->getUserByID($uid, false);
		if(empty($user)) {
			return null;
		}
		$allowed = array("language","timezone","dateformat","timeformat","datetimeformat");
		if(!in_array($keyword,$allowed)) {
			throw new \Exception($keyword . " is not a valid keyword");
		}
		if(empty($user[$keyword])) {
			$groups = $this->getGroupsByID($uid);
			foreach($groups as $group) {
				$g = $this->getGroupByGID($group);
				if(!empty($g[$keyword])) {
					return $g[$keyword];
				}
			}
		}
		return null;
	}

	/**
	 * Get Locale Specific User Setting
	 * @method getLocaleSpecificSetting
	 * @param  integer                   $uid     The User ID
	 * @param  string                   $keyword The keyword to lookup
	 * @return string                            Result of lookup
	 */
	public function getLocaleSpecificSettingByUID($uid, $keyword) {
		$data = $this->getLocaleSpecificGroupSettingByUID($uid, $keyword);
		if(is_null($data)) {
			$user = $this->getUserByID($uid, false);
			return !empty($user[$keyword]) ? $user[$keyword] : null;
		}
		return $data;
	}

	/**
	 * Get Locale Specific User Setting
	 * @method getLocaleSpecificSetting
	 * @param  integer                   $uid     The User ID
	 * @param  string                   $keyword The keyword to lookup
	 * @return string                            Result of lookup
	 */
	public function getLocaleSpecificSetting($uid, $keyword) {
		return $this->getLocaleSpecificSettingByUID($uid, $keyword);
	}

	/**
	 * Gets a single setting after determining groups
	 * by merging group settings into user settings
	 * where as user settings will override groups
	 *
	 * -A true value always overrides a false
	 * -Arrays are merged
	 * -Blank/Empty Values will always take the group that has a setting
	 *
	 * @param int $uid     The user ID to lookup
	 * @param string $setting The setting to get
	 */
	public function getCombinedGlobalSettingByID($id, $setting, $detailed = false) {
		$groupid = -1;
		$groupname = "user";
		$output = $this->getGlobalSettingByID($id,$setting,true);
		if(is_null($output)) {
			$groups = $this->getGroupsByID($id);
			foreach($groups as $group) {
				$gs = $this->getGlobalSettingByGID($group,$setting,true);
				if(!is_null($gs)) {
					//Find and replace the word "self" with this users extension
					if(is_array($gs) && in_array("self",$gs)) {
						$i = array_search ("self", $gs);
						$user = $this->getUserByID($id);
						if($user['default_extension'] !== "none") {
							$gs[$i] = $user['default_extension'];
						}
					}
					$output = $gs;
					$groupid = $group;
					break;
				}
			}
		}
		if($detailed) {
			$grp = ($groupid >= 0) ? $this->getGroupByGID($groupid) : array('groupname' => 'user');
			return array(
				"val" => $output,
				"group" => $groupid,
				"setting" => $setting,
				"groupname" => $grp['groupname']
			);
		} else {
			return $output;
		}
	}

	public function getCombinedModuleSettingByID($id, $module, $setting, $detailed = false, $cached = true) {
		$groupid = -1;
		$groupname = "user";
		$output = $this->getModuleSettingByID($id,$module,$setting,true,$cached);
		if(is_null($output)) {
			$groups = $this->getGroupsByID($id);
			foreach($groups as $group) {
				$gs = $this->getModuleSettingByGID($group,$module,$setting,true,$cached);
				if(!is_null($gs)) {
					//Find and replace the word "self" with this users extension
					if(is_array($gs) && in_array("self",$gs)) {
						$i = array_search ("self", $gs);
						$user = $this->getUserByID($id);
						if($user['default_extension'] !== "none") {
							$gs[$i] = $user['default_extension'];
						}
					}
					$output = $gs;
					$groupid = $group;
					break;
				}
			}
		}
		if($detailed) {
			$grp = ($groupid >= 0) ? $this->getGroupByGID($groupid) : array('groupname' => 'user');
			return array(
				"val" => $output,
				"null" => is_null($output),
				"group" => $groupid,
				"setting" => $setting,
				"module" => $module,
				"groupname" => $grp['groupname']
			);
		} else {
			return $output;
		}
	}

	/**
	 * Set Globally Defined Sub Setting
	 *
	 * Sets a Globally Defined Sub Setting
	 *
	 * @param int $uid The ID of the user from User Manager
	 * @param string $setting The keyword that references said setting
	 * @param mixed $value Can be an array, boolean or string or integer
	 * @return mixed false if nothing, else array
	 */
	public function setGlobalSettingByID($uid,$setting,$value) {
		if(is_null($value)) {
			return $this->removeGlobalSettingByID($uid,$setting);
		}
		if(is_bool($value)) {
			$value = ($value) ? 1 : 0;
		}
		$type = is_array($value) ? 'json-arr' : null;
		$value = is_array($value) ? json_encode($value) : $value;
		$sql = "REPLACE INTO ".$this->userSettingsTable." (`uid`, `module`, `key`, `val`, `type`) VALUES(:uid, :module, :setting, :value, :type)";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':uid' => $uid, ':module' => 'global', ':setting' => $setting, ':value' => $value, ':type' => $type));
		return true;
	}

	/**
	 * Remove a Globally Defined Sub Setting
	 * @param int $uid     The user ID
	 * @param string $setting The setting Name
	 */
	public function removeGlobalSettingByID($uid,$setting) {
		$sql = "DELETE FROM ".$this->userSettingsTable." WHERE `module` = :module AND `uid` = :uid AND `key` = :setting";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':uid' => $uid, ':module' => 'global', ':setting' => $setting));
		return true;
	}

	/**
	 * Set Globally Defined Sub Setting
	 *
	 * Sets a Globally Defined Sub Setting
	 *
	 * @param int $gid The ID of the group from User Manager
	 * @param string $setting The keyword that references said setting
	 * @param mixed $value Can be an array, boolean or string or integer
	 * @return mixed false if nothing, else array
	 */
	public function setGlobalSettingByGID($gid,$setting,$value) {
		if(is_null($value)) {
			return $this->removeGlobalSettingByGID($gid,$setting);
		}
		if(is_bool($value)) {
			$value = ($value) ? 1 : 0;
		}
		$type = is_array($value) ? 'json-arr' : null;
		$value = is_array($value) ? json_encode($value) : $value;
		$sql = "REPLACE INTO ".$this->groupSettingsTable." (`gid`, `module`, `key`, `val`, `type`) VALUES(:gid, :module, :setting, :value, :type)";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':gid' => $gid, ':module' => 'global', ':setting' => $setting, ':value' => $value, ':type' => $type));
		return true;
	}

	/**
	 * Remove a Globally defined sub setting
	 * @param int $gid     The group ID
	 * @param string $setting The setting Name
	 */
	public function removeGlobalSettingByGID($gid,$setting) {
		$sql = "DELETE FROM ".$this->groupSettingsTable." WHERE `module` = :module AND `gid` = :gid AND `key` = :setting";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':gid' => $gid, ':module' => 'global', ':setting' => $setting));
		return true;
	}

	/**
	 * Get All Defined Sub Settings by Module Name
	 *
	 * Get All Defined Sub Settings by Module Name
	 *
	 * @param int $uid The ID of the user from User Manager
	 * @param string $module The module rawname (this can be anything really, another reference ID)
	 * @return mixed false if nothing, else array
	 */
	public function getAllModuleSettingsByID($uid,$module) {
		$sql = "SELECT a.val, a.type, a.key FROM ".$this->userSettingsTable." a, ".$this->userTable." b WHERE b.id = :id AND b.id = a.uid AND a.module = :module";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':id' => $uid, ':module' => $module));
		$result = $sth->fetchAll(\PDO::FETCH_ASSOC);
		if($result) {
			$fout = array();
			foreach($result as $res) {
				$fout[$res['key']] = ($res['type'] == 'json-arr' && $this->isJson($res['val'])) ? json_decode($res['val'],true) : $res['val'];
			}
			return $fout;
		}
		return false;
	}

	/**
	 * Get All Defined Sub Settings by Module Name
	 *
	 * Get All Defined Sub Settings by Module Name
	 *
	 * @param int $gid The GID of the user from User Manager
	 * @param string $module The module rawname (this can be anything really, another reference ID)
	 * @return mixed false if nothing, else array
	 */
	public function getAllModuleSettingsByGID($gid,$module) {
		$sql = "SELECT a.val, a.type, a.key FROM ".$this->groupSettingsTable." a, ".$this->groupTable." b WHERE b.id = :id AND b.id = a.gid AND a.module = :module";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':id' => $gid, ':module' => $module));
		$result = $sth->fetchAll(\PDO::FETCH_ASSOC);
		if($result) {
			$fout = array();
			foreach($result as $res) {
				$fout[$res['key']] = ($res['type'] == 'json-arr' && $this->isJson($res['val'])) ? json_decode($res['val'],true) : $res['val'];
			}
			return $fout;
		}
		return false;
	}

	/**
	 * Get a single setting from a User by Module
	 *
	 * Gets a single Module Defined Sub Setting
	 *
	 * @param int $uid The ID of the user from User Manager
	 * @param string $module The module rawname (this can be anything really, another reference ID)
	 * @param string $setting The keyword that references said setting
	 * @param bool $null If true return null if the setting doesn't exist, else return false
	 * @return mixed false if nothing, else array
	 */
	public function getModuleSettingByID($uid,$module,$setting,$null=false,$cached=true) {
		$settings = $this->getAllModuleUserSettings($cached);

		if(isset($settings[$uid][$module][$setting])) {
			return $settings[$uid][$module][$setting];
		}

		return ($null) ? null : false;
	}

	/**
	 * Get all Module User Settings
	 * @return array The settings as an ASSOC array
	 */
	private function getAllModuleUserSettings($cached = true) {
		if($cached && !empty($this->moduleUserSettingsCache)) {
			return $this->moduleUserSettingsCache;
		}
		$sql = "SELECT * FROM ".$this->userSettingsTable;
		$sth = $this->db->prepare($sql);
		$sth->execute();
		$results = $sth->fetchAll(\PDO::FETCH_ASSOC);
		$final = array();
		foreach($results as $r) {
			$val = ($r['type'] == 'json-arr' && $this->isJson($r['val'])) ? json_decode($r['val'],true) : $r['val'];
			$final[$r['uid']][$r['module']][$r['key']] = $val;
		}
		$this->moduleUserSettingsCache = $final;
		return $this->moduleUserSettingsCache;
	}

	/**
	* Get a single setting from a User by Module
	*
	* Gets a single Module Defined Sub Setting
	*
	* @param int $uid The ID of the user from User Manager
	* @param string $module The module rawname (this can be anything really, another reference ID)
	* @param string $setting The keyword that references said setting
	* @param bool $null If true return null if the setting doesn't exist, else return false
	* @return mixed false if nothing, else array
	*/
	public function getModuleSettingByGID($gid,$module,$setting,$null=false,$cached=true) {
		$settings = $this->getAllModuleGroupSettings($cached);

		if(isset($settings[$gid][$module][$setting])) {
			return $settings[$gid][$module][$setting];
		}

		return ($null) ? null : false;
	}

	/**
	 * Get all Module Group Settings
	 * @return array The settings as an ASSOC array
	 */
	private function getAllModuleGroupSettings($cached=true) {
		if($cached && !empty($this->moduleGroupSettingsCache)) {
			return $this->moduleGroupSettingsCache;
		}
		$sql = "SELECT * FROM ".$this->groupSettingsTable;
		$sth = $this->db->prepare($sql);
		$sth->execute();
		$results = $sth->fetchAll(\PDO::FETCH_ASSOC);
		$final = array();
		foreach($results as $r) {
			$val = ($r['type'] == 'json-arr' && $this->isJson($r['val'])) ? json_decode($r['val'],true) : $r['val'];
			$final[$r['gid']][$r['module']][$r['key']] = $val;
		}
		$this->moduleGroupSettingsCache = $final;
		return $this->moduleGroupSettingsCache;
	}

	/**
	 * Set a Module Sub Setting
	 *
	 * Sets a Module Defined Sub Setting
	 *
	 * @param int $uid The ID of the user from User Manager
	 * @param string $module The module rawname (this can be anything really, another reference ID)
	 * @param string $setting The keyword that references said setting
	 * @param mixed $value Can be an array, boolean or string or integer
	 * @return mixed false if nothing, else array
	 */
	public function setModuleSettingByID($uid,$module,$setting,$value) {
		if(is_null($value)) {
			$sql = "DELETE FROM ".$this->userSettingsTable." WHERE uid = :id AND module = :module AND `key` = :setting";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':id' => $uid, ':module' => $module, ':setting' => $setting));
			$this->moduleUserSettingsCache = array();
			return true;
		}
		if(is_bool($value)) {
			$value = ($value) ? 1 : 0;
		}
		$type = is_array($value) ? 'json-arr' : null;
		$value = is_array($value) ? json_encode($value) : $value;
		$sql = "REPLACE INTO ".$this->userSettingsTable." (`uid`, `module`, `key`, `val`, `type`) VALUES(:id, :module, :setting, :value, :type)";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':id' => $uid, ':module' => $module, ':setting' => $setting, ':value' => $value, ':type' => $type));
		$this->moduleUserSettingsCache = array();
		return true;
	}

	/**
	 * Set a Module Sub Setting
	 *
	 * Sets a Module Defined Sub Setting
	 *
	 * @param int $uid The ID of the user from User Manager
	 * @param string $module The module rawname (this can be anything really, another reference ID)
	 * @param string $setting The keyword that references said setting
	 * @param mixed $value Can be an array, boolean or string or integer
	 * @return mixed false if nothing, else array
	 */
	public function setModuleSettingByGID($gid,$module,$setting,$value) {
		if(is_null($value)) {
			$sql = "DELETE FROM ".$this->groupSettingsTable." WHERE gid = :id AND module = :module AND `key` = :setting";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':id' => $gid, ':module' => $module, ':setting' => $setting));
			$this->moduleGroupSettingsCache = array();
			return true;
		}
		if(is_bool($value)) {
			$value = ($value) ? 1 : 0;
		}
		$type = is_array($value) ? 'json-arr' : null;
		$value = is_array($value) ? json_encode($value) : $value;
		$sql = "REPLACE INTO ".$this->groupSettingsTable." (`gid`, `module`, `key`, `val`, `type`) VALUES(:id, :module, :setting, :value, :type)";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':id' => $gid, ':module' => $module, ':setting' => $setting, ':value' => $value, ':type' => $type));
		$this->moduleGroupSettingsCache = array();
		return true;
	}

	/**
	 * Get all password reset tokens
	 */
	public function getPasswordResetTokens() {
		$tokens = $this->getGlobalsetting('passresettoken');
		$final = array();
		$time = time();
		if(!empty($tokens)) {
			foreach($tokens as $token => $data) {
				if(!empty($data['time']) &&  $data['valid'] < $time) {
					continue;
				}
				$final[$token] = $data;
			}
		}
		$this->setGlobalsetting('passresettoken',$final);
		return $final;
	}

	/**
	 * Reset all password tokens
	 */
	public function resetAllPasswordTokens() {
		$this->setGlobalsetting('passresettoken',array());
	}

	/**
	 * Generate a password reset token for a user
	 * @param int $id The user ID
	 * @param string $valid How long the token key is valid for in string format eg: "5 minutes"
	 * @param bool $force Whether to forcefully generate a token even if one already exists
	 */
	public function generatePasswordResetToken($id, $valid = null, $force = false) {
		$user = $this->getUserByID($id);
		$time = time();
		$valid = !empty($valid) ? $valid : $this->tokenExpiration;
		if(!empty($user)) {
			$tokens = $this->getPasswordResetTokens();
			if(empty($tokens) || !is_array($tokens)) {
				$tokens = array();
			}
			foreach($tokens as $token => $data) {
				if(($data['id'] == $id) && !empty($token['time']) && $data['valid'] > $time) {
					if(!$force) {
						return false;
					}
				}
			}
			$token = bin2hex(openssl_random_pseudo_bytes(16));
			$tokens[$token] = array("id" => $id, "time" => $time, "valid" => strtotime($valid, $time));
			$this->setGlobalsetting('passresettoken',$tokens);
			return array("token" => $token, "valid" => strtotime($valid, $time));
		}
		return false;
	}

	/**
	 * Validate Password Reset token
	 * @param string $token The token
	 */
	public function validatePasswordResetToken($token) {
		$tokens = $this->getPasswordResetTokens();
		if(empty($tokens) || !is_array($tokens)) {
			return false;
		}
		if(isset($tokens[$token])) {
			$user = $this->getUserByID($tokens[$token]['id']);
			if(!empty($user)) {
				return $user;
			}
		}
		return false;
	}

	/**
	 * Reset password for a user base on token
	 * then invalidates the token
	 * @param string $token       The token
	 * @param string $newpassword The password
	 */
	public function resetPasswordWithToken($token,$newpassword) {
		$user = $this->validatePasswordResetToken($token);
		if(!empty($user)) {
			$tokens = $this->getGlobalsetting('passresettoken');
			unset($tokens[$token]);
			$this->setGlobalsetting('passresettoken',$tokens);
			$this->updateUser($user['id'], $user['username'], $user['username'], $user['default_extension'], $user['description'], array(), $newpassword);
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Set a global User Manager Setting
	 * @param {[type]} $key   [description]
	 * @param {[type]} $value [description]
	 */
	public function setGlobalsetting($key, $value) {
		$settings = $this->getGlobalsettings();
		$settings[$key] = $value;
		$sql = "REPLACE INTO module_xml (`id`, `data`) VALUES('userman_data', ?)";
		$sth = $this->db->prepare($sql);
		return $sth->execute(array(json_encode($settings)));
	}

	/**
	 * Get a global User Manager Setting
	 * @param {[type]} $key [description]
	 */
	public function getGlobalsetting($key) {
		$sql = "SELECT data FROM module_xml WHERE id = 'userman_data'";
		$sth = $this->db->prepare($sql);
		$sth->execute();
		$result = $sth->fetch(\PDO::FETCH_ASSOC);
		$results = !empty($result['data']) ? json_decode($result['data'], true) : array();
		return isset($results[$key]) ? $results[$key] : null;
	}

	/**
	 * Get all global user manager settings
	 */
	public function getGlobalsettings() {
		$sql = "SELECT data FROM module_xml WHERE id = 'userman_data'";
		$sth = $this->db->prepare($sql);
		$sth->execute();
		$result = $sth->fetch(\PDO::FETCH_ASSOC);
		return !empty($result['data']) ? json_decode($result['data'], true) : array();
	}

	/**
	 * Pre 12 way to call hooks.
	 * @param string $action Action type
	 * @param mixed $data   Data to send
	 */
	private function callHooks($action,$data=null) {
		$display = !empty($_REQUEST['display']) ? $_REQUEST['display'] : "";
		$ret = array();
		if(isset($this->registeredFunctions[$action])) {
			foreach($this->registeredFunctions[$action] as $function) {
				if(function_exists($function) && !empty($data['id'])) {
					$ret[$function] = $function($data['id'], $display, $data);
				}
			}
		}
		return $ret;
	}

	/**
	 * Migrate/Update Voicemail users to User Manager
	 * @param string $context The voicemail context to reference
	 */
	public function migrateVoicemailUsers($context = "default") {
		echo "Starting to migrate Voicemail users\\n";
		$config = $this->FreePBX->LoadConfig();
		$config->loadConfig("voicemail.conf");
		$context = empty($context) ? "default" : $context;
		if($context == "general" || empty($config->ProcessedConfig[$context])) {
			echo "Invalid Context: '".$context."'";
			return false;
		}

		foreach($config->ProcessedConfig[$context] as $exten => $vu) {
			$vars = explode(",",$vu);
			$password = $vars[0];
			$displayname = $vars[1];
			$email = !empty($vars[2]) ? $vars[2] : '';
			$z = $this->getUserByDefaultExtension($exten);
			if(!empty($z)) {
				echo "Voicemail User '".$z['username']."' already has '".$exten."' as it's default extension.";
				if(empty($z['email']) && empty($z['displayname'])) {
					echo "Updating email and displayname from Voicemail.\\n";
					$this->updateUser($z['id'], $z['username'], $z['username'], $z['default_extension'], $z['description'], array('email' => $email, 'displayname' => $displayname));
				} elseif(empty($z['displayname'])) {
					echo "Updating displayname from Voicemail.\\n";
					$this->updateUser($z['id'], $z['username'], $z['username'], $z['default_extension'], $z['description'], array('displayname' => $displayname));
				} elseif(empty($z['email'])) {
					echo "Updating email from Voicemail.\\n";
					$this->updateUser($z['id'], $z['username'], $z['username'], $z['default_extension'], $z['description'], array('email' => $email));
				} else {
					echo "\\n";
				}
				continue;
			}
			$z = $this->getUserByUsername($exten);
			if(!empty($z)) {
				echo "Voicemail User '".$z['username']."' already exists.";
				if(empty($z['email']) && empty($z['displayname'])) {
					echo "Updating email and displayname from Voicemail.\\n";
					$this->updateUser($z['id'], $z['username'], $z['username'], $z['default_extension'], $z['description'], array('email' => $email, 'displayname' => $displayname));
				} elseif(empty($z['displayname'])) {
					echo "Updating displayname from Voicemail.\\n";
					$this->updateUser($z['id'], $z['username'], $z['username'], $z['default_extension'], $z['description'], array('displayname' => $displayname));
				} elseif(empty($z['email'])) {
					echo "Updating email from Voicemail.\\n";
					$this->updateUser($z['id'], $z['username'], $z['username'], $z['default_extension'], $z['description'], array('email' => $email));
				} else {
					echo "\\n";
				}
				continue;
			}
			$user = $this->addUser($exten, $password, $exten, _('Migrated user from voicemail'), array('email' => $email, 'displayname' => $displayname));
			if(!empty($user['id'])) {
				echo "Added ".$exten." with password of ".$password."\\n";
				if(!empty($email)) {
					$this->sendWelcomeEmail($user['id'], $password);
				}
			} else {
				echo "Could not add ".$exten." because: ".$user['message']."\\n";
			}
		}
		echo "\\nNow run: amportal a ucp enableall\\nTo give all users access to UCP";
	}

	public function sendWelcomeEmailToAll() {
		$users = $this->getAllUsers();
		foreach($users as $user) {
			$this->sendWelcomeEmail($user['id']);
		}
	}

	/**
	 * Sends a welcome email
	 * @param {int} The user ID
	 * @param {string} $password =              null If you want to send the password set it here
	 */
	public function sendWelcomeEmail($id, $password =  null) {
		global $amp_conf;
		$request = $_REQUEST;
		$user = $this->getUserByID($id);
		if(empty($user) || empty($user['email'])) {
			return false;
		}

		$hostname = $this->getGlobalsetting("hostname");
		if(empty($hostname)) {
			$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https" : "http";
			$user['host'] = $protocol.'://'.$_SERVER["SERVER_NAME"];
		} else {
			$user['host'] = $hostname;
		}
		$user['brand'] = $this->brand;

		$usettings = $this->getAuthAllPermissions($user['auth']);
		if(!empty($password)) {
			$user['password'] = $password;
		} elseif(!$usettings['changePassword']) {
			$user['password'] = _("Set by your administrator");
		} else {
			$user['password'] = _("Obfuscated. To reset use the reset link in this email");
		}

		$mods = $this->callHooks('welcome',array('id' => $user['id'], 'brand' => $user['brand'], 'host' => $user['host']));
		$user['services'] = '';
		foreach($mods as $mod) {
			$user['services'] .= $mod . "\n";
		}

		$request['display'] = !empty($request['display']) ? $request['display'] : "";
		$mods = $this->FreePBX->Hooks->processHooks($user['id'], $request['display'], array('id' => $user['id'], 'brand' => $user['brand'], 'host' => $user['host'], 'password' => !empty($password)));
		foreach($mods as $mod => $items) {
			foreach($items as $item) {
				$user['services'] .= $item . "\n";
			}
		}

		$dbemail = $this->getGlobalsetting('emailbody');
		$template = !empty($dbemail) ? $dbemail : file_get_contents(__DIR__.'/views/emails/welcome_text.tpl');
		if(preg_match('/\${([\w|\d]*)}/',$template)) {
			preg_match_all('/\${([\w|\d]*)}/',$template,$matches);
			foreach($matches[1] as $match) {
				$replacement = !empty($user[$match]) ? $user[$match] : '';
				$template = str_replace('${'.$match.'}',$replacement,$template);
			}
		} else {
			preg_match_all('/%([\w|\d]*)%/',$template,$matches);
			foreach($matches[1] as $match) {
				$replacement = !empty($user[$match]) ? $user[$match] : '';
				$template = str_replace('%'.$match.'%',$replacement,$template);
			}
		}
		$email_options = array('useragent' => $this->brand, 'protocol' => 'mail');
		$email = new \CI_Email();
		$from = !empty($amp_conf['AMPUSERMANEMAILFROM']) ? $amp_conf['AMPUSERMANEMAILFROM'] : 'freepbx@freepbx.org';

		$mailtype = $this->getGlobalsetting('mailtype');
		$mailtype = $mailtype === 'html' ? 'html' : 'text';

		$email->set_mailtype($mailtype);
		$email->from($from);
		$email->to($user['email']);
		$dbsubject = $this->getGlobalsetting('emailsubject');
		$subject = !empty($dbsubject) ? $dbsubject : _('Your %brand% Account');
		preg_match_all('/%([\w|\d]*)%/',$subject,$matches);
		foreach($matches[1] as $match) {
			$replacement = !empty($user[$match]) ? $user[$match] : '';
			$subject = str_replace('%'.$match.'%',$replacement,$subject);
		}

		$this->sendEmail($user['id'],$subject,$template);
	}

	/**
	 * Send an email to a user
	 * @param int $id           The user ID
	 * @param string $subject   The email subject
	 * @param string $body      The email body
	 * @param string $forceType Type of email text or html
	 */
	public function sendEmail($id,$subject,$body,$forceType = null) {
		$user = $this->getUserByID($id);
		if(empty($user) || empty($user['email'])) {
			return false;
		}
		$email_options = array('useragent' => $this->brand, 'protocol' => 'mail');
		$email = new \CI_Email();

		//TODO: Stop gap until sysadmin becomes a full class
		if(!function_exists('sysadmin_get_storage_email') && $this->FreePBX->Modules->checkStatus('sysadmin') && file_exists($this->FreePBX->Config()->get('AMPWEBROOT').'/admin/modules/sysadmin/functions.inc.php')) {
			include $this->FreePBX->Config()->get('AMPWEBROOT').'/admin/modules/sysadmin/functions.inc.php';
		}

		$femail = $this->FreePBX->Config()->get('AMPUSERMANEMAILFROM');
		if(function_exists('sysadmin_get_storage_email')) {
			$emails = sysadmin_get_storage_email();
			if(!empty($emails['fromemail']) && filter_var($emails['fromemail'],FILTER_VALIDATE_EMAIL)) {
				$femail = $emails['fromemail'];
			}
		}

		$from = !empty($femail) ? $femail : get_current_user() . '@' . gethostname();

		$mailtype = (isset($forceType)) ? $forceType : $this->getGlobalsetting('mailtype');
		$mailtype = $mailtype === 'html' ? 'html' : 'text';

		$email->set_mailtype($mailtype);
		$email->from($from);
		$email->to($user['email']);

		$email->subject($subject);
		$email->message($body);
		$email->send();
		return true;
	}

	/**
	 * Check if a string is JSON
	 * @param string $string The string to check
	 */
	private function isJson($string) {
		json_decode($string);
		return (json_last_error() == JSON_ERROR_NONE);
	}

	/**
	 * Get all extensions that are in user as the "default extension"
	 */
	private function getAllInUseExtensions() {
		$sql = 'SELECT default_extension FROM '.$this->userTable;
		$sth = $this->db->prepare($sql);
		$sth->execute();
		$devices = $sth->fetchAll(\PDO::FETCH_ASSOC);
		$used = array();
		foreach($devices as $device) {
			if($device['default_extension'] == 'none') {
				continue;
			}
			$used[] = $device['default_extension'];
		}
		return $used;
	}

	public function bulkhandlerGetTypes() {
		$directory = $this->getDefaultDirectory();
		if(empty($directory)) {
			return array();
		}
		$final = array();
		if($this->getAuthPermission($directory['id'],'addUser')) {
			$final['usermanusers'] = array(
				'name' => _('User Manager Users'),
				'description' => _('User Manager Users')
			);
		}
		if($this->getAuthPermission($directory['id'],'addGroup')) {
			$final['usermangroups'] = array(
				'name' => _('User Manager Groups'),
				'description' => _('User Manager Groups')
			);
		}
		return $final;
	}

	/**
	 * Get headers for the bulk handler
	 * @param  string $type The type of bulk handler
	 * @return array       Array of headers
	 */
	public function bulkhandlerGetHeaders($type) {
		switch ($type) {
			case 'usermanusers':
				$headers = array(
					'username' => array(
						'required' => true,
						'identifier' => _('Login Name'),
						'description' => _('Login Name'),
					),
					'password' => array(
						'required' => true,
						'identifier' => _('Password'),
						'description' => _('Password - plaintext'),
					),
					'default_extension' => array(
						'required' => true,
						'identifier' => _('Primary Extension'),
						'description' => _('Primary Linked Extension'),
					),
					'description' => array(
						'identifier' => _('Description'),
						'description' => _('Description'),
					),
					'fname' => array(
						'identifier' => _('First Name'),
						'description' => _('First Name'),
					),
					'lname' => array(
						'identifier' => _('Last Name'),
						'description' => _('Last Name'),
					),
					'displayname' => array(
						'identifier' => _('Display Name'),
						'description' => _('Display Name'),
					)
				);

				return $headers;
			case 'usermangroups':
				$headers = array(
					'groupname' => array(
						'required' => true,
						'identifier' => _('Group Name'),
						'description' => _('Group Name'),
					),
					'description' => array(
						'identifier' => _('Description'),
						'description' => _('Description'),
					)
				);

				return $headers;
		}
	}

	/**
	 * Validate Bulk Handler
	 * @param  string $type    The type of bulk handling
	 * @param  array $rawData Raw data of array
	 * @return array          Full blown status
	 */
	public function bulkhandlerValidate($type, $rawData) {
		$ret = NULL;

		switch ($type) {
		case 'usermanusers':
		case 'usermangroups':
			if (true) {
				$ret = array(
					'status' => true,
				);
			} else {
				$ret = array(
					'status' => false,
					'message' => sprintf(_('%s records failed validation'), count($rawData))
				);
			}
			break;
		}

		return $ret;
	}

	/**
	 * Actually import the users
	 * @param  string $type    The type of import
	 * @param  array $rawData The raw data as an array
	 * @return array          Full blown status
	 */
	public function bulkhandlerImport($type, $rawData, $replaceExisting = false) {
		$ret = NULL;
		switch ($type) {
			case 'usermanusers':
				$directory = $this->getDefaultDirectory();
				if(empty($directory)) {
					return array("status" => false, "message" => _("Please set a default directory in User Manager"));
				}
				if($this->getAuthPermission($directory['id'], 'addUser')) {
					foreach ($rawData as $data) {
						if (empty($data['username'])) {
							return array("status" => false, "message" => _("username is required."));
						}
						if (empty($data['default_extension'])) {
							return array("status" => false, "message" => _("default_extension is required."));
						}

						$username = $data['username'];
						$password = $data['password'];
						$default_extension = $data['default_extension'];
						$description = !empty($data['description']) ? $data['description'] : null;

						$extraData = array(
							'fname' => isset($data['fname']) ? $data['fname'] : null,
							'lname' => isset($data['lname']) ? $data['lname'] : null,
							'displayname' => isset($data['displayname']) ? $data['displayname'] : null,
							'title' => isset($data['title']) ? $data['title'] : null,
							'company' => isset($data['company']) ? $data['company'] : null,
							'department' => isset($data['department']) ? $data['department'] : null,
							'email' => isset($data['email']) ? $data['email'] : null,
							'cell' => isset($data['cell']) ? $data['cell'] : null,
							'work' => isset($data['work']) ? $data['work'] : null,
							'home' => isset($data['home']) ? $data['home'] : null,
							'fax' => isset($data['fax']) ? $data['fax'] : null,
						);

						$existing = $this->getUserByUsername($username,$directory['id']);
						if(!$replaceExisting && $existing) {
							return array("status" => false, "message" => _("User already exists"));
						}
						if ($existing) {
							try {
								$password = !empty($password) ? $password : null;
								$status = $this->updateUser($existing['id'], $username, $username, $default_extension, $description, $extraData, $password);
							} catch (\Exception $e) {
								return array("status" => false, "message" => $e->getMessage());
							}
							if (!$status['status']) {
								$ret = array(
									'status' => false,
									'message' => $status['message'],
								);
								return $ret;
							}
						} else {
							if (empty($data['password'])) {
								return array("status" => false, "message" => _("password is required."));
							}
							try {
								$status = $this->addUser($username, $password, $default_extension, $description, $extraData, true);
							} catch (\Exception $e) {
								return array("status" => false, "message" => $e->getMessage());
							}
							if (!$status['status']) {
								$ret = array(
									'status' => false,
									'message' => $status['message'],
								);
								return $ret;
							}
						}

						break;
					}

					needreload();
					$ret = array(
						'status' => true,
					);
				} else {
					$ret = array(
						'status' => false,
						'message' => _("This authentication driver does not allow importing"),
					);
				}
			break;
			case 'usermangroups':
				$directory = $this->getDefaultDirectory();
				if(empty($directory)) {
					return array("status" => false, "message" => _("Please set a default directory in User Manager"));
				}
				if($this->getAuthPermission($directory['id'], 'addGroup')) {
					foreach ($rawData as $data) {
						if (empty($data['groupname'])) {
							return array("status" => false, "message" => _("groupname is required."));
						}

						$groupname = $data['groupname'];
						$description = !empty($data['description']) ? $data['description'] : null;

						$users = array();
						if (!empty($data['users'])) {
							$usernames = explode(',', $data['users']);
							foreach ($usernames as $username) {
								$user = $this->getUserByUsername($username,$directory['id']);
								if ($user) {
									$users[] = $user['id'];
								}
							}
						}

						$existing = $this->getGroupByUsername($groupname);
						if(!$replaceExisting && $existing) {
							return array("status" => false, "message" => _("Group already exists"));
						}
						if ($existing) {
							try {
								$status = $this->updateGroup($existing['id'], $groupname, $groupname, $description, $users);
							} catch (\Exception $e) {
								return array("status" => false, "message" => $e->getMessage());
							}
							if (!$status['status']) {
								$ret = array(
									'status' => false,
									'message' => $status['message'],
								);
								return $ret;
							}
						} else {
							try {
								$status = $this->addGroup($groupname, $description, $users);
							} catch (\Exception $e) {
								return array("status" => false, "message" => $e->getMessage());
							}
							if (!$status['status']) {
								$ret = array(
									'status' => false,
									'message' => $status['message'],
								);
								return $ret;
							}
						}
					}
				} else {
					$ret = array(
						'status' => false,
						'message' => _("This authentication driver does not allow importing"),
					);
				}
			break;
		}

		return $ret;
	}

	/**
	 * Bulk handler export
	 * @param  string $type The type of bulk handler
	 * @return array       Array of data to be exporting
	 */
	public function bulkhandlerExport($type) {
		$data = NULL;

		switch ($type) {
		case 'usermanusers':
			$users = $this->getAllUsers();
			foreach ($users as $user) {
				$data[$user['id']] = array(
					'username' => $user['username'],
					'description' => $user['description'],
					'default_extension' => $user['default_extension'],
					'password' => '',
					'fname' => $user['fname'],
					'lname' => $user['lname'],
					'displayname' => $user['displayname'],
					'title' => $user['title'],
					'company' => $user['company'],
					'department' => $user['department'],
					'email' => $user['email'],
					'cell' => $user['cell'],
					'work' => $user['work'],
					'home' => $user['home'],
					'fax' => $user['fax'],
				);
			}

			break;
		case 'usermangroups':
			$users = $this->getAllUsers();
			$groups = $this->getAllGroups();
			foreach ($groups as $group) {
				$gu = array();
				//FREEPBX-15351 Bulk Export User Manager Groups does not export correct info in "users" field
				foreach($users as $user){
					foreach ($group['users'] as $key => $val) {
						if ($user['id'] == $val) {
							$gu[] = $user['username'];
						}
					}
				}

				$data[$group['id']] = array(
					'groupname' => $group['groupname'],
					'description' => $group['description'],
					'users' => implode(',', $gu),
				);
			}

			break;
		}
		return $data;
	}
}
