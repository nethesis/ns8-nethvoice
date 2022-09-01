<?php
$logs = array('1'  => '/var/log/asterisk/full');
$filter = isset($_REQUEST['filter'])?$_REQUEST['filter']:'';
?>
<div class="container-fluid">
	<h1><?php echo _('Asterisk Log Files')?></h1>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-12">
				<div class="fpbx-container">
					<div class="display full-border">
							<!--File-->
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="logfile"><?php echo _("File") ?></label>
												</div>
												<div class="col-md-9">
													<select class="form-control" id="logfile" name="logfile">
														<?php
														foreach ($files as $k => $v) {
															$selected = ($k == $full)?'selected':'';
															echo '<option value='.$k.' '.$selected.'>'.$v.'</option>';
														}
														?>
													</select>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
							<!--END File-->
							<!--Lines-->
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="lines"><?php echo _("Lines") ?></label>
												</div>
												<div class="col-md-9">
													<input type="text" class="form-control" id="lines" name="lines" value="500">
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
							<!--END Lines-->
							<!--Filter-->
							<div class="element-container">
								<div class="row">
									<div class="col-md-12">
										<div class="row">
											<div class="form-group">
												<div class="col-md-3">
													<label class="control-label" for="filter"><?php echo _("Filter") ?></label>
													<i class="fa fa-question-circle fpbx-help-icon" data-for="filter"></i>
												</div>
												<div class="col-md-9">
													<input type="text" class="form-control" id="filter" name="filter" value="<?php echo isset($filter)?$filter:''?>">
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="row">
									<div class="col-md-12">
										<span id="filter-help" class="help-block fpbx-help-block"><?php echo _("Apply PCRE regex filter to the log output. <br/>This filters through the lines specified.")?></span>
									</div>
								</div>
							</div>
							<!--END Filter-->
							<br>
						<button id="show" name="show" class="btn btn-default"><?php echo _("Show")?></button>

					</div>
				</div>
			</div>
		</div>
		<br/>
		<div class="row">
			<div class="col-sm-12">
				<div id="log_view" class="pre">
					<?php echo _("Loading...")?>
				</div>
			</div>
		</div>
	</div>
</div>
<script type="text/javascript" src="modules/logfiles/assets/js/views/logs.js"></script>
