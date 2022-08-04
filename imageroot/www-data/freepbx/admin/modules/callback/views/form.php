<?php
extract($request);
if($itemid){
	$thisItem = callback_get($itemid);
	$deldata = "?display=callback&action=delete&itemid=".$itemid;
}
$callback_list = callback_list();
$callback_names = null;
$tmp_id = '';
if(isset($_REQUEST['itemid'])){
	        $tmp_id = $_REQUEST['itemid'];
}
if(!empty($callback_list)){
	foreach($callback_list as $tmp_item){
		if($tmp_item['callback_id'] != $tmp_id){
			$callback_names[] = $tmp_item['description'];
		}
	}
}
?>
<script>
var callback_names = new Array();
<?php
if(!empty($callback_names)){
	        echo "callback_names = " . json_encode($callback_names) . ";";
}
?>
</script>
<form autocomplete="off" name="edit" id="edit" action="" method="post" class="fpbx-submit" data-fpbx-delete="<?php echo $deldata?>" >
	<input type="hidden" name="display" value="callback">
	<input type="hidden" name="action" value="<?php echo ($itemid ? 'edit' : 'add') ?>">
	<input type="hidden" name="deptname" value="">
	<input type="hidden" name="account" value="<?php echo $itemid; ?>">
	<!--Callback Description-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="description"><?php echo _("Callback Description") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
						</div>
						<div class="col-md-9">
							<input type="text" class="form-control maxlen" id="description" maxlength="50" name="description" value="<?php echo (isset($thisItem['description']) ? $thisItem['description'] : ''); ?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="description-help" class="help-block fpbx-help-block"><?php echo _("Enter a description for this callback.")?></span>
			</div>
		</div>
	</div>
	<!--END Callback Description-->
	<!--Callback Number-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="callbacknum"><?php echo _("Callback Number") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="callbacknum"></i>
						</div>
						<div class="col-md-9">
							<input type="tel" class="form-control" id="callbacknum" name="callbacknum" value="<?php echo (isset($thisItem['callbacknum']) ? $thisItem['callbacknum'] : ''); ?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="callbacknum-help" class="help-block fpbx-help-block"><?php echo _("Optional: Enter the number to dial for the callback.  Leave this blank to just dial the incoming CallerID Number")?></span>
			</div>
		</div>
	</div>
	<!--END Callback Number-->
	<!--Delay Before Callback-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="sleep"><?php echo _("Delay Before Callback") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="sleep"></i>
						</div>
						<div class="col-md-9">
							<div class="input-group">
								<input type="number" min="0" class="form-control" id="sleep" name="sleep" value="<?php echo (isset($thisItem['sleep']) ? $thisItem['sleep'] : ''); ?>">
								<span class="input-group-addon"><?php echo _("Seconds")?></span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="sleep-help" class="help-block fpbx-help-block"><?php echo _("Optional: Enter the number of seconds the system should wait before calling back.")?></span>
			</div>
		</div>
	</div>
	<!--END Delay Before Callback-->
	<!--Caller Id-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="callerid"><?php echo _("Caller Id") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="callerid"></i>
						</div>
						<div class="col-md-9">
							<input type="text" class="form-control" id="callerid" name="callerid" value="<?php echo (isset($thisItem['callerid']) ? htmlspecialchars($thisItem['callerid']) : ''); ?>">
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="callerid-help" class="help-block fpbx-help-block"><?php echo _("Optional: Enter the callerid for the callback.<br>Format: <b>\"caller name\" &lt;#######&gt;</b><br>Default: Callback") ?></span>
			</div>
		</div>
	</div>
	<!--END Caller Id-->
	<!--Timeout-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="timeout"><?php echo _("Timeout") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="timeout"></i>
						</div>
						<div class="col-md-9">
							<div class="input-group">
								<input type="number" min="0" class="form-control" id="timeout" name="timeout" value="<?php echo (isset($thisItem['timeout']) ? $thisItem['timeout'] : ''); ?>">
								<span class="input-group-addon"><?php echo _("Milliseconds")?></span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="timeout-help" class="help-block fpbx-help-block"><?php echo _("Optional: Timeout in Milliseconds.</br>Default: 15000")?></span>
			</div>
		</div>
	</div>
	<!--Timeout-->
	<!--Destination after Callback-->
	<div class="element-container">
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					<div class="form-group">
						<div class="col-md-3">
							<label class="control-label" for="goto0"><?php echo _("Destination after Callback") ?></label>
							<i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
						</div>
						<div class="col-md-9">
							<?php
								//draw goto selects
								if (isset($thisItem)) {
									echo drawselects($thisItem['destination'],0);
								} else {
									echo drawselects(null, 0);
								}
							?>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<span id="goto0-help" class="help-block fpbx-help-block"><?php echo _("Where to send the caller once they are called back")?></span>
			</div>
		</div>
	</div>
	<!--END Destination after Callback-->
</form>
