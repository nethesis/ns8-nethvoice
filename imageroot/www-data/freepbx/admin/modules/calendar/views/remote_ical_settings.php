<div class = "display full-border">
	<div class="container-fluid">
		<h1>
			<span><?php echo sprintf(_('%s iCal Calendar'),ucfirst($action)) ?></span>
		</h1>
	</div>
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<div class="display full-border">
					<form class="fpbx-submit calform" method="post" action="?display=calendar" id="icalform" name="icalform" data-fpbx-delete="config.php?display=calendar&amp;id=<?php echo !empty($data['id']) ? $data['id'] : ''?>&amp;action=delete">
					<form class="fpbx-submit calform" method="post" action="?display=calendar" data-fpbx-delete="config.php?display=calendar&amp;id=<?php echo !empty($data['id']) ? $data['id'] : ''?>&amp;action=delete">
						<input type="hidden" name="action" value="<?php echo $action?>">
						<input type="hidden" name="type" value="ical">
						<input type="hidden" name="id" value="<?php echo !empty($data['id']) ? $data['id'] : ''?>">
						<!--Name-->
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
												<input type="text" class="form-control" id="name" name="name" value="<?php echo !empty($data['name']) ? $data['name'] : ''?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="name-help" class="help-block fpbx-help-block"><?php echo _("The name of this calendar")?></span>
								</div>
							</div>
						</div>
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
												<input type="text" class="form-control" id="description" name="description" value="<?php echo !empty($data['description']) ? $data['description'] : ''?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="description-help" class="help-block fpbx-help-block"><?php echo _("The description of this calendar")?></span>
								</div>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="url"><?php echo _("Remote URL") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="url"></i>
											</div>
											<div class="col-md-9">
												<input type="text" class="form-control" id="url" name="url" value="<?php echo !empty($data['url']) ? $data['url'] : ''?>">
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="url-help" class="help-block fpbx-help-block"><?php echo _("The remote url for this calendar")?></span>
								</div>
							</div>
						</div>
						<div class="element-container">
							<div class="row">
								<div class="col-md-12">
									<div class="row">
										<div class="form-group">
											<div class="col-md-3">
												<label class="control-label" for="next"><?php echo _("Auto Refresh") ?></label>
												<i class="fa fa-question-circle fpbx-help-icon" data-for="next"></i>
											</div>
											<div class="col-md-9">
												<select id="next" class="form-control" name="next">
													<option value="60" <?php echo $data['next'] == 60 ? 'selected' : '' ?>><?php echo _("1 Minute")?></option>
													<option value="300" <?php echo $data['next'] == 300 ? 'selected' : '' ?>><?php echo _("5 Minutes")?></option>
													<option value="600" <?php echo $data['next'] == 600 ? 'selected' : '' ?>><?php echo _("10 Minutes")?></option>
													<option value="1800" <?php echo $data['next'] == 1800 ? 'selected' : '' ?>><?php echo _("30 Minutes")?></option>
													<option value="3600" <?php echo $data['next'] == 3600 ? 'selected' : '' ?>><?php echo _("1 Hour")?></option>
													<option value="7200" <?php echo $data['next'] == 7200 ? 'selected' : '' ?>><?php echo _("2 Hours")?></option>
													<option value="21600" <?php echo $data['next'] == 216000 ? 'selected' : '' ?>><?php echo _("6 Hours")?></option>
													<option value="43200" <?php echo $data['next'] == 43200 ? 'selected' : '' ?>><?php echo _("12 Hours")?></option>
													<option value="86400" <?php echo $data['next'] == 86400 ? 'selected' : '' ?>><?php echo _("1 Day")?></option>
													<option value="604800" <?php echo $data['next'] == 604800 ? 'selected' : '' ?>><?php echo _("1 Week")?></option>
												</select>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<span id="next-help" class="help-block fpbx-help-block"><?php echo _("How often this calendar will synchronize with the remote server")?></span>
								</div>
							</div>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
</div>
