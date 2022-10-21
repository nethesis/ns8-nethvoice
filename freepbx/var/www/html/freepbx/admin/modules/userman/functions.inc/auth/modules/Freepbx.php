<?php
// vim: set ai ts=4 sw=4 ft=php:
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//
namespace FreePBX\modules\Userman\Auth;
use Hautelook\Phpass\PasswordHash;

class Freepbx extends Auth {

	public function __construct($userman, $freepbx, $config) {
		parent::__construct($userman, $freepbx, $config);
	}

	/**
	 * Get information about this driver
	 * @param  Object $userman The userman Object
	 * @param  Object $freepbx The freepbx Object
	 * @return array          array of information
	 */
	public static function getInfo($userman, $freepbx) {
		$brand = \FreePBX::Config()->get("DASHBOARD_FREEPBX_BRAND");
		return array(
			"name" => sprintf(_("%s Internal Directory"),$brand)
		);
	}

	public function getDefaultGroups() {
		return $this->config['default-groups'];
	}

	/**
	 * Get configuration for this driver
	 * @param  Object $userman The userman Object
	 * @param  Object $freepbx The freepbx Object
	 * @return string          html to show to the page
	 */
	public static function getConfig($userman, $freepbx, $config) {
		$sgroups = !empty($config['default-groups']) ? $config['default-groups'] : array();
		$sql = "SELECT * FROM userman_groups WHERE auth = ? ORDER BY priority";
		$sth = $freepbx->Database->prepare($sql);
		$sth->execute(array($config['id']));
		$groups = $sth->fetchAll(\PDO::FETCH_ASSOC);
		foreach($groups as &$group) {
			$group['users'] = json_decode($group['users'],true);
		}
		return load_view(dirname(dirname(dirname(__DIR__)))."/views/freepbx.php", array("groups" => $groups, "defaultgroups" => $sgroups));
	}

	/**
	 * Save Configuration from auth config page
	 * @param  Object $userman The userman Object
	 * @param  Object $freepbx The freepbx Object
	 */
	public static function saveConfig($userman, $freepbx) {
		$config = array(
			"default-groups" => $_POST['freepbx-default-groups']
		);
		return $config;
	}

	/**
	* Get All Users
	*
	* Get a List of all User Manager users and their data
	*
	* @return array
	*/
	public function getAllUsers() {
		return parent::getAllUsers();
	}

