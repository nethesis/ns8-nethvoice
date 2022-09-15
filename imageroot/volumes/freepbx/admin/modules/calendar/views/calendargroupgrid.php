<?php
$dataurl = "ajax.php?module=calendar&command=groupsgrid";
?>
<div class="panel panel-info">
	<div class="panel-heading">
		<div class="panel-title">
			<a href="#" data-toggle="collapse" data-target="#moreinfo"><i class="glyphicon glyphicon-info-sign"></i></a> <?php echo _("What are Calendar Event Groups?")?></div>
	</div>
	<!--At some point we can probably kill this... Maybe make is a 1 time panel that may be dismissed-->
	<div class="panel-body collapse" id="moreinfo">
		<p><?php echo _("Calendar event groups are a collection of calendars, events or categories from the Calendar Module.") ."<br>". _("Multiple calendars, events and/or categories can be placed into separate groups. Even multiple events from different calendars can be placed into a single group!") ."<br>". _("These groups can then be linked to various applications or utilities")?></p>
	</div>
</div>
<div id="toolbar-all">
	<a href='?display=calendar' class="btn btn-default"><i class='fa fa-calendar'></i>&nbsp;<?php echo _("View Calendars")?></a>
	<a href='?display=calendargroups&amp;action=add' class="btn btn-default"><i class='fa fa-plus'></i>&nbsp;<?php echo _("Add Group")?></a>
</div>
 <table id="mygrid"
				data-url="<?php echo $dataurl?>"
				data-cache="false"
				data-cookie="true"
				data-cookie-id-table="calendargroups-grid"
				data-toolbar="#toolbar-all"
				data-maintain-selected="true"
				data-show-columns="true"
				data-show-toggle="true"
				data-toggle="table"
				data-pagination="true"
				data-search="true"
				class="table table-striped">
		<thead>
				<tr>
						<th data-field="name"><?php echo _("Group")?></th>
						<th data-field="id" data-formatter="linkFormatter"><?php echo _("Actions")?></th>
				</tr>
		</thead>
</table>
<script>
function linkFormatter(value, row, index){
	var html = '<a href="?display=calendargroups&action=edit&id='+value+'"><i class="fa fa-pencil"></i></a>';
	html += '&nbsp;<a href="?display=calendargroups&action=delete&id='+value+'" class="delAction"><i class="fa fa-trash"></i></a>';
	return html;
}
</script>
