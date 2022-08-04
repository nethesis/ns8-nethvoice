<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<div class="display full-border">
					<form autocomplete="off" class="fpbx-submit" id="directory" name="directory" action="config.php?display=userman#directories" method="post" onsubmit="return">
						<input type="hidden" name="type" value="directory">
						<input type="hidden" name="submittype" value="gui">
						<input type="hidden" name="id" value="<?php echo !empty($config['id']) ? $config['id'] : ''?>">
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="authtype"><?php echo _("Directory Type")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="authtype"></i>
											</div>
											<div class="col-md-9">
												<?php if(empty($config['driver'])) { ?>
													<select id="authtype" name="authtype" class="form-control">
														<?php foreach($auths as $rawname => $auth) {?>
															<option value="<?php echo $rawname?>"><?php echo $auth['name']?></option>
														<?php } ?>
													</select>
												<?php } else {?>
													<input type="hidden" id="authtype" name="authtype" value="<?php echo $config['driver']?>">
													<?php echo $auths[$config['driver']]['name']?>
												<?php }?>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="authtype-help" class="help-block fpbx-help-block"><?php echo sprintf(_("The authentication engine to use"),$brand)?></span>
								</div>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="name"><?php echo _("Directory Name")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="name"></i>
											</div>
											<div class="col-md-9">
												<input class="form-control" id="name" name="name" value="<?php echo !empty($config['name']) ? $config['name'] : ''?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="name-help" class="help-block fpbx-help-block"><?php echo _("The directory name")?></span>
								</div>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="enable"><?php echo _("Enable Directory")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="enable"></i>
											</div>
											<div class="col-md-9 radioset">
												<input type="radio" id="enable1" name="enable" value="1" <?php echo $config['active'] ? 'checked' : ''?>>
												<label for="enable1"><?php echo _("Yes")?></label>
												<input type="radio" id="enable2" name="enable" value="0" <?php echo !$config['active'] ? 'checked' : ''?>>
												<label for="enable2"><?php echo _("No")?></label>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="enable-help" class="help-block fpbx-help-block"><?php echo sprintf(_("May this user log in to the %s Administration Pages?"),$brand)?></span>
								</div>
							</div>
						</div>
						<div class="element-container" id="sync-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="sync"><?php echo _("Synchronize")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="sync"></i>
											</div>
											<div class="col-md-9">
												<select name="sync" id="sync" class="form-control">
													<option value=""><?php echo _("Never")?></option>
													<option value="*/30 * * * *" <?php echo isset($config['config']['sync']) && $config['config']['sync'] == '*/30 * * * *' ? 'selected' : ''?>><?php echo _("30 Minutes")?></option>
													<option value="0 * * * *" <?php echo !isset($config['config']['sync']) || (isset($config['config']['sync']) && $config['config']['sync'] == '0 * * * *') ? 'selected' : ''?>><?php echo _("1 Hour")?></option>
													<option value="0 */6 * * *" <?php echo isset($config['config']['sync']) && $config['config']['sync'] == '0 */6 * * *' ? 'selected' : ''?>><?php echo _("6 Hours")?></option>
													<option value="0 0 * * *" <?php echo isset($config['config']['sync']) && $config['config']['sync'] == '0 0 * * *' ? 'selected' : ''?>><?php echo _("1 Day")?></option>
												</select>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="sync-help" class="help-block fpbx-help-block"><?php echo sprintf(_("This setting only applies to authentication engines other than the %s Internal Directory. For the %s Internal Directory this setting will be ignored."),$brand,$brand)?></span>
								</div>
							</div>
						</div>
						<fieldset>
							<legend><?php echo _('Directory Settings')?></legend>
						<?php foreach($auths as $rawname => $auth) {?>
							<div id="<?php echo $rawname?>-auth-settings" class="auth-settings hidden">
								<?php echo $auth['html']?>
							</div>
						<?php } ?>
						<fieldset>
					</form>
				</div>
			</div>
		</div>
	</div>
</div>
<script>
	var val = $("#authtype").val();
	$("#" + val + "-auth-settings").removeClass("hidden");
	if(val == "Freepbx") {
		$("#sync-container").addClass("hidden");
	} else {
		$("#sync-container").removeClass("hidden");
	}

	$("#authtype").change(function() {
		var val = $(this).val();
		if(val == "Freepbx") {
			$("#sync-container").addClass("hidden");
		} else {
			$("#sync-container").removeClass("hidden");
		}
		$(".auth-settings").addClass("hidden");
		$("#" + val + "-auth-settings").removeClass("hidden");
		$(".fpbx-submit input[type=text]:hidden").prop("disabled",true);
		$(".fpbx-submit input:visible").prop("disabled",false);
	});
	$(".fpbx-submit input[type=text]:hidden").prop("disabled",true);
	$(".fpbx-submit input:visible").prop("disabled",false);
</script>
