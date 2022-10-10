<div id="toolbar-all">
	<a href="?display=miscapps&amp;action=add" class="btn btn-primary"><i class="fa fa-plus"></i> <?php echo _("Add Misc Application")?></a>
</div>
<table id="wcbgrid" data-url="ajax.php?module=miscapps&amp;command=rnav" data-cache="false" data-toolbar="#toolbar-all" data-maintain-selected="true" data-show-columns="true" data-show-toggle="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
	<thead>
		<tr>
			<th data-sortable="true" data-field="description"><?php echo _('Description')?></th>
			<th data-sortable="true" data-field="ext"><?php echo _('Extension')?></th>
			<th data-field="actions" class="col-xs-2"><?php echo _("Actions")?></th>
		</tr>
	</thead>
</table>
