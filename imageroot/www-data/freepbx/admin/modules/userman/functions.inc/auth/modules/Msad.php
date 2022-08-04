<?php
// vim: set ai ts=4 sw=4 ft=php:
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//
//	https://msdn.microsoft.com/en-us/library/windows/desktop/ms677605(v=vs.85).aspx
//
namespace FreePBX\modules\Userman\Auth;
use Adldap\Adldap;
use Adldap\Connections\Provider;
use Adldap\Exceptions\Auth\BindException;
class Msad extends Auth {
	/**
	 * LDAP Object
	 * @var object
	 */
	private $ldap = null;
	/**
	 * LDAP Host
	 * @var string
	 */
	private $host = '';
	/**
	 * LDAP Port
	 * @var integer
	 */
	private $port = 389;
	/**
	 * LDAP Base DN
	 * @var string
	 */
	private $dn = "";
	/**
	 * LDAP Domain
	 * @var string
	 */
	private $domain = "";
	/**
	 * LDAP User
	 * @var string
	 */
	private $user = "";
	/**
	 * LDAP Password
	 * @var string
	 */
	private $password = "";
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

	private $active = 0;

	/**
	 * Private Group Cache
	 * cache requests throughout this class
	 * @var array
	 */
	private $pucache = array();

	/**
	 * Results Limit.
	 * Everything is paginated but we have to define a limit
	 * @var integer
	 */
	private $limit = 900;

	/**
	 * The Adldap2 connector
	 * @var object
	 */
	private $ad = null;

	/**
	 * The account suffix taken from configuration
	 * @var string
	 */
	private $account_suffix;

	/**
	 * Use or not startTLS
	 * @var boolean
	 */
	private $use_tls;

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

