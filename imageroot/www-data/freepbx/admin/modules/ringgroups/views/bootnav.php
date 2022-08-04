<div id="toolbar-rgnav">
	<a href="config.php?display=ringgroups&view=form" class="btn btn-default" ><i class="fa fa-plus"></i>&nbsp; <?php echo _("Add Ring Group") ?></a>
  <a href="config.php?display=ringgroups" class="btn btn-default" ><i class="fa fa-list"></i>&nbsp; <?php echo _("List Ring Groups") ?></a>
</div>
<table id= "table-all-side"
				data-url="ajax.php?module=ringgroups&command=getJSON&jdata=grid"
				data-toolbar="#toolbar-rgnav"
        data-toggle="table"
        data-search="true"
        class="table">
<thead>
	<tr>
		<th data-sortable="true" data-field="grpnum"><?php echo _("Ring Group")?></th>
		<th data-sortable="true" data-field="description"><?php echo _("Description")?></th>
	</tr>
</thead>
</table>
<script type="text/javascript">
	$("#table-all-side").on('click-row.bs.table',function(e,row,elem){
		window.location = '?display=ringgroups&view=form&extdisplay=GRP-'+row['grpnum'];
	})
</script>
