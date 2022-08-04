<div class = "display full-border">
	<div class="container-fluid">
		<h1><span><?php echo sprintf(_('%s Group'),$action)?></span></h1>
	</div>
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<div class="display full-border">
					<form action="config.php?display=calendargroups" method="post" class="fpbx-submit" id="cgform" name="cgform" data-fpbx-delete="config.php?display=calendargroups&amp;action=delete&amp;id=<?php echo $id?>">
					<input type="hidden" name='action' value="<?php echo isset($group['id']) ? 'edit' : 'add' ?>">
					<input type="hidden" name='id' value="<?php echo isset($group['id']) ? $group['id'] : '' ?>">
					<!--Description-->
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
											<input type="text" class="form-control" id="description" name="name" value="<?php echo isset($group['name'])?$group['name'] :''?>">
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="name-help" class="help-block fpbx-help-block"><?php echo _("Name of this group")?></span>
							</div>
						</div>
					</div>
					<!--END Description-->
					<!--Calendars-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="calendars"><?php echo _("Calendars") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="calendars"></i>
										</div>
										<div class="col-md-9">
											<select id="calendars" name="calendars[]" class="form-control" multiple="multiple">
												<?php foreach($calendars as $uid => $calendar) {?>
													<option value="<?php echo $uid?>" <?php echo isset($group['calendars']) && in_array($uid,$group['calendars']) ? "selected" : ""?>><?php echo $calendar['name']?></option>
												<?php } ?>
											</select>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="calendars-help" class="help-block fpbx-help-block"><?php echo _("Events to include in to this group")?></span>
							</div>
						</div>
					</div>
					<!--END Calendars-->
					<!--Calendars-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="categories"><?php echo _("Specific Categories") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="categories"></i>
										</div>
										<div class="col-md-9">
											<select id="categories" name="categories[]" class="form-control" multiple="multiple">
											</select>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="categories-help" class="help-block fpbx-help-block"><?php echo _("Select specific cateogories for this group. If no events are selected but categories are selected then all events in said categories will match. Changing categories will change events below")?></span>
							</div>
						</div>
					</div>
					<!--END Calendars-->
					<!--Events-->
					<div class="element-container">
						<div class="row">
							<div class="col-md-12">
								<div class="row">
									<div class="form-group">
										<div class="col-md-3">
											<label class="control-label" for="events"><?php echo _("Specific Events") ?></label>
											<i class="fa fa-question-circle fpbx-help-icon" data-for="events"></i>
										</div>
										<div class="col-md-9">
											<select id="events" name="events[]" class="form-control" multiple="multiple">
											</select>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="row">
							<div class="col-md-12">
								<span id="events-help" class="help-block fpbx-help-block"><?php echo _("Select specific events for this group. If no events are selected but categories are selected then all events in said categories will match")?></span>
							</div>
						</div>
					</div>
					<!--END Events-->
				</div>
			</div>
		</div>
	</div>
</div>
</form>
<script>
	var categories = <?php echo !empty($group['categories']) ? json_encode($group['categories']) : '[]'?>;
	var events = <?php echo !empty($group['events']) ? json_encode($group['events']) : '[]'?>;
	var expand = <?php echo !isset($group['expand']) || $group['expand']  ? 'true' : 'false'?>;
</script>
