<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad2-connection"><?php echo _("Secure Connection Type")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-connection"></i>
					</div>
					<div class="col-md-9">
						<select id="msad2-connection" data-default="<?php echo $defaults['connection']?>" name="msad2-connection" class="form-control">
							<option value='' <?php echo $config['connection'] == '' ? 'selected' : ''?>><?php echo _("None")?></option>
							<option value='tls' <?php echo $config['connection'] == 'tls' ? 'selected' : ''?>>Start TLS</option>
							<option value='ssl' <?php echo $config['connection'] == 'ssl' ? 'selected' : ''?>>SSL</option>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad2-connection-help" class="help-block fpbx-help-block"><?php echo _("The Active Directory secure connection type")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad2-host"><?php echo _("Host(s)")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-host"></i>
					</div>
					<div class="col-md-9">
						<input id="msad2-host" name="msad2-host" data-default="<?php echo $defaults['host']?>" type="text" class="form-control" value="<?php echo isset($config['host']) ? $config['host'] : $defaults['host']?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad2-host-help" class="help-block fpbx-help-block"><?php echo _("The active directory host(s), comma/space separated")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad2-post"><?php echo _("Port")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-port"></i>
					</div>
					<div class="col-md-9">
						<input id="msad2-port" data-default="<?php echo $defaults['port']?>" name="msad2-port" type="text" class="form-control" value="<?php echo isset($config['port']) ? $config['port'] : $defaults['port']?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad2-port-help" class="help-block fpbx-help-block"><?php echo _("The active directory port")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad2-host"><?php echo _("Username")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-username"></i>
					</div>
					<div class="col-md-9">
						<input id="msad2-username" data-default="<?php echo $defaults['username']?>" name="msad2-username" type="text" class="form-control" value="<?php echo isset($config['username']) ? $config['username'] : $defaults['username']?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad2-username-help" class="help-block fpbx-help-block"><?php echo _("The active directory username")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad2-password"><?php echo _("Password")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-password"></i>
					</div>
					<div class="col-md-9">
						<input id="msad2-password" data-default="<?php echo $defaults['password']?>" name="msad2-password" type="text" class="form-control" value="<?php echo isset($config['password']) ? $config['password'] : $defaults['password']?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad2-password-help" class="help-block fpbx-help-block"><?php echo _("The active directory password")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad2-domain"><?php echo _("Domain")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-domain"></i>
					</div>
					<div class="col-md-9">
						<input id="msad2-domain" data-default="<?php echo $defaults['domain']?>" name="msad2-domain" type="text" class="form-control" value="<?php echo isset($config['domain']) ? $config['domain'] : $defaults['domain']?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad2-domain-help" class="help-block fpbx-help-block"><?php echo _("The active directory domain")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad2-dn"><?php echo _("Base DN")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-dn"></i>
					</div>
					<div class="col-md-9">
						<input id="msad2-dn" data-default="<?php echo $defaults['dn']?>" name="msad2-dn" type="text" class="form-control" value="<?php echo isset($config['dn']) ? $config['dn'] : $defaults['dn']?>" required>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad2-dn-help" class="help-block fpbx-help-block"><?php echo _("The base DN. Usually in the format of CN=Users,DC=domain,DC=local")?></span>
		</div>
	</div>
</div>
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="msad2-status"><?php echo _("Status")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-status"></i>
					</div>
					<div class="col-md-9">
						<div id="msad2-status" class="bg-<?php echo $status['type']?>"><?php echo $status['message']?></div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="msad2-status-help" class="help-block fpbx-help-block"><?php echo _("The connection status of the Active Directory Server")?></span>
		</div>
	</div>
