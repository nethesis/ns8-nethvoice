<?php
if(!empty($message)) {
	$messagehtml = '<div class="alert alert-' . $message['type'] .'">'. $message['message'] . '</div>';
}
?>

<div class="container-fluid">
	<h1><?php echo _('New Certificate Signing Request')?></h1>
	<?php echo !empty($messagehtml) ? $messagehtml : "" ?>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-12">
				<div class="fpbx-container">
					<div class="display full-border" id='certpage'>
						<form class="fpbx-submit" name="frm_certman" action="config.php?display=certman" method="post" enctype="multipart/form-data">
							<input id="certaction" type="hidden" name="certaction" value="add">
							<input id="certtype" type="hidden" name="type" value="csr">
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
													<input type="text" class="form-control" autocomplete="off" name="name" id="name" placeholder="BaseName" data-invalid="<?php echo _('This field cannot be blank and must be alphanumeric')?>" value="<?php echo !empty($cert['basename']) ? $cert['basename'] : ""?>" required pattern="[A-Za-z0-9]{3,100}">
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
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="csrcn"><?php echo _("Common Name (Host Name)")?> (CN)</label>
												</div>
												<div class="col-md-9">
													<input type="text" class="form-control" id="csrcn" name="CN" placeholder="server.example.com" value="<?php echo $hostname?>" required>
												</div>
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
													<label class="control-label" for="csro"><?php echo _("Organization Name")?> (O)</label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="csro"></i>
												</div>
												<div class="col-md-9">
													<input type="text" class="form-control" id="csro" name="O" placeholder="Sangoma Technologies, Inc." required="">
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="csro-help" class="help-block fpbx-help-block"><?php echo sprintf(_("Organization Name such as %s"),"Sangoma Technologies, Inc.")?></span>
									</div>
								</div>
							</div>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="ou"><?php echo _("Organization Unit")?> (OU)</label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="OU"></i>
												</div>
												<div class="col-md-9">
													<input type="text" class="form-control" id="OU" name="OU">
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="OU-help" class="help-block fpbx-help-block"><?php echo _("Organizational Unit. This can be a doing business as (DBA) name, or the name of a department within the business. This may be left blank.")?></span>
									</div>
								</div>
							</div>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="c"><?php echo _("Country")?> (C)</label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="C"></i>
												</div>
												<div class="col-md-9">
													<input type="text" class="form-control" id="C" name="C" placeholder="US" value="US">
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="C-help" class="help-block fpbx-help-block"><?php echo _('Two letter country code, such as "US", "CA", or "AU".')?></span>
									</div>
								</div>
							</div>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="st"><?php echo _("State/Province")?> (ST)</label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="ST"></i>
												</div>
												<div class="col-md-9">
													<input type="text" class="form-control" id="ST" name="ST" placeholder="Wisconsin">
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="ST-help" class="help-block fpbx-help-block" style=""><?php echo _('State or province such as "Queensland" or "Wisconsin" or "Ontario." Do not abbreviate. Enter the full name.')?></span>
									</div>
								</div>
							</div>
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="l"><?php echo _("City or Locality")?> (L)</label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="L"></i>
												</div>
												<div class="col-md-9">
													<input type="text" class="form-control" id="L" name="L" placeholder="Neenah">
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="L-help" class="help-block fpbx-help-block"><?php echo _('City name such as "Toronto" or "Brisbane." Do not abbreviate. For example, enter "Saint Louis" not "St. Louis"')?></span>
									</div>
								</div>
							</div>
						</form>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
