<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//  License for all code of this FreePBX module can be found in the license file inside the module directory
//  Copyright 2015 Sangoma Technologies.
//

$parking_defaults = array(
	"name" => "Lot Name",
	"type" => "public",
	"parkext" => "",
	"parkpos" => "",
	"numslots" => 4,
	"parkingtime" => 45,
	"parkedmusicclass" => "default",
	"generatehints" => "yes",
	"generatefc" => "yes",
	"findslot" => "first",
	"parkedplay" => "both",
	"parkedcalltransfers" => "caller",
	"parkedcallreparking" => "caller",
	"alertinfo" => "",
	"cidpp" => "",
	"autocidpp" => "",
	"announcement_id" => null,
	"comebacktoorigin" => "yes",
	"dest" => "",
	"rvolume" => ""
);
$all_pl['lots'] = parking_get('all');
$heading = parking_views('header',$all_pl);

switch ($_REQUEST['action']) {
	case 'modify':
	case 'update':
		$data = parking_get($_REQUEST['id'])? parking_get($_REQUEST['id']) : parking_get('default');
		$content = parking_views('lot',$data);
	break;
	case 'add':
		$content = parking_views('lot',$parking_defaults);
	break;
	default:
		$mc = \module_functions::create();
		$o = parking_views($action,$data);
		if(!$o) {
			$m = "paging";
			$d = $mc->getinfo($m);
			$data['modules']['paging'] = $d[$m]['status'] == "2" ? TRUE : FALSE;
			$m = "pagingpro";
			$data['modules']['pagingpro'] = $d[$m]['status'] == "2" ? TRUE : FALSE;
			$m = "parkpro";
			$d = $mc->getinfo($m);
			$data['modules']['parkpro'] = $d[$m]['status'] == "2" ? TRUE : FALSE;
		}
		$content = parking_views('overview',$data);
	break;
}

?>
<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<div class="display no-border">
					<?php echo $heading ?>
					<?php echo $content ?>
				</div>
			</div>
		</div>
	</div>
</div>
