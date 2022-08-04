<?php
if(!empty($message)) {
	$messagehtml = '<div class="alert alert-' . $message['type'] .'">'. $message['message'] . '</div>';
}
?>
<div class="container-fluid">
	 <div class="row">
		  <div class="col-sm-12">
				<div class="fpbx-container">
				<h1><?php echo _("Certificate Settings") . ': ' . $cert['basename']?></h1>
				<?php echo !empty($messagehtml) ? $messagehtml : "" ?>
					<form class="fpbx-submit" autocomplete="false" name="frm_certman_edit" action="config.php?display=certman&action=view&id=<?php echo $cert['cid']?>" method="post" data-fpbx-delete="config.php?display=certman&amp;type=cert&amp;action=delete&amp;id=<?php echo $cert['cid']?>" role="form">
					<input id="certtype" type="hidden" name="type" value="update">
					<input id="cid" type="hidden" name="cid" value="<?php echo $cert['cid']?>">
						  <div class="display full-border">
						<!--NAME-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="name"><?php echo _("Name") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="name"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="name" name="name" placeholder="BaseName" value="<?php echo $cert['basename']?>" required pattern="[A-Za-z0-9]{3,100}">
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
						<!--END NAME-->
						<!--Description-->
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="description"><?php echo _("Description") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="description" name="description" value="<?php echo $cert['description']?>" >
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
						  </div>
					 </form>
				</div>
		</div>
	</div>
</div>
