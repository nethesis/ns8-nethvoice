<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//
function userman_configpageinit($pagename) {
	global $currentcomponent;
	global $amp_conf;

	$action = isset($_REQUEST['action'])?$_REQUEST['action']:null;
	$extdisplay = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
	$extension = isset($_REQUEST['extension'])?$_REQUEST['extension']:null;
	$tech_hardware = isset($_REQUEST['tech_hardware'])?$_REQUEST['tech_hardware']:null;

	// We only want to hook 'users' or 'extensions' pages.
	if ($pagename != 'users' && $pagename != 'extensions')  {
		return true;
	}

	//$currentcomponent->addprocessfunc('userman_configprocess', 1);

	if ($tech_hardware != null || $extdisplay != '' || $pagename == 'users' || $action == 'add') {
		// On a 'new' user, 'tech_hardware' is set, and there's no extension. Hook into the page.
		if ($tech_hardware != null ) {
			userman_applyhooks();
		} elseif ($action == 'add') {
			$currentcomponent->addprocessfunc('userman_configprocess', 9);
		} elseif ($extdisplay != '' || $pagename == 'users') {
			// We're now viewing an extension, so we need to display _and_ process.
			userman_applyhooks();
			$currentcomponent->addprocessfunc('userman_configprocess', 9);
		}
	}
}

function userman_applyhooks() {
	global $currentcomponent;
	$currentcomponent->addguifunc('userman_configpageload');
}

