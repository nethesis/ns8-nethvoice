<?php /* $Id */
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
$dispnum = "timeconditions"; //used for switch on config.php
$heading = _("Time Conditions");
$request = $_REQUEST;
$display_mode = "advanced";
$mode = \FreePBX::Config()->get("FPBXOPMODE");
if(!empty($mode)) {
	$display_mode = $mode;
}
$usagehtml = '';

switch ($request['view']) {
	case 'form':
		if (isset($request['itemid'])) {
			$usagehtml = FreePBX::View()->destinationUsage(timeconditions_getdest($request['itemid']));
		}
		if($display_mode == "basic") {
			$content = load_view(__DIR__.'/views/timeconditions/basic_form.php', array('request' => $request));
		} else {
			$content = load_view(__DIR__.'/views/timeconditions/advanced_form.php', array('request' => $request));
		}
	break;
	default:
		$content = load_view(__DIR__.'/views/timeconditions/grid.php', array('request' => $request));
	break;
}

?>
<div class="container-fluid">
	<h1><?php echo $heading?></h1>
	<?php echo $usagehtml?>
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
