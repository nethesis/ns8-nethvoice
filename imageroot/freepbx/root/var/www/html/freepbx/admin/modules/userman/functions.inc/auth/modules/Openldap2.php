<?php
// vim: set ai ts=4 sw=4 ft=php:
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//
//
//  MSActiveDirectory auth module copied and modified for use with OpenLDAP-Directory
//  Modified by Matthias Frei - www.frei.media
//  2016/01/10
//
//
//  Groups are identified by attribute 'objectClass'='posixGroup'
//  User are identified by attribute 'objectClass'='person'
//
//  Group-Membership:  via attributes 'memberUid' of a posixGroup object
//  Primary-Group of User:	via attribute 'gidNumber' of a person object
//
//  FreePBX User Manager Settings examples:
//  Authentication Engine: 				Microsoft Active Directory
//  Username for LDAP-Auth example:		uid=USERA
//  Password for LDAP-Auth:				[LDAP password of USERA]
//  User-DN for LDAP-Auth example:		ou=people,dc=example,dc=com
//  ((=>Generated LDAP-Auth string:		uid=USERA,ou=people,dc=example,dc=com))
//  Base-DN example:  					dc=example,dc=com
//  Extension Link Attribute example:	telephonenumber 	([needs to be lowercase] => LDAP attribute 'telephoneNumber')


namespace FreePBX\modules\Userman\Auth;
use Adldap\Adldap;
use Adldap\Exceptions\Auth\BindException;
class Openldap2 extends Auth {
	private $provider = null;
	/**
	 * LDAP Object
	 * @var object
	 */
	private $ldap = null;
	/**
	 * Socket Timeout
	 * @var integer
	 */
	private $timeout = 3;
	/**
	 * User cache
	 * cache requests throughout this class
	 * @var array
	 */
	private $ucache = array();
	/**
	 * Group Cache
	 * cache requests throughout this class
	 * @var array
	 */
	private $gcache = array();
	/**
	 * Server Time
	 * @var string
	 */
	private $time = null;

	private $limit = 900;

	private static $serverDefaults = array(
		'host' => '',
		'port' => '389',
		'basedn' => '',
		'username' => '',
		'password' => '',
		'connection' => '',
		'localgroups' => 0,
		'createextensions' => '',
		'externalidattr' => 'entryUUID',
		'descriptionattr' => 'description',
		'commonnameattr' => 'cn'
	);

	private static $userDefaults = array(
		'userdn' => '', /** User DN **/
		'userobjectclass' => 'posixAccount', /** Object Class User **/
		'userobjectfilter' => '(objectclass=posixAccount)', /** User Object Filter **/
		'usernameattr' => 'uid', /** Account Name **/
		'userfirstnameattr' => 'givenName', /** First Name **/
		'userlastnameattr' => 'sn', /** Last Name **/
		'userdisplaynameattr' => 'displayName', /** Display Name **/
		'usertitleattr' => '', /** Personal Title **/
		'usercompanyattr' => '', /** Company **/
		'usercellphoneattr' => '', /** Cell Phone TODO: MISS **/
		'userworkphoneattr' => 'telephoneNumber', /** Work Phone **/
		'userhomephoneattr' => '', /** Home Phone TODO: MISS **/
		'userfaxphoneattr' => '', /** Fax Phone TODO: MISS **/
		'usermailattr' => 'mail', /** email **/
		'usergroupmemberattr' => 'memberOf', /** memberOf **/
		'userpasswordattr' => 'userPassword', /** Unicode Password **/
		'userprimarygroupattr' => 'gidNumber', /** primaryGroupId **/
		'la' => ''
	);

	private static $groupDefaults = array(
		'groupdnaddition' => '', /** Group DN **/
		'groupobjectclass' => 'groupOfUniqueNames', /** Object Class Group **/
		'groupobjectfilter' => '(objectclass=posixGroup)', /** Group Object Filter **/
		'groupmemberattr' => 'memberUid', /** member **/
		'groupgidnumberattr' => 'gidNumber'
	);

	private $userHooks = array(
		'add' => array(),
		'update' => array(),
		'remove' => array()
	);

	private $groupHooks = array(
		'add' => array(),
		'update' => array(),
		'remove' => array()
	);

