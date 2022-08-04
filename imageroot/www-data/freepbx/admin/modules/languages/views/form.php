<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
extract($request);
if ($extdisplay) {
	// load
	$row = FreePBX::Languages()->getLanguage($extdisplay);
	$description = $row['description'];
	$lang_code   = $row['lang_code'];
	$dest        = $row['dest'];
	$deleteurl = '?display=languages&action=delete&language_id='.$row['language_id'];
	$subhead = "<h2>"._("Edit: ")."$description ($lang_code)"."</h2>";
	$usage_list = framework_display_destination_usage(languages_getdest($extdisplay));
	if (!empty($usage_list)) {
		$inusehtml = '<div class="well">';
		$inusehtml .= '<h3>'.$usage_list['text'].'</h3>';
		$inusehtml .= '<p>'.$usage_list['tooltip'].'</p>';
		$inusehtml .= '</div>';
	}
} else {
	if (FreePBX::Modules()->moduleHasMethod('Soundlang', 'getLanguage')) {
		$lang_code = FreePBX::Soundlang()->getLanguage();
	}
}

?>

<?php
$langList = FreePBX::Languages()->listLanguages();
if($langList){
        $langDesc = array();
        foreach($langList as $tmp_langList){
                if($extdisplay !=  $tmp_langList['language_id']){
                        $langDesc[] = $tmp_langList['description'];
                }
        }
}
?>
<script>
var description = [];
<?php
if(!empty($langDesc)){
	                echo "description = " . json_encode($langDesc) . ";";
}
?>
</script>

<?php echo $subhead ?>
<?php echo $inusehtml ?>
<br>
<form name="editLanguage" action="config.php?display=languages" class="fpbx-submit" method="post" onsubmit="return checkLanguage(editLanguage);" data-fpbx-delete="<?php echo $deleteurl?>">
	<input type="hidden" name="extdisplay" value="<?php echo $extdisplay; ?>">
	<input type="hidden" name="language_id" value="<?php echo $extdisplay; ?>">
	<input type="hidden" name="action" value="<?php echo ($extdisplay ? 'edit' : 'add'); ?>">
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
						<input type="text" class="form-control" id="description" name="description" value="<?php  echo $description; ?>">
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="description-help" class="help-block fpbx-help-block"><?php echo _("The descriptive name of this language instance. For example \"French Main IVR\"")?></span>
		</div>
	</div>
</div>
<!--END Description-->
<!--Language Code-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="lang_code"><?php echo _("Language Code") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="lang_code"></i>
					</div>
					<div class="col-md-9">
<?php
					if (FreePBX::Modules()->moduleHasMethod('Soundlang', 'getLanguages')) {
						$languages = FreePBX::Soundlang()->getLanguages();
?>
						<select class="form-control" id="lang_code" name="lang_code">
<?php
						foreach ($languages as $key => $val) {
?>
							<option value="<?php echo $key;?>" <?php echo $key == $lang_code ? "selected" : ""?>><?php echo $val;?></option>
<?php
						}
?>
						</select>
<?php
					} else {
?>
						<input type="text" class="form-control" id="lang_code" name="lang_code" value="<?php echo $lang_code; ?>">
<?php
					}
?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="lang_code-help" class="help-block fpbx-help-block"><?php echo _("The Asterisk language code you want to change to. For example \"fr\" for French, \"de\" for German")?></span>
		</div>
	</div>
</div>
<!--END Language Code-->
<!--Destination-->
<div class="element-container">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
				<div class="form-group">
					<div class="col-md-3">
						<label class="control-label" for="goto0"><?php echo _("Destination") ?></label>
						<i class="fa fa-question-circle fpbx-help-icon" data-for="goto0"></i>
					</div>
					<div class="col-md-9">
						<?php echo drawselects($dest,0) ?>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-md-12">
			<span id="goto0-help" class="help-block fpbx-help-block"><?php echo _("Where to send the caller after setting the language.")?></span>
		</div>
	</div>
</div>
<!--END Destination-->
</form>
