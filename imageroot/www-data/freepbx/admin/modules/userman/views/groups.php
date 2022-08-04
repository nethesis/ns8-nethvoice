<?php
if(isset($_REQUEST['action']) && $_REQUEST['action'] == 'showgroup'){
	$heading = '<h1>' . _("Edit Group") . '</h1>';
	$permissions['modifyGroup'] = !$permissions['modifyGroup'] ? $group['local'] : $permissions['modifyGroup'];
}else{
	$heading = '<h1>' . _("Add Group") . '</h1>';
	$permissions['modifyGroup'] = $permissions['addGroup'];
}
$formaction = 'config.php?display=userman#groups';



echo $heading;
?>

<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<?php if(!empty($message)){ ?>
					<div class="alert alert-<?php echo $message['type']?>"><?php echo $message['message']?></div>
				<?php } ?>
				<?php if($locked){ ?>
					<div class="alert alert-info"><?php echo _("The directory for this group is currently locked while updates are being run")?></div>
				<?php } ?>
				<div class="display no-border">
						<div role="tabpanel">
							<div class="nav-container">
								<div class="scroller scroller-left"><i class="glyphicon glyphicon-chevron-left"></i></div>
								<div class="scroller scroller-right"><i class="glyphicon glyphicon-chevron-right"></i></div>
								<div class="wrapper">
									<ul class="nav nav-tabs list" role="tablist">
										<li role="presentation" class="active"><a href="#usermanlogin" aria-controls="usermanlogin" role="tab" data-toggle="tab"><?php echo _("Group Details")?></a></li>
										<li role="presentation"><a href="#advanced" aria-controls="usermanlogin" role="tab" data-toggle="tab"><?php echo _("Advanced")?></a></li>
										<?php if(\FreePBX::Config()->get('AUTHTYPE') == "usermanager") { ?>
											<li role="presentation"><a href="#pbx" aria-controls="pbx" role="tab" data-toggle="tab"><?php echo sprintf(_("%s Administration GUI"),$brand)?></a></li>
										<?php } ?>
										<?php foreach($sections as $section) { ?>
											<li role="presentation"><a href="#usermanhook<?php echo $section['rawname']?>" aria-controls="usermanhook<?php echo $section['rawname']?>" role="tab" data-toggle="tab"><?php echo $section['title']?></a></li>
										<?php } ?>
									</ul>
								</div>
							</div>
						</div>
						<form class="fpbx-submit" autocomplete="off" name="editM" id="editM" action="<?php echo $formaction ?>" method="post" <?php if(!empty($group['id'])) {?>data-fpbx-delete="config.php?display=userman&amp;action=delgroup&amp;user=<?php echo $group['id']?>"<?php }?> onsubmit="return true;">
							<input type="hidden" name="type" value="group">
							<input type="hidden" name="directory" value="<?php echo $directory ?>">
							<input type="hidden" name="prevGroupname" value="<?php echo !empty($group['groupname']) ? $group['groupname'] : ''; ?>">
							<input type="hidden" name="group" value="<?php echo !empty($group['id']) ? $group['id'] : ''; ?>">
							<input type="hidden" name="submittype" value="gui">
							<div class="tab-content">
								<!--Login Details -->
								<div role="tabpanel" class="tab-pane active display" id="usermanlogin">
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="group_name"><?php echo _('Group Name')?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="group_name"></i>
														</div>
														<div class="col-md-9">
															<input name="name" class="form-control" value="<?php echo !empty($group['groupname']) ? $group['groupname'] : ''?>" <?php echo !$permissions['modifyGroup'] ? 'disabled' : ''?>>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="group_name-help" class="help-block fpbx-help-block"><?php echo _("Give the group a name")?></span>
											</div>
										</div>
									</div>
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="group_description"><?php echo _('Group Description')?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="group_description"></i>
														</div>
														<div class="col-md-9">
															<input name="description" class="form-control" value="<?php echo !empty($group['description']) ? $group['description'] : ''?>" <?php echo !$permissions['modifyGroup'] ? 'disabled' : ''?>>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="group_description-help" class="help-block fpbx-help-block"><?php echo _("Give the group a description")?></span>
											</div>
										</div>
									</div>
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
																<?php echo FreePBX::View()->languageDrawSelect('language',$group['language'],_("Use System Language")); ?>
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
																<?php echo FreePBX::View()->timezoneDrawSelect('timezone',$group['timezone'],_("Use System Timezone")); ?>
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
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="group_users"><?php echo _('Users')?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="group_users"></i>
														</div>
														<div class="col-md-9">
															<select id="group_users" class="form-control" name="users[]" multiple="multiple" <?php echo !$permissions['modifyGroup'] ? 'disabled' : ''?>>
																<?php foreach($users as $user) {?>
																	<option value="<?php echo $user['id']?>" <?php echo !empty($group['users']) && in_array($user['id'], $group['users']) ? 'selected' : '' ?>><?php echo $user['username']?></option>
																<?php } ?>
															</select>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="group_users-help" class="help-block fpbx-help-block"><?php echo _("Which users are in this group")?></span>
											</div>
										</div>
									</div>
								</div>
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
															<input type="text" class="form-control" id="datetimeformat" name="datetimeformat" value="<?php echo !empty($group['datetimeformat']) ? $group['datetimeformat'] : ''; ?>">
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="datetimeformat-help" class="help-block fpbx-help-block"><?php echo _('The format dates and times should display in. The default of "llll" is locale aware. If left blank this will use the system format. For more formats please see: http://momentjs.com/docs/#/displaying/format/')?></span>
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
															<input type="text" class="form-control" id="timeformat" name="timeformat" value="<?php echo !empty($group['timeformat']) ? $group['timeformat'] : ''; ?>">
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="timeformat-help" class="help-block fpbx-help-block"><?php echo _('The format times should display in. The default of "LT" is locale aware. If left blank this will use the system format. For more formats please see: http://momentjs.com/docs/#/displaying/format/')?></span>
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
															<input type="text" class="form-control" id="dateformat" name="dateformat" value="<?php echo !empty($group['dateformat']) ? $group['dateformat'] : ''; ?>">
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="dateformat-help" class="help-block fpbx-help-block"><?php echo _('The format dates should display in. The default of "l" is locale aware. If left blank this will use the system format. For more formats please see: http://momentjs.com/docs/#/displaying/format/')?></span>
											</div>
										</div>
									</div>
								</div>
								<?php if(\FreePBX::Config()->get('AUTHTYPE') == "usermanager") {?>
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
																<input type="radio" id="pbxlogin1" name="pbx_login" value="true" <?php echo ($pbx_login) ? 'checked' : ''?>>
																<label for="pbxlogin1"><?php echo _("Yes")?></label>
																<input type="radio" id="pbxlogin2" name="pbx_login" value="false" <?php echo (!$pbx_login) ? 'checked' : ''?>>
																<label for="pbxlogin2"><?php echo _("No")?></label>
															</div>
														</div>
													</div>
												</div>
											</div>
											<div class="row">
												<div class="col-md-12">
													<span id="pbx_login-help" class="help-block fpbx-help-block"><?php echo sprintf(_("May this group log in to the %s Administration Pages?"),$brand)?></span>
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
																<input type="radio" id="pbxadmin1" name="pbx_admin" value="true" <?php echo ($pbx_admin) ? 'checked' : ''?>>
																<label for="pbxadmin1"><?php echo _("Yes")?></label>
																<input type="radio" id="pbxadmin2" name="pbx_admin" value="false" <?php echo (!$pbx_admin) ? 'checked' : ''?>>
																<label for="pbxadmin2"><?php echo _("No")?></label>
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
													<span id="pbx_range-help" class="help-block fpbx-help-block"><?php echo _("Restrict this groups's view to only Extensions, Ring Groups, and Queues within this range.")?></span>
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
																		}
																		?>
																		<option value="<?php echo $key?>" <?php echo in_array($key,$pbx_modules) ? 'selected' : '' ?>><?php echo $val['name']?></option>
																	<?php } ?>
																</select>
															</div>
														</div>
													</div>
												</div>
											</div>
											<div class="row">
												<div class="col-md-12">
													<span id="pbx_modules-help" class="help-block fpbx-help-block"><?php echo _("Select the Admin Sections this group should have access to.")?></span>
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
																<select id="pbx_landing" class="form-control" name="pbx_landing">
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
													<span id="pbx_landing-help" class="help-block fpbx-help-block"><?php echo _("Select a landing page that will be used by default.")?></span>
												</div>
											</div>
										</div>
									</div>
								<?php } ?>
								<!--Module Specific -->
								<?php foreach($sections as $section) { ?>
									<div role="tabpanel" class="tab-pane display" id="usermanhook<?php echo $section['rawname']?>">
										<?php echo $section['content']?>
									</div>
								<?php } ?>
							</div>
						</form>
				</div>
			</div>
		</div>
	</div>
</div>
