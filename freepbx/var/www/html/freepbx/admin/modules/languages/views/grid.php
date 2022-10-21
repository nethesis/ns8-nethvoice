<?php
//	License for all code of this FreePBX module can be found in the license file inside the module directory
//	Copyright 2015 Sangoma Technologies.
//
$lrows = '';
foreach (languages_list() as $row) {
	$lrows .= '<tr>';
	$lrows .= '<td>';
	$lrows .= $row['description'];
	$lrows .= '</td>';
	$lrows .= '<td>';
	$lrows .= '<a href="?display=languages&view=form&extdisplay='.$row['language_id'].'"><i class="fa fa-edit"></i></a>&nbsp;';
	$lrows .= '<a href="?display=languages&action=delete&language_id='.$row['language_id'].'"><i class="fa fa-trash"></i></a>';
	$lrows .= '</td>';
	$lrows .= '</tr>';
}

?>
<div id="toolbar-all">
	<a href="config.php?display=languages&view=form" class="btn btn-default" ><i class="fa fa-plus"></i>&nbsp; <?php echo _("Add Language") ?></a>
</div>
<table data-toolbar="#toolbar-all" data-maintain-selected="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
	<thead>
		<th data-sortable="true"><?php echo _("Language")?></th>
		<th><?php echo _("Actions")?></th>
	</thead>
	<tbody>
		<?php echo $lrows ?>
	</tbody>
</table>
