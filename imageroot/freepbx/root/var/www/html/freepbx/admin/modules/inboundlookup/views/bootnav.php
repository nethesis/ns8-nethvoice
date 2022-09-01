<?php
#
# Copyright (C) 2017 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#
?>
<div id='toolbar-cidrnav'>
  <a href="config.php?display=inboundlookup" class="btn btn-default"><i class="fa fa-list"></i>&nbsp; <?php echo _("List Sources") ?></a>
</div>
<table data-url="ajax.php?module=inboundlookup&amp;command=getJSON&amp;jdata=grid"
  data-toolbar="#toolbar-cidrnav"
  data-cache="false"
  data-toggle="table"
  data-search="true"
  class="table" id="table-all-side">
    <thead>
        <tr>
            <th data-sortable="true" data-field="inboundlookup_id" data-formatter="inboundlookupformatter"><?php echo _('Source')?></th>
        </tr>
    </thead>
</table>
<script type="text/javascript">
  function inboundlookupformatter(v,r){
    return r['description']+'&nbsp;('+r['sourcetype']+')';
  }
  $("#table-all-side").on('click-row.bs.table',function(e,row,elem){
     console.log(row);
    window.location = '?display=inboundlookup&view=form&itemid='+row['inboundlookup_id']+'&extdisplay='+row['inboundlookup_id'];
  })
</script>
