<?php 

#
#    Copyright (C) 2017 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of CQR.
#
#    CQR is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any
#    later version.
#
#    CQR is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with CQR.  If not, see <http://www.gnu.org/licenses/>.
#

$get_vars = array(
	'action' => '',
	'id_cqr' => '',
	'display' => ''
);
foreach ($get_vars as $k => $v) {
        $var[$k] = isset($_REQUEST[$k]) ? $_REQUEST[$k] : $v;
        $$k = $var[$k];//todo: legacy support, needs to GO!
}

echo load_view(dirname(__FILE__) . '/views/rnav.php', array('cqr_results' => nethcqr_get_details()) + $var);

if (!$action && !$id_cqr) {
?>
<h2><?php echo _("CQR"); ?></h2>
<br/><br/>
<a href="config.php?type=setup&display=nethcqr&action=add">
        <input type="button" value="Add a new CQR" id="new_dir">
</a>
<br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/>
<br/><br/><br/><br/><br/><br/><br/>

<?php
}


?>















