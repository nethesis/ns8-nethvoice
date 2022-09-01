<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				 <div class="display no-border">
					<h1><?php echo _("User Manager")?></h1>
					<div class="panel panel-info">
						<div class="panel-heading">
							<div class="panel-title">
								<a href="#" data-toggle="collapse" data-target="#moreinfo"><i class="glyphicon glyphicon-info-sign"></i></a>&nbsp;&nbsp;&nbsp;<?php echo _("What is User Manager")?>
							</div>
						</div>
						<!--At some point we can probably kill this... Maybe make is a 1 time panel that may be dismissed-->
						<div class="panel-body collapse" id="moreinfo">
							<p><?php echo sprintf(_('%s User Manager is taking the place of several modules which have attempted to create and manage users separate from Extensions. Modules such as iSymphony and RestAPI are examples of these type of modules. In %s 12, the new User Control Panel also uses User Manager.'),$brand,$brand)?></p>
							<p><?php echo sprintf(_('In %s User Manager you can create users that have access to Extensions or Device/User Mode Users and the settings associated with those Devices. For example, a new user can be created that can log into User Control Panel and access the voicemail of 3 other accounts.'),$brand)?></p>
						</div>
					</div>
					<?php echo $dirwarn?>
					<?php if(!empty($message)){ ?>
						<div class="alert alert-<?php echo $message['type']?>"><?php echo $message['message']?></div>
					<?php } ?>
					<div role="tabpanel">
						<ul class="nav nav-tabs" role="tablist">
							<li role="presentation" class="active"><a href="#users" aria-controls="users" role="tab" data-toggle="tab"><?php echo _("Users"); ?></a></li>
							<li role="presentation"><a href="#groups" aria-controls="groups" role="tab" data-toggle="tab"><?php echo _("Groups"); ?></a></li>
							<li role="presentation"><a href="#directories" aria-controls="directories" role="tab" data-toggle="tab"><?php echo _("Directories"); ?></a></li>
							<li role="presentation"><a href="#settings" aria-controls="settings" role="tab" data-toggle="tab"><?php echo _("Settings"); ?></a></li>
						</ul>
						<div class="tab-content">
							<div role="tabpanel" id="users" class="tab-pane display active">
								<div class="table-responsive">
									<div id="toolbar-users">
										<a href="config.php?display=userman&amp;action=adduser" id="add-users" class="btn btn-add hidden" data-type="users" data-section="users">
											<i class="fa fa-user-plus"></i> <span><?php echo _('Add')?></span>
										</a>
										<button id="remove-users" class="btn btn-danger btn-remove hidden" data-type="users" disabled data-section="users">
											<i class="fa fa-user-times"></i> <span><?php echo _('Delete')?></span>
										</button>
										<button id="email-users" class="btn btn-info btn-send" data-type="users" disabled data-section="users">
											<i class="fa fa-envelope-o"></i> <span><?php echo _('Send Email')?></span>
										</button>
										<select id="directory-users" class="form-control" style="display: inline-block;width: inherit;">
											<option value=""><?php echo _("All Directories")?></option>
											<?php foreach($directories as $directory) {?>
												<option value="<?php echo $directory['id']?>"><?php echo $directory['name']?></option>
											<?php } ?>
										</select>
									</div>
									<table data-toolbar="#toolbar-users" data-url="ajax.php?module=userman&amp;command=getUsers" data-cache="false" data-toggle="table" data-maintain-selected="true" data-show-columns="true" data-pagination="true" data-search="true" class="table table-striped" id="table-users" data-type="users">
										<thead>
											<tr>
												<th data-checkbox="true"></th>
												<th data-sortable="true" data-field="auth" data-formatter="directoryMap"><?php echo _("Directory") ?></th>
												<th data-sortable="true" data-field="username"><?php echo _("Username") ?></th>
												<th data-sortable="true" data-field="displayname"><?php echo _("Display Name") ?></th>
												<th data-sortable="true" data-field="fname"><?php echo _("First Name") ?></th>
												<th data-sortable="true" data-field="lname"><?php echo _("Last Name") ?></th>
												<th data-sortable="true" data-field="default_extension"><?php echo _("Linked Extension") ?></th>
												<th data-sortable="true" data-field="description"><?php echo _("Description") ?></th>
												<th data-formatter="userActions"><?php echo _("Action") ?></th>
											</tr>
										</thead>
									</table>
								</div>
							</div>
							<div role="tabpanel" id="groups" class="tab-pane display">
								<div class="table-responsive">
									<div class="alert alert-info"><?php echo _("Group Priorities can be changed by clicking and dragging groups around in the order you'd like. Groups with a lower number for priority take priority (EG 0 is higher than 1)")?></div>
									<div id="toolbar-groups">
										<a href="config.php?display=userman&amp;action=addgroup" id="add-groups" class="btn btn-add hidden" data-type="groupss" data-section="groups">
											<i class="fa fa-user-plus"></i> <span><?php echo _('Add')?></span>
										</a>
										<button id="remove-groups" class="btn btn-danger btn-remove hidden" data-type="groups" disabled data-section="groups">
											<i class="fa fa-user-times"></i> <span><?php echo _('Delete')?></span>
										</button>
										<select id="directory-groups" class="form-control" style="display: inline-block;width: inherit;">
											<option value=""><?php echo _("All Directories")?></option>
											<?php foreach($directories as $directory) {?>
												<option value="<?php echo $directory['id']?>"><?php echo $directory['name']?></option>
											<?php } ?>
										</select>
									</div>
									<table data-reorderable-rows="true" data-use-row-attr-func="true" data-sort-name="priority" data-toolbar="#toolbar-groups" data-url="ajax.php?module=userman&amp;command=getGroups" data-cache="false" data-toggle="table" data-pagination="false" data-search="true" class="table table-striped" id="table-groups" data-type="groups">
										<thead>
											<tr>
												<th data-checkbox="true"></th>
												<th data-sortable="true" data-field="auth" data-formatter="directoryMap"><?php echo _("Directory") ?></th>
												<th data-field="groupname"><?php echo _("Group Name") ?></th>
												<th data-field="description"><?php echo _("Description") ?></th>
												<th data-field="priority"><?php echo _("Priority") ?></th>
												<th data-formatter="groupActions"><?php echo _("Action") ?></th>
											</tr>
										</thead>
									</table>
								</div>
							</div>
							<div role="tabpanel" id="directories" class="tab-pane display">
								<div class="table-responsive">
									<div class="alert alert-info"><?php echo _("Directory order can be changed by clicking and dragging directories around in the order you'd like. User logins will match based on the first directory then if no match was found waterfall down the list in the order chosen below")?></div>
									<div id="toolbar-directories">
										<a href="?display=userman&amp;action=adddirectory" id="add-directories" class="btn btn-add" data-type="directories" data-section="directories">
											<i class="fa fa-sitemap"></i> <span><?php echo _('Add')?></span>
										</a>
										<button id="remove-directories" class="btn btn-danger btn-remove" data-type="directories" disabled data-section="directories">
											<i class="fa fa-sitemap"></i> <span><?php echo _('Delete')?></span>
										</button>
									</div>
									<table data-reorderable-rows="true" data-use-row-attr-func="true" data-sort-name="order" data-toolbar="#toolbar-directories" data-url="ajax.php?module=userman&amp;command=getDirectories" data-cache="false" data-toggle="table" data-maintain-selected="true" data-show-columns="true" data-pagination="true" data-search="true" class="table table-striped" id="table-directories" data-type="directories">
										<thead>
											<tr>
												<th data-checkbox="true"></th>
												<th data-sortable="true" data-field="name"><?php echo _("Name") ?></th>
												<th data-sortable="true" data-formatter="directoryActive" data-field="active"><?php echo _("Active") ?></th>
												<th data-sortable="true" data-formatter="directoryType" data-field="type"><?php echo _("Type") ?></th>
												<th data-formatter="defaultSelector" data-field="type"><?php echo _("Default") ?></th>
												<th data-formatter="directoryActions"><?php echo _("Action") ?></th>
											</tr>
										</thead>
									</table>
								</div>
							</div>
							<div role="tabpane" id="settings" class="tab-pane display">
								<div class="container-fluid">
									<?php echo load_view(dirname(__FILE__).'/general.php', array("hostname" => $hostname, "host" => $host, "remoteips" => $remoteips, "sync" => $sync, "brand" => $brand, "auths" => $auths, "authtype" => $authtype, "autoEmail" => $autoEmail,"emailbody" => $emailbody, "emailsubject" => $emailsubject, "mailtype" => $mailtype)); ?>
								</div>
							</div>
						</div>
					</div>
					<?php echo load_view(dirname(__FILE__).'/passwordmodal.php')?>
				</div>
			</div>
		</div>
	</div>
</div>
<script>
	var drivers = <?php echo json_encode($auths)?>;
	var directoryMapValues = <?php echo json_encode($directoryMap)?>;
	</script>
