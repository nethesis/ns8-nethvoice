<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="voicemail-context"><?php echo _("Context")?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="voicemail-context"></i>
					</div>
					<div class="col-md-9">
						<input id="voicemail-context" name="voicemail-context" type="text" class="form-control" value="<?php echo isset($config['context']) ? $config['context'] : ''?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="voicemail-context-help" class="help-block fpbx-help-block"><?php echo _("The voicemail context to get users from")?></span>
		</div>
	</div>
</div>
