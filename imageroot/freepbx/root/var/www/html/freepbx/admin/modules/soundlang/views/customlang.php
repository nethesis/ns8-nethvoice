<?php
if(isset($_REQUEST['action']) && $_REQUEST['action'] == 'showcustomlang'){
	$heading = '<h1>' . _("Edit Custom Language") . '</h1>';
	$formaction = 'config.php?display=soundlang&action=showcustomlang&language=' . $customlang['id'];
}else{
	$heading = '<h1>' . _("Add Custom Language") . '</h1>';
	$formaction = 'config.php?display=soundlang&action=customlangs';

}

echo $heading;
?>
<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<?php if(!empty($message)){ ?>
					<div class="alert alert-<?php echo $message['type']?>"><?php echo $message['message']?></div>
				<?php } ?>
				<div class="display full-border">
					<form id="customlang-frm" class="fpbx-submit" autocomplete="off" name="editM" id="editM" action="<?php echo $formaction ?>" method="post" <?php if(!empty($customlang['id'])) {?>data-fpbx-delete="config.php?display=soundlang&amp;action=delcustomlang&amp;customlang=<?php echo $customlang['id']?>"<?php } ?> onsubmit="return true;">
						<input type="hidden" name="save" value="customlang">
						<input type="hidden" id="id" name="customlang" value="<?php echo !empty($customlang['id']) ? $customlang['id'] : ''; ?>">
						<!--LANGUAGE-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="language"><?php echo _("Language Code")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="language"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="language" name="language" value="<?php echo !empty($customlang['language']) ? $customlang['language'] : ''; ?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="language-help" class="help-block fpbx-help-block"><?php echo _("Language Code (e.g. 'en').")?></span>
								</div>
							</div>
						</div>
						<!--END LANGUAGE-->
						<!--DESCRIPTION-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="description"><?php echo _("Description")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="description" name="description" value="<?php echo !empty($customlang['description']) ? $customlang['description'] : ''; ?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="description-help" class="help-block fpbx-help-block"><?php echo _("A brief description for this Custom Language.")?></span>
								</div>
							</div>
						</div>
						<!--END DESCRIPTION-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="fileupload"><?php echo _("Upload Recording")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="fileupload"></i>
											</div>
											<div class="col-md-9">
												<span class="btn btn-default btn-file">
													<?php echo _("Browse")?><input id="fileupload" type="file" class="form-control" name="files[]" data-url="ajax.php?module=soundlang&amp;command=upload" multiple="">
												</span>
												<span class="filename"></span>
												<strong><?php echo _("Files to upload")?>:</strong> <span id="filecount">0</span>
												<div id="upload-progress" class="progress">
													<div class="progress-bar" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100" style="width: 0%;"></div>
												</div>
												<div id="dropzone">
													<div class="message"><?php echo _("Drop Multiple Files or Archives Here")?></div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="fileupload-help" class="help-block fpbx-help-block"><?php echo sprintf(_("Upload files from your local system. Supported upload formats are: %s. This includes archives (that include multiple files, such as %s) and multiple files"),"<i><strong>".implode(", ",$supported['in'])."</strong></i>","<i><strong>tar,gz,zip</strong></i>")?></span>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="convert"><?php echo _("Convert To")?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="convert"></i>
											</div>
											<div class="col-md-9 text-center">
												<span class="radioset">
													<?php $c=0;foreach($convertto as $k => $v) { ?>
														<?php if(($c % 5) == 0 && $c != 0) { ?></span></br><span class="radioset"><?php } ?>
														<input type="checkbox" id="<?php echo $k?>" name="codec[]" class="codec" value="<?php echo $k?>" <?php echo ($k == 'wav') ? 'CHECKED' : ''?>>
														<label for="<?php echo $k?>"><?php echo $v?></label>
													<?php $c++; } ?>
												</span>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="convert-help" class="help-block fpbx-help-block"><?php echo _("Check all file formats you would like this system recording to be encoded into")?></span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
</div>
<div id="recscreen" class="hidden">
	<div class="holder">
		<label></label>
		<div class="progress">
			<div class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%">
			</div>
		</div>
	</div>
</div>
<script>var supportedRegExp = "<?php echo implode("|",array_keys($supported['in']))?>";</script>
