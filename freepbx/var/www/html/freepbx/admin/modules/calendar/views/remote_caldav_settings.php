<div class = "display full-border">
	<div class="container-fluid">
		<h1>
			<span><?php echo sprintf(_('%s CalDAV Calendar'),ucfirst($action)) ?></span>
		</h1>
	</div>
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<div class="display full-border">
					<form class="fpbx-submit calform" method="post" id="caldavform" name="caldavform" action="?display=calendar" data-fpbx-delete="config.php?display=calendar&amp;id=<?php echo !empty($data['id']) ? $data['id'] : ''?>&amp;action=delete">
						<input type="hidden" name="action" value="<?php echo $action?>">
						<input type="hidden" name="type" value="caldav">
						<input type="hidden" name="id" value="<?php echo !empty($data['id']) ? $data['id'] : ''?>">
						<!--Name-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="name"><?php echo _("Name") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="name"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="name" name="name" value="<?php echo !empty($data['name']) ? $data['name'] : ''?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="name-help" class="help-block fpbx-help-block"><?php echo _("The name of this calendar")?></span>
								</div>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="description"><?php echo _("Description") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="description" name="description" value="<?php echo !empty($data['description']) ? $data['description'] : ''?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="description-help" class="help-block fpbx-help-block"><?php echo _("The description of this calendar")?></span>
								</div>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="purl"><?php echo _("Principal URL") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="purl"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control diswhenloading" id="purl" name="purl" value="<?php echo !empty($data['purl']) ? $data['purl'] : ''?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="purl-help" class="help-block fpbx-help-block"><?php echo _("The principal url for this calendar")?></span>
								</div>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="username"><?php echo _("Username") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="username"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control diswhenloading" id="username" name="username" value="<?php echo !empty($data['username']) ? $data['username'] : ''?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="username-help" class="help-block fpbx-help-block"><?php echo _("The Userman for this calendar")?></span>
								</div>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="password"><?php echo _("Password") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="password"></i>
											</div>
											<div class="col-md-9">
												<input type="password" class="form-control diswhenloading" id="password" name="password" value="<?php echo !empty($data['password']) ? $data['password'] : ''?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="password-help" class="help-block fpbx-help-block"><?php echo _("The password for this calendar")?></span>
								</div>
							</div>
						</div>
						<!--Events-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="calendars"><?php echo _("Calendar") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="calendars"></i>
											</div>
											<div class="col-md-9">
<?php
if (strtolower($action) == "add") {
	$selclass = "hidden";
	$unsetclass = "";
} else {
	$selclass = "";
	$unsetclass = "hidden";
}
?>
												<span id='setspan' class="<?php echo $selclass; ?>">
													<select id="calendars" name="calendars[]" class="form-control">
														<?php foreach($calendars as $calendar) { ?>
															<option value="<?php echo $calendar['id']?>" <?php echo $calendar['selected'] ? 'selected' : ''?>><?php echo $calendar['name']?></option>
														<?php } ?>
													</select>
												</span>
												<span id='unsetspan' class="<?php echo $unsetclass; ?>"><?php echo _("Please enter valid credentials above"); ?></span>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="calendars-help" class="help-block fpbx-help-block"><?php echo _("Select specific calendar")?></span>
								</div>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="next"><?php echo _("Auto Refresh") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="next"></i>
											</div>
											<div class="col-md-9">
												<select id="next" class="form-control" name="next">
													<option value="60" <?php echo $data['next'] == 60 ? 'selected' : '' ?>><?php echo _("1 Minute")?></option>
													<option value="300" <?php echo $data['next'] == 300 ? 'selected' : '' ?>><?php echo _("5 Minutes")?></option>
													<option value="600" <?php echo $data['next'] == 600 ? 'selected' : '' ?>><?php echo _("10 Minutes")?></option>
													<option value="1800" <?php echo $data['next'] == 1800 ? 'selected' : '' ?>><?php echo _("30 Minutes")?></option>
													<option value="3600" <?php echo $data['next'] == 3600 ? 'selected' : '' ?>><?php echo _("1 Hour")?></option>
													<option value="7200" <?php echo $data['next'] == 7200 ? 'selected' : '' ?>><?php echo _("2 Hours")?></option>
													<option value="21600" <?php echo $data['next'] == 216000 ? 'selected' : '' ?>><?php echo _("6 Hours")?></option>
													<option value="43200" <?php echo $data['next'] == 43200 ? 'selected' : '' ?>><?php echo _("12 Hours")?></option>
													<option value="86400" <?php echo $data['next'] == 86400 ? 'selected' : '' ?>><?php echo _("1 Day")?></option>
													<option value="604800" <?php echo $data['next'] == 604800 ? 'selected' : '' ?>><?php echo _("1 Week")?></option>
												</select>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="next-help" class="help-block fpbx-help-block"><?php echo _("How often this calendar will synchronize with the remote server")?></span>
								</div>
							</div>
						</div>
						<!--END Events-->
					</form>
				</div>
			</div>
		</div>
	</div>
</div>
<script>
	var calendars = <?php echo !empty($data['calendars']) ? json_encode($data['calendars']) : '[]'?>;
	$("#purl").blur(function() {
		updateCalendars();
	});
	$("#username").blur(function() {
		updateCalendars();
	});
	$("#password").blur(function() {
		updateCalendars();
	});
	var updating = false;
	function updateCalendars() {
		if($("#purl").val() !== "" && $("#username").val() !== "" && $("#password").val() !== "" && !updating) {
			updating = true;
			$("#unsetspan").text('<?php echo _("Attempting to load..."); ?>').show();
			$("#setspan").addClass("hidden");
			$(".diswhenloading").addClass("disabled").attr("disabled", true);
			$.post( "ajax.php?module=calendar&command=getcaldavcals", {purl: $("#purl").val(), username: $("#username").val(), password: $("#password").val()}, function( data ) {
				$("#calendars").html(data.calshtml);
				if(data.status == true){
					$('#calendars').multiselect('rebuild');
					$("#setspan").removeClass("hidden");
					$("#unsetspan").addClass("hidden");
					$(".diswhenloading").removeClass("disabled").attr("disabled", false);
				}else{
					$("#unsetspan").html(data.calshtml);
					$(".diswhenloading").addClass("disabled").attr("disabled", false);
				}

			}).always(function() {
				updating = false;
			});
		}
	}
	$(document).ready(function() {
		$('#calendars').multiselect({
				enableFiltering: true,
				enableFullValueFiltering: true,
				enableCaseInsensitiveFiltering: true,
				buttonWidth: '50%'
		});
	});
	$(".fpbx-submit").submit(function() {
		if($("#username").val() == "") {
			return warnInvalid($("#username"),_("Please define a valid username"));
		}
		if($("#password").val() == "") {
			return warnInvalid($("#password"),_("Please define a valid password"));
		}
		if($("#purl").val() == "") {
			return warnInvalid($("#url"),_("Please define a valid url"));
		}
		if($("#urlerror").length == 1) {
			return warnInvalid($("#url"),_("Please check your URL and credentials."));
		}
		if($("#setspan").is(":hidden")) {
			fpbxToast(_('Validation in progress. Please wait.'),'','warning');
			return false;
		}
	});
</script>
