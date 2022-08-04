<?php
/*This file is only used for legacy functionality and things that aren't in BMO.
*These functions should generally make a BMO Call if possible.
*/

function calendar_getdest($exten) {
	return array("calendargroups,$exten,1");
}

function calendar_destinations(){
	$extens = array();
	foreach(FreePBX::Calendar()->listGroups() as $id => $group){
		$extens[] = array(
			'destination' => 'calendargroups,'.$id.',1',
			'description' => sprintf(_("Calendar Group: %s"),$group['name']),
			'category' => _('Calendar Groups'),
		);
	}
	return $extens;
}


function calendar_getdestinfo($dest) {
	if (substr(trim($dest),0,14) == 'calendargroups') {
		$parts = explode(',', $dest);
		$group = FreePBX::Calendar()->getGroup($parts[1]);
		return array(
			'description' => sprintf(_("Calendar Group: %s"),$group['name']),
			'edit_url' => '?display=calendargroups&action=edit&id='.$parts[1]
		);
	} else {
		return false;
	}
}
