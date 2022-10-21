<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
$fmlist = findmefollow_list();
$fmlist = is_array($fmlist)?$fmlist:array();
$fmrows = '';
foreach($fmlist as $fm){
	$thisg = FreePBX::Findmefollow()->get($fm,1);
	$fmrows .= '<tr>';
	$fmrows .= '<td><a href="?display=findmefollow&view=form&extdisplay=GRP-'.urlencode($fm).'"><i class="fa fa-edit"></i>&nbsp;'.$fm.'</a></td>';
	$fmrows .= '<td>';
	$fmrows .= '<span class="radioset">';
	$fmrows .= '<input type="radio" name="fmtoggle'.$fm.'" id="fmtoggle'.$fm.'yes" data-for="'.$fm.'" '.($thisg['ddial'] == 'CHECKED'?'':'CHECKED').'>';
	$fmrows .= '<label for="fmtoggle'.$fm.'yes">'._("Yes").'</label>';
	$fmrows .= '<input type="radio" name="fmtoggle'.$fm.'" id="fmtoggle'.$fm.'no" data-for="'.$fm.'" '.($thisg['ddial'] == 'CHECKED'?'CHECKED':'' ).' value="CHECKED">';
	$fmrows .= '<label for="fmtoggle'.$fm.'no">'._("No").'</label>';
	$fmrows .= '</span>';
}
?>

<table data-show-columns="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
<thead>
	<tr>
		<th data-sortable="true"><?php echo _("Followme Extension")?></th>
		<th class="col-xs-3"><?php echo _("Enabled")?></th>
	</tr>
</thead>
<tbody>
	<?php echo $fmrows ?>
</tbody>
</table>
