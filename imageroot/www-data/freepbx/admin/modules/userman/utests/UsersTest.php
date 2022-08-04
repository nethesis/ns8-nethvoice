<?php
/**
* https://blogs.kent.ac.uk/webdev/2011/07/14/phpunit-and-unserialized-pdo-instances/
* @backupGlobals disabled
*/
class ModulesTest extends PHPUnit_Framework_TestCase {

	protected static $f;
	protected static $u;
	protected static $id;
	protected static $gid;
	protected static $token;
	protected static $randomUser;

	public static function setUpBeforeClass() {
		self::$f = FreePBX::create();
		self::$u = self::$f->Userman;
	}

	public function testAutoGroup() {
		$r = self::$u->getAutoGroup();
		//$this->assertTrue(!empty($r), "No auto group defined");
	}

	public function testGetAuthPermissions() {
		$r = self::$u->getAuthAllPermissions();
		$this->assertTrue(!empty($r), "No auth permissions");
	}

	public function testGetSingleAuthPermission() {
		$r = self::$u->getAuthPermission("addGroup");
		$this->assertTrue(!empty($r), "No auth permissions");
	}

	public function testAddUser() {
		$r = self::$u->addUser("usermanTest", "randomPassword");
		self::$id = $r['id'];
		$this->assertTrue($r['status'], "Unable to add user for reason: " . $r['message']);
	}

	public function testUpdateUserExtraData() {
		$r = self::$u->updateUserExtraData(self::$id, array("email" => "test@domain.com"));
		$this->assertTrue($r, "Unable to update user extra info for reason: " . $r['message']);
	}

	public function testAddGroup() {
		$r = self::$u->addGroup("usermanTest", "Test", array(self::$id));
		self::$gid = $r['id'];
		$this->assertTrue($r['status'], "Unable to add group user for reason: " . $r['message']);
	}

	public function testUpdateGroup() {
		//$gid, $prevGroupname, $groupname, $description=null, $users=array()
		$r = self::$u->updateGroup(self::$gid, "usermanTest", "usermanTest", "Test", array(self::$id));
		$this->assertTrue($r['status'], "Unable to update group user for reason: " . $r['message']);
	}

	public function testCheckCredentials() {
		$r = self::$u->checkCredentials("usermanTest", "randomPassword");
		$this->assertEquals($r, self::$id, "Authentication failed");
	}

	public function searchUser() {
		$results = array();
		$r = self::$u->search("usermanTest", $results);
		$this->assertTrue(!empty($r), "No users were returned!");
	}

	public function testUpdateUser() {
		$r = self::$u->updateUser(self::$id, "usermanTest", "usermanTest");
		$this->assertTrue($r['status'], "Unable to update user for reason: " . $r['message']);
	}

	public function testGetAllUsers() {
		$r = self::$u->getAllUsers();
		$this->assertTrue(!empty($r), "No users were returned!");
	}

	public function testGetAllGroups() {
		$r = self::$u->getAllGroups();
		$this->assertTrue(!empty($r), "No groups were returned!");
	}

	public function testgetAllContactInfo() {
		$r = self::$u->getAllContactInfo();
		$this->assertTrue(!empty($r), "No contact info returned!");
	}

	public function testGetUserByUsername() {
		$r = self::$u->getUserByUsername("usermanTest");
		$this->assertEquals($r['username'], "usermanTest", "Could not find user by username");
	}

	public function testGetGroupByGroupname() {
		$r = self::$u->getGroupByUsername("usermanTest");
		$this->assertEquals($r['groupname'], "usermanTest", "Could not get group by groupname");
	}

	public function testGetUserByEmail() {
		$r = self::$u->getUserByEmail("test@domain.com");
		$this->assertEquals($r['username'], "usermanTest", "Could not get user by email");
	}

	public function testGetUserByID() {
		$r = self::$u->getUserByID(self::$id);
		$this->assertEquals($r['id'], self::$id, "Could not get user by ID");
	}

	public function testGetGroupByGID() {
		$r = self::$u->getGroupByGID(self::$gid);
		$this->assertEquals($r['id'], self::$gid, "Could not get group by GID");
	}

	public function testGetGroupsByID() {
		$r = self::$u->getGroupsByID(self::$id);
		$this->assertTrue(!empty($r), "Could not get users groups by ID");
	}

	/** Global Settings By User **/

	public function testGetGlobalSettingByIDNull() {
		$r = self::$u->getGlobalSettingByID(self::$id,"settingTest",true);
		$this->assertNull($r, "Did not return null!");
	}

	public function testGetGlobalSettingByIDFalse() {
		$r = self::$u->getGlobalSettingByID(self::$id,"settingTest");
		$this->assertFalse($r, "Did not return false!");
	}

	public function testSetGlobalSettingByID() {
		$r = self::$u->setGlobalSettingByID(self::$id,"settingTest","test");
		$this->assertTrue($r, "Unable to set global setting");
	}

	public function testGetGlobalSettingByID() {
		$r = self::$u->getGlobalSettingByID(self::$id,"settingTest");
		$this->assertEquals($r, "test", "Invalid Returned data");
	}

	public function testGetCombinedGlobalSettingByID() {
		$r = self::$u->	getCombinedGlobalSettingByID(self::$id,"settingTest");
		$this->assertEquals($r, "test", "Invalid Returned data");
	}

