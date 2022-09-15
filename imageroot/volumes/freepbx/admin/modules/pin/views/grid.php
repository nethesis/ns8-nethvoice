<?php
#
#    Copyright (C) 2019 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of Pin FreePBX module.
#
#    Pin module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    Pin module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with Pin module.  If not, see <http://www.gnu.org/licenses/>.
#

//Via action call
//$dataurl = "?display=pin&action=getJSON&jdata=grid&quietmode=1";
//Via BMO AJAX call
$dataurl = "ajax.php?module=pin&command=getJSON&jdata=grid";
?>
<table id="mygrid" data-url="<?php echo $dataurl?>" data-cache="false" data-toolbar="#toolbar-all" data-maintain-selected="true" data-show-columns="true" data-show-toggle="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
	<thead>
		<tr>
			<th data-sortable="true" data-field="extension"><?php echo _("Extension")?></th>
            <th data-field="extension" data-formatter="actionformatter"><?php echo _("Actions")?></th>
		</tr>
	</thead>
</table>
