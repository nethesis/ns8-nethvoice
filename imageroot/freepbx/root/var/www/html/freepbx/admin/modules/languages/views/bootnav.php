<div id="toolbar-langrnav">
<a href="config.php?display=languages" class="btn btn-default"><i class="fa fa-list"></i>&nbsp; <?php echo _("List Languagess") ?></a>
<a href="config.php?display=languages&view=form" class="btn btn-default" ><i class="fa fa-plus"></i>&nbsp; <?php echo _("Add Language") ?></a>
</div>
<table data-toolbar="#toolbar-langrnav" data-url="ajax.php?module=languages&amp;command=getJSON&amp;jdata=grid" data-cache="false" data-toggle="table" data-search="true" class="table" id="table-all-side">
    <thead>
        <tr>
            <th data-sortable="true" data-field="description"><?php echo _('Language')?></th>
        </tr>
    </thead>
</table>
<script type="text/javascript">
	$("#table-all-side").on('click-row.bs.table',function(e,row,elem){
		window.location = '?display=languages&view=form&extdisplay='+row['language_id'];
	})
</script>
