<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="calendar_enable"><?php echo _("Enable Calendar")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="calendar_enable"></i>
					</div>
					<div class="col-md-9">
						<span class="radioset">
							<input type="radio" name="calendar_enable" id="calendar_enable_yes" value="yes" <?php echo ($enabled) ? 'checked' : ''?>>
							<label for="calendar_enable_yes"><?php echo _('Yes')?></label>
							<input type="radio" name="calendar_enable" id="calendar_enable_no" value="no" <?php echo (!is_null($enabled) && !$enabled) ? 'checked' : ''?>>
							<label for="calendar_enable_no"><?php echo _('No')?></label>
							<?php if($mode == "user") {?>
								<input type="radio" id="calendar_enable_inherit" name="calendar_enable" value='inherit' <?php echo is_null($enabled) ? 'checked' : ''?>>
								<label for="calendar_enable_inherit"><?php echo _('Inherit')?></label>
							<?php } ?>
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="calendar_enable-help" class="help-block fpbx-help-block"><?php echo _("Whether to allow this user to be able to access the calendar in UCP")?></span>
		</div>
	</div>
</div>
<!--Allowed Calendars-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="calendar_allowedcalendars"><?php echo _("Allowed Calendars") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="calendar_allowedcalendars"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" id="calendar_allowedcalendars" name="calendar_allowedcalendars[]" multiple="multiple">
							<?php echo $calopts ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="calendar_allowedcalendars-help" class="help-block fpbx-help-block"><?php echo _("Calendars the user may utilize")?></span>
		</div>
	</div>
</div>
<!--END Allowed Calendars-->
<!--Allowed Calendar Groups-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="calendar_allowedgroups"><?php echo _("Allowed Calendar Groups") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="calendar_allowedgroups"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" id="calendar_allowedgroups" name="calendar_allowedgroups[]" multiple='multiple'>
							<?php echo $grpopts ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="calendar_allowedgroups-help" class="help-block fpbx-help-block"><?php echo _("Calendar groups the user may utilize.")?></span>
		</div>
	</div>
</div>
<!--END Allowed Calendar Groups-->
<script type="text/javascript">
    $(document).ready(function() {
        $('#calendar_allowedgroups,#calendar_allowedcalendars').multiselect({
            enableFiltering: true,
            filterBehavior: 'value',
						 buttonWidth: '80%'
        });
    });
</script>
