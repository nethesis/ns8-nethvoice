<div id="toolbar-main">
	<a href="?display=callback&view=form" class="btn btn-default"><i class="fa fa-plus"></i>&nbsp;<?php echo _("Add Callback")?></a>
</div>
<table id="callbackgrid"
		data-url="ajax.php?module=callback&command=getJSON&jdata=grid"
		data-toolbar="#toolbar-main"
		data-cache="false"
		data-toggle="table"
		data-search="true"
		data-pagination ="true"
		class="table table-striped">
	<thead>
		<tr>
			<th data-field="description" data-sortable="true"><?php echo _("Item")?></th>
			<th data-field="callbacknum" data-sortable="true"><?php echo _("Callback Number")?></th>
			<th data-field="callback_id" data-formatter="linkFormatter"><?php echo _("Actions")?></th>
		</tr>
	</thead>
</table>
