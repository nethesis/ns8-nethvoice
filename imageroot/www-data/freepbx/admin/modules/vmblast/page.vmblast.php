<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2013 Schmooze Com Inc.
//
$heading = _("Voicemail Blasting");

$request = $_REQUEST;
$tabindex = 0;




switch($request['view']){
	case "form":
		if($request['extdisplay'] != ''){
			$heading .= ": "._("Edit VMBlast Group")." ".ltrim($request['extdisplay'],'GRP-');
		}else{
			$heading .= ": "._("Add VMBlast Group");
		}
		$content = load_view(__DIR__.'/views/form.php', array('request' => $request));
	break;
	default:
		$content = load_view(__DIR__.'/views/grid.php');
	break;
}

		if (!empty($conflict_url)) {
			$conflicthtml = '<div class="well">';
			$conflicthtml .= "<h5>"._("Conflicting Extensions")."</h5>";
			$conflicthtml .= implode('<br .>',$conflict_url);
			$conflicthtml .= '</div>';
		}
?>
<div class="container-fluid">
	<h1><?php echo $heading?></h1>
	<?php echo $conflicthtml ?>
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
<script type="text/javascript" src="modules/vmblast/assets/js/vmblast.js"></script>
