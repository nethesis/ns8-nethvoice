<?php
namespace App\Schemas;

use Adldap\Schemas\ActiveDirectory;

class Msad2 extends ActiveDirectory {
	private $config;

	public function __construct($config) {
		$this->config = $config;
	}
	public function objectClassUser() {
		return $this->config['userobjectclass'];
	}
	public function accountName() {
		return $this->config['usernameattr'];
	}
	public function commonName() {
		return $this->config['commonnameattr'];
	}
	public function firstName() {
		return $this->config['userfirstnameattr'];
	}
	public function lastName() {
		return $this->config['userlastnameattr'];
	}
	public function displayName() {
		return $this->config['userdisplaynameattr'];
	}
	public function description() {
		return $this->config['descriptionattr'];
	}
	public function personalTitle() {
		return $this->config['usertitleattr'];
	}
	public function company() {
		return $this->config['usercompanyattr'];
	}
	public function email() {
		return $this->config['usermailattr'];
	}
	public function memberOf() {
		return $this->config['usergroupmemberattr'];
	}
	public function unicodePassword() {
		return $this->config['userpasswordattr'];
	}
	public function objectGuid() {
		return $this->config['externalidattr'];
	}
	public function primaryGroupId() {
		return $this->config['userprimarygroupattr'];
	}
	public function objectClassGroup() {
		return $this->config['groupobjectclass'];
	}
	public function member() {
		return $this->config['groupmemberattr'];
	}
}