	/**
	* Get All Groups
	*
	* Get a List of all User Manager users and their data
	*
	* @return array
	*/
	public function getAllGroups() {
		return parent::getAllGroups();
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
	* @param bool $encrypt Whether to encrypt the password or not. If this is false the system will still assume its hashed, so this is only useful if importing accounts with previous hashed passwords
	* @return array
	*/
	public function addUser($username, $password, $default='none', $description=null, $extraData=array(), $encrypt = true) {
		$request = $_REQUEST;
		$display = !empty($request['display']) ? $request['display'] : "";
		$description = !empty($description) ? $description : null;
		if(empty($username) || empty($password)) {
			return array("status" => false, "type" => "danger", "message" => _("Username/Password Can Not Be Blank!"));
		}
		if($this->getUserByUsername($username)) {
			return array("status" => false, "type" => "danger", "message" => sprintf(_("User '%s' Already Exists"),$username));
		}
		$sql = "INSERT INTO ".$this->userTable." (`username`,`auth`,`password`,`description`,`default_extension`) VALUES (:username,:directory,:password,:description,:default_extension)";
		$sth = $this->db->prepare($sql);
		if($encrypt) {
			$passwordHasher = new PasswordHash(8,false);
			$pw = $passwordHasher->HashPassword($password);
		} else {
			$pw = $password;
		}
		try {
			$sth->execute(array(':directory' => $this->config['id'], ':username' => $username, ':password' => $pw, ':description' => $description, ':default_extension' => $default));
		} catch (\Exception $e) {
			return array("status" => false, "type" => "danger", "message" => $e->getMessage());
		}

		$id = $this->db->lastInsertId();
		$this->updateUserData($id,$extraData);
		$this->addUserHook($id, $username, $description, $password, $encrypt, $extraData);
		return array("status" => true, "type" => "success", "message" => _("User Successfully Added"), "id" => $id);
	}

	public function addGroup($groupname, $description=null, $users=array(), $extraData=array()) {
		$sql = "INSERT INTO ".$this->groupTable." (`groupname`,`description`,`users`, `auth`) VALUES (:groupname,:description,:users,:directory)";
		$sth = $this->db->prepare($sql);
		try {
			$sth->execute(array(':directory' => $this->config['id'],':groupname' => $groupname, ':description' => $description, ':users' => json_encode($users)));
		} catch (\Exception $e) {
			return array("status" => false, "type" => "danger", "message" => $e->getMessage());
		}

		$id = $this->db->lastInsertId();
		$this->updateGroupData($id,$extraData);
		$this->addGroupHook($id, $groupname, $description, $users);
		return array("status" => true, "type" => "success", "message" => _("Group Successfully Added"), "id" => $id);
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
		$request = $_REQUEST;
		$display = !empty($request['display']) ? $request['display'] : "";
		$description = !empty($description) ? $description : null;
		$user = $this->getUserByUsername($prevUsername);
		if(!$user || empty($user)) {
			return array("status" => false, "type" => "danger", "message" => sprintf(_("User '%s' Does Not Exist"),$prevUsername));
		}

		if(isset($password)) {
			$sql = "UPDATE ".$this->userTable." SET `username` = :username, `password` = :password, `description` = :description, `default_extension` = :default_extension WHERE `id` = :uid";
			$sth = $this->db->prepare($sql);
			try {
				$passwordHasher = new PasswordHash(8,false);
				$sth->execute(array(':username' => $username, ':uid' => $uid, ':description' => $description, ':password' => $passwordHasher->HashPassword($password), ':default_extension' => $default));
			} catch (\Exception $e) {
				return array("status" => false, "type" => "danger", "message" => $e->getMessage());
			}
		} elseif(($prevUsername != $username) || ($user['description'] != $description) || $user['default_extension'] != $default) {
			if(($prevUsername != $username) && $this->getUserByUsername($username)) {
				return array("status" => false, "type" => "danger", "message" => sprintf(_("User '%s' Already Exists"),$username));
			}
			$sql = "UPDATE ".$this->userTable." SET `username` = :username, `description` = :description, `default_extension` = :default_extension WHERE `id` = :uid";
			$sth = $this->db->prepare($sql);
			try {
				$sth->execute(array(':username' => $username, ':uid' => $uid, ':description' => $description, ':default_extension' => $default));
			} catch (\Exception $e) {
				return array("status" => false, "type" => "danger", "message" => $e->getMessage());
			}
		}
		$message = _("Updated User");

		if(!$this->updateUserData($user['id'],$extraData)) {
			return array("status" => false, "type" => "danger", "message" => _("An Unknown error occured while trying to update user data"));
		}
		$this->updateUserHook($uid, $prevUsername, $username, $description, $password, $extraData, $nodisplay);
		return array("status" => true, "type" => "success", "message" => $message, "id" => $user['id']);
	}

	/**
	* Update Group
	* @param string $prevGroupname The group's previous name
	* @param string $groupname     The Groupname
	* @param string $description   The group description
	* @param array  $users         Array of users in this Group
	*/
	public function updateGroup($gid, $prevGroupname, $groupname, $description=null, $users=array(), $nodisplay = false, $extraData=array()) {
		$group = $this->getGroupByUsername($prevGroupname);
		if(!$group || empty($group)) {
			return array("status" => false, "type" => "danger", "message" => sprintf(_("Group '%s' Does Not Exist"),$group));
		}
		$sql = "UPDATE ".$this->groupTable." SET `groupname` = :groupname, `description` = :description, `users` = :users WHERE `id` = :gid";
		$sth = $this->db->prepare($sql);
		try {
			$sth->execute(array(':groupname' => $groupname, ':gid' => $gid, ':description' => $description, ':users' => json_encode($users)));
		} catch (\Exception $e) {
			return array("status" => false, "type" => "danger", "message" => $e->getMessage());
		}
		if(!$this->updateGroupData($gid,$extraData)) {
			return array("status" => false, "type" => "danger", "message" => _("An Unknown error occured while trying to update user data"));
		}
		$message = _("Updated Group");
		$this->updateGroupHook($gid, $prevGroupname, $groupname, $description, $users, $nodisplay);
		return array("status" => true, "type" => "success", "message" => $message, "id" => $gid);
	}

	/**
	* Check Credentials against username with a passworded sha
	* @param {string} $username      The username
	* @param {string} $password_sha1 The sha
	*/
	public function checkCredentials($username, $password) {
		$sql = "SELECT id, password FROM ".$this->userTable." WHERE username = :username AND auth = :directory";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':username' => $username, ':directory' => $this->config['id']));
		$result = $sth->fetch(\PDO::FETCH_ASSOC);

		$passwordHasher = new PasswordHash(8,false);

		if(!empty($result) && (strlen($result['password']) === 40) && (sha1($password) === $result['password'])) {
			$hash = $passwordHasher->HashPassword($password);
			$sql = "UPDATE ".$this->userTable." SET password = :password WHERE username = :username";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':password' => $hash, ':username' => $username));
			return $result['id'];
		} elseif(!empty($result)) {
			$passwordMatch = $passwordHasher->CheckPassword($password, $result['password']);
			if($passwordMatch) {
				return $result['id'];
			}
		}

		return false;
	}
}
