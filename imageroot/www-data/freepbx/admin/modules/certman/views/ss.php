<?php
if(!empty($message)) {
	$messagehtml = '<div class="alert alert-' . $message['type'] .'">'. $message['message'] . '</div>';
}
//ca input
if(count($cas) == 1){
	$cainput = '<b>' . $cas[0]['on'] . '</b>';
	$cainput .= '<input type="hidden" name="ca" id="ca" value="' . $cas[0]['uid'] . '" data-requirespassphrase="'. $rpf . '" >';
}else{
	$cainput = '<select name="ca" id="ca" class="form-control">';
	foreach($cas as $ca) {
		$rpf = !empty($ca['passphrase']) && $ca['passphrase'] == 'yes' && !empty($ca['salt']) ? 'no' : 'yes';
		$cainput .= '<option data-requirespassphrase="'. $rpf . '" value="'. $ca['uid'].'">' . $ca['on'] .'</option>';
	}
	$cainput .= '</select>';
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
						<form class="fpbx-submit" name="frm_certman" action="config.php?display=certman" method="post" enctype="multipart/form-data" data-fpbx-delete="config.php?display=certman&amp;type=cert&amp;certaction=delete&amp;id=<?php echo $cert['cid']?>">
							<input id="certaction" type="hidden" name="certaction" value="<?php echo !empty($cert['cid']) ? 'edit' : 'add'?>">
							<input id="certtype" type="hidden" name="type" value="ss">
							<input id="cid" type="hidden" name="cid" value="<?php echo !empty($cert['cid']) ? $cert['cid'] : ''?>">
							<input id="caid" type="hidden" name="caid" value="<?php echo !empty($cas[0]['uid']) ? $cas[0]['uid'] : ""?>">
							<?php if(!empty($cert['cid'])) { ?>
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="cn"><?php echo _("Host Name")?></label>
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
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="expires"><?php echo _("Valid Until")?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="expires"></i>
													</div>
													<div class="col-md-9">
														<?php echo is_numeric($certinfo['validTo_time_t']) ? date('m/d/Y',$certinfo['validTo_time_t']) : _("N/A")?>
													</div>
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
							<?php } else { ?>
								<!--Name-->
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="hostname"><?php echo  _("Host Name") ?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="hostname"></i>
													</div>
													<div class="col-md-9">
														<input type="text" class="form-control" id="hostname" name="hostname" placeholder="<?php echo $hostname ?>" value="<?php echo $hostname?>" required>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="hostname-help" class="help-block fpbx-help-block"><?php echo _("DNS name or your IP address")?></span>
										</div>
									</div>
								</div>
								<!--END Name-->
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
							<?php if($caExists) { ?>
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="ca"><?php echo _("Certificate Authority")?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="ca"></i>
													</div>
													<div class="col-md-9">
														<b><?php echo $cas[0]['on']?></b> <a href="?display=certman&amp;certaction=delete&amp;type=ca" id="delCA"><i class="fa fa-trash-o"></i></a>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="ca-help" class="help-block fpbx-help-block"><?php echo _("Certificate Authority to Reference")?></span>
										</div>
									</div>
								</div>
							<?php } else { ?>
								<div class="element-container">
									<div class="row">
										<div class="col-md-12">
											<div class="row">
												<div class="form-group">
													<div class="col-md-3">
														<label class="control-label" for="orgname"><?php echo  _("Organization Name") ?></label>
														<i class="fa fa-question-circle fpbx-help-icon" data-for="orgname"></i>
													</div>
													<div class="col-md-9">
														<input type="text" class="form-control" id="orgname" name="orgname" placeholder="My Super Organization" value="" required>
													</div>
												</div>
											</div>
										</div>
									</div>
									<div class="row">
										<div class="col-md-12">
											<span id="orgname-help" class="help-block fpbx-help-block"><?php echo  _("The Organization Name")?></span>
										</div>
									</div>
								</div>
								<!-- old remove later -->
								<input type="hidden" class="form-control" id="passphrase" name="passphrase" value="<?php echo !empty($cert['cid']) ? '' : $pass?>">
								<input type="hidden" name="savepassphrase" value="no" id="phsaveno">
							<?php } ?>
						</form>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
