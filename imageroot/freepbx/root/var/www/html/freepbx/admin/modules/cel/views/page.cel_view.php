<?php
$get=array('frommonth','fromday','fromyear','tomonth','today','toyear','source','destination','application');
foreach($get as $g){
	$$g=isset($_REQUEST[$g])?trim($_REQUEST[$g]):'';

}
$applications = array(
	'' => '',
	'conference' => _('Conference'),
	'queue' => _('Queue'),
	'voicemail' => _('Voicemail'),
	'voicemailmain' => _('Voicemail Main'),
);
$default = !empty($_REQUEST['application']) ? $_REQUEST['application'] : '';
$approws = '';
foreach ($applications as $key => $value) {
	$approws .= '<option value="'.$key.'" '.($default == $key?"SELECTED":"").'>'.$value.'</option>';
}
?>
<script>var supportedHTML5 = "<?php echo implode(",",FreePBX::Media()->getSupportedHTML5Formats())?>"</script>
<div class="container-fluid">
	<h1><?php echo _("CEL Reports")?></h1>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-12">
				<div class="fpbx-container">

					<div class="modal fade" id="callpreview" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
						<div class="modal-dialog" role="document">
							<div class="modal-content">
								<div class="modal-header">
									<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
									<h4 class="modal-title" id="myModalLabel"><?php echo _("Call Detail")?></h4>
								</div>
								<div class="modal-body">
									<table id="cel-detail-grid"
									data-show-columns="true"
									data-show-toggle="true"
									data-toggle="table"
									data-pagination="true"
									data-search="true"
									data-sort-order="desc"
									data-sort-name="eventtime"
									data-mobile-responsive="true"
									data-check-on-init="true"

									>
									<thead>
										<th data-field="eventtime" data-sortable="true" data-formatter="dateFormatter"><?php echo _("Time")?></th>
										<th data-field="eventtype" data-sortable="true" ><?php echo _("Event Type")?></th>
										<th data-field="uniqueid" data-sortable="true" ><?php echo _("UniqueID")?></th>
										<th data-field="linkedid" data-sortable="true" ><?php echo _("LinkedID")?></th>
										<th data-field="cid_num" data-sortable="true" ><?php echo _("Cid num")?></th>
										<th data-field="exten" data-sortable="true" ><?php echo _("Extension")?></th>
										<th data-field="context" data-sortable="true" ><?php echo _("Context")?></th>
										<th data-field="channame" data-sortable="true"><?php echo _("Channel Name")?></th>
									</thead>
								</table>
							</div>
							<div class="modal-footer">
								<button type="button" class="btn btn-default" data-dismiss="modal"><?php echo _("Close")?></button>
							</div>
						</div>
					</div>
				</div>
				<form action="" method="post" class="fpbx-submit" id="cel" name="cel">
					<!--Date Range-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="drwrap"><?php echo _("Date Range") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="drwrap"></i>
										</div>
										<div class="col-md-9">
											<?php echo _("From")?>:
											<table>
												<tr>
													<td>
														<input type="date" max="<?php echo date('Y-m-d')?>" class="form-control" id="datefrom" name="datefrom" value="<?php echo !empty($_REQUEST['datefrom']) ? $_REQUEST['datefrom'] : date('Y-m-d')?>" placeholder="<?php echo _('From')?>">

													</td>
												</tr>
											</table>
											<?php echo _("To")?>:
											<table>
												<tr>
													<td>
														<input type="date" max="<?php echo date('Y-m-d')?>" class="form-control" id="dateto" name="dateto" value="<?php echo !empty($_REQUEST['dateto']) ? $_REQUEST['dateto'] : date('Y-m-d')?>" placeholder="<?php echo _('To')?>">
													</td>
												</tr>
											</table>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="drwrap-help" class="help-block fpbx-help-block"><?php echo _("Select the date range for the report")?></span>
							</div>
						</div>
					</div>
					<!--END Date Range-->
					<!--Source-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="source"><?php echo _("Source") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="source"></i>
										</div>
										<div class="col-md-9">
											<input type="text" class="form-control" id="source" name="source" value="<?php echo $source ?>">
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="source-help" class="help-block fpbx-help-block"><?php echo _("Filter by Source")?></span>
							</div>
						</div>
					</div>
					<!--END Source-->
					<!--Destination-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="destination"><?php echo _("Destination") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="destination"></i>
										</div>
										<div class="col-md-9">
											<input type="text" class="form-control" id="destination" name="destination" value="<?php echo $destination ?>">
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="destination-help" class="help-block fpbx-help-block"><?php echo _("Filter by destination")?></span>
							</div>
						</div>
					</div>
					<!--END Destination-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="application"><?php echo _("Application") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="application"></i>
										</div>
										<div class="col-md-9">
											<select class="form-control" id="application" name="application">
												<?php echo $approws ?>
											</select>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="application-help" class="help-block fpbx-help-block"><?php echo _("Application executed by a call participant")?></span>
							</div>
						</div>
					</div>
					<!--END Account Code-->
				</form>
				<div class="text-right" style="text-align: right;margin-top:  5px;">
					<button id='refresh' class="btn btn-default"><?php echo _('Refresh')?></button>
				</div>
				<div id="toolbar-detai">
					<h2><?php echo _("Detailed Report")?></h2>
				</div>
				<table class="table table-striped"
				id="report"
				data-sort-name="eventtime"
				data-sort-order="desc"
				data-url="ajax.php?module=cel&command=report"
				data-toolbar="#toolbar-detail"
				data-toggle="table"
				data-pagination="true"
				data-side-pagination="server"
				data-query-params="queryParams"
				data-show-export="true"
				data-page-list="[10, 25, 50, 100, 200, 400, 800, 1600]">
				<thead>
					<tr class="call">
						<th data-field="eventtime" data-sortable="true" data-formatter="dateFormatter"><?php echo _("Date")?></th>
						<th data-field="cid_num" data-sortable="true"><?php echo _("Caller")?></th>
						<th data-field="exten" data-sortable="true"><?php echo _("Dialed")?></th>
						<th data-field="duration" ><?php echo _("Duration")?></th>
						<th data-field="file" data-formatter="playFormatter" class="col-sm-4"><?php echo _("Play") ?></th>
						<th data-field="moreinfo" data-formatter="format"><?php echo _("Details")?></th>
					</tr>
				</thead>
			</table>
		</div>

	</div>
</div>
</div>
</div>
</div>
