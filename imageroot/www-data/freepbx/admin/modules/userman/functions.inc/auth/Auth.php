<?php
// vim: set ai ts=4 sw=4 ft=php:
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//
namespace FreePBX\modules\Userman\Auth;

abstract class Auth {
	protected $userTable = 'userman_users';
	protected $userSettingsTable = 'userman_users_settings';
	protected $groupTable = 'userman_groups';
	protected $groupSettingsTable = 'userman_groups_settings';
	protected $directoryTable = 'userman_directories';
	protected $contacts = array();
	protected $auth;
	protected $config;

	public function __construct($userman, $freepbx, $config=array()) {
		$this->FreePBX = $freepbx;
		$this->db = $freepbx->Database;
		$this->userman = $userman;
		$f = new \ReflectionClass($this);
		$this->auth = strtolower($f->getShortName());
		$this->config = $config;
	}

	public function addUserHook($id, $username, $description, $password, $encrypt, $extraData) {
		$display = isset($_REQUEST['display']) ? $_REQUEST['display'] : "";
		$this->FreePBX->Hooks->processHooksByClassMethod("FreePBX\\modules\\Userman", "addUser", array($id, $display, array("id" => $id, "username" => $username, "description" => $description, "password" => $password, "encrypted" => $encrypt, "extraData" => $extraData)));
	}

	public function updateUserHook($id, $prevUsername, $username, $description, $password, $extraData, $nodisplay=false) {
		$display = !$nodisplay && isset($_REQUEST['display']) ? $_REQUEST['display'] : "";
		$this->FreePBX->Hooks->processHooksByClassMethod("FreePBX\\modules\\Userman", "updateUser", array($id, $display, array("id" => $id, "prevUsername" => $prevUsername, "username" => $username, "description" => $description, "password" => $password, "extraData" => $extraData)));
	}

	public function delUserHook($id, $data) {
		$display = isset($_REQUEST['display']) ? $_REQUEST['display'] : "";
		$this->FreePBX->Hooks->processHooksByClassMethod("FreePBX\\modules\\Userman", "delUser", array($id, $display, $data));
	}

	public function addGroupHook($id, $groupname, $description, $users) {
		$display = isset($_REQUEST['display']) ? $_REQUEST['display'] : "";
		$this->FreePBX->Hooks->processHooksByClassMethod("FreePBX\\modules\\Userman", "addGroup", array($id, $display, array("id" => $id, "groupname" => $groupname, "description" => $description, "users" => $users)));
	}

	public function updateGroupHook($id, $prevGroupname, $groupname, $description, $users, $nodisplay=false) {
		$display = !$nodisplay && isset($_REQUEST['display']) ? $_REQUEST['display'] : "";
		$this->FreePBX->Hooks->processHooksByClassMethod("FreePBX\\modules\\Userman", "updateGroup", array($id, $display, array("id" => $id, "prevGroupname" => $prevGroupname, "groupname" => $groupname, "description" => $description, "users" => $users)));
	}

	public function delGroupHook($gid, $data) {
		$display = isset($_REQUEST['display']) ? $_REQUEST['display'] : "";
		$this->FreePBX->Hooks->processHooksByClassMethod("FreePBX\\modules\\Userman", "UpdateGroup", array($gid, $display, $data));
	}

	public function getDefaultGroups() {
		return array();
	}

	public function addUser($username, $password, $default='none', $description=null, $extraData=array(), $encrypt = true) {
		return array("status" => false, "type" => "danger", "message" => _("Add User is not defined"));
	}

	public function updateUser($uid, $prevUsername, $username, $default='none', $description=null, $extraData=array(), $password=null, $nodisplay=false) {
		return array("status" => false, "type" => "danger", "message" => _("Update User is not defined"));
	}

	public function addGroup($groupname, $description=null, $users=array()) {
		return array("status" => false, "type" => "danger", "message" => _("Add Group is not defined"));
	}

	public function updateGroup($gid, $prevGroupname, $groupname, $description=null, $users=array(), $nodisplay=false) {
		return array("status" => false, "type" => "danger", "message" => _("Update Group is not defined"));
	}

