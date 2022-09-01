<?php
$pageopts = '';
foreach ($paging_groups as $key => $value) {
	$selected = ($key == $paging_group)?'SELECTED':'';
	$pageopts .= '<option value = '.$key.' '.$selected.'>'.$value.'</option>';
}
?>
<!--Notifications-->
<div id="paging" class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="paging_notification"><?php echo _("Paging Notification") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="paging_notification"></i>
					</div>
					<div class="col-md-9">
						<select class="form-control" id="paging_notification" name="paging_notification">
							<?php echo $pageopts?>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="paging_notification-help" class="help-block fpbx-help-block"><?php echo _('This will cause the selected Page Group to be paged and connected to any call that is served by this route. It is recommended not to use a Page Group that uses (Force) Valet Paging(Paging Pro only)')?></span>
		</div>
	</div>
</div>
<!--END Notifications-->
