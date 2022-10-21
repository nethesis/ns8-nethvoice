<?php
	if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
	
	FreePBX::Endpointman()->configmod->getConfigModuleSQL(false);
	
	
	if ((FreePBX::Endpointman()->configmod->get("server_type") == 'file') AND (FreePBX::Endpointman()->epm_advanced->epm_advanced_config_loc_is_writable())) {
		FreePBX::Endpointman()->tftp_check();
	}
	
	if (FreePBX::Endpointman()->configmod->get("use_repo") == "1") {
		if (FreePBX::Endpointman()->has_git()) {
			
			if (!file_exists(FreePBX::Endpointman()->PHONE_MODULES_PATH . '/.git')) {
				$o = getcwd();
				chdir(dirname(FreePBX::Endpointman()->PHONE_MODULES_PATH));
				FreePBX::Endpointman()->rmrf(FreePBX::Endpointman()->PHONE_MODULES_PATH);
				$path = FreePBX::Endpointman()->has_git();
				exec($path . ' clone https://github.com/provisioner/Provisioner.git _ep_phone_modules', $output);
				chdir($o);
			}
		} else {
			echo  _("Git not installed!");
		}
	} else {
		if (file_exists(FreePBX::Endpointman()->PHONE_MODULES_PATH . '/.git')) {
			FreePBX::Endpointman()->rmrf(FreePBX::Endpointman()->PHONE_MODULES_PATH);
			$sql = "SELECT * FROM  `endpointman_brand_list` WHERE  `installed` =1";
			$result = & sql($sql, 'getAll', DB_FETCHMODE_ASSOC);
			foreach ($result as $row) {
				FreePBX::Endpointman()->remove_brand($row['id'], FALSE, TRUE);
			}
		}
	}
?>

<div class="section-title" data-for="setting_provision">
	<h3><i class="fa fa-minus"></i><?php echo _("Setting Provision") ?></h3>
</div>
<div class="section" data-id="setting_provision">

	<!--IP address of phone server-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="srvip"><?php echo _("IP address of phone server")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="srvip"></i>
						</div>
						<div class="col-md-9">
							<div class="input-group">
      							<input type="text" class="form-control" placeholder="Server PBX..." id="srvip" name="srvip" value="<?php echo FreePBX::Endpointman()->configmod->get("srvip"); ?>">
      							<span class="input-group-btn">
        							<button class="btn btn-default" type="button" id='autodetect' onclick="epm_advanced_tab_setting_input_value_change_bt('#srvip', sValue = '<?php echo $_SERVER["SERVER_ADDR"]; ?>', bSaveChange = true);"><i class='fa fa-search'></i> <?php echo _("Use me!")?></button>
      							</span>
    						</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span class="help-block fpbx-help-block" id="srvip-help"><?php echo _("Address IP by my server PBX."); ?></span>
			</div>
		</div>
	</div>
	<!--END IP address of phone server-->
	<!--Configuration Type-->
	<?php
		$server_type = FreePBX::Endpointman()->configmod->get("server_type");
	?>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="cfg_type"><?php echo _("Configuration Type")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="cfg_type"></i>
						</div>
						<div class="col-md-9">
	                        <select class="form-control selectpicker show-tick" data-style="btn-info" name="cfg_type" id="cfg_type">
                            	<option data-icon="fa fa-upload" value="file" <?php echo ($server_type == "file" ? 'selected="selected"' : '') ?> ><?php echo _("File (TFTP/FTP)")?></option>
								<option data-icon="fa fa-upload" value="http" <?php echo ($server_type == "http"? 'selected="selected"' : '') ?> ><?php echo _("Web (HTTP)")?></option>
                                <option data-icon="fa fa-upload" value="https" <?php echo ($server_type == "https"? 'selected="selected"' : '') ?> disabled><?php echo _("Web (HTTPS)")?></option>
							</select>
                            <br /><br />
							<div class="alert alert-info" role="alert" id="cfg_type_alert">
								<strong><?php echo _("Updated!"); ?></strong><?php echo _(" - Point your phones to: "); ?><a href="http://<?php echo $_SERVER['SERVER_ADDR']; ?>/provisioning/p.php/" class="alert-link" target="_blank">http://<?php echo $_SERVER['SERVER_ADDR']; ?>/provisioning/p.php/</a>.
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span class="help-block fpbx-help-block" id="cfg_type-help"><?php echo _("Type the server by aprovisonament setting. Server TFTP, Server HTTP, Server HTTPS (not found, future version!)."); ?></span>
			</div>
		</div>
	</div>
	<?php
		unset($server_type);
	?>
	<!--END Configuration Type-->
	<!--Global Final Config & Firmware Directory-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="config_loc"><?php echo _("Global Final Config & Firmware Directory")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="config_loc"></i>
						</div>
						<div class="col-md-9">
							<input type="text" class="form-control" id="config_loc" name="config_loc" value="<?php echo FreePBX::Endpointman()->configmod->get("config_location"); ?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span class="help-block fpbx-help-block" id="config_loc-help"><?php echo _("Path location root TFTP server."); ?></span>
			</div>
		</div>
	</div>
	<!--END Global Final Config & Firmware Directory-->