</div>
<fieldset>
	<legend><?php echo _("Operational Settings")?></legend>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-createextensions"><?php echo _("Create Missing Extensions")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-createextensions"></i>
						</div>
						<div class="col-md-9">
							<select class="form-control" id="msad2-createextensions" name="msad2-createextensions">
								<option value=""><?php echo _("Don't Create")?></option>
								<?php foreach($techs as $tech) { ?>
									<option value="<?php echo $tech['rawName']?>" <?php echo !empty($config['createextensions']) && ($config['createextensions'] == $tech['rawName']) ? 'selected' : ''?>><?php echo $tech['shortName']?></option>
								<?php } ?>
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-createextensions-help" class="help-block fpbx-help-block"><?php echo _("If enabled and the 'User extension Link attribute' is set, a new extension will be created and linked to this user if one does not exist previously")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-localgroups"><?php echo _("Manage groups locally")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-localgroups"></i>
						</div>
						<div class="col-md-9 radioset">
							<input type="radio" id="msad2-localgroups1" name="msad2-localgroups" value="1" <?php echo !empty($config['localgroups']) ? 'checked' : ''?>>
							<label for="msad2-localgroups1"><?php echo _("Yes")?></label>
							<input type="radio" id="msad2-localgroups2" name="msad2-localgroups" value="0" <?php echo !empty($config['localgroups']) ? '' : 'checked'?>>
							<label for="msad2-localgroups2"><?php echo _("No")?></label>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-localgroups-help" class="help-block fpbx-help-block"><?php echo _("New groups created in this directory will be local and not saved to the LDAP directory. Groups synchronised from the remote directory will be read-only.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-commonnameattr"><?php echo _("Common Name attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-commonnameattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-commonnameattr" data-default="<?php echo $defaults['commonnameattr']?>" name="msad2-commonnameattr" type="text" class="form-control" value="<?php echo isset($config['commonnameattr']) ? $config['commonnameattr'] : $defaults['commonnameattr']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-commonnameattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the object's common name.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-descriptionattr"><?php echo _("Description attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-descriptionattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-descriptionattr" data-default="<?php echo $defaults['descriptionattr']?>" name="msad2-descriptionattr" type="text" class="form-control" value="<?php echo isset($config['descriptionattr']) ? $config['descriptionattr'] : $defaults['descriptionattr']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-descriptionattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the object description.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-externalidattr"><?php echo _("Unique identifier attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-externalidattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-externalidattr" data-default="<?php echo $defaults['externalidattr']?>" name="msad2-externalidattr" type="text" class="form-control" value="<?php echo isset($config['externalidattr']) ? $config['externalidattr'] : $defaults['externalidattr']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-externalidattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use for tracking user identity across object renames.")?></span>
			</div>
		</div>
	</div>
