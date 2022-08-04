<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//

$action = isset($_REQUEST['action'])?$_REQUEST['action']:'';
$dispnum = "featurecodeadmin"; //used for switch on config.php

$tabindex = 0;

//if submitting form, update database
switch ($action) {
	case "save":
		if(!empty($_POST['fc'])) {
			\FreePBX::Featurecodeadmin()->update($_POST['fc']);
		}
	break;
}

$featurecodes = featurecodes_getAllFeaturesDetailed();
$exten_conflict_arr = array();
$conflict_url = array();
$exten_arr = array();
foreach ($featurecodes as $result) {
	/* if the feature code starts with "In-Call Asterisk" then it is not conflicting with normal feature codes. This would be featuremap and future
	* application map type codes. This is a real kludge and instead there should be a category associated with these codes when the feature code
	* is created. However, the logic would be the same, thus my willingness to put in such a kludge for now. When the schema changes to add this
	* then this can be updated to reflect that
	*/
	if (($result['featureenabled'] == 1) && ($result['moduleenabled'] == 1) && substr($result['featuredescription'],0,16) != 'In-Call Asterisk') {
		$exten_arr[] = ($result['customcode'] != '')?$result['customcode']:$result['defaultcode'];
	}
}
$usage_arr = framework_check_extension_usage($exten_arr);
unset($usage_arr['featurecodeadmin']);
if (!empty($usage_arr)) {
	$conflict_url = framework_display_extension_usage_alert($usage_arr,false,false);
}
$conflicterror = '';
if (!empty($conflict_url)) {
	$str = _("You have feature code conflicts with extension numbers in other modules. This will result in unexpected and broken behavior.");
	$conflicterror .= "<script>javascript:alert('$str')</script>";
	$conflicterror .= "<div class='alert alert-danger'>"._("Feature Code Conflicts with other Extensions")."</div>";
	$conflicterror .=  implode('<br />',$conflict_url);


	// Create hash of conflicting extensions
	foreach ($usage_arr as $details) {
		foreach (array_keys($details) as $exten_conflict) {
			$exten_conflict_arr[$exten_conflict] = true;
		}
	}
	// Now check for conflicts within featurecodes page
	$unique_exten_arr = array_unique($exten_arr);
	$feature_conflict_arr = array_diff_assoc($exten_arr, $unique_exten_arr);
	foreach ($feature_conflict_arr as $value) {
		$exten_conflict_arr[$value] = true;
	}
}
$currentmodule = "(none)";
$modlines = '';

$modules = array();
foreach($featurecodes as $item) {
	$moduledesc = isset($item['moduledescription']) ? modgettext::_($item['moduledescription'], $item['modulename']) : null;
	// just in case the translator put the translation in featurcodes module:
	if (($moduledesc !== null) && !empty($moduledesc) && ($moduledesc == $item['moduledescription'])) {
		$moduledesc = _($moduledesc);
	}
	$featuredesc = !empty($item['featuredescription']) ? modgettext::_($item['featuredescription'], $item['modulename']) : "";
	// just in case the translator put the translation in featurcodes module:
	if (!empty($item['featuredescription']) && ($featuredesc == $item['featuredescription'])) {
		$featuredesc = _($featuredesc);
	}
	$help = !empty($item['featurehelptext']) ? modgettext::_($item['featurehelptext'], $item['modulename']) : "";
	if (!empty($item['featurehelptext']) && ($help == $item['featurehelptext'])) {
		$help = _($help);
	}
	//TODO: What did we do here before when the module was disabled?
	//bueller, bueller, bueller
	$moduleena = ($item['moduleenabled'] == 1 ? true : false);

	$default = (isset($item['defaultcode']) ? $item['defaultcode'] : '');
	$custom = (isset($item['customcode']) ? $item['customcode'] : '');
	$code = ($custom != '') ? $custom : $default;

	$thismodule = $item['modulename'];
	if($thismodule != $currentmodule){
		$lastmodule = $currentmodule;
		$currentmodule = $thismodule;
		$title = ucfirst($thismodule);
		$modules[$thismodule]['title'] = $title;
	}
	$modules[$thismodule]['items'][] = array(
		'title' => $featuredesc,
		'id' => $item['modulename'] . '_' . $item['featurename'],
		'module' => $item['modulename'],
		'feature' => $item['featurename'],
		'default' => $default,
		'iscustom' => ($custom != ''),
		'code' => $code,
		'isenabled' => ($item['featureenabled'] == 1 ? true : false),
		'custom' => $custom,
		'help' => $help
	);
}
$conf_mode = $freepbx_conf->get_conf_setting('AMPEXTENSIONS');
if($conf_mode == 'extensions'){
	$featurecode_settings = $freepbx_conf->get_conf_setting('EXPOSE_ALL_FEATURE_CODES');
	if(!$featurecode_settings){
		if(isset($modules['core'])){
			$new_items = array();
			foreach($modules['core']['items'] as $tmp_item){
			    	if($tmp_item['id'] == 'core_userlogoff' || $tmp_item['id'] == 'core_userlogon'){
			    		continue;
			    	}else{
			    		$new_items[] = $tmp_item;
			    	}
			}
			$modules['core']['items'] = $new_items;
		}
	}
}

show_view(__DIR__."/views/main.php",array("conflicterror" => $conflicterror, "modules" => $modules, "exten_conflict_arr" => $exten_conflict_arr));
