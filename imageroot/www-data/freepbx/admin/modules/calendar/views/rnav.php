<div id="toolbar-nav">
	<a href="?display=calendar" class="btn btn-default"><i class="fa fa-list"></i> <?php echo _("List Calendars")?></a>
	<div class="dropdown">
		<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-expanded="false">
			<i class="fa fa-plus">&nbsp;</i><?php echo _("Add Calendar")?> <span class="caret"></span>
		</button>
		<ul class="dropdown-menu" role="menu">
			<li><a href="?display=calendar&amp;action=add&amp;type=local"><i class="fa fa-plus"></i> <strong><?php echo _('Add New Local Calendar')?></strong></a></li>
			<li><a href="?display=calendar&amp;action=add&amp;type=ical"><i class="fa fa-plus"></i> <strong><?php echo _('Add Remote iCal Calendar')?></strong></a></li>
			<li><a href="?display=calendar&amp;action=add&amp;type=caldav"><i class="fa fa-plus"></i> <strong><?php echo _('Add Remote CalDAV Calendar')?></strong></a></li>
			<li><a href="?display=calendar&amp;action=add&amp;type=ews"><i class="fa fa-plus"></i> <strong><?php echo _('Add Remote Outlook Calendar')?></strong></a></li>
		<!-- Temporary removal of outlook and google
			<li><a href="?display=calendar&amp;action=add&amp;type=google"><i class="fa fa-plus"></i> <strong><?php echo _('Add Remote Google Calendar')?></strong></a></li>
		-->
		</ul>
	</div>
</div>
<table
	data-url="ajax.php?module=calendar&amp;command=grid"
	data-toolbar="#toolbar-nav"
	data-maintain-selected="true"
	data-show-columns="true"
	data-show-toggle="true"
	data-toggle="table"
	data-pagination="true"
	data-search="true"
	id="table-rnav">
	<thead>
		<tr>
			<th data-sortable="true" data-field="name"><?php echo _("Name")?></th>
			<th data-sortable="true" data-field="type"><?php echo _("Type")?></th>
		</tr>
	</thead>
	<tbody>
	</tbody>
</table>
<script type="text/javascript">
	$("#table-rnav").on('click-row.bs.table',function(e,row,elem){
		window.location = '?display=calendar&action=view&type=calendar&id='+row['id'];
	})
</script>
