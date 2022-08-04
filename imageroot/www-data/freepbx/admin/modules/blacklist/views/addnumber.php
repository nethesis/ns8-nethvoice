<!--Add number Modal -->
<div class="modal fade" id="addNumber" tabindex="-1" role="dialog" aria-labelledby="addNumber" aria-hidden="true">
    <div class="modal-dialog display">
		<div class="modal-content">
			<div class="modal-header">
				<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
				<h4 class="modal-title" id="addNumber"><?php echo _("Add or replace entry") ?></h4>
			</div>
			<div class="modal-body">
				<input type="hidden" id="oldval" value=""/>
				<!--Number-->
				<div class="element-container">
					<div class="row">
						<div class="col-md-12">
							<div class="row">
								<div class="form-group">
									<div class="col-md-3">
										<label class="control-label" for="number"><?php echo _("Number/CallerID")?></label>
									</div>
									<div class="col-md-9">
										<input type="tel" class="form-control" id="number" name="number" value="" required>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-md-12">
						</div>
					</div>
				</div>
				<!--END Number-->
				<!--Description-->
				<div class="element-container">
					<div class="row">
						<div class="col-md-12">
							<div class="row">
								<div class="form-group">
									<div class="col-md-3">
										<label class="control-label" for="description"><?php echo _("Description")?></label>
									</div>
									<div class="col-md-9">
										<input type="text" class="form-control" id="description" name="description" value="">
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-md-12">
						</div>
					</div>
				</div>
				<!--END Description-->
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-default" data-dismiss="modal"><?php echo _("Close")?></button>
				<button type="button" class="btn btn-primary" id="submitnumber"><?php echo _("Save changes")?></button>
			</div>
		</div>
	</div>
</div>
<!--report Modal -->
<div class="modal fade" id="numreport" tabindex="-1" role="dialog" aria-labelledby="numreport" aria-hidden="true">
    <div class="modal-dialog display">
		<div class="modal-content">
			<div class="modal-header">
				<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
				<h4 class="modal-title" id="addNumber"><?php echo _("Call Log") ?></h4>
			</div>
			<div class="modal-body">
        <table id="blReport">
          <thead>
            <tr>
              <th data-field="calldate"><?php echo _("Call Date/Time")?></th>
            </tr>
          </thead>
        </table>
			</div>
		</div>
	</div>
</div>
