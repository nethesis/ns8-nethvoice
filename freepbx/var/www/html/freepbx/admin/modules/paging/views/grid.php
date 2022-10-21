<?php

    $dataurl = "ajax.php?module=paging&command=getJSON&jdata=grid";
?>
<div id="toolbar-all">
  <a href="config.php?display=paging&amp;view=form" class="btn btn-default"><i class="fa fa-plus"></i>&nbsp; <?php echo _("Add Page Group") ?></a>
</div>
 <table id="pagegrid" data-escape="true" data-url="<?php echo $dataurl?>" data-cache="false" data-toolbar="#toolbar-all" data-maintain-selected="true" data-show-columns="true" data-show-toggle="true" data-single-select="true" data-checkbox-header="false" data-select-item-name="mkdefault" data-pagination="true" data-search="true" data-toggle="table" class="table table-striped">
    <thead>
            <tr>
            <th data-field="page_group" data-sortable="true"><?php echo _("Page Group")?></th>
            <th data-field="description"><?php echo _("Description")?></th>
            <th data-field="is_default" data-formatter="defaultCheck" data-checkbox="true"><?php echo _("Default")?></th>
            <th data-field="page_group" data-formatter="linkFormatter"><?php echo _("Actions")?></th>
        </tr>
    </thead>
</table>
