<div id="toolbar-qrnav">
  <a href="config.php?display=queues" class="btn btn-default"><i class="fa fa-list"></i>&nbsp; <?php echo _("List Queues") ?></a>
  <a href="config.php?display=queues&amp;view=form" class="btn btn-primary"><i class="fa fa-plus"></i> <?php echo _("Add Queue") ?></a>

</div>
<table data-url="ajax.php?module=queues&amp;command=getJSON&amp;jdata=grid" data-escape="true" data-toolbar="#toolbar-qrnav" data-cache="false" data-toggle="table" data-search="true" class="table" id="table-all-side">
    <thead>
        <tr>
            <th data-sortable="true" data-field="extension"><?php echo _('Queue')?></th>
            <th data-sortable="true" data-field="description"><?php echo _("Description")?></th>
        </tr>
    </thead>
</table>
<script type="text/javascript">
  $("#table-all-side").on('click-row.bs.table',function(e,row,elem){
    window.location = '?display=queues&view=form&extdisplay='+row['extension'];
  })
</script>