	/**
	 * Get information about this authentication driver
	 * @param  object $userman The userman object
	 * @param  object $freepbx The FreePBX BMO object
	 * @return array          Array of information about this driver
	 */
	public static function getInfo($userman, $freepbx) {
		return array();
	}

	/**
	 * Get the configuration display of the authentication driver
	 * @param  object $userman The userman object
	 * @param  object $freepbx The FreePBX BMO object
	 * @return string          html display data
	 */
	public static function getConfig($userman, $freepbx, $config) {
		return '';
	}

	/**
	 * Save the configuration about the authentication driver
	 * @param  object $userman The userman object
	 * @param  object $freepbx The FreePBX BMO object
	 * @return mixed          Return true if valid. Otherwise return error string
	 */
	public static function saveConfig($userman, $freepbx) {
		return $config;
	}

	/**
	 * Return an array of permissions for this adaptor
	 */
	public function getPermissions() {
		return array(
			"addGroup" => true,
			"addUser" => true,
			"modifyGroup" => true,
			"modifyUser" => true,
			"modifyGroupAttrs" => true,
			"modifyUserAttrs" => true,
			"removeGroup" => true,
			"removeUser" => true,
			"changePassword" => true
		);
	}

	/**
	 * Get User Information by Username
	 *
	 * This gets user information by username
	 *
	 * @param string $username The User Manager Username
	 * @return bool
	 */
	public function getUserByUsername($username, $extraInfo = true) {
		if(!empty($this->config['id'])) {
			$sql = "SELECT * FROM ".$this->userTable." WHERE username = :username AND auth = :auth LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':username' => $username, ':auth' => $this->config['id']));
		} else {
			$sql = "SELECT u.* FROM ".$this->userTable." u, ".$this->directoryTable." d WHERE username = :username AND u.auth = d.id ORDER BY d.order LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':username' => $username));
		}
		$user = $sth->fetch(\PDO::FETCH_ASSOC);
		if($extraInfo) {
			$user = $this->userman->getExtraContactInfo($user);
		}
		return $user;
	}

	/**
	 * Get User Information by Email
	 *
	 * This gets user information by Email
	 *
	 * @param string $username The User Manager Email Address
	 * @return bool
	 */
	public function getUserByEmail($username, $extraInfo = true) {
		if(!empty($this->config['id'])) {
			$sql = "SELECT * FROM ".$this->userTable." WHERE email = :email AND auth = :auth LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':email' => $username, ':auth' => $this->config['id']));
		} else {
			$sql = "SELECT u.* FROM ".$this->userTable." u, ".$this->directoryTable." d WHERE email = :email AND u.auth = d.id ORDER BY d.order LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':email' => $username));
		}
		$user = $sth->fetch(\PDO::FETCH_ASSOC);
		if($extraInfo) {
			$user = $this->userman->getExtraContactInfo($user);
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
		if(!empty($this->config['id'])) {
			$sql = "SELECT * FROM ".$this->userTable." WHERE id = :id AND auth = :auth LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':id' => $id, ':auth' => $this->config['id']));
		} else {
			$sql = "SELECT * FROM ".$this->userTable." WHERE id = :id LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':id' => $id));
		}
		$user = $sth->fetch(\PDO::FETCH_ASSOC);
		if($extraInfo) {
			$user = $this->userman->getExtraContactInfo($user);
		}
		return $user;
	}

	/**
	 * Get user by external auth id
	 * @param  string $id The external auth ID
	 * @return array     Array of user data
	 */
	public function getUserByAuthID($id, $extraInfo = true) {
		if(!empty($this->config['id'])) {
			$sql = "SELECT * FROM ".$this->userTable." WHERE authid = :id AND auth = :auth LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':id' => $id, ':auth' => $this->config['id']));
			$user = $sth->fetch(\PDO::FETCH_ASSOC);
		} else { //TODO: authids could clash. This function should not allow without directory id
			$sql = "SELECT * FROM ".$this->userTable." WHERE authid = :id LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':id' => $id));
			$user = $sth->fetch(\PDO::FETCH_ASSOC);
		}
		if($extraInfo) {
			$user = $this->userman->getExtraContactInfo($user);
		}
		return $user;
	}

	/**
	 * Get All Users
	 *
	 * Get a List of all User Manager users and their data
	 *
	 * @return array
	 */
	public function getAllUsers() {
		if(!empty($this->config['id'])) {
			$sql = "SELECT *, coalesce(displayname, username) as dn FROM ".$this->userTable." WHERE auth = :auth ORDER BY username";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(":auth" => $this->config['id']));
		} else {
			$sql = "SELECT *, coalesce(displayname, username) as dn FROM ".$this->userTable." ORDER BY username";
			$sth = $this->db->prepare($sql);
			$sth->execute();
		}
		return $sth->fetchAll(\PDO::FETCH_ASSOC);
	}

