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

$li[] = '<a href="config.php?display='. urlencode($display) . '&action=add">' . _("Add CQR") . '</a>';

if (isset($cqr_results) && !empty($cqr_results)){
	foreach ($cqr_results as $r) {
		$r['name'] = $r['name'] ? $r['name'] : 'CQR ID: ' . $r['id_cqr'];
		$li[] = '<a id="' . ( $id_cqr == $r['id_cqr'] ? 'current' : '') 
			. '" href="config.php?display=nethcqr&amp;action=edit&amp;id_cqr=' 
			. $r['id_cqr'] . '">' 
			. $r['name'] .'</a>';
	}
}	

echo '<div class="rnav">' . ul($li) . '</div>';
