<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//

$heading = _("Parking Lot");
switch ($_REQUEST['view']) {
	case 'form':
		$content = load_view(__DIR__.'/form.php', array('request' => $_REQUEST));
	break;
	default:
		$pageinfo = '<div class="well well-info">';
		$pageinfo .=  _("This module is used to configure Parking Lot(s)");
		$pageinfo .= _("You can transfer a call to the Parking Lot Extension (70 by default), the call will then be placed into a lot (71-78 by default) and the lot number will be announced to you.");
		$pageinfo .=  _("You can also transfer directly to a lot number (71 through 78) and if that lot is empty, your call will be parked there");
		$pageinfo .= '</div>';
		$content = $pageinfo;
	break;
}
echo '<h1>'.$heading.'</h1>';
echo $content;
?>
