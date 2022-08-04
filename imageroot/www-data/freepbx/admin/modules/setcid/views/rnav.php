<div id="toolbar-scid">
	<a href="?display=setcid&amp;view=form" class="btn btn-primary"><i class="fa fa-plus"></i> <?php echo _('Add')?></a>
	<a href="?display=setcid" class="btn btn-primary"><i class="fa fa-list"></i> <?php echo _('List SetCID')?></a>
</div>
<table id="scidrnav"
		data-url="ajax.php?module=setcid&amp;command=getable"
		data-cache="false"
		data-toolbar="#toolbar-scid"
		data-toggle="table"
		data-search="true" 
		class="table">
	<thead>
		<tr>
			<th data-field="description"><?php echo _("SetCID")?></th>
		</tr>
	</thead>
</table>
<script type="text/javascript">
	$("#scidrnav").on('click-row.bs.table',function(e,row,elem){
		window.location = '?display=setcid&view=form&id='+row['cid_id'];
	})
</script>
