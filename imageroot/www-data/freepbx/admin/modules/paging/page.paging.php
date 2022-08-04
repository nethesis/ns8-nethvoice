<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
$request = $_REQUEST;
$request['view'] = isset($request['view'])?$request['view']:'';
switch ($_GET['view']) {
	case 'form':
		if (isset($request['extdisplay'])) {
			$usage_list = FreePBX::View()->destinationUsage(paging_getdest($request['extdisplay']));
		} else {
			$usage_list = '';
		}
		$content = load_view(__DIR__.'/views/formwrap.php', array('request' => $request, 'amp_conf'=> $amp_conf, 'usage_list' => $usage_list));
	break;
	default:
		$content = load_view(__DIR__.'/views/overview.php', array('request' => $request));
	break;
}


echo $content;
