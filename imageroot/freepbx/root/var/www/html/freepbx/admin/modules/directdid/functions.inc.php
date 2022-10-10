<?php

#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of DirectDID FreePBX module.
#
#    DirectDID module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    DirectDID module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with DirectDID module.  If not, see <http://www.gnu.org/licenses/>.
#

function directdid_destinations() {
    global $amp_conf;
    $results = \FreePBX::Directdid()->directdid_get();
    if (isset($results)) {
	foreach($results as $did) {
            $x = '';
            $name = $did['root'];
            for ($i = 0; $i < $did['varlength']; $i++) {
                $x .= 'X';
            }
            $name .= $x.' -> '.$did['prefix'].$x;
	    $extens[] = array('destination' => 'directdid-'.$did['id'].',${EXTEN},1','description' => $name, 'category' => 'DirectDID', 'id' => $did['id'],'edit_url' => 'config.php?display=directdid&view=form&id='.$did['id']);
	}
        return $extens;
    }
}

function directdid_getdestinfo($dest) {
    global $active_modules;
    if (substr(trim($dest),0,10) == 'directdid-') {
        $id = preg_replace('/directdid-([0-9]*),.*/','${1}',$dest);
        return array('description' => "DirectDID", 'edit_url' => 'config.php?display=directdid&view=form&id='.$id);
    }
    return array('description' => "DirectDID", 'edit_url' => 'config.php?display=directdid');
}

function directdid_get_config($engine){
    global $ext;
    global $asterisk_conf;
    switch($engine) {
        case "asterisk":
            $results = \FreePBX::Directdid()->directdid_get();
            $extension = '_!XXX.';
            $extension2 = '_X.';
            foreach ($results as $did) {
                $contextname = 'directdid-'.$did['id'];
                $ext->add($contextname, $extension, '', new ext_answer());
                $ext->add($contextname, $extension, '', new ext_playtones('ring'));
                $ext->add($contextname, $extension, '', new ext_progress());
                $ext->add($contextname, $extension, '', new ext_macro('user-callerid'));
                $ext->add($contextname, $extension, '', new ext_noop('${EXTEN}'));
		$ext->add($contextname, $extension, '', new ext_goto('directdid-'.$did['id'].'-call,'.$did['prefix'].'${FROM_DID:-'.$did['varlength'].'},1'));

                $contextname2 = 'directdid-'.$did['id'].'-call';
                $ext->add($contextname2, $extension2, '', new ext_set('CDR(dst_cnam)','${DB(AMPUSER/${EXTEN}/cidname)}'));
                $ext->add($contextname2, $extension2, '', new ext_set('__PICKUPMARK','${EXTEN}'));
                $ext->add($contextname2, $extension2, '', new ext_macro('dial-one',$did['timeout'].',${DIAL_OPTIONS},${EXTEN}'));
                $ext->add($contextname2, $extension2, '', new ext_gotoif('$["${DIALSTATUS}" = "NOANSWER"]',$did['timeout_destination']));
                $ext->add($contextname2, $extension2, '', new ext_gotoif('$["${DIALSTATUS}" = "BUSY"]',$did['busy_destination']));
                $ext->add($contextname2, $extension2, '', new ext_gotoif('$["${DIALSTATUS}" = "CHANUNAVAIL"]',$did['unavailable_destination']));
            }
        break;
    }
}

function directdid_get_details($id) {
    $dbh = FreePBX::Database();
    $sql = 'SELECT * FROM directdid WHERE id = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($id));
    $res = $sth->fetchAll()[0];
    return $res;
}







