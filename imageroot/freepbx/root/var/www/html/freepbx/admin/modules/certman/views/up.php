<?php
if(!empty($message)) {
	$messagehtml = '<div class="alert alert-' . $message['type'] .'">'. $message['message'] . '</div>';
}
?>

<div class="container-fluid">
	<h1><?php echo !empty($cert['cid']) ? _("Update Existing Certificate") : _("Add New Certificate")?></h1>
	<?php echo !empty($messagehtml) ? $messagehtml : "" ?>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-12">
				<div class="fpbx-container">
					<div class="display full-border" id='certpage'>
						<form class="fpbx-submit" name="frm_certman" action="config.php?display=certman" method="post" enctype="multipart/form-data"  data-fpbx-delete="config.php?display=certman&amp;type=cert&amp;certaction=delete&amp;id=<?php echo $cert['cid']?>">
							<input id="certaction" type="hidden" name="certaction" value="<?php echo !empty($cert['cid']) ? 'edit' : 'add'?>">
							<input id="certtype" type="hidden" name="type" value="up">
							<input id="cid" type="hidden" name="cid" value="<?php echo !empty($cert['cid']) ? $cert['cid'] : ''?>">
							<!--Name-->
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="name"><?php echo _("Name")?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="name"></i>
												</div>
												<div class="col-md-9">
													<?php if (empty($cert['cid'])) { ?>
														<input type="text" class="form-control" autocomplete="off" name="name" id="name" placeholder="BaseName" data-invalid="<?php echo _('This field cannot be blank and must be alphanumeric')?>" value="<?php echo !empty($cert['basename']) ? $cert['basename'] : ""?>" required pattern="[A-Za-z0-9]{3,100}">
													<?php } else { ?>
														<?php echo !empty($cert['basename']) ? $cert['basename'] : ""?>
													<?php } ?>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="name-help" class="help-block fpbx-help-block"><?php echo _("The base name of the certificate, Can only contain alphanumeric characters")?></span>
									</div>
								</div>
							</div>
							<!--END Name-->
							<?php if(!empty($cert['cid'])) { ?>
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="expires"><?php echo _("Valid Until")?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="expires"></i>
													</div>
													<div class="col-md-9"><?php echo \FreePBX::Certman()->getReadableExpiration($certinfo['validTo_time_t']); ?></div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="expires-help" class="help-block fpbx-help-block" style=""><?php echo _('How long the certificate is valid until')?></span>
										</div>
									</div>
								</div>
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="cn"><?php echo _("Common Name")?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="cn"></i>
													</div>
													<div class="col-md-9">
														<?php echo $certinfo['subject']['CN']?>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="cn-help" class="help-block fpbx-help-block" style=""><?php echo _('The certificate common name, usually the same as the host name')?></span>
										</div>
									</div>
								</div>
								<?php if(!empty($certinfo['extensions']['certificatePolicies'])) {?>
									<div class="element-container">
										<div class="row">
											<div class="col-md-12">
												<div class="row">
													<div class="form-group">
														<div class="col-md-3">
															<label class="control-label" for="cp"><?php echo _("Certificate Policies")?></label>
															<i class="fa fa-question-circle fpbx-help-icon" data-for="cp"></i>
														</div>
														<div class="col-md-9">
															<textarea class="form-control" readonly><?php echo $certinfo['extensions']['certificatePolicies']?></textarea>
														</div>
													</div>
												</div>
											</div>
										</div>
										<div class="row">
											<div class="col-md-12">
												<span id="cp-help" class="help-block fpbx-help-block" style=""><?php echo _('TThe certificate policies')?></span>
											</div>
										</div>
									</div>
								<?php } ?>
							<?php } ?>
							<!--Description-->
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
													<input type="text" class="form-control" autocomplete="off" name="description" id="description" value="<?php echo !empty($cert['description']) ? $cert['description'] : ""?>">
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="description-help" class="help-block fpbx-help-block"><?php echo _("The Description of this certificate. Used in the module only")?></span>
									</div>
								</div>
							</div>
							<!--END Description-->
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="passphrase"><?php echo _("Passphrase")?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="passphrase"></i>
												</div>
												<div class="col-md-9">
													<input type="password" class="form-control" autocomplete="off" name="passphrase" id="passphrase">
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="passphrase-help" class="help-block fpbx-help-block"><?php echo _("The Passphrase of the Private Key. This will be used to decrypt the private key and the certificate. They will be stored unpassworded on the system to prevent service disruptions.")?></span>
									</div>
								</div>
							</div>
							<!--Description-->
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="csrref"><?php echo _("CSR Reference")?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="csrref"></i>
												</div>
												<div class="col-md-9">
													<select class="form-control" id="csrref" name="csrref">
														<option value=""><?php echo _('None')?></option>
														<?php foreach($csrs as $c) {?>
															<option value="<?php echo $c['cid']?>"><?php echo $c['basename']?></option>
														<?php } ?>
													</select>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="csrref-help" class="help-block fpbx-help-block"><?php echo _("Certificate Signing Request to reference. Select 'None' to upload your own private key.")?></span>
									</div>
								</div>
							</div>
							<!--END Description-->
							<div id="privatekey-container">
								<div class="panel panel-default">
									<div class="panel-heading">
										<h3 class="panel-title"><?php echo _("Private Key")?></h3>
									</div>
									<div class="panel-body">
										<p><?php echo _("If you have a separate private key paste it here.")?></p>
										<textarea class="form-control" rows="5" name="privatekey" placeholder="<?php echo !empty($cert['cid']) ? _("Not Shown for your security. Paste a new key here") : _("Paste new key here")?>"></textarea>
									</div>
								</div>
							</div>
							<div class="panel panel-default">
								<div class="panel-heading">
									<h3 class="panel-title"><?php echo _("Certificate")?></h3>
								</div>
								<div class="panel-body">
									<p><?php echo _("After you have submitted a CSR to a CA, they will sign it, after validation, and return a Signed Certificate. That certificate should be pasted in the box below. If you leave this box blank, the certificate will not be updated.")?></p>
									<textarea class="form-control" rows="5" name="signedcert" placeholder="<?php echo !empty($cert['cid']) ? _("Not Shown for your security. Paste a new certificate here") : _("Paste new certificate here")?>"></textarea>
								</div>
							</div>
							<div class="panel panel-default">
								<div class="panel-heading">
									<h3 class="panel-title"><?php echo _("Trusted Chain")?></h3>
								</div>
								<div class="panel-body">
									<p><?php echo _("Your CA may also require a Trusted Chain to be installed. This will be provided by the CA, and will consist of one, or multiple, certificate files.   Paste the contents of all the Chain files, if any, into the box below. This may be left blank, or updated at any time. They can be added in any order.")?></p>
									<textarea class="form-control" rows="5" name="certchain" placeholder="<?php echo !empty($cert['cid']) ? _("Not Shown for your security. Paste a new certificate here") : _("Paste new certificate here")?>"></textarea>
								</div>
							</div>
						</form>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