</div>

<div class="section-title" data-for="setting_time">
	<h3><i class="fa fa-minus"></i><?php echo _("Time") ?></h3>
</div>
<div class="section" data-id="setting_time">
	<!--Time Zone-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="tz"><?php echo _("Time Zone")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="tz"></i>
						</div>
						<div class="col-md-9">
                        	<div class="input-group input-group-br">
                            	<select class="form-control selectpicker show-tick" data-style="btn-primary" data-live-search-placeholder="Search" data-size="10" data-live-search="true" name="tz" id="tz">
								<?php
									$list_tz = FreePBX::Endpointman()->listTZ(FreePBX::Endpointman()->configmod->get("tz"));
								   	foreach ($list_tz as $row) {
										echo '<option data-icon="fa fa-clock-o" value="'.$row['value'].'" '.($row['selected'] == 1 ? 'selected="selected"' : '' ).'>'.$row['text'].'</option>';
									}
									unset ($list_tz);
								?>
								</select>
								<span class="input-group-btn">
									<button class="btn btn-default" type="button" id='tzphp' onclick="epm_advanced_tab_setting_input_value_change_bt('#tz', sValue = '<?php echo FreePBX::Endpointman()->config->get('PHPTIMEZONE'); ?>', bSaveChange = true);"><i class="fa fa-clock-o"></i> <?php echo _("TimeZone PBX")?></button>
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span class="help-block fpbx-help-block" id="tz-help"><?php echo _("TimeZone configuration terminasl. Like England/London"); ?></span>
			</div>
		</div>
	</div>
	<!--END Time Zone-->
	<!--Time Server - NTP Server-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="ntp_server"><?php echo _("Time Server (NTP Server)")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="ntp_server"></i>
						</div>
						<div class="col-md-9">
							<div class="input-group">
      							<input type="text" class="form-control" placeholder="Server NTP..." id="ntp_server" name="ntp_server" value="<?php echo FreePBX::Endpointman()->configmod->get("ntp"); ?>">
      							<span class="input-group-btn">
        							<button class="btn btn-default" type="button" id='autodetectntp' onclick="epm_advanced_tab_setting_input_value_change_bt('#ntp_server', sValue = '<?php echo $_SERVER["SERVER_ADDR"]; ?>', bSaveChange = true);"><i class='fa fa-search'></i> <?php echo _("Use me!")?></button>
      							</span>
    						</div>
							
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span class="help-block fpbx-help-block" id="ntp_server-help"><?php echo _("Server NTP use the configuration terminals."); ?></span>
			</div>
		</div>
	</div>
	<!--END Time Server - NTP Server-->
</div>

<div class="section-title" data-for="setting_local_paths">
	<h3><i class="fa fa-minus"></i><?php echo _("Local Paths") ?></h3>
</div>
<div class="section" data-id="setting_local_paths">
	<!--NMAP Executable Path-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="nmap_loc"><?php echo _("NMAP Executable Path")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="nmap_loc"></i>
						</div>
						<div class="col-md-9">
							<input type="text" class="form-control" id="nmap_loc" name="nmap_loc" value="<?php echo FreePBX::Endpointman()->configmod->get("nmap_location"); ?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span class="help-block fpbx-help-block" id="nmap_loc-help"><?php echo _("Path location NMAP."); ?></span>
			</div>
		</div>
	</div>
	<!--END NMAP Executable Path-->
	<!--ARP Executable Path-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="arp_loc"><?php echo _("ARP Executable Path")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="arp_loc"></i>
						</div>
						<div class="col-md-9">
							<input type="text" class="form-control" id="arp_loc" name="arp_loc" value="<?php echo FreePBX::Endpointman()->configmod->get("arp_location"); ?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span class="help-block fpbx-help-block" id="arp_loc-help"><?php echo _("Path location ARP."); ?></span>
			</div>
		</div>
	</div>
	<!--END ARP Executable Path-->
	<!--Asterisk Executable Path-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="asterisk_loc"><?php echo _("Asterisk Executable Path")?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="asterisk_loc"></i>
						</div>
						<div class="col-md-9">
							<input type="text" class="form-control" id="asterisk_loc" name="asterisk_loc" value="<?php echo FreePBX::Endpointman()->configmod->get("asterisk_location"); ?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span class="help-block fpbx-help-block" id="asterisk_loc-help"><?php echo _("Path location Asterisk."); ?></span>
			</div>
		</div>
	</div>
	<!--END Asterisk Executable Path-->
</div>
