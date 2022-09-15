<?php
//Copyright (C) nethesis srl. (info@nethesis.it)
//
//This program is free software; you can redistribute it and/or
//modify it under the terms of the GNU General Public License
//as published by the Free Software Foundation; either version 2
//of the License, or (at your option) any later version.
//
//This program is distributed in the hope that it will be useful,
//but WITHOUT ANY WARRANTY; without even the implied warranty of
//MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//GNU General Public License for more details.

$cidsources = cidlookup_list();
$srow = "";
foreach ($cidsources as $source) {
    if($source['sourcetype'] === null){
      continue;
    }
    $srow .= '<tr>';
    $srow .= '<td>'.$source['description'].'</td>';
    $srow .= '<td>';
    if ($source['sourcetype'] == 'opencnam') {
        $srow .= 'OpenCNAM';
    } else {
        $srow .= $source['sourcetype'];
    }
    $srow .= '</td>';
    $srow .= '<td><a href="?display=cidlookup&view=form&itemid='.$source['cidlookup_id'].'&amp;extdisplay='.$source['cidlookup_id'].'"><i class="fa fa-edit"></i></a>';
    $srow .= '&nbsp;';
    $srow .= '<a href="config.php?display=cidlookup&view=form&amp;itemid='.$source['cidlookup_id'].'&amp;action=delete"><i class="fa fa-trash"></i></a>';
    $srow .= '</td></tr>';
}
?>
<div id="toolbar-all">
  <a href="config.php?display=cidlookup&amp;view=form" class="btn btn-default" ><i class="fa fa-plus"></i>&nbsp; <?php echo _("Add CIDLookup Source") ?></a>

</div>
<table id="cidlookupgrid"
        data-cache="false"
        data-toolbar="#toolbar-all"
        data-toggle="table"
        data-pagination="true"
        data-search="true"
        class="table table-striped">
<thead>
    <tr>
        <th data-sortable="true"><?php echo _("Description")?></th>
        <th data-sortable="true"><?php echo _("Type")?></th>
        <th><?php echo _("Actions")?></th>
    </tr>
</thead>
<tbody>
    <?php echo $srow ?>
</tbody>
</table>
