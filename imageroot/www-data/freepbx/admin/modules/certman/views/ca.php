<?php
if($caExists){
	$cafclass = 'hidden';
	$caehtml = '<div class ="well" id="caexists">';
	$caehtml .= _('A Certificate Authority is already present on this system. Deleting/Generating/Uploading will invalidate all of your current certificates!');
	$caehtml .= '<br/><br/>';
	$caehtml .= '<button class="btn btn-danger" id="replaceCA">'._("I Know what I am doing").'</button>';
	$caehtml .= '</div>';
}

?>
<div class="fpbx-container">
	<h2><?php echo $caExists ? _("Edit Certificate Authority Settings") : _("New Certificate Authority Settings")?></h2>
	<?php echo !empty($caehtml) ? $caehtml : "" ?>
	<div id = "caform" class="<?php echo !empty($cafclass) ? $cafclass : ""?>">
		<form autocomplete="off" class="fpbx-submit" name="editCAS" method="post" action="config.php?display=certman" data-fpbx-delete="config.php?display=certman&amp;action=ca&amp;type=delete" enctype="multipart/form-data">
		<input id="catype" type="hidden" name="type" value="generate">
		<input id="action" type="hidden" name="action" value="ca">
		<input id="replace" type="hidden" name="replace" value="no">
		<!--Hostname-->

		<!--END Hostname-->
		<!--Orgname-->

		<!--END Orgname-->
		<!--Passphrase-->

		<!--END Passphrase-->
		<!--Save Passphrase-->

		<!--END Save Passphrase-->
		<!--Enable Upload-->
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
							</div>
							<div class="col-md-9 radioset">
								<input type="checkbox" id="enableul">
								<label class="control-label" for="enableul"><?php echo _("Upload CA")?></label>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="enableul-help" class="help-block fpbx-help-block"><?php echo _("Select this for additional fields used to upload your own certificate.")?></span>
				</div>
			</div>
		</div>
		<!--End Enable Upload-->
		<!--Private key-->
		<div class="element-container hidden" id='pkdiv'>
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="privatekey"><?php echo _("Private Key") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="privatekey"></i>
							</div>
							<div class="col-md-9">
								<span class="btn btn-default btn-file">
									Browse <input type="file" class="form-control" name="privatekey" id="privatekey">
								</span>
								<span class="filename"></span>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="privatekey-help" class="help-block fpbx-help-block"><?php echo _("Private Key File to use for this CA")?></span>
				</div>
			</div>
		</div>
		<!--END Privatekey-->
		<!--Certificate-->
		<div class="element-container hidden" id='cdiv'>
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="certificate"><?php echo _("Certificate") ?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="certificate"></i>
							</div>
							<div class="col-md-9">
								<span class="btn btn-default btn-file">
									Browse <input type="file" class="form-control" name="certificate" id="certificate">
								</span>
								<span class="filename"></span>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="certificate-help" class="help-block fpbx-help-block"><?php echo _("Certificate to use for this CA (must reference the Private Key)")?></span>
				</div>
			</div>
		</div>
		<!--END Certificate-->

		</form>
	</div>
</div>
