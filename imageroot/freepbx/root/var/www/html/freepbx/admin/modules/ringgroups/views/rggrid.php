<div id="toolbar-rg">
	<a href="config.php?display=ringgroups&view=form" class="btn btn-default" ><i class="fa fa-plus"></i>&nbsp; <?php echo _("Add Ring Group") ?></a>
</div>
<table id= "ringgroupgrid"
				data-url="ajax.php?module=ringgroups&command=getJSON&jdata=grid"
        data-cookie="true"
				data-toolbar="#toolbar-rg"
        data-cookie-id-table="ringgroupgrid"
        data-maintain-selected="true"
        data-toggle="table"
        data-pagination="true"
        data-search="true"
        class="table table-striped">
<thead>
	<tr>
		<th data-sortable="true" data-field="grpnum"><?php echo _("Ring Group")?></th>
		<th data-field="description"><?php echo _("Description")?></th>
		<th data-field="grpnum" data-formatter="linkFormatter"><?php echo _("Actions")?></th>
	</tr>
</thead>
</table>
<script type="text/javascript">
function linkFormatter(value, row, index){
    var html = '<a href="?display=ringgroups&view=form&extdisplay=GRP-'+value+'"><i class="fa fa-edit"></i></a>';
    html += '&nbsp;<a href="?display=ringgroups&action=delGRP&account='+value+'" class="delAction"><i class="fa fa-trash"></i></a>';
    return html;
}
</script>