	public function __construct($userman, $freepbx, $config=array()) {
		parent::__construct($userman, $freepbx, $config);
		$this->FreePBX = $freepbx;
		$this->host = $config['host'];
		$this->port = !empty($config['port']) ? $config['port'] : 389;
		$this->dn = $config['dn'];
		$this->domain = $config['domain'];
		$this->user = $config['username'];
		$this->password = $config['password'];
		$this->linkAttr = isset($config['la']) ? strtolower($config['la']) : '';
		$this->account_suffix = !empty($config['account_suffix']) ? $config['account_suffix'] : $config['domain'];
		$this->use_tls = isset($config['use_tls']) ? $config['use_tls'] : false;
		$this->output = null;
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
			"name" => _("Microsoft Active Directory (Legacy)")
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
		if(!empty($config['host']) && !empty($config['username']) && !empty($config['password']) && !empty($config['domain'])) {
			$msad = new static($userman, $freepbx, $config);
			try {
				$msad->connect();
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
		} elseif(!empty($config['host']) || !empty($config['username']) || !empty($config['password']) || !empty($config['domain'])) {
			$status = array(
				"connected" => false,
				"type" => "warning",
				"message" => _("Not all of the connection parameters have been filled out")
			);
		}
		return load_view(dirname(dirname(dirname(__DIR__)))."/views/msad.php", array("config" => $config, "status" => $status));
	}

	/**
	 * Save the configuration about the authentication driver
	 * @param  object $userman The userman object
	 * @param  object $freepbx The FreePBX BMO object
	 * @return mixed          Return true if valid. Otherwise return error string
	 */
	public static function saveConfig($userman, $freepbx) {
		$config = array(
			"host" => $_REQUEST['msad-host'],
			"port" => $_REQUEST['msad-port'],
			"username" => $_REQUEST['msad-username'],
			"password" => $_REQUEST['msad-password'],
			"domain" => $_REQUEST['msad-domain'],
			"dn" => $_REQUEST['msad-dn'],
			"la" => $_REQUEST['msad-la'],
			"sync" => $_REQUEST['sync']
		);
		return $config;
	}

	/**
	 * Return the LDAP object after connect
	 * @return object The LDAP object
	 */
	public function getLDAPObject() {
		$msad->connect();
		return $this->ldap;
	}

	/**
	 * Connect to the LDAP server
	 */
	public function connect($reconnect = false) {
		if($reconnect || !$this->ad) {
			$config = [
				'account_suffix'        => $this->account_suffix,
				'use_tls'               => $this->use_tls,
				'domain_controllers'    => [$this->host],
				'base_dn'               => $this->dn,
				'admin_username'        => $this->user,
				'admin_password'        => $this->password,
			];

			$this->provider = new \Adldap\Connections\Provider($config);
			$this->ad = new Adldap(array("default" => $config));
			$this->ad->addProvider($this->provider, 'default');

			try {
				$this->ldap = $this->ad->connect();
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
			$this->out("\tUpdating User ".$user[1]."...",false);
			call_user_func_array(array($this,"updateUserHook"),$user);
			$this->out("done");
		}
		foreach($this->userHooks['remove'] as $user) {
			$this->out("\tRemoving User ".$user[1]."...",false);
			call_user_func_array(array($this,"delUserHook"),$user);
			$this->out("done");
		}
		foreach($this->groupHooks['add'] as $group) {
			$this->out("\tAdding Group ".$group[1]."...",false);
			call_user_func_array(array($this,"addGroupHook"),$group);
			$this->out("done");
		}
		foreach($this->groupHooks['update'] as $group) {
			$this->out("\tUpdating Group ".$group[1]."...",false);
			call_user_func_array(array($this,"updateGroupHook"),$group);
			$this->out("done");
		}
		foreach($this->groupHooks['remove'] as $group) {
			$this->out("\tRemoving Group ".$group[1]."...",false);
			call_user_func_array(array($this,"delGroupHook"),$group);
			$this->out("done");
		}
	}

	/**
	 * Return an array of permissions for this adaptor
	 */
	public function getPermissions() {
		return array(
			"addGroup" => false,
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
		return array("status" => false, "type" => "danger", "message" => _("LDAP is in Read Only Mode. Addition denied"));
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
		$ldap = ldap_connect($this->host,$this->port);
		if($ldap === false) {
			return false;
		}
		ldap_set_option($ldap, LDAP_OPT_PROTOCOL_VERSION, 3);

		if(strpos($username,"@") === false) {
			$res = @ldap_bind($ldap, $username."@".$this->domain, $password);
		} else {
			$res = @ldap_bind($ldap, $username, $password);
		}
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
		}

		$process = array();
		foreach($this->pucache as $usid => $group) {
			$u = $this->getUserByAuthID($usid);
			$gsid = $this->limitString($group->getSid());
			if(!empty($u) && !empty($groups[$gsid])) {
				$group = $groups[$gsid];
				$this->out("\tAdding ".$u['username']." to ".$group['groupname']."...",false);
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
				$this->out("Done");
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
		$this->connect();

		$search = $this->ad->search();
		$paginator = $search->groups()->paginate($this->limit, 1);
		$results = $paginator->getResults();

		$this->out("Found ".count($results). " groups");

		$sql = "DROP TABLE IF EXISTS msad_procs_temp";
		$sth = $this->FreePBX->Database->prepare($sql);
		$sth->execute();
		$tempsql = "CREATE TABLE msad_procs_temp (
			`pid` int NOT NULL,
			`udata` varchar(255),
			`gdata` varchar(255),
			PRIMARY KEY(pid)
		) ENGINE = MEMORY";
		$sth = $this->FreePBX->Database->prepare($tempsql);
		$sth->execute();
		$this->out("Forking child processes");
		$tpath = __DIR__."/tmp";
		if(!file_exists($tpath)) {
			mkdir($tpath,0777,true);
		}
		declare(ticks = 1);
		pcntl_signal(SIGCHLD, array($this,"sig_handler"));
		$max = getCpuCount() * 7;
		$this->active = 0;
		$this->out("Forking out $max active children at a time");
		foreach($results as $i => $result) {

			while ($this->active >= $max) {
				sleep(1);
			}

			$ssid = $result->getObjectSid();
			$this->active++;
			$pid = pcntl_fork();
			if (!$pid) {
				$iid = getmypid().time();
				\FreePBX::Database()->__construct();
				$db = new \DB();
				$this->out("\tGetting users from ".$result->getName()."...");
				$this->connect(true);
				$search = $this->ad->search();
				$record = $search->findBy('objectsid', $ssid);
				$users = $record->getMembers();
				$susers = serialize($users);
				file_put_contents($tpath."/".$iid."-users",$susers);
				$sgroup = serialize($record);
				file_put_contents($tpath."/".$iid."-group",$sgroup);
				$sql = "INSERT INTO msad_procs_temp (`pid`,`udata`,`gdata`) VALUES (?,?,?)";
				$sth = $this->FreePBX->Database->prepare($sql);
				$sth->execute(array($i,$iid."-users",$iid."-group"));
				$this->out("\tFork $i finished Getting users from ".$result->getName());
				exit($i);
			}
		}
		while (pcntl_waitpid(0, $status) != -1) {
			$status = pcntl_wexitstatus($status);
		}
		\FreePBX::Database()->__construct();
		$db = new \DB();
		//$this->connect(true); //Do we have to reconnect?

		$this->out("Child processes have finished");

		$sql = "SELECT * FROM msad_procs_temp";
		$sth = $this->FreePBX->Database->prepare($sql);
		$sth->execute();
		$children = $sth->fetchAll(\PDO::FETCH_ASSOC);
		$this->out("Adding Users from non-primary groups...");
		foreach($children as $child) {
			if(!file_exists($tpath."/".$child['udata']) || !file_exists($tpath."/".$child['gdata'])) {
				continue;
			}
			$udata = file_get_contents($tpath."/".$child['udata']);
			unlink($tpath."/".$child['udata']);
			$users = unserialize($udata);
			$gdata = file_get_contents($tpath."/".$child['gdata']);
			unlink($tpath."/".$child['gdata']);
			$group = unserialize($gdata);

			if(empty($users) || empty($group)) {
				throw new \Exception("Users or Groups are empty");
			}

			$members = array();
			foreach($users as $user) {
				$usid = $this->limitString($user->getSid());
				$u = $this->getUserByAuthID($usid);
				if(!empty($u)) {
					$members[] = $u['id'];
				}
			}
			$sid = $this->limitString($$group->getSid());
			$this->gcache[$sid] = $group;
			$um = $this->linkGroup($group->getName(), $sid);
			if($um['status']) {
				$this->out("\t".$group->getAccountName(). ": ".$um['message']);
				$this->out("\t\tFound ".count($users). " users in ".$group->getName());
				$description = !empty($group->getAttribute('description',0)) ? $group->getAttribute('description',0) : '';
				$this->updateGroupData($um['id'], array(
					"description" => $description,
					"users" => $members
				));
				if($um['new']) {
					$this->groupHooks['add'][$um['id']] = array($um['id'], $group->getName(), $description, $members);
				} else {
					$this->groupHooks['update'][$um['id']] = array($um['id'], $um['prevGroupname'], $group->getName(), $description, $members);
				}
			}
		}

		//remove groups
		$fgroups = $this->getAllGroups();
		foreach($fgroups as $group) {
			if(!isset($this->gcache[$group['authid']])) {
				$this->deleteGroupByGID($group['id'], false);
				$this->groupHooks['remove'][$group['id']] = array($group['id'], $group);
			}
		}
		$sql = "DROP TABLE msad_procs_temp";
		$sth = $this->FreePBX->Database->prepare($sql);
		$sth->execute();
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

		$search = $this->ad->search();

		$paginator = $search->users()->paginate($this->limit, 1);
		$results = $paginator->getResults();

		$this->out("Found ".count($results). " users");

		foreach($results as $result) {
			$sid = $this->limitString($result->getSid());
			$this->ucache[$sid] = $result; //store object

			$this->pucache[$sid] = $result->getPrimaryGroup();

			$um = $this->linkUser($result->getAccountName(), $sid);
			if($um['status']) {
				$this->out("\t".$result->getAccountName(). ": ".$um['message']);
				$data = array(
					"description" => !empty($result->getAttribute('description',0)) ? $result->getAttribute('description',0) : '',
					"primary_group" => !empty($result->getPrimaryGroupId()) ? $result->getPrimaryGroupId() : '',
					"fname" => !empty($result->getFirstName()) ? $result->getFirstName() : '',
					"lname" => !empty($result->getLastName()) ? $result->getLastName() : '',
					"displayname" => !empty($result->getDisplayName()) ? $result->getDisplayName() : '',
					"department" => !empty($result->getDepartment()) ? $result->getDepartment() : '',
					"email" => !empty($result->getEmail()) ? $result->getEmail() : '',
					"cell" => !empty($result->getAttribute('mobile',0)) ? $result->getAttribute('mobile',0) : '',
					"work" => !empty($result->getTelephoneNumber()) ? $result->getTelephoneNumber() : '',
				);
				//automatically assign Extension to this User
				if(!empty($this->linkAttr) && !empty($result->getAttribute($this->linkAttr,0))) {
					$ext = $result->getAttribute($this->linkAttr,0);
					$d = $this->FreePBX->Core->getUser($ext);
					if(!empty($d)) {
						$data["default_extension"] = !empty($ext) ? $ext : '';
					} else {
						//TODO: Technically we could create an extension here..
						dbug("Extension ".$ext . " does not exist, skipping link");
					}
				} elseif(!empty($this->linkAttr) && empty($result->getAttribute($this->linkAttr,0))) {
					$data["default_extension"] = 'none';
				}
				$this->updateUserData($um['id'], $data);
				if($um['new']) {
					$this->userHooks['add'][$um['id']] = array($um['id'], $result->getAccountName(), $data['description'], null, false, $data);
				} else {
					$this->userHooks['update'][$um['id']] = array($um['id'], $um['prevUsername'], $result->getAccountName(), $data['description'], null, $data);
				}
			}
		}
		//remove users
		$fusers = $this->getAllUsers();
		foreach($fusers as $user) {
			if(!isset($this->ucache[$user['authid']])) {
				$this->deleteUserByID($user['id'], false);
				$this->userHooks['remove'][$user['id']] = array($user['id'],$user);
			}
		}
	}

	/**
	 * Turns a binary SID into a String
	 * @param  string $binsid The binary string
	 */
	public function binToStrSid($binsid) {
		$hex_sid = bin2hex($binsid);
		$rev = hexdec(substr($hex_sid, 0, 2));
		$subcount = hexdec(substr($hex_sid, 2, 2));
		$auth = hexdec(substr($hex_sid, 4, 12));
		$result    = "$rev-$auth";

		for ($x=0;$x < $subcount; $x++) {
			$subauth[$x] =
			hexdec($this->littleEndian(substr($hex_sid, 16 + ($x * 8), 8)));
			$result .= "-" . $subauth[$x];
		}

		// Cheat by tacking on the S-
		$string = 'S-' . $result;
		$string = (strlen($string) > 255) ? substr($string,0,255) : $string;
		return $string;
	}

	/**
	 * Converts a little-endian hex-number to one, that 'hexdec' can convert
	 * @param  string $hex hex string
	 */
	public function littleEndian($hex) {
		$result = "";

		for ($x = strlen($hex) - 2; $x >= 0; $x = $x - 2) {
			$result .= substr($hex, $x, 2);
		}
		return $result;
	}

	public function sig_handler($signo) {
		switch($signo) {
			case SIGCLD:
				while (($pid = pcntl_wait($signo, WNOHANG)) > 0) {
					$signal = pcntl_wexitstatus($signo);
					$this->active -= 1;
				}

				break;
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

	private function limitString($string) {
		return (strlen($string) > 255) ? substr($string,0,255) : $string;
	}
}