	/**
	 * Get all active user ids
	 * @method getAllUserIDs
	 * @param  string        $auth The auth
	 * @return array              Array of User IDs
	 */
	public function getAllUserIDs() {
		if(!empty($this->config['id'])) {
			$sql = "SELECT id FROM ".$this->userTable." WHERE auth = :auth";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':auth' => $this->config['id']));
		} else {
			$sql = "SELECT id FROM ".$this->userTable;
			$sth = $this->db->prepare($sql);
			$sth->execute();
		}
		$u = $sth->fetchAll(\PDO::FETCH_ASSOC);
		$users = array();
		foreach($u as $ud) {
			$users[] = $ud['id'];
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
	public function getAllGroups() {
		if(!empty($this->config['id'])) {
			$sql = "SELECT * FROM ".$this->groupTable." WHERE auth = :auth ORDER BY priority";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(":auth" => $this->config['id']));
		} else {
			$sql = "SELECT * FROM ".$this->groupTable." ORDER BY priority";
			$sth = $this->db->prepare($sql);
			$sth->execute();
		}
		$groups = $sth->fetchAll(\PDO::FETCH_ASSOC);
		foreach($groups as &$group) {
			$group['users'] = json_decode($group['users'],true);
			$group['users'] = is_array($group['users']) ? $group['users'] : array();
		}
		return $groups;
	}

	/**
	* Get User Information by the Default Extension
	*
	* This gets user information from the user which has said extension defined as it's default
	*
	* @param string $extension The User (from Device/User Mode) or Extension to which this User is attached
	* @return bool
	*/
	public function getUserByDefaultExtension($extension) {
		if(!empty($this->config['id'])) {
			$sql = "SELECT * FROM ".$this->userTable." WHERE default_extension = :extension AND auth = :auth LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':extension' => $extension, ':auth' => $this->config['id']));
		} else {
			$sql = "SELECT * FROM ".$this->userTable." WHERE default_extension = :extension LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':extension' => $extension));
		}
		$user = $sth->fetch(\PDO::FETCH_ASSOC);
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
	public function getGroupByUsername($groupname) {
		if(!empty($this->config['id'])) {
			$sql = "SELECT * FROM ".$this->groupTable." WHERE groupname = :groupname AND auth = :auth LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':groupname' => $groupname, ':auth' => $this->config['id']));
		} else {
			$sql = "SELECT * FROM ".$this->groupTable." WHERE groupname = :groupname LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':groupname' => $groupname));
		}
		$group = $sth->fetch(\PDO::FETCH_ASSOC);
		if(!empty($group)) {
			$group['users'] = json_decode($group['users'],true);
			$group['users'] = is_array($group['users']) ? $group['users'] : array();
		}
		return $group;
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
		if(!empty($this->config['id'])) {
			$sql = "SELECT * FROM ".$this->groupTable." WHERE id = :gid AND auth = :auth LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':gid' => $gid, ':auth' => $this->config['id']));
			$group = $sth->fetch(\PDO::FETCH_ASSOC);
		} else {
			$sql = "SELECT * FROM ".$this->groupTable." WHERE id = :gid LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':gid' => $gid));
			$group = $sth->fetch(\PDO::FETCH_ASSOC);
		}
		if(empty($group)) {
			return false;
		}

		$group['users'] = json_decode($group['users'],true);
		$group['users'] = is_array($group['users']) ? $group['users'] : array();

		$users = $this->getAllUserIDs($group['auth']);
		$final = array();
		foreach($group['users'] as $u) {
			if(in_array($u,$users)) {
				$final[] = $u;
			}
		}
		if($group['users'] != $final) {
			$sql = "UPDATE ".$this->groupTable." SET users = :users WHERE id = :gid";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':gid' => $gid, ':users' => json_encode($final)));
		}
		$group['users'] = $final;
		return $group;
	}

	/**
	 * Get group by the external auth ID
	 * @param  string $aid The external auth id
	 * @return array      Array of user information
	 */
	public function getGroupByAuthID($aid) {
		if(!empty($this->config['id'])) {
			$sql = "SELECT * FROM ".$this->groupTable." WHERE authid = :aid AND auth = :auth LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':aid' => $aid, ':auth' => $this->config['id']));
		} else { //TODO: authids could clash. This function should not allow without directory id
			$sql = "SELECT * FROM ".$this->groupTable." WHERE authid = :aid LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(':aid' => $aid));
		}
		$group = $sth->fetch(\PDO::FETCH_ASSOC);
		if(!empty($group)) {
			$group['users'] = json_decode($group['users'],true);
			$group['users'] = is_array($group['users']) ? $group['users'] : array();
		}
		return $group;
	}

	/**
	* Get all Groups that this user is a part of
	* @param int $uid The User ID
	*/
	public function getGroupsByID($uid) {
		$groups = $this->getAllGroups();
		$final = array();
		foreach($groups as $group) {
			if(in_array($uid,$group['users'])) {
				$final[] = $group['id'];
			}
		}
		return $final;
	}

	/**
	* Get User Information by Username
	*
	* This gets user information by username.
	* !!This should never be called externally outside of User Manager!!
	*
	* @param string $id The ID of the user from User Manager
	* @param bool $processHooks Whether to processHooks or not
	* @return array
	*/
	public function deleteUserByID($id, $processHooks=true) {
		$user = $this->getUserByID($id);
		if(empty($user)) {
			return array("status" => false, "type" => "danger", "message" => _("User Does Not Exist"));
		}
		$sql = "DELETE FROM ".$this->userTable." WHERE `id` = :id";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':id' => $id));

		$sql = "DELETE FROM ".$this->userSettingsTable." WHERE `uid` = :uid";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':uid' => $id));
		if($processHooks) {
			$this->delUserHook($id, $user);
		}
		return array("status" => true, "type" => "success", "message" => _("User Successfully Deleted"));
	}

	/**
	* Delete a Group by it's ID
	* @param int $gid The group ID
	* @param bool $processHooks Whether to processHooks or not
	*/
	public function deleteGroupByGID($gid, $processHooks=true) {
		$group = $this->getGroupByGID($gid);
		if(empty($group)) {
			return array("status" => false, "type" => "danger", "message" => _("Group Does Not Exist"));
		}
		$sql = "DELETE FROM ".$this->groupTable." WHERE `id` = :id";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':id' => $gid));

		$sql = "DELETE FROM ".$this->groupSettingsTable." WHERE `gid` = :gid";
		$sth = $this->db->prepare($sql);
		$sth->execute(array(':gid' => $gid));
		if($processHooks) {
			$this->delGroupHook($gid, $group);
		}
		return array("status" => true, "type" => "success", "message" => _("Group Successfully Deleted"));
	}

	/**
	* Get all Users as contacts
	*
	* @return array
	*/
	public function getAllContactInfo() {
		if(!empty($this->contacts)) {
			return $this->contacts;
		}
		if(!empty($this->config['id'])) {
			$sql = "SELECT id, default_extension as internal, username, description, fname, lname, coalesce(displayname, CONCAT_WS(' ', fname, lname)) AS displayname, title, company, department, email, cell, work, home, fax FROM ".$this->userTable." WHERE auth = :auth LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute(array(":auth" => $this->config['id']));
		} else {
			$sql = "SELECT id, default_extension as internal, username, description, fname, lname, coalesce(displayname, CONCAT_WS(' ', fname, lname)) AS displayname, title, company, department, email, cell, work, home, fax FROM ".$this->userTable." LIMIT 1";
			$sth = $this->db->prepare($sql);
			$sth->execute();
		}
		$users = $sth->fetchAll(\PDO::FETCH_ASSOC);
		if(empty($users)) {
			return array();
		}
		foreach($users as &$user) {
			//dont let displayname escape without a value
			$user['displayname'] = !empty($user['displayname']) ? $user['displayname'] : $user['username'];
			$user['internal'] = !empty($user['internal']) && $user['internal'] != "none" ? $user['internal'] : "";
			$user = $this->userman->getExtraContactInfo($user);
		}

		$this->contacts = $users;
		return $this->contacts;
	}

	/**
	 * Link user from external auth system into Usermanager
	 * @param string $username    The username of the user
	 * @param string $authid      The authID
	 */
	public function linkUser($username, $authid = null) {
		if(empty($this->config['id'])) {
			throw new \Exception(_("Unable to link user to an invalid directory"));
		}
		$request = $_REQUEST;
		$display = !empty($request['display']) ? $request['display'] : "";
		$description = !empty($description) ? $description : null;
		if(empty($username)) {
			return array("status" => false, "type" => "danger", "message" => _("Username Can Not Be Blank!"));
		}
		$sql = "SELECT * FROM ".$this->userTable." WHERE auth = :auth AND authid = :authid";
		$sth = $this->db->prepare($sql);
		try {
			$sth->execute(array(':auth' => $this->config['id'], ":authid" => $authid));
			$previous = $sth->fetch(\PDO::FETCH_ASSOC);
		} catch (\Exception $e) {
			return array("status" => false, "type" => "danger", "message" => $e->getMessage());
		}
		if(!$previous) {
			$sql = "INSERT INTO ".$this->userTable." (`username`,`auth`,`authid`) VALUES (:username,:auth,:authid)";
			$sth = $this->db->prepare($sql);
			try {
				$sth->execute(array(':username' => $username, ':auth' => $this->config['id'], ":authid" => $authid));
			} catch (\Exception $e) {
				return array("status" => false, "type" => "danger", "message" => $e->getMessage());
			}

			$id = $this->db->lastInsertId();
			return array("status" => true, "type" => "success", "message" => _("User Successfully Added"), "id" => $id, "new" => true);
		} else {
			$sql = "UPDATE ".$this->userTable." SET username = :username WHERE auth = :auth AND authid = :authid AND id = :id";
			$sth = $this->db->prepare($sql);
			try {
				$sth->execute(array(':username' => $username, ':auth' => $this->config['id'], ":authid" => $authid, ":id" => $previous['id']));
			} catch (\Exception $e) {
				return array("status" => false, "type" => "danger", "message" => $e->getMessage());
			}
			return array("status" => true, "type" => "success", "message" => _("User Successfully Updated"), "id" => $previous['id'], "prevUsername" => $previous['username'], "new" => false);
		}
	}

	/**
	* Link group from external auth system into Usermanager
	* @param string $groupname    The name of the group
	* @param string $authid      The authID
	*/
	public function linkGroup($groupname, $authid = null) {
		if(empty($this->config['id'])) {
			throw new \Exception(_("Unable to link group to an invalid directory"));
		}
		$request = $_REQUEST;
		$display = !empty($request['display']) ? $request['display'] : "";
		$description = !empty($description) ? $description : null;
		if(empty($groupname)) {
			return array("status" => false, "type" => "danger", "message" => _("Groupname Can Not Be Blank!"));
		}
		$sql = "SELECT * FROM ".$this->groupTable." WHERE auth = :auth AND authid = :authid";
		$sth = $this->db->prepare($sql);
		try {
			$sth->execute(array(':auth' => $this->config['id'], ":authid" => $authid));
			$previous = $sth->fetch(\PDO::FETCH_ASSOC);
		} catch (\Exception $e) {
			return array("status" => false, "type" => "danger", "message" => $e->getMessage());
		}
		if(!$previous) {
			$sql = "INSERT INTO ".$this->groupTable." (`groupname`,`auth`,`authid`) VALUES (:groupname,:auth,:authid)";
			$sth = $this->db->prepare($sql);
			try {
				$sth->execute(array(':groupname' => $groupname, ':auth' => $this->config['id'], ":authid" => $authid));
			} catch (\Exception $e) {
				return array("status" => false, "type" => "danger", "message" => $e->getMessage());
			}

			$id = $this->db->lastInsertId();
			return array("status" => true, "type" => "success", "message" => _("group Successfully Added"), "id" => $id, "new" => true);
		} else {
			$sql = "UPDATE ".$this->groupTable." SET groupname = :groupname WHERE auth = :auth AND authid = :authid AND id = :id";
			$sth = $this->db->prepare($sql);
			try {
				$sth->execute(array(':groupname' => $groupname, ':auth' => $this->config['id'], ":authid" => $authid, ":id" => $previous['id']));
			} catch (\Exception $e) {
				return array("status" => false, "type" => "danger", "message" => $e->getMessage());
			}
			return array("status" => true, "type" => "success", "message" => _("Group Successfully Updated"), "id" => $previous['id'], "prevGroupname" => $previous['groupname'], "new" => false);
		}
	}

	/**
	 * Update information about a linked group
	 * @param  int $gid  The Group ID
	 * @param  array  $data Group data
	 * @return Boolean       True is success
	 */
	public function updateGroupData($gid, $data = array()) {
		$sql = "UPDATE ".$this->groupTable." SET `description` = :description, `language` = :language, `timezone` = :timezone, `dateformat` = :dateformat, `timeformat` = :timeformat, `datetimeformat` = :datetimeformat, `users` = :users WHERE `id` = :gid";
		$sth = $this->db->prepare($sql);
		$defaults = $this->getGroupByGID($gid);
		$description = isset($data['description']) ? $data['description'] : (!isset($data['description']) && !empty($defaults['description']) ? $defaults['description'] : null);
		$users = isset($data['users']) ? $data['users'] : (!isset($data['users']) && !empty($defaults['users']) ? $defaults['users'] : null);
		$language = isset($data['language']) ? $data['language'] : (!isset($data['language']) && !empty($defaults['language']) ? $defaults['language'] : null);
		$timezone = isset($data['timezone']) ? $data['timezone'] : (!isset($data['timezone']) && !empty($defaults['timezone']) ? $defaults['timezone'] : null);
		$datetimeformat = isset($data['datetimeformat']) ? $data['datetimeformat'] : (!isset($data['datetimeformat']) && !empty($defaults['datetimeformat']) ? $defaults['datetimeformat'] : null);
		$timeformat = isset($data['timeformat']) ? $data['timeformat'] : (!isset($data['timeformat']) && !empty($defaults['timeformat']) ? $defaults['timeformat'] : null);
		$dateformat = isset($data['dateformat']) ? $data['dateformat'] : (!isset($data['dateformat']) && !empty($defaults['dateformat']) ? $defaults['dateformat'] : null);
		try {
			$sth->execute(
				array(
					':description' => $description,
					':language' => $language,
					':timezone' => $timezone,
					':timeformat' => $timeformat,
					':dateformat' => $dateformat,
					':datetimeformat' => $datetimeformat,
					':users' => json_encode($users),
					':gid' => $gid
				)
			);
		} catch (\Exception $e) {
			dbug($e->getMessage());
			return false;
		}
		return true;
	}

	/**
	 * Update linked user data
	 * @param  int $uid  The User ID
	 * @param  array  $data The user Data to update
	 * @return Boolean       True if success
	 */
	public function updateUserData($uid, $data = array()) {
		if(empty($data)) {
			return true;
		}
		$sql = "UPDATE ".$this->userTable." SET `fname` = :fname, `lname` = :lname, `default_extension` = :default_extension, `displayname` = :displayname, `company` = :company, `title` = :title, `email` = :email, `cell` = :cell, `work` = :work, `home` = :home, `fax` = :fax, `department` = :department, `language` = :language, `timezone` = :timezone, `dateformat` = :dateformat, `timeformat` = :timeformat, `datetimeformat` = :datetimeformat, `description` = :description, `primary_group` = :primary_group WHERE `id` = :uid";
		$defaults = $this->getUserByID($uid);
		$sth = $this->db->prepare($sql);
		$fname = isset($data['fname']) ? $data['fname'] : (!isset($data['fname']) && !empty($defaults['fname']) ? $defaults['fname'] : null);
		$lname = isset($data['lname']) ? $data['lname'] : (!isset($data['lname']) && !empty($defaults['lname']) ? $defaults['lname'] : null);
		$default_extension = isset($data['default_extension']) ? $data['default_extension'] : (!isset($data['default_extension']) && !empty($defaults['default_extension']) ? $defaults['default_extension'] : 'none');
		$title = isset($data['title']) ? $data['title'] : (!isset($data['title']) && !empty($defaults['title']) ? $defaults['title'] : null);
		$company = isset($data['company']) ? $data['company'] : (!isset($data['company']) && !empty($defaults['company']) ? $defaults['company'] : null);
		$email = isset($data['email']) ? $data['email'] : (!isset($data['email']) && !empty($defaults['email']) ? $defaults['email'] : null);
		$cell = isset($data['cell']) ? $data['cell'] : (!isset($data['cell']) && !empty($defaults['cell']) ? $defaults['cell'] : null);
		$home = isset($data['home']) ? $data['home'] : (!isset($data['home']) && !empty($defaults['home']) ? $defaults['home'] : null);
		$work = isset($data['work']) ? $data['work'] : (!isset($data['work']) && !empty($defaults['work']) ? $defaults['work'] : null);
		$fax = isset($data['fax']) ? $data['fax'] : (!isset($data['fax']) && !empty($defaults['fax']) ? $defaults['fax'] : null);
		$displayname = isset($data['displayname']) ? $data['displayname'] : (!isset($data['displayname']) && !empty($defaults['displayname']) ? $defaults['displayname'] : null);
		$department = isset($data['department']) ? $data['department'] : (!isset($data['department']) && !empty($defaults['department']) ? $defaults['department'] : null);
		$description = isset($data['description']) ? $data['description'] : (!isset($data['description']) && !empty($defaults['description']) ? $defaults['description'] : null);
		$primary_group = isset($data['primary_group']) ? $data['primary_group'] : (!isset($data['primary_group']) && !empty($defaults['primary_group']) ? $defaults['primary_group'] : null);

		//special case
		$language = (array_key_exists('language',$data) && !empty($data['language'])) ? $data['language'] : (!array_key_exists('language',$data) && !empty($defaults['language']) ? $defaults['language'] : null);
		$timezone = (array_key_exists('timezone',$data) && !empty($data['timezone'])) ? $data['timezone'] : (!array_key_exists('timezone',$data) && !empty($defaults['timezone']) ? $defaults['timezone'] : null);
		$datetimeformat = (array_key_exists('datetimeformat',$data) && !empty($data['datetimeformat'])) ? $data['datetimeformat'] : (!array_key_exists('datetimeformat',$data) && !empty($defaults['datetimeformat']) ? $defaults['datetimeformat'] : null);
		$timeformat = (array_key_exists('timeformat',$data) && !empty($data['timeformat'])) ? $data['timeformat'] : (!array_key_exists('timeformat',$data) && !empty($defaults['timeformat']) ? $defaults['timeformat'] : null);
		$dateformat = (array_key_exists('dateformat',$data) && !empty($data['dateformat'])) ? $data['dateformat'] : (!array_key_exists('dateformat',$data) && !empty($defaults['dateformat']) ? $defaults['dateformat'] : null);

		try {
			$sth->execute(
				array(
					':fname' => $fname,
					':lname' => $lname,
					':default_extension' => $default_extension,
					':displayname' => $displayname,
					':title' => $title,
					':company' => $company,
					':email' => $email,
					':cell' => $cell,
					':work' => $work,
					':home' => $home,
					':fax' => $fax,
					':department' => $department,
					':language' => $language,
					':timezone' => $timezone,
					':timeformat' => $timeformat,
					':dateformat' => $dateformat,
					':datetimeformat' => $datetimeformat,
					':description' => $description,
					':primary_group' => $primary_group,
					':uid' => $uid
				)
			);
		} catch (\Exception $e) {
			return false;
		}
		return true;
	}

	public function checkCredentials($username, $password) {
		return false;
	}
}
