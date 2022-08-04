<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="freepbx-default-groups"><?php echo _('Default Groups')?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="freepbx-default-groups"></i>
					</div>
					<div class="col-md-9">
						<select id="freepbx-default-groups" class="form-control chosenmultiselect" name="freepbx-default-groups[]" multiple="multiple">
							<?php foreach($groups as $group) {?>
								<option value="<?php echo $group['id']?>" <?php echo in_array($group['id'], $defaultgroups) ?  "SELECTED" : "" ?>><?php echo $group['groupname']?></option>
							<?php } ?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="freepbx-default-groups-help" class="help-block fpbx-help-block"><?php echo _("Select which groups new users are added to when they are created")?></span>
		</div>
	</div>
</div>
