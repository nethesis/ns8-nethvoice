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

?>
<div id='toolbar-cidrnav'>
  <a href="config.php?display=outboundlookup" class="btn btn-default"><i class="fa fa-list"></i>&nbsp; <?php echo _("List Sources") ?></a>
</div>
<table data-url="ajax.php?module=outboundlookup&amp;command=getJSON&amp;jdata=grid"
  data-toolbar="#toolbar-cidrnav"
  data-cache="false"
  data-toggle="table"
  data-search="true"
  class="table" id="table-all-side">
    <thead>
        <tr>
            <th data-sortable="true" data-field="outboundlookup_id" data-formatter="outboundlookupformatter"><?php echo _('Source')?></th>
        </tr>
    </thead>
</table>
<script type="text/javascript">
  function outboundlookupformatter(v,r){
    return r['description']+'&nbsp;('+r['sourcetype']+')';
  }
  $("#table-all-side").on('click-row.bs.table',function(e,row,elem){
     console.log(row);
    window.location = '?display=outboundlookup&view=form&itemid='+row['outboundlookup_id']+'&extdisplay='+row['outboundlookup_id'];
  })
</script>
