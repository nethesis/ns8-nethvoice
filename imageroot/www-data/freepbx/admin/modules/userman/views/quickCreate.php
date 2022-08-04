<?php if($permissions['addUser']) { ?>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="um"><?php echo _('Create User Manager User')?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="um"></i>
						</div>
						<div class="col-md-9">
							<span class="radioset">
								<input type="radio" name="um" id="um_on" value="yes" checked>
								<label for="um_on"><?php echo _('Yes')?></label>
								<input type="radio" name="um" id="um_off" value="no">
								<label for="um_off"><?php echo _('No')?></label>
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="um-help" class="help-block fpbx-help-block"><?php echo _('Enable User Manager for this extension')?></span>
			</div>
		</div>
	</div>
	<?php if($permissions['modifyGroup']) { ?>
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="um-groups"><?php echo _('User Manager Groups')?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="um-groups"></i>
							</div>
							<div class="col-md-9">
								<select id="um-groups" data-placeholder="Groups" class="form-control chosenmultiselect" name="um-groups[]" multiple="multiple">
									<?php foreach($groups as $group) {?>
										<option value="<?php echo $group['id']?>" <?php echo in_array($group['id'],$dgroups) ? "selected" : ""?>><?php echo $group['groupname']?></option>
									<?php } ?>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="um-groups-help" class="help-block fpbx-help-block"><?php echo _("Which groups this user is in")?></span>
				</div>
			</div>
			<script>
			$("input[name=um]").change(function() {
				if($("#um_on").is(":checked")) {
					$("#um-groups").prop("disabled", false);
				} else {
					$("#um-groups").prop("disabled", true);
				}
				$('#um-groups').trigger('chosen:updated');
			})
			</script>
		</div>
	<?php } ?>
<?php } else { ?>
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="um-link"><?php echo _('Link to User Manager User')?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="um-link"></i>
						</div>
						<div class="col-md-9">
							<select id="um-link" class="form-control" name="um-link">
								<?php foreach($users as $key => $value) {?>
									<option value="<?php echo $key?>"><?php echo $value?></option>
								<?php } ?>
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="um-link-help" class="help-block fpbx-help-block"><?php echo _("Which User Manager user this extension will link to")?></span>
			</div>
		</div>
	</div>
<?php } ?>