	public function testGetAllGlobalSettingsByID() {
		$r = self::$u->getAllGlobalSettingsByID(self::$id);
		$this->assertTrue(!empty($r), "No settings returned!");
	}

	public function testRemoveGlobalSettingByID() {
		$r = self::$u->removeGlobalSettingByID(self::$id,"settingTest");
		$this->assertTrue($r, "Cant remove global setting");
	}

	/** Global Settings By Group **/

	public function testGetGlobalSettingByGIDNull() {
		$r = self::$u->getGlobalSettingByGID(self::$gid,"settingTest",true);
		$this->assertNull($r, "No groups returned!");
	}

	public function testGetGlobalSettingByGIDFalse() {
		$r = self::$u->getGlobalSettingByGID(self::$gid,"settingTest");
		$this->assertFalse($r, "No groups returned!");
	}

	public function testSetGlobalSettingByGID() {
		$r = self::$u->setGlobalSettingByGID(self::$gid,"settingTest","test");
		$this->assertTrue($r, "Unable to set global setting");
	}

	public function testGetGlobalSettingByGID() {
		$r = self::$u->getGlobalSettingByGID(self::$gid,"settingTest");
		$this->assertEquals($r, "test", "Invalid Returned data");
	}

	public function testGetAllGlobalSettingsByGID() {
		$r = self::$u->getAllGlobalSettingsByGID(self::$gid);
		$this->assertTrue(!empty($r), "No settings returned!");
	}

	public function testRemoveGlobalSettingByGID() {
		$r = self::$u->removeGlobalSettingByGID(self::$gid,"settingTest");
		$this->assertTrue($r, "Cant remove global setting");
	}

	/** Module Settings By User**/

	public function testSetModuleSettingByIDNull() {
		$r = self::$u->getModuleSettingByID(self::$id,"moduleTest","settingTest",true);
		$this->assertNull($r, "Did not return null!");
	}

	public function testSetModuleSettingByIDFalse() {
		$r = self::$u->getModuleSettingByID(self::$id,"moduleTest","settingTest");
		$this->assertFalse($r, "Did not return false!");
	}

	public function testSetModuleSettingByID() {
		$r = self::$u->setModuleSettingByID(self::$id,"moduleTest","settingTest","test");
		$this->assertTrue($r, "Cant remove global setting");
	}

	public function testGetModuleSettingByID() {
		$r = self::$u->getModuleSettingByID(self::$id,"moduleTest","settingTest");
		$this->assertEquals($r, "test", "Invalid Returned data");
	}

	public function testGetCombinedModuleSettingByID() {
		$r = self::$u->getCombinedModuleSettingByID(self::$id,"moduleTest","settingTest");
		$this->assertEquals($r, "test", "Invalid Returned data");
	}

	public function testGetAllModuleSettingsByID() {
		$r = self::$u->getAllModuleSettingsByID(self::$id,"moduleTest");
		$this->assertTrue(!empty($r), "Cant remove global setting");
	}

	/** Module Settings By Group**/

	public function testSetModuleSettingByGIDNull() {
		$r = self::$u->getModuleSettingByGID(self::$gid,"moduleTest","settingTest",true);
		$this->assertNull($r, "No groups returned!");
	}

	public function testSetModuleSettingByGIDFalse() {
		$r = self::$u->getModuleSettingByGID(self::$gid,"moduleTest","settingTest");
		$this->assertFalse($r, "No groups returned!");
	}

	public function testSetModuleSettingByGID() {
		$r = self::$u->setModuleSettingByGID(self::$gid,"moduleTest","settingTest","test");
		$this->assertTrue($r, "Cant remove global setting");
	}

	public function testGetModuleSettingByGID() {
		$r = self::$u->getModuleSettingByGID(self::$gid,"moduleTest","settingTest");
		$this->assertEquals($r, "test", "Invalid Returned data");
	}

	public function testGetAllModuleSettingsByGID() {
		$r = self::$u->getAllModuleSettingsByGID(self::$gid,"moduleTest");
		$this->assertTrue(!empty($r), "Cant remove global setting");
	}

	/** Password Tokens **/

	public function testGeneratePasswordResetToken() {
		$r = self::$u->generatePasswordResetToken(self::$id, "1 minute", true);
		$this->assertTrue(!empty($r), "Cant remove global setting");
		self::$token = $r['token'];
	}

	public function testValidatePasswordResetToken() {
		$r = self::$u->validatePasswordResetToken(self::$token);
		$this->assertTrue(!empty($r), "Cant remove global setting");
	}

	public function testGetPasswordResetTokens() {
		$r = self::$u->getPasswordResetTokens();
		$this->assertTrue(!empty($r), "Cant remove global setting");
	}

	public function testResetPasswordWithToken() {
		$r = self::$u->resetPasswordWithToken(self::$token,"test");
		$this->assertTrue($r, "Cant remove global setting");
	}

	public function testDelUser() {
		$r = self::$u->deleteUserByID(self::$id);
		$this->assertTrue($r['status'], "Unable to delete user [".self::$id."] for reason: " . $r['message']);
	}

	public function testDelGroup() {
		$r = self::$u->deleteGroupByGID(self::$gid);
		$this->assertTrue($r['status'], "Unable to delete user [".self::$gid."] for reason: " . $r['message']);
	}
}
