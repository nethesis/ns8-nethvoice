<?php
$dataurl = "ajax.php?module=vmblast&command=getJSON&jdata=grid";
?>
<div id="toolbar-all">
	<a href="?display=vmblast&view=form" class="btn btn-default"><i class="fa fa-plus"></i>&nbsp;<?php echo _("Add VM Blast Group")?></a>
</div>
<table id="vmblastgrid"
			 data-url="<?php echo $dataurl?>"
			 data-cache="false"
			 data-toolbar="#toolbar-all"
			 data-toggle="table"
			 data-pagination="true"
			 data-search="true"
			 class="table table-striped">
	<thead>
		<tr>
			<th data-field="extension" data-sortable="true"><?php echo _("Group")?></th>
			<th data-field="description" data-sortable="true"><?php echo _("Description")?></th>
			<th data-field="default" data-formatter="defaultFormatter"><?php echo _("Default")?></th>
			<th data-field="extension" data-formatter="linkFormatter"><?php echo _("Actions")?></th>
		</tr>
	</thead>
</table>
<script type="text/javascript">
function linkFormatter(value, row, index){
	var html = '<a href="?display=vmblast&view=form&extdisplay='+value+'"><i class="fa fa-pencil"></i></a>';
	html += '&nbsp;<a href="?display=vmblast&action=delGRP&account='+value+'" class="delAction"><i class="fa fa-trash"></i></a>';
	return html;
}
function defaultFormatter(value, row, index){
	if(value){
		return '<i class="fa fa-check"></i>';
	}
}
</script>