	public function __construct($userman, $freepbx, $config) {
		parent::__construct($userman, $freepbx, $config);
		$this->FreePBX = $freepbx;
		$c = $config;
		$validKeys = array_merge(self::$serverDefaults,self::$userDefaults,self::$groupDefaults);
		$this->config = array();
		$this->config['id'] = !empty($config['id']) ? $config['id'] : '';
		foreach($validKeys as $key => $value) {
			if($key != "password") {
				$this->config[$key] = (isset($c[$key])) ? strtolower($c[$key]) : strtolower($value);
			} else {
				$this->config[$key] = (isset($c[$key])) ? $c[$key] : '';
			}
		}
		if(isset($config['userexternalidattr'])) {
			$this->config['externalidattr'] = strtolower($config['userexternalidattr']);
		}
		if(isset($config['userdescriptionattr'])) {
			$this->config['descriptionattr'] = strtolower($config['userdescriptionattr']);
		}
		if(isset($config['groupnameattr'])) {
			$this->config['commonnameattr'] = strtolower($config['groupnameattr']);
		}
		$date = new \DateTime("now",new \DateTimeZone("UTC"));
		$this->time = $date->format('YmdHis\Z');
	}

	/**
	* Get information about this authentication driver
	* @param  object $userman The userman object
	* @param  object $freepbx The FreePBX BMO object
	* @return array          Array of information about this driver
	*/
	public static function getInfo($userman, $freepbx) {
		if(!function_exists('ldap_connect')) {
			return array();
		}
		return array(
			"name" => _("OpenLDAP Directory")
		);
	}

	/**
	 * Get the configuration display of the authentication driver
	 * @param  object $userman The userman object
	 * @param  object $freepbx The FreePBX BMO object
	 * @return string          html display data
	 */
	public static function getConfig($userman, $freepbx, $config) {
		$status = array(
			"connected" => false,
			"type" => "info",
			"message" => _("Not Connected")
		);
		if(!empty($config['host']) && !empty($config['username']) && !empty($config['password']) && !empty($config['basedn'])) {
			$openldap2 = new static($userman, $freepbx, $config);
			try {
				$openldap2->connect();
				$status = array(
					"connected" => true,
					"type" => "success",
					"message" => _("Connected")
				);
			} catch(\Exception $e) {
				$status = array(
					"connected" => false,
					"type" => "danger",
					"message" => $e->getMessage()
				);
			}
		} elseif(!empty($config['host']) || !empty($config['username']) || !empty($config['password']) || !empty($config['basedn'])) {
			$status = array(
				"connected" => false,
				"type" => "warning",
				"message" => _("Not all of the connection parameters have been filled out")
			);
		}
		$defaults = array_merge(self::$serverDefaults,self::$userDefaults,self::$groupDefaults);
		$techs = $freepbx->Core->getAllDriversInfo();
		return load_view(dirname(dirname(dirname(__DIR__)))."/views/openldap2.php", array("techs" => $techs, "config" => $config, "status" => $status, "defaults" => $defaults));
	}

	/**
	 * Save the configuration about the authentication driver
	 * @param  object $userman The userman object
	 * @param  object $freepbx The FreePBX BMO object
	 * @return mixed          Return true if valid. Otherwise return error string
	 */
	public static function saveConfig($userman, $freepbx) {
		$validKeys = array();
		$validKeys = array_merge($validKeys,array_keys(self::$serverDefaults),array_keys(self::$userDefaults),array_keys(self::$groupDefaults));
		$config = array();
		foreach($validKeys as $key) {
			if(isset($_POST['openldap2-'.$key])) {
				$config[$key] = $_POST['openldap2-'.$key];
			}
		}
		return $config;
	}

	/**
	 * Return the LDAP object after connect
	 * @return object The LDAP object
	 */
	public function getLDAPObject() {
		$openldap2->connect();
		return $this->ldap;
	}

