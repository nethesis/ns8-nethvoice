<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<h2><?php echo _("Settings")?></h2>

			<div class="fpbx-container">
				<div class="display full-border">
					<form method="POST" class="fpbx-submit" name="settings">
						<input type="hidden" name="action" value="savesettings">
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="language"><?php echo _("Global Language") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="language"></i>
											</div>
											<div class="col-md-9">
												<select name="language" id="language" class="form-control">
												<?php foreach ($languages as $key => $val) { ?>
													<option value="<?php echo $key?>" <?php echo ($language == $key ? 'selected' : '')?>><?php echo $val?></option>
												<?php } ?>
												</select>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="language-help" class="help-block fpbx-help-block"><?php echo _("Language to be used for sound prompts throughout the system")?></span>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="formats"><?php echo _("Download Formats") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="formats"></i>
											</div>
											<div class="col-md-9">
												<select name="formats[]" id="formats" class="form-control" multiple>
												<?php foreach ($formatlist as $format) { ?>
													<option value="<?php echo $format?>" <?php echo (in_array($format, $formatpref) ? 'selected' : '')?>><?php echo $format?></option>
												<?php } ?>
												</select>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="formats-help" class="help-block fpbx-help-block"><?php echo _("Formats (codecs) to download when installing a language pack")?></span>
							</div>
						</div>
					</div>
					</form>
				</div>
			</div>
		</div>
	</div>
</div>
