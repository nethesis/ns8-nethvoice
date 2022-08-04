<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
$daynightcodes = daynight_list();
$daynightcodes = $daynightcodes?$daynightcodes:array();
?>
<div id="toolbar-all">
		<a class="btn btn-primary" href="?display=daynight&amp;view=form"><i class="fa fa-plus"></i> <?php echo _("Add")?></a>
</div>
<table id="daynightgrid" data-toolbar="#toolbar-all" data-maintain-selected="true" data-show-columns="true" data-show-toggle="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
<thead>
	<tr>
		<th data-sortable="true"><?php echo _("Feature Code")?></th>
		<th data-sortable="true"><?php echo _("Description")?></th>
		<th data-sortable="true"><?php echo _("State")?></th>
		<th><?php echo _("Actions")?></th>
	</tr>
</thead>
<tbody>
	<?php foreach ($daynightcodes as $row) {
		$fcc = new featurecode('daynight', 'toggle-mode-'.$row['ext']);
		$fc = $fcc->getCode();
		$dnobj = daynight_get_obj($row['ext']);
		?>
		<tr>
			<td><?php echo $fcc->getCode()?></td>
			<td><?php echo $row['dest']?></td>
			<td><span class="label label-<?php echo ($dnobj['state'] == 'DAY') ? "success" : "danger"?>"><?php echo $dnobj['state']?></span></td>
			<td>
				<a href="?display=daynight&amp;view=form&amp;itemid=<?php echo urlencode($row['ext'])?>&amp;extdisplay=<?php echo urlencode($row['ext'])?>"><i class="fa fa-edit"></i></a>
				<a class="deleteitem" href="?display=daynight&amp;itemid=<?php echo urlencode($row['ext'])?>&amp;action=delete"><i class="fa fa-trash"></i><a/>
			</td>
		</tr>
	<?php } ?>
</tbody>
</table>
