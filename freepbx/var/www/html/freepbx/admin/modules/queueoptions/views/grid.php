<?php
#
#    Copyright (C) 2019 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of QueueOptions FreePBX module.
#
#    QueueOptions module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    QueueOptions module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with QueueOptions module.  If not, see <http://www.gnu.org/licenses/>.
#

//Via action call
//$dataurl = "?display=queueoptions&action=getJSON&jdata=grid&quietmode=1";
//Via BMO AJAX call
$dataurl = "ajax.php?module=queueoptions&command=getJSON&jdata=grid";
?>
<script type="text/javascript">
var destinations = <?php echo json_encode(FreePBX::Modules()->getDestinations())?>;

function destFormatter(value){
        if(value === null || value.length == 0){
                return _("No Destination");
        }else{
                if(typeof destinations[value] !== "undefined") {
                        var prefix = destinations[value].name;
                        if(typeof destinations[value].category !== "undefined"){
                                prefix = destinations[value].category;
                        }
                        if(typeof destinations[value].edit_url !== "undefined" && destinations[value].edit_url !== false) {
                                return '<a href="' + destinations[value].edit_url + '">' + prefix + ": " + destinations[value].description + '</a>';
                        } else {
                                return prefix + ": " + destinations[value].description;
                        }
                } else {
                        return value;
                }
        }
}
</script>

<table id="mygrid" data-url="<?php echo $dataurl?>" data-cache="false" data-toolbar="#toolbar-all" data-maintain-selected="true" data-show-columns="true" data-show-toggle="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
	<thead>
		<tr>
			<th data-sortable="true" data-field="name"><?php echo _("Queue Options")?></th>
            <th data-field="dest" data-formatter="destFormatter" ><?php echo _("Destination")?></th>
            <th data-field="id" data-formatter="actionformatter"><?php echo _("Actions")?></th>
		</tr>
	</thead>
</table>