	/**
	 * Connect to the LDAP server
	 */
	public function connect($reconnect = false) {
		if($reconnect || !$this->ldap) {
			if(!class_exists('App\Schemas\Openldap2',false)) {
				include __DIR__."/openldap2/Openldap2Schema.class.php";
			}
			$mySchema = new \App\Schemas\Openldap2($this->config);
			$config = [
				// Mandatory Configuration Options
				'domain_controllers'    => 
					preg_split("/[ ,]/", $this->config['host']),
				'base_dn'               => $this->config['basedn'],
				'admin_username'        => $this->config['username'],
				'admin_password'        => $this->config['password'],

				// Optional Configuration Options
				'port'                  => $this->config['port'],
				'follow_referrals'      => false,
				'use_ssl'               => ($this->config['connection'] == 'ssl'),
				'use_tls'               => ($this->config['connection'] == 'tls'),
				'timeout'               => $this->timeout
			];
			$this->provider = new \Adldap\Connections\Provider($config, $connection = null, $mySchema);
			$ad = new Adldap(array("default" => $config));
			$ad->addProvider($this->provider, 'default');
			try {
				$this->ldap = $ad->connect();
			} catch (BindException $e) {
				throw new \Exception("Unable to Connect to host! Reason: ".$e->getMessage());
			}
		}
	}

	/**
	 * Sync users and groups to the local database
	 */
	public function sync($output=null) {
		if(php_sapi_name() !== 'cli') {
			$path = $this->FreePBX->Config->get("AMPSBIN");
			exec($path."/fwconsole userman --sync ".escapeshellarg($this->config['id'])." --force");
			return;
		}

		$this->connect();
		$this->output = $output;
		$this->out("");
		$this->out("Updating All Users");
		$this->updateAllUsers();
		$this->out("Updating All Groups");
		$this->updateAllGroups();
		$this->out("Updating Primary Groups");
		$this->updatePrimaryGroups();
		$this->out("Executing User Manager Hooks");
		$this->executeHooks();
	}

	/**
	 * Execute all User Manager hooks. After processing
	 */
	public function executeHooks() {
		foreach($this->userHooks['add'] as $user) {
			$this->out("\tAdding User ".$user[1]."...",false);
			call_user_func_array(array($this,"addUserHook"),$user);
			$this->out("done");
		}
		foreach($this->userHooks['update'] as $user) {
			$this->out("\tUpdating User ".$user[2]."...",false);
			call_user_func_array(array($this,"updateUserHook"),$user);
			$this->out("done");
		}
		foreach($this->userHooks['remove'] as $user) {
			$this->out("\tRemoving User ".$user[1]['username']."...",false);
			call_user_func_array(array($this,"delUserHook"),$user);
			$this->out("done");
		}
		foreach($this->groupHooks['add'] as $group) {
			$this->out("\tAdding Group ".$group[1]."...",false);
			call_user_func_array(array($this,"addGroupHook"),$group);
			$this->out("done");
		}
		foreach($this->groupHooks['update'] as $group) {
			$this->out("\tUpdating Group ".$group[2]."...",false);
			call_user_func_array(array($this,"updateGroupHook"),$group);
			$this->out("done");
		}
		foreach($this->groupHooks['remove'] as $group) {
			$this->out("\tRemoving Group ".$group[1]['groupname']."...",false);
			call_user_func_array(array($this,"delGroupHook"),$group);
			$this->out("done");
		}
	}

