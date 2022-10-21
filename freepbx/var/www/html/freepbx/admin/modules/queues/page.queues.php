<?php /* $Id$ */
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
$request = $_REQUEST;
//used for switch on config.php
$dispnum = 'queues';

$heading = _("Queues");
//get unique queues
$queues = queues_list();
$view = isset($request['view'])?$request["view"]:'';
$usagehtml = '';
switch($view){
	case "form":
		if($request['extdisplay']){
			$heading .= _(" Edit: ");
			$heading .= $request['extdisplay'];
			$usagehtml = FreePBX::View()->destinationUsage(queues_getdest($extdisplay));
		}else{
			$heading .= _(" Add Queue");
		}
		$content = load_view(__DIR__.'/views/form.php', array('request' => $request, 'amp_conf' => $amp_conf));
	break;
	default:
		$content = load_view(__DIR__.'/views/qgrid.php');
	break;

}

?>
<div class="container-fluid">
	<h1><?php echo $heading ?></h1>
	<?php echo $usagehtml?>
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<div class="display no-border">
					<?php echo $content ?>
				</div>
			</div>
		</div>
	</div>
</div>
