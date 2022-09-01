<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2006-2014 Schmooze Com Inc.
//
$request = $_REQUEST;
$heading = _("Announcement");
$view = !empty($_GET["view"]) ? $_GET["view"] : '';
$usagehtml = '';
//get unique queues
switch($view){
	case "form":
		if(isset($request['extdisplay'])){
			$heading .= _(": Edit");
			$usagehtml = FreePBX::View()->destinationUsage(announcement_getdest($request['extdisplay']));
		}else{
			$heading .= _(": Add");
		}
		$content = load_view(__DIR__.'/views/form.php', array('request' => $request, 'amp_conf' => $amp_conf));
	break;
	default:
		$content = load_view(__DIR__.'/views/grid.php');
	break;
}

?>
<div class="container-fluid">
	<h1><?php echo $heading ?></h1>
	<?php echo $usagehtml?>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-12">
				<div class="fpbx-container">
					<div class="display <?php echo !empty($view) ? "full" : "no"?>-border">
						<?php echo $content ?>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