	/**
	 * Return an array of permissions for this adaptor
	 */
	public function getPermissions() {
		return array(
			"addGroup" => ($this->config['localgroups'] ? true : false),
			"addUser" => false,
			"modifyGroup" => false,
			"modifyUser" => false,
			"modifyGroupAttrs" => false,
			"modifyUserAttrs" => false,
			"removeGroup" => false,
			"removeUser" => false,
			"changePassword" => false
		);
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
	* Get All Users
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
	* @param bool $encrypt Whether to encrypt the password or not. If this is false the system will still assume its hashed as sha1, so this is only useful if importing accounts with previous sha1 passwords
	* @return array
	*/
	public function addUser($username, $password, $default='none', $description=null, $extraData=array(), $encrypt = true) {
		return array("status" => false, "type" => "danger", "message" => _("LDAP is in Read Only Mode. Addition denied"));
	}

	/**
	 * Add a group to User Manager
	 *
	 * This adds a new group to User Manager
	 *
	 * @param string $groupname   The group Name
	 * @param string $description The group description
	 * @param array  $users       users to add to said group (by ID)
	 */
	public function addGroup($groupname, $description=null, $users=array()) {
		if($this->config['localgroups']) {
			$sql = "INSERT INTO ".$this->groupTable." (`groupname`,`description`,`users`, `auth`, `local`) VALUES (:groupname,:description,:users,:directory,1)";
			$sth = $this->db->prepare($sql);
			try {
				$sth->execute(array(':directory' => $this->config['id'],':groupname' => $groupname, ':description' => $description, ':users' => json_encode($users)));
			} catch (\Exception $e) {
				return array("status" => false, "type" => "danger", "message" => $e->getMessage());
			}

			$id = $this->db->lastInsertId();
			$this->addGroupHook($id, $groupname, $description, $users);
			return array("status" => true, "type" => "success", "message" => _("Group Successfully Added"), "id" => $id);
		} else {
			return array("status" => false, "type" => "danger", "message" => _("LDAP is in Read Only Mode. Addition denied"));
		}
	}

	/**
	 * Update a User in User Manager
	 *
	 * This Updates a User in User Manager
	 *
	 * @param string $username The username
	 * @param string $password The user Password
	 * @param string $default The default user extension, there is an integrity constraint here so there can't be duplicates
	 * @param string $description a short description of this account
	 * @param array $extraData A hash of extra data to provide about this account (work, email, telephone, etc)
	 * @param string $password The updated password, if null then password isn't updated
	 * @return array
	 */
	public function updateUser($uid, $prevUsername, $username, $default='none', $description=null, $extraData=array(), $password=null, $nodisplay=false) {
		$sql = "UPDATE ".$this->userTable." SET `default_extension` = :default_extension WHERE `id` = :uid";
		$sth = $this->db->prepare($sql);
		try {
			$sth->execute(array(':default_extension' => $default, ':uid' => $uid));
		} catch (\Exception $e) {
			return array("status" => false, "type" => "danger", "message" => $e->getMessage());
		}
		$this->updateUserHook($uid, $prevUsername, $username, $description, $password, $extraData, $nodisplay);
		return array("status" => true, "type" => "success", "message" => _("User updated"), "id" => $uid);
	}

	/**
	 * Update Group
	 * @param string $prevGroupname The group's previous name
	 * @param string $groupname     The Groupname
	 * @param string $description   The group description
	 * @param array  $users         Array of users in this Group
	 */
	public function updateGroup($gid, $prevGroupname, $groupname, $description=null, $users=array(), $nodisplay=false) {
		$group = $this->getGroupByUsername($prevGroupname);
		if($this->config['localgroups'] && $group['local']) {
			$sql = "UPDATE ".$this->groupTable." SET `groupname` = :groupname, `description` = :description, `users` = :users WHERE `id` = :gid";
			$sth = $this->db->prepare($sql);
			try {
				$sth->execute(array(':groupname' => $groupname, ':gid' => $gid, ':description' => $description, ':users' => json_encode($users)));
			} catch (\Exception $e) {
				return array("status" => false, "type" => "danger", "message" => $e->getMessage());
			}
		}
		$this->updateGroupHook($gid, $prevGroupname, $groupname, $description, $group['users'],$nodisplay);
		return array("status" => true, "type" => "success", "message" => _("Group updated"), "id" => $gid);
	}

	/**
	 * Check Credentials against username with a passworded sha
	 * @param {string} $username      The username
	 * @param {string} $password_sha1 The sha
	 */
	public function checkCredentials($username, $password) {
		$this->connect();

		$userdn = !empty($this->config['userdn']) ? $this->config['userdn'].",".$this->config['basedn'] : $this->config['basedn'];
		$res = $this->provider->auth()->attempt($this->config['usernameattr']."=".$username.",".$userdn, $password);

		if($res) {
			$user = $this->getUserByUsername($username);
		}
		return !empty($user['id']) ? $user['id'] : false;
	}

	/**
	 * Lookup and find all primary group memberships
	 * This should be run after updating groups and users
	 */
	private function updatePrimaryGroups() {
		if(empty($this->ucache) || empty($this->gcache)) {
			$this->updateAllUsers();
			$this->updateAllGroups();
		}

		$groups = array();
		foreach($this->gcache as $gsid => $group) {
			$groups[$gsid] = $this->getGroupByAuthID($gsid);
			$groups[$gsid]['cache'] = $group;
		}
		$process = array();
		foreach($this->ucache as $usid => $user) {
			$u = $this->getUserByAuthID($usid);
			if(empty($user->getAttribute($this->config['userprimarygroupattr'],0))) {
				$this->out("\tUser ".$u['username']." missing ".$this->config['userprimarygroupattr']." attribute. Cant determine primary group");
				continue;
			}
			$primarygroup = $user->getAttribute($this->config['userprimarygroupattr'],0);
			foreach($groups as $gsid => $group) {
				if(empty($group['cache']->getAttribute($this->config['groupgidnumberattr'],0))) {
					$this->out("\tGroup ".$group['groupname']." missing ".$this->config['groupgidnumberattr']." attribute. Cant determine primary group");
					continue;
				} elseif($primarygroup == $group['cache']->getAttribute($this->config['groupgidnumberattr'],0)) {
					$this->out("\tUser ".$u['username']." primary group is ".$group['groupname']);
					if(empty($process[$group['id']])) {
						$process[$group['id']] = array(
							"id" => $group['id'],
							"description" => $group['description'],
							"users" => $group['users'],
							"name" => $group['groupname']
						);
					}
					if(!in_array($u['id'],$process[$group['id']]['users'])) {
						$process[$group['id']]['users'][] = $u['id'];
					}
				}
			}
		}
		foreach($process as $id => $g) {
			$this->updateGroupData($g['id'], array(
				"description" => $g['description'],
				"users" => $g['users']
			));
			if(isset($this->groupHooks['update'][$g['id']])) {
				$this->groupHooks['update'][$g['id']] = array($g['id'], $this->groupHooks['update'][$g['id']][2], $g['name'], $g['description'], $g['users']);
			} else {
				$this->groupHooks['update'][$g['id']] = array($g['id'], $g['name'], $g['name'], $g['description'], $g['users']);
			}
		}
	}

	/**
	 * Update All Groups
	 * Runs through the directory to update all settings (users and naming)
	 */
	private function updateAllGroups() {
		if(!empty($this->gcache)) {
			return true;
		}
		if(php_sapi_name() !== 'cli') {
			throw new \Exception("Can only update groups over CLI");
		}
		$this->connect();
		$userdn = !empty($this->config['userdn']) ? $this->config['userdn'].",".$this->config['basedn'] : $this->config['basedn'];
		$groupdn = !empty($this->config['groupdnaddition']) ? $this->config['groupdnaddition'].",".$this->config['basedn'] : $this->config['basedn'];
		$ldapuri = $this->buildldapuri($this->config['connection'], $this->config['host'], $this->config['port']);
		$this->out("\t".'ldapsearch -w '.$this->config['password'].' -H "'.$ldapuri.'" -D "'.$this->config['username'].'" -b "'.$groupdn.'" -s sub "'.$this->config['groupobjectfilter'].'"');
		$this->out("\tRetrieving all groups...");

		$search = $this->ldap->search();
		//(".$this->config['usermodifytimestampattr'].">=20010301000000Z)
		$paginator = $search->in($groupdn)->rawFilter("(&".$this->config['groupobjectfilter']."(objectclass=".$this->config['groupobjectclass']."))")->select(["*",$this->config['groupgidnumberattr'],$this->config['descriptionattr'],$this->config['groupnameattr'], $this->config['externalidattr'], $this->config['groupmemberattr']])->paginate($this->limit, 1);
		$results = $paginator->getResults();

		if(count($results) == 0) {
			$this->out("\tNo groups found! Perhaps your query is wrong?");
			return;
		}
		$this->out("\tGot ".count($results). " groups");

		foreach($results as $result) {
			$sid = $result->getObjectGuid();
			if(empty($sid)) {
				$this->out("\t\tERROR Group is missing ".$this->config['externalidattr']." attribute! Cant continue!!");
				continue;
			}
			$groupname = $result->getCommonName();
			if(empty($groupname)) {
				$this->out("\t\tGroupname is blank! Skipping unknown group");
				continue;
			}
			$this->gcache[$sid] = $result;
			$um = $this->linkGroup($groupname, $sid);
			$description = !is_null($result->getDescription()) ? $result->getDescription() : '';
			$members = array();
			$this->out("\tWorking on ".$groupname);
			foreach($result->getMembers() as $member) {
				$m = $this->getUserByUsername($member->getAccountName());
				if(!empty($m)) {
					$this->out("\t\t\tAdding ".$m['username']." to group");
					$members[] = $m['id'];
				}
			}
			if($um['status']) {
				$this->updateGroupData($um['id'], array(
					"description" => $description,
					"users" => $members
				));
				if($um['new']) {
					$this->out("\t\tAdding ".$groupname);
					$this->groupHooks['add'][$um['id']] = array($um['id'], $groupname, $description, $members);
				} else {
					$this->out("\t\tUpdating ".$groupname);
					$this->groupHooks['update'][$um['id']] = array($um['id'], $um['prevGroupname'], $groupname, $description, $members);
				}
			}
		}
		//remove users
		$fgroups = $this->getAllGroups();
		foreach($fgroups as $group) {
			if($group['local']) {
				$this->out("\tSkipping local group '".$group['groupname']."'");
				continue;
			}
			if(!isset($this->gcache[$group['authid']])) {
				$this->out("\t\tDeleting ".$group['groupname']);
				$this->deleteGroupByGID($group['id'], false);
				$this->groupHooks['remove'][$group['id']] = array($group['id'], $group);
			}
		}
		$this->out("Finished adding users from non-primary groups");
	}

	/**
	 * Update All Users
	 */
	private function updateAllUsers() {
		if(!empty($this->ucache)) {
			return true;
		}
		$this->connect();

		$userdn = !empty($this->config['userdn']) ? $this->config['userdn'].",".$this->config['basedn'] : $this->config['basedn'];
		$ldapuri = $this->buildldapuri($this->config['connection'], $this->config['host'], $this->config['port']);
		$this->out("\t".'ldapsearch -w '.$this->config['password'].' -H "'.$ldapuri.'" -D "'.$this->config['username'].'" -b "'.$userdn.'" -s sub "'.$this->config['userobjectfilter'].'" "'.$this->config['externalidattr'].'=*" '.$this->config['externalidattr']);
		$this->out("\tRetrieving all users...");

		$search = $this->ldap->search();
		$paginator = $search->in($userdn)->rawFilter("(&".$this->config['userobjectfilter']."(objectclass=".$this->config['userobjectclass']."))")->select(['*',$this->config['externalidattr']])->paginate($this->limit, 1);
		$results = $paginator->getResults();

		if(count($results) == 0) {
			$this->out("\tNo users found! Perhaps your query is wrong?");
			return;
		}

		$this->out("\tGot ".count($results). " users");
		foreach($results as $result) {
			$sid = $result->getObjectGuid();
			if(empty($sid)) {
				$this->out("\t\tERROR User is missing ".$this->config['externalidattr']." attribute! Cant continue!!");
				continue;
			}
			$username = $result->getAccountName();
			if(empty($username)) {
				$this->out("\t\tUsername is blank! Skipping unknown user");
				continue;
			}
			$this->ucache[$sid] = $result;
			$um = $this->linkUser($username, $sid);
			if($um['status']) {
				if($um['new']) {
					$this->out("\t\tAdding ".$username);
				} else {
					$this->out("\t\tUpdating ".$username);
				}
				$data = array(
					"description" => !is_null($result->getDescription()) ? $result->getDescription() : '',
					"primary_group" => !is_null($result->getPrimaryGroupId()) ? $result->getPrimaryGroupId() : '',
					"fname" => !is_null($result->getFirstName()) ? $result->getFirstName() : '',
					"lname" => !is_null($result->getLastName()) ? $result->getLastName() : '',
					"displayname" => !is_null($result->getDisplayName()) ? $result->getDisplayName() : '',
					"department" => !empty($this->config['userdepartmentattr']) && !is_null($result->getAttribute($this->config['userdepartmentattr'],0)) ? $result->getAttribute($this->config['userdepartmentattr'],0) : '',
					"title" => !is_null($result->getTitle()) ? $result->getTitle() : '',
					"email" => !is_null($result->getEmail()) ? $result->getEmail() : '',
					"cell" => !empty($this->config['usercellphoneattr']) && !is_null($result->getAttribute($this->config['usercellphoneattr'],0)) ? $result->getAttribute($this->config['usercellphoneattr'],0) : '',
					"work" => !empty($this->config['userworkphoneattr']) && !is_null($result->getAttribute($this->config['userworkphoneattr'],0)) ? $result->getAttribute($this->config['userworkphoneattr'],0) : '',
					"fax" => !empty($this->config['userfaxphoneattr']) && !is_null($result->getAttribute($this->config['userfaxphoneattr'],0)) ? $result->getAttribute($this->config['userfaxphoneattr'],0) : '',
					"home" => !empty($this->config['userhomephoneattr']) && !is_null($result->getAttribute($this->config['userhomephoneattr'],0)) ? $result->getAttribute($this->config['userhomephoneattr'],0) : '',
				);
				if(!empty($this->config['la']) && !is_null($result->getAttribute($this->config['la'],0))) {
					$extension = $result->getAttribute($this->config['la'],0);
					$d = $this->FreePBX->Core->getUser($extension);
					if(!empty($d)) {
						$this->out("\t\t\tLinking Extension ".$extension." to ".$username);
						$data["default_extension"] = $extension;
					} else {
						$dn = !empty($data['displayname']) ? $data['displayname'] : $data['fname'] ." ".$data['lname'];
						if(!empty($this->config['createextensions'])) {
							$tech = $this->config['createextensions'];
							$this->out("\t\t\tCreating ".$tech." Extension ".$extension);
							$settings = $this->FreePBX->Core->generateDefaultDeviceSettings($tech,$extension,$dn);
							if($this->FreePBX->Core->addDevice($extension,$tech,$settings)) {
								$settings = $this->FreePBX->Core->generateDefaultUserSettings($tech,$dn);
								$settings['outboundcid'] = $data['outboundcid'];
								try {
									if(!$this->FreePBX->Core->addUser($extension, $settings)) {
										//cleanup
										$this->FreePBX->Core->delDevice($extension);
										$this->out("\t\t\tThere was an unknown error creating this extension");
									}
									$this->out("\t\t\tLinking Extension ".$extension." to ".$username);
									$data["default_extension"] = $extension;
								} catch(\Exception $e) {
									//cleanup
									$this->delDevice($extension);
								}
							} else {
								$this->out("\t\t\tDevice ".$extension." was not added!");
							}
						} else {
							$this->out("\t\t\tExtension ". $extension . " does not exist, skipping link");
						}
					}
				} elseif(!empty($this->config['la']) && empty($result->getAttribute($this->config['la'],0))) {
					$data["default_extension"] = 'none';
				}
				$this->updateUserData($um['id'], $data);
				if($um['new']) {
					$this->userHooks['add'][$um['id']] = array($um['id'], $username, $data['description'], null, false, $data);
				} else {
					$this->userHooks['update'][$um['id']] = array($um['id'], $um['prevUsername'], $username, $data['description'], null, $data);
				}
				$this->ucache[$sid]['userman'][0] = $um['id'];
			} else {
				$this->out("\t\t\tThere was an error linking '".$username."'. Error was '".$um['message']."'");
			}
		}
		//remove users
		$fusers = $this->getAllUsers();
		foreach($fusers as $user) {
			if(!isset($this->ucache[$user['authid']])) {
				$this->out("\t\tDeleting ".$user['username']);
				$this->deleteUserByID($user['id'], false);
				$this->userHooks['remove'][$user['id']] = array($user['id'],$user);
			}
		}
	}

	/**
	 * Debug messages
	 * @param  string $message The message
	 * @param  boolean $nl      New line or not
	 */
	private function out($message,$nl=true) {
		if(is_object($this->output) && $this->output->isVerbose()) {
			if($nl) {
				$this->output->writeln($message);
			} else {
				$this->output->write($message);
			}
		} elseif(!is_object($this->output)) {
			dbug($message);
		}
	}

	private function serviceping($hosts, $port=389, $timeout=1) {
		foreach (preg_split("/[ ,]/", $hosts) as $host) {
			$op = @fsockopen($host, $port, $errno, $errstr, $timeout);
			if ($op) {
				fclose($op); //explicitly close open socket connection
				return 1; //DC is up & running, 
						  //we can safely connect with ldap_connect
			}
		}
		return 0; //DC is N/A 
	}

	private function buildldapuri($connection, $hosts, $port) {
	    $securearray = array("ldaps", "ssl");
		$uriarray = array();
		if (in_array($connection, $securearray)) {
			$proto = 'ldaps';
		} else {
			$proto = 'ldap';
		}
		foreach (preg_split("/[ ,]/", $hosts) as $host) {
			array_push($uriarray, $proto . "://" . $host . ":" . $port);
		}
		return implode(" ", $uriarray);
	}
}

