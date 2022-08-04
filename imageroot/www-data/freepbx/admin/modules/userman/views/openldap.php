<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-host"><?php echo _("Host")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-host"></i>
					</div>
					<div class="col-md-9">
						<input id="openldap-host" name="openldap-host" type="text" class="form-control" value="<?php echo isset($config['host']) ? $config['host'] : ''?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-host-help" class="help-block fpbx-help-block"><?php echo _("The OpenLDAP host")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-post"><?php echo _("Port")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-port"></i>
					</div>
					<div class="col-md-9">
						<input id="openldap-port" name="openldap-port" type="text" class="form-control" placeholder="389" value="<?php echo isset($config['port']) ? $config['port'] : ''?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-port-help" class="help-block fpbx-help-block"><?php echo _("The OpenLDAP port")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-post"><?php echo _("Use TLS")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-tls"></i>
					</div>
						<div class="col-md-9">
							<span class="radioset">
								<input type="radio" id="tls-yes" name="openldap-tls" value="yes" <?php echo (!isset($config['tls']) || $config['tls']) ? "checked" : ""?>>
								<label for="tls-yes"><?php echo _("Yes")?></label>
								<input type="radio" id="tls-no" name="openldap-tls" value="no" <?php echo (isset($config['tls']) && !($config['tls'])) ? "checked" : ""?>>
								<label for="tls-no"><?php echo _("No")?></label>
							</span>
						</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-tls-help" class="help-block fpbx-help-block"><?php echo _("Use TLS")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-host"><?php echo _("Username")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-username"></i>
					</div>
					<div class="col-md-9">
						<input id="openldap-username" name="openldap-username" type="text" class="form-control" value="<?php echo isset($config['username']) ? $config['username'] : ''?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-username-help" class="help-block fpbx-help-block"><?php echo _("The OpenLDAP username")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-password"><?php echo _("Password")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-password"></i>
					</div>
					<div class="col-md-9">
						<input id="openldap-password" name="openldap-password" type="text" class="form-control" value="<?php echo isset($config['password']) ? $config['password'] : ''?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-password-help" class="help-block fpbx-help-block"><?php echo _("The OpenLDAP password")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-userident"><?php echo _("User Identity")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-userident"></i>
					</div>
					<div class="col-md-9">
						<input id="openldap-userident" name="openldap-userident" type="text" class="form-control" value="<?php echo isset($config['userident']) ? $config['userident'] : 'uid'?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-userident-help" class="help-block fpbx-help-block"><?php echo _("The OpenLDAP User Identity. Usually is uid")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-displayname"><?php echo _("Display Name")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-displayname"></i>
					</div>
					<div class="col-md-9">
						<input id="openldap-displayname" name="openldap-displayname" type="text" class="form-control" value="<?php echo isset($config['displayname']) ? $config['displayname'] : 'displayname' ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-displayname-help" class="help-block fpbx-help-block"><?php echo _("The OpenLDAP Display Name. Usually is displayname")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-userdn"><?php echo _("User DN")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-userdn"></i>
					</div>
					<div class="col-md-9">
						<input id="openldap-userdn" name="openldap-userdn" type="text" class="form-control" value="<?php echo isset($config['userdn']) ? $config['userdn'] : ''?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-userdn-help" class="help-block fpbx-help-block"><?php echo _("The OpenLDAP User-DN. Usually in the format of OU=people,DC=example,DC=com)")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-basedn"><?php echo _("Base DN")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-basedn"></i>
					</div>
					<div class="col-md-9">
						<input id="openldap-basedn" name="openldap-basedn" type="text" class="form-control" value="<?php echo isset($config['basedn']) ? $config['basedn'] : ''?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-basedn-help" class="help-block fpbx-help-block"><?php echo _("The OpenLDAP Base-DN. Usually in the format of DC=example,DC=com")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-la"><?php echo _("Extension Link Attribute")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-la"></i>
					</div>
					<div class="col-md-9">
						<input id="openldap-la" name="openldap-la" type="text" class="form-control" value="<?php echo isset($config['la']) ? $config['la'] : ''?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-la-help" class="help-block fpbx-help-block"><?php echo _("If this is set then User Manager will use the defined attribute of the user from the OpenLDAP server as the extension link. NOTE: If this field is set it will overwrite any manually linked extensions where this attribute extists!! (Try lowercase if it is not working.)")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="openldap-status"><?php echo _("Status")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="openldap-status"></i>
					</div>
					<div class="col-md-9">
						<div id="openldap-status" class="bg-<?php echo $status['type']?>"><?php echo $status['message']?></div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="openldap-status-help" class="help-block fpbx-help-block"><?php echo _("The connection status of the OpenLDAP Server")?></span>
		</div>
	</div>
</div>
<style>
	#openldap-status {
		padding: 5px;
		border-radius: 5px;
		margin-top: 5px;
	}
</style>