function userman_configpageload() {
	global $currentcomponent;
	global $amp_conf;
	global $astman;
	$userman = FreePBX::create()->Userman;
	// Init vars from $_REQUEST[]
	$action = isset($_REQUEST['action'])?$_REQUEST['action']:null;
	$ext = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
	$extn = isset($_REQUEST['extension'])?$_REQUEST['extension']:null;
	$display = isset($_REQUEST['display'])?$_REQUEST['display']:null;

	if ($ext==='') {
		$extdisplay = $extn;
	} else {
		$extdisplay = $ext;
	}

	if ($action != 'del') {
		$usersC = array();  // Initialize the array.
		foreach(core_users_list() as $user) {
			$usersC[] = $user[0];
		}
		$section = _("User Manager Settings");
		$category = "general";
		$defaultDirectory = $userman->getDefaultDirectory();
		$allDirectories = array();
		foreach($userman->getAllDirectories() as $dir) {
			$allDirectories[] = array(
				"value" => $dir['id'],
				"text" => $dir['name']
			);
		}

$js = <<<JS
	$("#userman_assign").prop("disabled",true);
	$("#userman_username").prop("disabled",true);
	$("#userman_username_cb").prop("disabled",true);
	$("#userman_password").prop("disabled",true);
	$("#userman_group").prop("disabled",true);
	$("#userman_username_cb").prop("checked",false);
	$("#userman_group").trigger("chosen:updated");
	$.post( 'ajax.php', {command: "getGuihookInfo", module: "userman", directory: $('#userman_directory').val()}).done(function(data) {
		var options = '<option value="none">'+_('None')+'</option>';
		if(data.permissions.addUser) {
			options += '<option value="add">'+_('Create New User')+'</option>';
		}
		$.each(data.users, function(k,v){
			if(v.default_extension != 'none' && v.default_extension != $("#extdisplay").val()) {
				return true;
			}
			options += '<option value="'+v.id+'">'+v.username+''+((v.default_extension == $("#extdisplay").val()) ? " (Linked)" : "")+'</option>';
		});
		$("#userman_assign").html(options);
		$("#userman_assign").val("none");

		options = '';
		$.each(data.groups, function(k,v){
			options += '<option value="'+v.id+'">'+v.groupname+'</option>';
		});
		$("#userman_group").html(options);
		$("#userman_group").val("");
		$("#userman_username").val("");
		$("#userman_group").trigger("chosen:updated");
		$("#userman_assign").prop("disabled",false);
		window.permissions = data.permissions;
		window.users = data.users;
		window.groups = data.groups;
	}).always(function(){

	}).fail(function(){

	});
JS;
		$currentcomponent->addjsfunc('changeDirectory()',$js);

$js = <<<JS
	if($('#userman_username_cb').prop('checked')) {
		if(isEmpty($('#userman_username').val())) {
			return true;
		}
	}
	return false;
JS;
		$currentcomponent->addjsfunc('usermanUsername()',$js);

$js = <<<JS
	if(typeof permissions == "undefined") {
		$.post( 'ajax.php', {command: "getGuihookInfo", module: "userman", directory: $('#userman_directory').val()}).done(function(data) {
			window.permissions = data.permissions;
			window.users = data.users;
			window.groups = data.groups;
			frm_extensions_usermanSetFields();
		});
	} else {
		frm_extensions_usermanSetFields();
	}
JS;
		$currentcomponent->addjsfunc('usermanChangeUsername()',$js);

$js = <<<JS
	$("#userman_username_cb").prop("checked",false);
	if($("#userman_assign").val() == "add") {
		$("#userman_username_cb").prop("disabled",false);
		$("#userman_password").prop("disabled",false);
		$("#userman_group").prop("disabled",false);
		$("#userman_group").trigger("chosen:updated");
	} else {
		$("#userman_username").prop("disabled",true);
		$("#userman_username_cb").prop("disabled",true);
		$("#userman_password").prop("disabled",true);
		var selected = [];
		$.each(groups, function(k,v) {
			if(v.users.indexOf($('#userman_assign').val()) > -1) {
				selected.push(v.id);
			}
		})
		$("#userman_group").val(selected);
		if(!permissions.modifyUser || $("#userman_assign").val() == "none") {
			$("#userman_group").prop("disabled",true);
			$("#userman_group").trigger("chosen:updated");
		} else {
			$("#userman_group").prop("disabled",false);
			$("#userman_group").trigger("chosen:updated");
		}
	}
JS;
		$currentcomponent->addjsfunc('usermanSetFields()',$js);

		//Old Extension
		if($extdisplay != '') {
			$userM = $userman->getUserByDefaultExtension($extdisplay);
			$selarray = array(
				array(
					"value" => 'none',
					"text" => _('None')
				),
			);
			if(!empty($userM)) {
				$selarray[] = array(
					"value" => $userM['id'],
					"text" => $userM['username'] . " (" . _("Linked") . ")"
				);
				$dirid = $userM['auth'];
			} else {
				$dirid = $defaultDirectory['id'];
			}

			$allGroups = array();
			foreach($userman->getAllGroups($dirid) as $g) {
				$allGroups[] = array(
					"value" => $g['id'],
					"text" => $g['groupname']
				);
			}

			$permissions = $userman->getAuthAllPermissions($dirid);
			$groups = $userman->getDefaultGroups($dirid);
			$passDisable = true;
			$customUsernameDisable = true;
			if($permissions['addUser']) {
				$customUsernameDisable = false;
				$passDisable = false;
				$selarray[]	= array(
					"value" => 'add',
					"text" => _('Create New User')
				);
			}
			$userarray = array();
			$uUsers = array();
			foreach($userman->getAllUsers($dirid) as $user) {
				$uUsers[] = $user['username'];
				if($user['default_extension'] != 'none' && in_array($user['default_extension'],$usersC)) {
					continue;
				}
				$userarray[] = array(
						"value" => $user['id'],
						"text" => $user['username']
				);
			}
			$selarray = array_merge($selarray,$userarray);

			if(!empty($userM)) {
				$currentcomponent->addguielem($section, new gui_link('userman|'.$extdisplay, sprintf(_('Linked to User %s'),$userM['username']), '?display=userman&action=showuser&user='.$userM['id']),$category);
				$currentcomponent->addguielem($section, new gui_selectbox('userman_directory', $allDirectories, $dirid, _('Select User Directory:'), _('Select a user directory'), false, 'frm_extensions_changeDirectory();'),$category);
				$currentcomponent->addguielem($section, new gui_selectbox('userman_assign', $selarray, $userM['id'], _('Link to a Different Default User:'), _('Select a user that this extension should be linked to in User Manager, else select Create New User to have User Manager autogenerate a new user that will be linked to this extension'), false, 'frm_extensions_usermanChangeUsername();'),$category);
				$groups = $userman->getGroupsByID($userM['id']);
				$groups = is_array($groups) ? $groups : array();
			} else {
				$currentcomponent->addguielem($section, new gui_selectbox('userman_directory', $allDirectories, $dirid, _('Select User Directory:'), _('Select a user directory'), false, 'frm_extensions_changeDirectory();'),$category);
				$currentcomponent->addguielem($section, new gui_selectbox('userman_assign', $selarray, '', _('Link to a Default User'), _('Select a user that this extension should be linked to in User Manager, else select Create New User to have User Manager autogenerate a new user that will be linked to this extension'), false, 'frm_'.$display.'_usermanChangeUsername();'),$category);
				$groups = array();
			}

			$currentcomponent->addguielem($section, new gui_textbox_check('userman_username','', _('Username'), _('If Create New User is selected this will be the username. If blank the username will be the same number as this device'),'frm_'.$display.'_usermanUsername()', _("Please select a valid username for New User Creation"),false,0,true,_('Use Custom Username'),"",'true',$customUsernameDisable),$category);
			$currentcomponent->addguielem($section, new gui_textbox('userman_password',md5(uniqid()), _('Password For New User'), _('If Create New User is selected this will be the autogenerated users new password'),'','',false,0,$passDisable,false,'password-meter',false),$category);
			$currentcomponent->addguielem($section, new gui_multiselectbox('userman_group', $allGroups, $groups, _('Groups'), _('Groups that this user is a part of. You can add and remove this user from groups in this view as well'), false, '',!$permissions['modifyUser'],"chosenmultiselect"),$category);
		} else {
			//New Extension
			$selarray = array(
				array(
					"value" => 'none',
					"text" => _('None')
				),
			);
			$permissions = $userman->getAuthAllPermissions($defaultDirectory['id']);
			$groups = $userman->getDefaultGroups($defaultDirectory['id']);
			$passDisable = true;
			$customUsernameDisable = true;
			if($permissions['addUser']) {
				$passDisable = false;
				$customUsernameDisable = false;
				$selarray[]	= array(
					"value" => 'add',
					"text" => _('Create New User')
				);
			}
			$allGroups = array();
			foreach($userman->getAllGroups($defaultDirectory['id']) as $g) {
				$allGroups[] = array(
					"value" => $g['id'],
					"text" => $g['groupname']
				);
			}
			$uUsers = array();
			foreach($userman->getAllUsers($defaultDirectory['id']) as $user) {
				$uUsers[] = $user['username'];
				if($user['default_extension'] != 'none' && in_array($user['default_extension'],$usersC)) {
					continue;
				}
				$selarray[] = array(
						"value" => $user['id'],
						"text" => $user['username']
				);
			}

			$currentcomponent->addguielem($section, new gui_selectbox('userman_directory', $allDirectories, $defaultDirectory['id'], _('Select User Directory:'), _('Select a user directory'), false, 'frm_extensions_changeDirectory();'),$category);
			$currentcomponent->addguielem($section, new gui_selectbox('userman_assign', $selarray, 'add', _('Link to a Default User'), _('Select a user that this extension should be linked to in User Manager, else select None to have no association to a user'), false, 'frm_extensions_usermanChangeUsername()'),$category);
			$currentcomponent->addguielem($section, new gui_textbox_check('userman_username','', _('Username'), _('If Create New User is selected this will be the username. If blank the username will be the same number as this device'),'frm_'.$display.'_usermanUsername()', _("Please select a valid username for New User Creation"),false,0,true,_('Use Custom Username'),"",'true',$customUsernameDisable),$category);
			$currentcomponent->addguielem($section, new gui_textbox('userman_password',md5(uniqid()), _('Password For New User'), _('If Create New User is selected this will be the autogenerated users new password'),'','',false,0,$passDisable,false,'password-meter',false),$category);
			$currentcomponent->addguielem($section, new gui_multiselectbox('userman_group', $allGroups, $groups, _('Groups'), _('Groups that this user is a part of. You can add and remove this user from groups in this view as well'), false, '',!$permissions['modifyUser'],"chosenmultiselect"),$category);
		}
	}
}

