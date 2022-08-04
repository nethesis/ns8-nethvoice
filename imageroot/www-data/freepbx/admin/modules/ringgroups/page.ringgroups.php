<?php /* $Id$ */
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
$rg = \FreePBX::create()->Ringgroups;

$request = $_REQUEST;
$tabindex = 0;
$dispnum = 'ringgroups'; //used for switch on config.php
$usagehtml = '';

$heading = _("Ring Groups");
$border = 'no';
switch($request['view']){
	case "form":
		$border = 'full';
		if($request['extdisplay'] != ''){
			$heading .= ": Edit ".ltrim($request['extdisplay'],'GRP-');
			$usagehtml = FreePBX::View()->destinationUsage(ringgroups_getdest(ltrim($extdisplay,'GRP-')));
		}else{
			$heading .= ": Add";
		}
		$content = load_view(__DIR__.'/views/form.php', array('request' => $request));
	break;
	default:
		$content = load_view(__DIR__.'/views/rggrid.php');
	break;
}

?>

<div class="container-fluid">
	<h1><?php echo $heading ?></h1>
	<?php echo $usagehtml?>
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<div class="display <?php echo $border?>-border">
					<?php echo $content ?>
				</div>
			</div>
		</div>
	</div>
</div>