</fieldset>
<fieldset>
	<legend><?php echo _("User configuration")?></legend>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-userdn"><?php echo _("User DN")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-userdn"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-userdn" data-default="<?php echo $defaults['userdn']?>" name="msad2-userdn" type="text" class="form-control" value="<?php echo isset($config['userdn']) ? $config['userdn'] : $defaults['userdn']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-userdn-help" class="help-block fpbx-help-block"><?php echo _("This value is used in addition to the base DN when searching and loading users. An example is ou=Users. If no value is supplied, the subtree search will start from the base DN.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-userobjectclass"><?php echo _("User object class")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-userobjectclass"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-userobjectclass" data-default="<?php echo $defaults['userobjectclass']?>" name="msad2-userobjectclass" type="text" class="form-control" value="<?php echo isset($config['userobjectclass']) ? $config['userobjectclass'] : $defaults['userobjectclass']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-userobjectclass-help" class="help-block fpbx-help-block"><?php echo _("The LDAP user object class type to use when loading users.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-userobjectfilter"><?php echo _("User object filter")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-userobjectfilter"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-userobjectfilter" data-default="<?php echo $defaults['userobjectfilter']?>" name="msad2-userobjectfilter" type="text" class="form-control" value="<?php echo isset($config['userobjectfilter']) ? $config['userobjectfilter'] : $defaults['userobjectfilter']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-userobjectfilter-help" class="help-block fpbx-help-block"><?php echo _("The filter to use when searching user objects.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-usernameattr"><?php echo _("User name attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-usernameattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-usernameattr" data-default="<?php echo $defaults['usernameattr']?>" name="msad2-usernameattr" type="text" class="form-control" value="<?php echo isset($config['usernameattr']) ? $config['usernameattr'] : $defaults['usernameattr']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-usernameattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use on the user object (eg. cn, sAMAccountName)")?></span>
			</div>
		</div>
	</div>
	<!--
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-usernamerdnattr"><?php echo _("User name RDN attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-usernamerdnattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-usernamerdnattr" data-default="<?php echo $defaults['usernamerdnattr']?>" name="msad2-usernamerdnattr" type="text" class="form-control" value="<?php echo isset($config['usernamerdnattr']) ? $config['usernamerdnattr'] : $defaults['usernamerdnattr']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-usernamerdnattr-help" class="help-block fpbx-help-block"><?php echo _("The RDN to use when loading the user username (eg. cn).")?></span>
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
							<label class="control-label" for="msad2-userfirstnameattr"><?php echo _("User first name attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-userfirstnameattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-userfirstnameattr" data-default="<?php echo $defaults['userfirstnameattr']?>" name="msad2-userfirstnameattr" type="text" class="form-control" value="<?php echo isset($config['userfirstnameattr']) ? $config['userfirstnameattr'] : $defaults['userfirstnameattr']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-userfirstnameattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user first name.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-userlastnameattr"><?php echo _("User last name attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-userlastnameattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-userlastnameattr" data-default="<?php echo $defaults['userlastnameattr']?>" name="msad2-userlastnameattr" type="text" class="form-control" value="<?php echo isset($config['userlastnameattr']) ? $config['userlastnameattr'] : $defaults['userlastnameattr']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-userlastnameattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user last name.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-userdisplaynameattr"><?php echo _("User display name attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-userdisplaynameattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-userdisplaynameattr" data-default="<?php echo $defaults['userdisplaynameattr']?>" name="msad2-userdisplaynameattr" type="text" class="form-control" value="<?php echo isset($config['userdisplaynameattr']) ? $config['userdisplaynameattr'] : $defaults['userdisplaynameattr']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-userdisplaynameattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user full name.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-usergroupmemberattr"><?php echo _("User group attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-usergroupmemberattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-usergroupmemberattr" data-default="<?php echo $defaults['usergroupmemberattr']?>" name="msad2-usergroupmemberattr" type="text" class="form-control" value="<?php echo isset($config['usergroupmemberattr']) ? $config['usergroupmemberattr'] : $defaults['usergroupmemberattr']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-usergroupmemberattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the users groups.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-usermailattr"><?php echo _("User email attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-usermailattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-usermailattr" data-default="<?php echo $defaults['usermailattr']?>" name="msad2-usermailattr" type="text" class="form-control" value="<?php echo isset($config['usermailattr']) ? $config['usermailattr'] : $defaults['usermailattr']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-usermailattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user email.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-usertitleattr"><?php echo _("User Title attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-usertitleattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-usertitleattr" data-default="<?php echo $defaults['usertitleattr']?>" name="msad2-usertitleattr" type="text" class="form-control" value="<?php echo isset($config['usertitleattr']) ? $config['usertitleattr'] : $defaults['usertitleattr']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-usertitleattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user title.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-usercompanyattr"><?php echo _("User Company attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-usercompanyattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-usercompanyattr" data-default="<?php echo $defaults['usercompanyattr']?>" name="msad2-usercompanyattr" type="text" class="form-control" value="<?php echo isset($config['usercompanyattr']) ? $config['usercompanyattr'] : $defaults['usercompanyattr']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-usercompanyattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user company.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-userdepartmentattr"><?php echo _("User Department attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-userdepartmentattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-userdepartmentattr" data-default="<?php echo $defaults['userdepartmentattr']?>" name="msad2-userdepartmentattr" type="text" class="form-control" value="<?php echo isset($config['userdepartmentattr']) ? $config['userdepartmentattr'] : $defaults['userdepartmentattr']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-userdepartmentattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user department.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-userhomephoneattr"><?php echo _("User Home Phone attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-userhomephoneattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-userhomephoneattr" data-default="<?php echo $defaults['userhomephoneattr']?>" name="msad2-userhomephoneattr" type="text" class="form-control" value="<?php echo isset($config['userhomephoneattr']) ? $config['userhomephoneattr'] : $defaults['userhomephoneattr']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-userhomephoneattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user home phone.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-userworkphoneattr"><?php echo _("User Work Phone attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-userworkphoneattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-userworkphoneattr" data-default="<?php echo $defaults['userworkphoneattr']?>" name="msad2-userworkphoneattr" type="text" class="form-control" value="<?php echo isset($config['userworkphoneattr']) ? $config['userworkphoneattr'] : $defaults['userworkphoneattr']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-userworkphoneattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user work phone.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-usercellphoneattr"><?php echo _("User Cell Phone attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-usercellphoneattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-usercellphoneattr" data-default="<?php echo $defaults['usercellphoneattr']?>" name="msad2-usercellphoneattr" type="text" class="form-control" value="<?php echo isset($config['usercellphoneattr']) ? $config['usercellphoneattr'] : $defaults['usercellphoneattr']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-usercellphoneattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user cell phone.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-userfaxphoneattr"><?php echo _("User Fax attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-userfaxphoneattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-userfaxphoneattr" data-default="<?php echo $defaults['userfaxphoneattr']?>" name="msad2-userfaxphoneattr" type="text" class="form-control" value="<?php echo isset($config['userfaxphoneattr']) ? $config['userfaxphoneattr'] : $defaults['userfaxphoneattr']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-userfaxphoneattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the user fax.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-la"><?php echo _("User extension Link attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-la"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-la" data-default="<?php echo $defaults['la']?>" name="msad2-la" type="text" class="form-control" value="<?php echo isset($config['la']) ? $config['la'] : $defaults['la']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-la-help" class="help-block fpbx-help-block"><?php echo _("If this is set then User Manager will use the defined attribute of the user from the Active Directory server as the extension link. NOTE: If this field is set it will overwrite any manually linked extensions where this attribute extists!! (Try lowercase if it is not working.)")?></span>
			</div>
		</div>
	</div>
</fieldset>
<fieldset>
	<legend><?php echo _("Group configuration")?></legend>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-groupdnaddition"><?php echo _("Group DN")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-groupdnaddition"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-groupdnaddition" data-default="<?php echo $defaults['groupdnaddition']?>" name="msad2-groupdnaddition" type="text" class="form-control" value="<?php echo isset($config['groupdnaddition']) ? $config['groupdnaddition'] : $defaults['groupdnaddition']?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-groupdnaddition-help" class="help-block fpbx-help-block"><?php echo _("This value is used in addition to the base DN when searching and loading groups. An example is ou=Groups. If no value is supplied, the subtree search will start from the base DN.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-groupobjectclass"><?php echo _("Group object class")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-groupobjectclass"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-groupobjectclass" data-default="<?php echo $defaults['groupobjectclass']?>" name="msad2-groupobjectclass" type="text" class="form-control" value="<?php echo isset($config['groupobjectclass']) ? $config['groupobjectclass'] : $defaults['groupobjectclass']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-groupobjectclass-help" class="help-block fpbx-help-block"><?php echo _("The LDAP user object class type to use when loading groups.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-groupobjectfilter"><?php echo _("Group object filter")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-groupobjectfilter"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-groupobjectfilter" data-default="<?php echo $defaults['groupobjectfilter']?>" name="msad2-groupobjectfilter" type="text" class="form-control" value="<?php echo isset($config['groupobjectfilter']) ? $config['groupobjectfilter'] : $defaults['groupobjectfilter']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-groupobjectfilter-help" class="help-block fpbx-help-block"><?php echo _("The filter to use when searching group objects.")?></span>
			</div>
		</div>
	</div>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="msad2-groupmemberattr"><?php echo _("Group members attribute")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="msad2-groupmemberattr"></i>
						</div>
						<div class="col-md-9">
							<input id="msad2-groupmemberattr" data-default="<?php echo $defaults['groupmemberattr']?>" name="msad2-groupmemberattr" type="text" class="form-control" value="<?php echo isset($config['groupmemberattr']) ? $config['groupmemberattr'] : $defaults['groupmemberattr']?>" required>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="msad2-groupmemberattr-help" class="help-block fpbx-help-block"><?php echo _("The attribute field to use when loading the group members.")?></span>
			</div>
		</div>
	</div>
</fieldset>
<style>
	#msad2-status {
		padding: 5px;
		border-radius: 5px;
		margin-top: 5px;
	}
</style>
