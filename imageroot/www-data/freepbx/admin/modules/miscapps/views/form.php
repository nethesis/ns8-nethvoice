<?php
if(isset($data) && is_array($data)){
	extract($data);
}
?>
<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<form autocomplete="off" class="fpbx-submit" name="editMiscapp" action="config.php?display=miscapps" method="post" data-fpbx-delete="<?php echo $delurl ?>" role="form" >
					<input type="hidden" name="extdisplay" value="<?php echo $extdisplay; ?>">
					<input type="hidden" name="miscapp_id" value="<?php echo $extdisplay; ?>">
					<input type="hidden" name="action" value="<?php echo ($extdisplay ? 'edit' : 'add'); ?>">
					<div class="display full-border">
						<div>
							<?php echo $warn ?>
							<p><?php echo $helptext ?></p>
						</div>
						<!--Enabled-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3 control-label">
												<?php echo _("Enable") ?>
											</div>
											<div class="col-md-9 radioset">
												<input type="radio" name="enabled" id="enabledyes" value="1" <?php echo ($enabled?"CHECKED":"") ?>>
												<label for="enabledyes"><?php echo _("Yes");?></label>
												<input type="radio" name="enabled" id="enabledno" value="" <?php echo ($enabled?"":"CHECKED") ?>>
												<label for="enabledno"><?php echo _("No");?></label>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
						<!--End Enabled-->
						<!--Descripton-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3 control-label">
												<label for="description"><?php echo _("Description:")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="description" name="description" value="<?php echo (isset($description) ? $description : ''); ?>"  >
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="description-help" class="help-block fpbx-help-block"><?php echo _("The name of this application")?></span>
								</div>
							</div>
						</div>
						<!--End Description-->
						<!--Feaurecode-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3 control-label">
												<label for="ext"><?php echo _("Feature Code")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="ext"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="ext" name="ext" value="<?php echo (isset($ext) ? $ext : ''); ?>" required data-invalid="<?php echo _("This field is required.");?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="ext-help" class="help-block fpbx-help-block"><?php echo _("The feature code/extension users can dial to access this application. This can also be modified on the Feature Codes page.")?></span>
								</div>
							</div>
						</div>
						<!--END Feaurecode-->
						<!--Destination-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3 control-label">
												<label for="goto0"><?php echo _("Destination") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
											</div>
											<div class="col-md-9">
												<?php echo drawselects($dest,0);?>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="goto0-help" class="help-block fpbx-help-block"><?php echo _("Choose the destination for this app when people dial the feature code")?></span>
								</div>
							</div>
						</div>
						<!--End Destination-->
					</div>
				</form>
			</div>
		</div>
	</div>
</div>
