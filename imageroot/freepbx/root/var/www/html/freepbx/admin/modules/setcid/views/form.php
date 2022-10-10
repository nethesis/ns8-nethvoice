<?php
$setcid_list = \FreePBX::Setcid()->getAll();
if($setcid_list){
	$setcid_descriptions = array();
        	foreach($setcid_list as $tmp_setcid){
                	if($item['cid_id'] !=  $tmp_setcid['cid_id']){
                        	$setcid_descriptions[] = $tmp_setcid['description'];
                	}
		}
}
?>
<script>
var setcid_descriptions = [];
<?php
if(!empty($setcid_descriptions)){
	echo "setcid_descriptions = " . json_encode($setcid_descriptions) . ";";
}
?>
</script>
<h3>
	<?php echo !empty($item['cid_id']) ? sprintf(_("Edit CID: %s"),$item['cid_id']) : _("Add CID")?>
</h3>
<div class="display full-border">
	<form class="fpbx-submit" name="setcid" action="?display=setcid" method="post" <?php if(isset($item['cid_id'])) {?>data-fpbx-delete="?display=setcid&amp;action=delete&amp;id=<?php echo $item['cid_id']?><?php }?>">
		<input type="hidden" name="id" value="<?php echo isset($item['cid_id']) ? $item['cid_id'] : ""?>">
		<input type="hidden" name="action" value="save">
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="description"><?php echo _('Description')?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="description"></i>
							</div>
							<div class="col-md-9"><input type="text" name="description" class="form-control" id="description" value="<?php echo !empty($item['description']) ? $item['description'] : ""?>" required data-invalid="Description field is required."></div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="description-help" class="help-block fpbx-help-block"><?php echo _('The descriptive name of this CallerID instance. For example "new name here"')?></span>
				</div>
			</div>
		</div>
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="cid_name"><?php echo _('CallerID Name')?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="cid_name"></i>
							</div>
							<div class="col-md-9"><input type="text" name="cid_name" class="form-control" id="cid_name" value="<?php echo !empty($item['cid_name']) ? $item['cid_name'] : ""?>"></div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="cid_name-help" class="help-block fpbx-help-block"><?php echo _('The caller ID name will be changed to this. If you are appending to the current caller ID name, don\'t forget to include the appropriate variables. If you leave this box blank, the caller ID name will be blank. Default caller ID name variable: ${CALLERID(name)}')?></span>
				</div>
			</div>
		</div>
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="cid_num"><?php echo _('CallerID Number')?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="cid_num"></i>
							</div>
							<div class="col-md-9"><input type="text" name="cid_num" class="form-control" id="cid_num" value="<?php echo !empty($item['cid_num']) ? $item['cid_num'] : ""?>"></div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="cid_num-help" class="help-block fpbx-help-block"><?php echo _('Caller ID Number: The caller ID number will be changed to this. If you are appending to the current caller ID number, don\'t forget to include the appropriate variables. If you leave this box blank, the caller ID number will be blank. Default caller ID number variable: ${CALLERID(num)}')?></span>
				</div>
			</div>
		</div>
		<div class="element-container">
			<div class="row">
				<div class="col-md-12">
					<div class="row">
						<div class="form-group">
							<div class="col-md-3">
								<label class="control-label" for="goto0"><?php echo _('Destination')?></label>
								<i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
							</div>
							<div class="col-md-9"><?php echo drawselects((isset($item['dest']) ? $item['dest'] : ""),0)?></div>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<span id="goto0-help" class="help-block fpbx-help-block"><?php echo _('Destination to send the call to after CID has been processed')?></span>
				</div>
			</div>
		</div>
	</form>
</div>
