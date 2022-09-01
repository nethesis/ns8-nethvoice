<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
$fmf = \FreePBX::create()->Findmefollow;
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013-2015 Schmooze Com Inc.
//
$request = $_REQUEST;
$tabindex = 0;
$dispnum = 'findmefollow'; //used for switch on config.php

$heading = _("Follow Me");

$view = isset($request['view']) ? $request['view'] : '';
switch($view){
	case "form":
		$cwidth = "9";
		$bootnav ='
			<div class="col-sm-3 hidden-xs bootnav">
				<div class="list-group">
					'.load_view(__DIR__.'/views/bootnav.php', array('request' => $request)) .'
				</div>
			</div>
		';
		if($request['extdisplay'] != ''){
			$heading .= ": Edit ".ltrim($request['extdisplay'],'GRP-');
			$content = load_view(__DIR__.'/views/form.php', array('request' => $request));
		}else{
			$content = load_view(__DIR__.'/views/nogo.php');
		}
	break;
	default:
		$cwidth = "11";
		$content = load_view(__DIR__.'/views/fmgrid.php');
	break;
}
?>

<div class="container-fluid">
	<h1><?php echo $heading ?></h1>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-12">
				<div class="fpbx-container">
					<div class="display full-border">
						<?php echo $content ?>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
