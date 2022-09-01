<?php /* $Id */
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
$dispnum = "timegroups"; //used for switch on config.php
$heading = _("Time Groups");
$request = $_REQUEST;
switch ($request['view']) {
	case 'form':
		$content = load_view(__DIR__.'/views/timegroups/form.php', array('request' => $request));
	break;
	default:
		$content = load_view(__DIR__.'/views/timegroups/grid.php', array('request' => $request));
	break;
}

?>
<div class="container-fluid">
	<h1><?php echo $heading?></h1>
	<?php
	$errormsg = \FreePBX::Timeconditions()->errormsg;
	if(!empty($errormsg)){
		echo '<div class="alert alert-danger">'.$errormsg.'</div>';
		\FreePBX::Timeconditions()->errormsg = '';
	}
	?>
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
