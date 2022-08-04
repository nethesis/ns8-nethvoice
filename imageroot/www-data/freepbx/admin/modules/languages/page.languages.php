<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }

$helptext = _("Languages allow you to change the language of the call flow and then continue on to the desired destination. For example, you may have an IVR option that says \"For French Press 5 now\". You would then create a French language instance and point it's destination at a French IVR. The language of the call's channel will now be in French. This will result in French sounds being chosen if installed.");
$heading = _("Languages");
$request = $_REQUEST;
$view = isset($request['view'])?$request['view']:'';
switch ($view) {
	case 'form':
		if($request['extdisplay']){
			$heading = _("Edit Language Instance");
		}else{
			$heading = _("Add Language Instance");
		}
		$content = load_view(__DIR__.'/views/form.php', array('request' => $request));
	break;
	default:
		$content = load_view(__DIR__.'/views/grid.php', array('request' => $request));
	break;
}

?>

<div class="container-fluid">
	<h1><?php echo $heading?></h1>
	<?php echo show_help($helptext)?>
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<div class="display <?php echo isset($_REQUEST['view'])?'full':'no'?>-border">
					<?php echo $content ?>
				</div>
			</div>
		</div>
	</div>
</div>
