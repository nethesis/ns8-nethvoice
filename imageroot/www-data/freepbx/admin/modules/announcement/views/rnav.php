<div id="toolbar-all">
	<a href="?display=announcement" class="btn btn-default"><i class="fa fa-list"></i> <?php echo _("List Announcements")?></a>
	<a href="?display=announcement&amp;view=form" class="btn btn-default"><i class="fa fa-plus"></i> <?php echo _("Add Announcements")?></a>
</div>
 <table id="announcegrid-side" data-url="ajax.php?module=announcement&amp;command=getJSON&amp;jdata=grid" data-cache="false" data-toolbar="#toolbar-all" data-toggle="table" data-search="true" class="table">
    <thead>
        <tr>
            <th data-field="description" data-sortable="true"><?php echo _("Destinations")?></th>
        </tr>
    </thead>
</table>
