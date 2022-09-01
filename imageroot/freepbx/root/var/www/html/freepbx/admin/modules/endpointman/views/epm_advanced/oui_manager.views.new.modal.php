<div class="modal fade" id="AddDlgModal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
	<div class="modal-dialog" role="document">
		<div class="modal-content">
			<div class="modal-header">
				<h4 class="modal-title">New OUI Custom</h4>
			</div>
			<div class="modal-body">
				<div class="element-container">
					<div class="row">
						<div class="col-md-12">
							<div class="row">
								<div class="form-group">
									<div class="col-md-3">
										<label class="control-label" for="number_new_oui"><?php echo _("OUI")?></label>
										<i class="fa fa-question-circle fpbx-help-icon" data-for="number_new_oui"></i>
									</div>
									<div class="col-md-9">
										<input type="text" maxlength="6" class="form-control" id="number_new_oui" name="number_new_oui" value="" placeholder="<?php echo _("OUI Brand")?>">
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-md-12">
							<span class="help-block fpbx-help-block" id="number_new_oui-help"><?php echo _("They are the first 6 characters of the MAC device that identifies the brand (manufacturer).")?></span>
						</div>
					</div>
				</div>
				<div class="element-container">
					<div class="row">
						<div class="col-md-12">
							<div class="row">
								<div class="form-group">
									<div class="col-md-3">
										<label class="control-label" for="brand_new_oui"><?php echo _("Brand")?></label>
										<i class="fa fa-question-circle fpbx-help-icon" data-for="brand_new_oui"></i>
									</div>
									<div class="col-md-9">
			      						<select class="form-control selectpicker show-tick" data-style="btn-info" data-live-search-placeholder="Search" data-size="10" data-live-search="true" id="brand_new_oui" name="brand_new_oui">
			      							<option value=""><?php echo _("Select Brand:")?></option>
											<?php
											foreach ($brands as $row) {
												echo '<option value="'.$row['id'].'">'.$row['name'].'</option>';
											}
											?>
										</select>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-md-12">
							<span class="help-block fpbx-help-block" id="brand_new_oui-help"><?php echo _("It is the brand of OUI we specified.")?></span>
						</div>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-danger" data-dismiss="modal"><i class='fa fa-times'></i> <?php echo _("Cancel")?></button>
				<button type="button" class="btn btn-primary" id="AddDlgModal_bt_new"><i class='fa fa-check'></i> <?php echo _("Add New")?></button>
			</div>
		</div><!-- /.modal-content -->
	</div><!-- /.modal-dialog -->
</div><!-- /.modal -->