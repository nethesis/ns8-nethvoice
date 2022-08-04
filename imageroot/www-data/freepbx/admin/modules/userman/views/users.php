<?php
if(isset($_REQUEST['action']) && $_REQUEST['action'] == 'showuser'){
	$heading = '<h1>' . _("Edit User") . '</h1>';
}else{
	$heading = '<h1>' . _("Add User") . '</h1>';
}
$formaction = 'config.php?display=userman#users';

echo $heading;
echo $usage_html;
?>
<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<?php if(!empty($message)){ ?>
					<div class="alert alert-<?php echo $message['type']?>"><?php echo $message['message']?></div>
				<?php } ?>
				<?php if($locked){ ?>
					<div class="alert alert-info"><?php echo _("The directory for this user is currently locked while updates are being run")?></div>
				<?php } ?>
				<div class="display no-border">
					<div role="tabpanel">
						<div class="nav-container">
							<div class="scroller scroller-left"><i class="glyphicon glyphicon-chevron-left"></i></div>
							<div class="scroller scroller-right"><i class="glyphicon glyphicon-chevron-right"></i></div>
							<div class="wrapper">
								<ul class="nav nav-tabs list" role="tablist">
									<li role="presentation" class="active"><a href="#usermanlogin" aria-controls="usermanlogin" role="tab" data-toggle="tab"><?php echo _("Login Details")?></a></li>
									<li role="presentation"><a href="#usermanuser" aria-controls="usermanuser" role="tab" data-toggle="tab"><?php echo _("User Details")?></a></li>
									<li role="presentation"><a href="#advanced" aria-controls="usermanlogin" role="tab" data-toggle="tab"><?php echo _("Advanced")?></a></li>
									<?php if(\FreePBX::Config()->get('AUTHTYPE') == "usermanager") { ?>
										<li role="presentation"><a href="#pbx" aria-controls="pbx" role="tab" data-toggle="tab"><?php echo sprintf(_("%s Administration GUI"),$brand)?></a></li>
									<?php } ?>
									<?php foreach($sections as $section) { ?>
										<li role="presentation"><a href="#usermanhook<?php echo $section['rawname']?>" aria-controls="usermanhook<?php echo $section['rawname']?>" role="tab" data-toggle="tab"><?php echo $section['title']?></a></li>
									<?php } ?>
									<li role="presentation" class="<?php echo empty($hookHtml)?'hidden':''?>"><a href="#usermanother" aria-controls="usermanother" role="tab" data-toggle="tab"><?php echo _("Other Settings")?></a></li>
								</ul>
							</div>
						</div>
					</div>
					<form class="fpbx-submit" autocomplete="off" name="editM" id="editM" enctype="multipart/form-data" action="<?php echo $formaction ?>" method="post" <?php if(!empty($user['id'])) {?>data-fpbx-delete="config.php?display=userman&amp;action=deluser&amp;user=<?php echo $user['id']?>"<?php } ?> onsubmit="return true;">
						<input type="hidden" name="type" value="user">
						<input type="hidden" name="directory" value="<?php echo $directory ?>">
						<input type="hidden" name="prevUsername" value="<?php echo !empty($user['username']) ? $user['username'] : ''; ?>">
						<input type="hidden" name="user" value="<?php echo !empty($user['id']) ? $user['id'] : ''; ?>">
						<input type="hidden" name="submittype" value="gui">
						<div class="tab-content">
						<!--Login Details -->
						<div role="tabpanel" class="tab-pane active display" id="usermanlogin">
						<!-- LOGIN NAME-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="username"><?php echo _("Login Name")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="username"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="username" name="username" value="<?php echo !empty($user['username']) ? $user['username'] : ''; ?>" required pattern=".{1,255}" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="username-help" class="help-block fpbx-help-block"><?php echo _("This is the name that the user will use when logging in.")?></span>
								</div>
							</div>
						</div>
						<!--END LOGIN NAME-->
						<!--DESCRIPTION-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="description"><?php echo _("Description")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="description" name="description" value="<?php echo !empty($user['description']) ? $user['description'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="description-help" class="help-block fpbx-help-block"><?php echo _("A brief description for this user.")?></span>
								</div>
							</div>
						</div>
						<!--END DESCRIPTION-->
						<!--PASSWORD-->
						<?php if($permissions['changePassword']) {?>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="password"><?php echo _("Password")?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="password"></i>
												</div>
												<div class="col-md-9">
													<input type="password" autocomplete="new-password" class="form-control password-meter" id="password" name="password" value="<?php echo !empty($user['password']) ? '******' : ''; ?>" required>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="password-help" class="help-block fpbx-help-block"><?php echo _("The user's password.")?></span>
									</div>
								</div>
							</div>
						<?php } ?>
						<!--
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="group_primary"><?php echo _('Primary Group')?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="group_users"></i>
											</div>
											<div class="col-md-9">
												<select id="group_primary" data-placeholder="Groups" class="form-control" name="primary_group" <?php echo !$permissions['modifyGroup'] ? 'disabled' : ''?>>
													<?php foreach($groups as $group) {?>
														<option value="<?php echo $group['id']?>" <?php echo (!empty($user['id']) && in_array($user['id'], $group['users'])) || (empty($user['id']) && in_array($group['id'], $dgroups)) ? 'selected' : '' ?>><?php echo $group['groupname']?></option>
													<?php } ?>
												</select>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="group_primary-help" class="help-block fpbx-help-block"><?php echo _("Which groups this user is in")?></span>
								</div>
							</div>
						</div>
						-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="group_users"><?php echo _('Groups')?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="group_users"></i>
											</div>
											<div class="col-md-9">
												<?php if($permissions['modifyGroup']) {?>
													<select id="group_users" data-placeholder="Groups" class="form-control" name="groups[]" multiple="multiple">
														<?php foreach($groups as $group) {?>
															<option value="<?php echo $group['id']?>" <?php echo (!empty($user['id']) && in_array($user['id'], $group['users'])) || (empty($user['id']) && in_array($group['id'], $dgroups)) ? 'selected' : '' ?>><?php echo $group['groupname']?></option>
														<?php } ?>
													</select>
												<?php } else {?>
													<select class="form-control chosenmultiselect" name="groups[]" multiple="multiple" <?php echo !$permissions['modifyGroup'] ? 'disabled' : ''?>>
														<?php foreach($groups as $group) {?>
															<option value="<?php echo $group['id']?>" <?php echo (!empty($user['id']) && in_array($user['id'], $group['users'])) || (empty($user['id']) && in_array($group['id'], $dgroups)) ? 'selected' : '' ?>><?php echo $group['groupname']?></option>
														<?php } ?>
													</select>
												<?php } ?>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="group_users-help" class="help-block fpbx-help-block"><?php echo _("Which groups this user is in")?></span>
								</div>
							</div>
						</div>
						<!--Linked Extensions-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="defaultextension"><?php echo _("Primary Linked Extension")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="defaultextension"></i>
											</div>
											<div class="col-md-9">
												<select id="defaultextension" name="defaultextension" class="form-control">
												<?php foreach($dfpbxusers as $dfpbxuser) {?>
													<option value="<?php echo $dfpbxuser['ext']?>" <?php echo $dfpbxuser['selected'] ? 'selected' : '' ?>><?php echo $dfpbxuser['name']?> &lt;<?php echo $dfpbxuser['ext']?>&gt;</option>
												<?php } ?>
												</select>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="defaultextension-help" class="help-block fpbx-help-block"><?php echo _("This is the extension this user is linked to from the Extensions page. A single user can only be linked to one extension, and one extension can only be linked to a single user.")?></span>
								</div>
							</div>
						</div>
						<!--END LINKED EXTENSIONS-->
						</div>
						<!-- End Login details -->

						<!--User Details-->
						<div role="tabpanel" class="tab-pane display" id="usermanuser">
						<!--FIRSTNAME-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="fname"><?php echo _("First Name")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="fname"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="fname" name="fname" value="<?php echo !empty($user['fname']) ? $user['fname'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="fname-help" class="help-block fpbx-help-block"><?php echo _("The user's first name.")?></span>
								</div>
							</div>
						</div>
						<!--END FIRSTNAME-->
						<!--LASTNAME-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="lname"><?php echo _("Last Name")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="lname"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="lname" name="lname" value="<?php echo !empty($user['lname']) ? $user['lname'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="lname-help" class="help-block fpbx-help-block"><?php echo _("The user's last name.")?></span>
								</div>
							</div>
						</div>
						<!--END LASTNAME-->
						<!--DISPLAYNAME-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="displayname"><?php echo _("Display Name")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="displayname"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="displayname" name="displayname" value="<?php echo !empty($user['displayname']) ? $user['displayname'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="displayname-help" class="help-block fpbx-help-block"><?php echo _("Display Name. Used in User Control Panel and Contact Manager to display a customized user name")?></span>
								</div>
							</div>
						</div>
						<!--END DISPLAYNAME-->
						<!--TITLE-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="title"><?php echo _("Title")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="title"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="title" name="title" value="<?php echo !empty($user['title']) ? $user['title'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="title-help" class="help-block fpbx-help-block"><?php echo _("The user's title.")?></span>
								</div>
							</div>
						</div>
						<!--END TITLE-->
						<!--COMPANY-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="company"><?php echo _("Company")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="company"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="company" name="company" value="<?php echo !empty($user['company']) ? $user['company'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="company-help" class="help-block fpbx-help-block"><?php echo _("The user's company.")?></span>
								</div>
							</div>
						</div>
						<!--END COMPANY-->
						<!--DEPARTMENT-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="department"><?php echo _("Department")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="department"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="department" name="department" value="<?php echo !empty($user['department']) ? $user['department'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="department-help" class="help-block fpbx-help-block"><?php echo _("The user's department.")?></span>
								</div>
							</div>
						</div>
						<!--END DEPARTMENT-->
						<!--Language-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="language"><?php echo _("Language") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="language"></i>
											</div>
											<div class="col-md-9">
												<div class="input-group">
													<?php echo FreePBX::View()->languageDrawSelect('language',$user['language'],_("Inherit")); ?>
													<span class="input-group-btn">
														<a href="#" class="btn btn-default" id="browserlang"><?php echo _("Use Browser Language")?></a>
													</span>
													<span class="input-group-btn">
														<a href="#" class="btn btn-default" id="systemlang"><?php echo _("Use PBX Language")?></a>
													</span>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="language-help" class="help-block fpbx-help-block"><?php echo _("Language for this user")?></span>
								</div>
							</div>
						</div>
						<!--END Language-->
						<!--Timezone-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="timezone"><?php echo _("Timezone") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="timezone"></i>
											</div>
											<div class="col-md-9">
												<div class="input-group">
													<?php echo FreePBX::View()->timezoneDrawSelect('timezone',$user['timezone'],_("Inherit")); ?>
													<span class="input-group-btn">
														<a href="#" class="btn btn-default" id="browsertz"><?php echo _("Use Browser Timezone")?></a>
													</span>
													<span class="input-group-btn">
														<a href="#" class="btn btn-default" id="systemtz"><?php echo _("Use PBX Timezone")?></a>
													</span>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="timezone-help" class="help-block fpbx-help-block"><?php echo _("Timezone for this user")?></span>
								</div>
							</div>
						</div>
						<!--END Timezone-->
						<!--EMAIL-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="email"><?php echo _("Email Address")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="email"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="email" name="email" value="<?php echo !empty($user['email']) ? $user['email'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="email-help" class="help-block fpbx-help-block"><?php echo _("The email address to associate with this user. Multiple email address need to be separated with a comma.")?></span>
								</div>
							</div>
						</div>
						<!--END EMAIL-->
						<!--Cell Number-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="cell"><?php echo _("Cell Phone Number")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="cell"></i>
											</div>
											<div class="col-md-9">
												<input type="tel" class="form-control" id="cell" name="cell" value="<?php echo !empty($user['cell']) ? $user['cell'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="cell-help" class="help-block fpbx-help-block"><?php echo _("The user's cell (mobile) phone number.")?></span>
								</div>
							</div>
						</div>
						<!--END CELL-->
						<!--WORK Number-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="work"><?php echo _("Work Phone Number")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="work"></i>
											</div>
											<div class="col-md-9">
												<input type="tel" class="form-control" id="work" name="work" value="<?php echo !empty($user['work']) ? $user['work'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="work-help" class="help-block fpbx-help-block"><?php echo _("The user's work phone number.")?></span>
								</div>
							</div>
						</div>
						<!--END WORK-->
						<!--Home Number-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="home"><?php echo _("Home Phone Number")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="home"></i>
											</div>
											<div class="col-md-9">
												<input type="tel" class="form-control" id="home" name="home" value="<?php echo !empty($user['home']) ? $user['home'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="home-help" class="help-block fpbx-help-block"><?php echo _("The user's home phone number.")?></span>
								</div>
							</div>
						</div>
						<!--END HOME-->
						<!--fax Number-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="fax"><?php echo _("Fax Phone Number")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="fax"></i>
											</div>
											<div class="col-md-9">
												<input type="tel" class="form-control" id="fax" name="fax" value="<?php echo !empty($user['fax']) ? $user['fax'] : ''; ?>" <?php echo !$permissions['modifyUser'] ? 'disabled' : ''?>>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="fax-help" class="help-block fpbx-help-block"><?php echo _("The user's fax phone number.")?></span>
								</div>
							</div>
						</div>
						<!--END FAX-->
						<?php foreach($extrauserdetails as $html) { ?>
							<?php echo $html?>
						<?php } ?>
						</div>
						<!--END User Details-->
						<div role="tabpanel" class="tab-pane display" id="advanced">
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="datetimeformat"><?php echo _("Date and Time Format")?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="datetimeformat"></i>
												</div>
												<div class="col-md-9">
													<div class="input-group">
														<input type="text" class="form-control" id="datetimeformat" name="datetimeformat" placeholder="llll" value="<?php echo !empty($user['datetimeformat']) ? $user['datetimeformat'] : ''; ?>">
														<span class="input-group-addon" id="datetimeformat-now"></span>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="datetimeformat-help" class="help-block fpbx-help-block"><?php echo _('The format dates and times should display in. The default of "llll" is locale aware. If left blank this will use the group/system format. For more formats please see: http://momentjs.com/docs/#/displaying/format/')?></span>
									</div>
								</div>
							</div>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="timeformat"><?php echo _("Time Format")?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="timeformat"></i>
												</div>
												<div class="col-md-9">
													<div class="input-group">
														<input type="text" class="form-control" id="timeformat" name="timeformat" placeholder="LT" value="<?php echo !empty($user['timeformat']) ? $user['timeformat'] : ''; ?>">
														<span class="input-group-addon" id="timeformat-now"></span>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="timeformat-help" class="help-block fpbx-help-block"><?php echo _('The format times should display in. The default of "LT" is locale aware. If left blank this will use the group/system format. For more formats please see: http://momentjs.com/docs/#/displaying/format/')?></span>
									</div>
								</div>
							</div>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="dateformat"><?php echo _("Date Format")?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="dateformat"></i>
												</div>
												<div class="col-md-9">
													<div class="input-group">
														<input type="text" class="form-control" id="dateformat" name="dateformat" placeholder="l" value="<?php echo !empty($user['dateformat']) ? $user['dateformat'] : ''; ?>">
														<span class="input-group-addon" id="dateformat-now"></span>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="dateformat-help" class="help-block fpbx-help-block"><?php echo _('The format dates should display in. The default of "l" is locale aware. If left blank this will use the group/system format. For more formats please see: http://momentjs.com/docs/#/displaying/format/')?></span>
									</div>
								</div>
							</div>
						</div>
						<div role="tabpanel" class="tab-pane display" id="pbx">
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="pbx_login"><?php echo sprintf(_('Allow %s Administration Login'),$brand)?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="pbx_login"></i>
												</div>
												<div class="col-md-9 radioset">
													<input type="radio" id="pbxlogin1" name="pbx_login" value="true" <?php echo !is_null($pbx_login) && ($pbx_login) ? 'checked' : ''?>>
													<label for="pbxlogin1"><?php echo _("Yes")?></label>
													<input type="radio" id="pbxlogin2" name="pbx_login" value="false" <?php echo !is_null($pbx_login) && (!$pbx_login) ? 'checked' : ''?>>
													<label for="pbxlogin2"><?php echo _("No")?></label>
													<input type="radio" id="pbxlogin3" name="pbx_login" value="inherit" <?php echo is_null($pbx_login) ? 'checked' : ''?>>
													<label for="pbxlogin3"><?php echo _("Inherit")?></label>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="pbx_login-help" class="help-block fpbx-help-block"><?php echo sprintf(_("May this user log in to the %s Administration Pages?"),$brand)?></span>
									</div>
								</div>
							</div>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="pbx_admin"><?php echo _('Grant Full Administration Rights')?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="pbx_admin"></i>
												</div>
												<div class="col-md-9 radioset">
													<input type="radio" id="pbxadmin1" name="pbx_admin" value="true" <?php echo !is_null($pbx_admin) && ($pbx_admin) ? 'checked' : ''?>>
													<label for="pbxadmin1"><?php echo _("Yes")?></label>
													<input type="radio" id="pbxadmin2" name="pbx_admin" value="false" <?php echo !is_null($pbx_admin) && (!$pbx_admin) ? 'checked' : ''?>>
													<label for="pbxadmin2"><?php echo _("No")?></label>
													<input type="radio" id="pbxadmin3" name="pbx_admin" value="inherit" <?php echo is_null($pbx_admin) ? 'checked' : ''?>>
													<label for="pbxadmin3"><?php echo _("Inherit")?></label>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="pbx_admin-help" class="help-block fpbx-help-block"><?php echo _("Grant full administration rights regardless of extension range or module access.")?></span>
									</div>
								</div>
							</div>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="pbx_range"><?php echo _('Visible Extension Range')?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="pbx_range"></i>
												</div>
												<div class="col-md-9">
													<input name="pbx_low" type="number" min="0" class="form-control" style="display: inline;width:48%" value="<?php echo $pbx_low?>"> - <input name="pbx_high" type="number" min="1" class="form-control" style="display: inline;width:48%" value="<?php echo $pbx_high?>">
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="pbx_range-help" class="help-block fpbx-help-block"><?php echo _("Restrict this user's view to only Extensions, Ring Groups, and Queues within this range.")?></span>
									</div>
								</div>
							</div>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="pbx_modules"><?php echo _('Administration Access')?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="pbx_modules"></i>
												</div>
												<div class="col-md-9">
													<select id="pbx_modules" class="bsmultiselect " name="pbx_modules[]" multiple="multiple">
														<?php foreach($modules as $key => $val) {
															 if($key == "wiki"){
																 continue;
															 } ?>
															<option value="<?php echo $key?>" <?php echo is_array($pbx_modules) && in_array($key,$pbx_modules) ? 'selected' : '' ?>><?php echo $val['name']?></option>
														<?php } ?>
													</select>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="pbx_modules-help" class="help-block fpbx-help-block"><?php echo _("Select the Admin Sections this user should have access to,This settings will be overridden by Group setting if Allow PBXact Administration Login set to Inherit.")?></span>
									</div>
								</div>
							</div>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="pbx_landing"><?php echo _('Default Landing Page')?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="pbx_landing"></i>
												</div>
												<div class="col-md-9">
													<select id="pbx_landing" class="form-control" name="pbx_landing" >
														<?php foreach($landing_page_list as $key => $val) {
															if($key == "wiki"){
																 continue;
															 } ?>
															<option value="<?php echo $key?>" <?php echo $pbx_landing === $key ? 'selected' : '' ?>><?php echo $val['name']?></option>
														<?php } ?>
													</select>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="pbx_landing-help" class="help-block fpbx-help-block"><?php echo _("Select a landing page that will be used by default.This settings will be overridden by Group setting if Allow PBXact Administration Login set to Inherit.")?></span>
									</div>
								</div>
							</div>
						</div>
						<!--Module Specific -->
						<?php foreach($sections as $section) { ?>
							<div role="tabpanel" class="tab-pane display" id="usermanhook<?php echo $section['rawname']?>">
								<?php echo $section['content']?>
							</div>
						<?php } ?>
					</form>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
