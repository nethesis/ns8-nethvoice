<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad-host"><?php echo _("Host")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad-host"></i>
					</div>
					<div class="col-md-9">
						<input id="msad-host" name="msad-host" type="text" class="form-control" value="<?php echo isset($config['host']) ? $config['host'] : ''?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad-host-help" class="help-block fpbx-help-block"><?php echo _("The active directory host")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad-post"><?php echo _("Port")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad-port"></i>
					</div>
					<div class="col-md-9">
						<input id="msad-port" name="msad-port" type="text" class="form-control" placeholder="389" value="<?php echo isset($config['port']) ? $config['port'] : ''?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad-port-help" class="help-block fpbx-help-block"><?php echo _("The active directory port")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad-host"><?php echo _("Username")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad-username"></i>
					</div>
					<div class="col-md-9">
						<input id="msad-username" name="msad-username" type="text" class="form-control" value="<?php echo isset($config['username']) ? $config['username'] : ''?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad-username-help" class="help-block fpbx-help-block"><?php echo _("The active directory username")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad-password"><?php echo _("Password")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad-password"></i>
					</div>
					<div class="col-md-9">
						<input id="msad-password" name="msad-password" type="text" class="form-control" value="<?php echo isset($config['password']) ? $config['password'] : ''?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad-password-help" class="help-block fpbx-help-block"><?php echo _("The active directory password")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad-domain"><?php echo _("Domain")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad-domain"></i>
					</div>
					<div class="col-md-9">
						<input id="msad-domain" name="msad-domain" type="text" class="form-control" value="<?php echo isset($config['domain']) ? $config['domain'] : ''?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad-domain-help" class="help-block fpbx-help-block"><?php echo _("The active directory domain")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad-dn"><?php echo _("Base DN")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad-dn"></i>
					</div>
					<div class="col-md-9">
						<input id="msad-dn" name="msad-dn" type="text" class="form-control" value="<?php echo isset($config['dn']) ? $config['dn'] : ''?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad-dn-help" class="help-block fpbx-help-block"><?php echo _("The base DN. Usually in the format of CN=Users,DC=domain,DC=local")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad-la"><?php echo _("Extension Link Attribute")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad-la"></i>
					</div>
					<div class="col-md-9">
						<input id="msad-la" name="msad-la" type="text" class="form-control" value="<?php echo isset($config['la']) ? $config['la'] : ''?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad-la-help" class="help-block fpbx-help-block"><?php echo _("If this is set then User Manager will use the defined attribute of the user from the Active Directory server as the extension link. NOTE: If this field is set it will overwrite any manually linked extensions where this attribute extists!!")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad-status"><?php echo _("Status")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad-status"></i>
					</div>
					<div class="col-md-9">
						<div id="msad-status" class="bg-<?php echo $status['type']?>"><?php echo $status['message']?></div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad-status-help" class="help-block fpbx-help-block"><?php echo _("The connection status of the Active Directory Server")?></span>
		</div>
	</div>
</div>
<style>
	#msad-status {
		padding: 5px;
		border-radius: 5px;
		margin-top: 5px;
	}
</style>
