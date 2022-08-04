
<div id="toolbar-cbbnav">
  <a href="?display=callback" class="btn btn-default"><i class="fa fa-list"></i>&nbsp;<?php echo _("List Callbacks")?></a>
  <a href="?display=callback&view=form" class="btn btn-default"><i class="fa fa-plus"></i>&nbsp;<?php echo _("Add Callback")?></a>
</div>
<table id="callbackgridrnav"
		data-url="ajax.php?module=callback&command=getJSON&jdata=grid"
		data-toolbar="#toolbar-cbbnav"
		data-cache="false"
		data-toggle="table"
		data-search="true"
		class="table">
	<thead>
		<tr>
			<th data-field="description"><?php echo _("Callback")?></th>
		</tr>
	</thead>
</table>

<script type="text/javascript">
	$("#callbackgridrnav").on('click-row.bs.table',function(e,row,elem){
		window.location = '?display=callback&view=form&itemid='+row['callback_id'];
	})
</script>