function userman_configprocess() {
	$action = isset($_REQUEST['action'])?$_REQUEST['action']:null;
	$extension = isset($_REQUEST['extdisplay'])?$_REQUEST['extdisplay']:null;
	$userman = FreePBX::create()->Userman;
	$directory = $userman->getDefaultDirectory();
	$usettings = $userman->getAuthAllPermissions($directory['id']);
	//if submitting form, update database
	switch ($action) {
		case "add":
			$extension = isset($_REQUEST['extension']) ? $_REQUEST['extension'] : null;
			if(isset($_REQUEST['userman_assign']) && !empty($extension)) {
				if($_REQUEST['userman_assign'] == 'add') {
					$username = (!empty($_REQUEST['userman_username_cb']) && !empty($_REQUEST['userman_username'])) ? $_REQUEST['userman_username'] : $extension;
					$displayname = !empty($_REQUEST['name']) ? $_REQUEST['name'] : $extension;
					$email = !empty($_REQUEST['email']) ? $_REQUEST['email'] : '';
					$password = $_REQUEST['userman_password'];
					$directory = $_REQUEST['userman_directory'];
					$ret = $userman->addUserByDirectory($directory, $username, $password, $extension, _('Autogenerated user on new device creation'), array('email' => $email, 'displayname' => $displayname));
					if($ret['status']) {
						if($usettings['modifyGroup']) {
							if(!empty($_POST['userman_group'])) {
								$groups = $userman->getAllGroups($directory);
								foreach($groups as $group) {
									if(in_array($group['id'],$_POST['userman_group']) && !in_array($ret['id'],$group['users'])) {
										$group['users'][] = $ret['id'];
										$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
									} elseif(!in_array($group['id'],$_POST['userman_group']) && in_array($ret['id'],$group['users'])) {
										$group['users'] = array_diff($group['users'], array($ret['id']));
										$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
									}
								}
							} else {
								$groups = $userman->getGroupsByID($ret['id']);
								foreach($groups as $gid) {
									$group = $userman->getGroupByGID($gid);
									$group['users'] = array_diff($group['users'], array($ret['id']));
									$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
								}
							}
						}
						if(!empty($email)) {
							$autoEmail = $userman->getGlobalsetting('autoEmail');
							$autoEmail = is_null($autoEmail) ? true : $autoEmail;
							if($autoEmail) {
								$userman->sendWelcomeEmail($username, $password);
							}
						}
					} else {
						echo "<script>alert('".$ret['message']."')</script>";
						return false;
					}
				} elseif($_REQUEST['userman_assign'] != 'none') {
					$ret = $userman->getUserByID($_REQUEST['userman_assign']);
					//run this last so that hooks to other modules get the correct information
					$o = $userman->updateUser($ret['id'],$ret['username'],$ret['username'],$extension);
					if(!empty($ret) && $o['status'] && $usettings['modifyGroup']) {
						if(!empty($_POST['userman_group'])) {
							$groups = $userman->getAllGroups($ret['auth']);
							foreach($groups as $group) {
								if(in_array($group['id'],$_POST['userman_group']) && !in_array($ret['id'],$group['users'])) {
									$group['users'][] = $ret['id'];
									$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
								} elseif(!in_array($group['id'],$_POST['userman_group']) && in_array($ret['id'],$group['users'])) {
									$group['users'] = array_diff($group['users'], array($ret['id']));
									$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
								}
							}
						} else {
							$groups = $userman->getGroupsByID($ret['id']);
							foreach($groups as $gid) {
								$group = $userman->getGroupByGID($gid);
								$group['users'] = array_diff($group['users'], array($ret['id']));
								$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
							}
						}
					} elseif(!$o['status']) {
						echo "<script>alert('".$ret['message']."')</script>";
						return false;
					}
				}
			}
		break;
		case "edit":
			if(isset($_REQUEST['userman_assign']) && $_REQUEST['userman_assign'] == 'add') {
				$userO = $userman->getUserByDefaultExtension($extension);
				$username = (!empty($_REQUEST['userman_username_cb']) && !empty($_REQUEST['userman_username'])) ? $_REQUEST['userman_username'] : $extension;
				$displayname = !empty($_REQUEST['name']) ? $_REQUEST['name'] : $extension;
				$email = !empty($_REQUEST['email']) ? $_REQUEST['email'] : '';
				$password = $_REQUEST['userman_password'];
				$directory = $_REQUEST['userman_directory'];
				$ret = $userman->addUserByDirectory($directory, $username, $password, $extension, _('Autogenerated user on new device creation'), array('email' => $email, 'displayname' => $displayname));
				if($ret['status'] && $usettings['modifyGroup']) {
					if(!empty($_POST['userman_group'])) {
						$groups = $userman->getAllGroups($directory);
						foreach($groups as $group) {
							if(in_array($group['id'],$_POST['userman_group']) && !in_array($ret['id'],$group['users'])) {
								$group['users'][] = $ret['id'];
								$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
							} elseif(!in_array($group['id'],$_POST['userman_group']) && in_array($ret['id'],$group['users'])) {
								$group['users'] = array_diff($group['users'], array($ret['id']));
								$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
							}
						}
					} else {
						$groups = $userman->getGroupsByID($ret['id']);
						foreach($groups as $gid) {
							$group = $userman->getGroupByGID($gid);
							$group['users'] = array_diff($group['users'], array($ret['id']));
							$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
						}
					}
				}
				if($ret['status'] && !empty($userO)) {
					$o = $userman->updateUser($userO['id'],$userO['username'],$userO['username'],'none');
					if($o['status'] && !empty($email)) {
						$autoEmail = $userman->getGlobalsetting('autoEmail');
						$autoEmail = is_null($autoEmail) ? true : $autoEmail;
						if($autoEmail) {
							$userman->sendWelcomeEmail($username, $password);
						}
					}
				}
			} elseif(isset($_REQUEST['userman_assign']) && $_REQUEST['userman_assign'] != 'none') {
				$userO = $userman->getUserByDefaultExtension($extension);
				if(!empty($userO['id']) && ($userO['id'] != $_REQUEST['userman_assign'])) {

					//run this last so that hooks to other modules get the correct information
					$o = $userman->updateUser($userO['id'],$userO['username'],$userO['username'],'none');

					if($o['status']) {
						$ret = $userman->getUserById($_REQUEST['userman_assign']);
						if(!empty($ret)) {
							//run this last so that hooks to other modules get the correct information
							$userman->updateUser($ret['id'],$ret['username'],$ret['username'],$extension);
						}
					}
				} elseif(empty($userO['id'])) {
					$ret = $userman->getUserByID($_REQUEST['userman_assign']);
					//run this last so that hooks to other modules get the correct information
					$userman->updateUser($ret['id'],$ret['username'],$ret['username'],$extension);
				} else {
					$ret = $userO;
				}
				if(!empty($ret) && $usettings['modifyGroup']) {
					if(!empty($_POST['userman_group'])) {
						$groups = $userman->getAllGroups($ret['auth']);
						foreach($groups as $group) {
							if(in_array($group['id'],$_POST['userman_group']) && !in_array($ret['id'],$group['users'])) {
								$group['users'][] = $ret['id'];
								$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
							} elseif(!in_array($group['id'],$_POST['userman_group']) && in_array($ret['id'],$group['users'])) {
								$group['users'] = array_diff($group['users'], array($ret['id']));
								$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
							}
						}
					} else {
						$groups = $userman->getGroupsByID($ret['id']);
						foreach($groups as $gid) {
							$group = $userman->getGroupByGID($gid);
							$group['users'] = array_diff($group['users'], array($ret['id']));
							$userman->updateGroup($group['id'],$group['groupname'], $group['groupname'], $group['description'], $group['users']);
						}
					}
				}
			//Set to none so remove the extension as a default from this user
			//also remove extension from assigned devices, since we probably did it
			} elseif(isset($_REQUEST['userman_assign']) && $_REQUEST['userman_assign'] == 'none') {
				$userO = $userman->getUserByDefaultExtension($extension);
				if(!empty($userO['id'])) {
					//run this last so that hooks to other modules get the correct information
					$userman->updateUser($userO['id'], $userO['username'],$userO['username'],'none');
				}
			}
		break;
		case "del":
			$userO = $userman->getUserByDefaultExtension($extension);
			if(!empty($userO['id'])) {
				//run this last so that hooks to other modules get the correct information
				$userman->updateUser($userO['id'],$userO['username'],$userO['username'],'none');
			}
		break;
	}
}
