<?php

#
#    Copyright (C) 2018 Nethesis S.r.l.
#    http://www.nethesis.it - support@nethesis.it
#
#    This file is part of QueueExit FreePBX module.
#
#    QueueExit module is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or any 
#    later version.
#
#    QueueExit module is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with QueueExit module.  If not, see <http://www.gnu.org/licenses/>.
#

function queueexit_destinations() {
    global $amp_conf;
    $results = \FreePBX::Queueexit()->queueexit_get();
    if (isset($results)) {
	foreach($results as $queueexit) {
            $name .= $queueexit['displayname'];
	    $extens[] = array('destination' => 'queueexit-'.$queueexit['id'].',${EXTEN},1','description' => $name, 'category' => 'QueueExit', 'id' => $queueexit['id'],'edit_url' => 'config.php?display=queueexit&view=form&id='.$queueexit['id']);
	}
        return $extens;
    }
}

function queueexit_getdestinfo($dest) {
    global $active_modules;
    if (substr(trim($dest),0,10) == 'queueexit-') {
        $id = preg_replace('/queueexit-([0-9]*),.*/','${1}',$dest);
        return array('description' => "QueueExit", 'edit_url' => 'config.php?display=queueexit&view=form&id='.$id);
    }
    return array('description' => "QueueExit", 'edit_url' => 'config.php?display=queueexit');
}

function queueexit_get_config($engine){
    global $ext;
    global $asterisk_conf;
    switch($engine) {
        case "asterisk":
            $results = \FreePBX::Queueexit()->queueexit_get();
            $extension = '_[0-9].';
            foreach ($results as $queueexit) {
                $contextname = 'queueexit-'.$queueexit['id'];
                $ext->add($contextname, $extension, '', new ext_noop('Queue Exit'));
                $ext->add($contextname, $extension, '', new ext_noop('QUEUESTATUS = ${QUEUESTATUS}'));
                $ext->add($contextname, $extension, '', new ext_set('queuenum', '${EXTEN}'));
                $ext->add($contextname, $extension, '', new ext_goto('1','s-${QUEUESTATUS}'));
                $ext->add($contextname, $extension, '', new ext_macro('hangupcall'));

                $ext->add($contextname, 's-TIMEOUT', '', new ext_noop('Queue TIMEOUT'));
                $goto_timeout = strtok($queueexit['timeout_destination'],',');
                $goto_timeout_exten = strtok(',');
                $goto_timeout_pri = strtok(',');
                $ext->add($contextname, 's-TIMEOUT', '', new ext_goto($goto_timeout_pri,$goto_timeout_exten,$goto_timeout));

                $ext->add($contextname, 's-FULL', '', new ext_noop('Queue FULL'));
                $ext->add($contextname, 's-FULL', '', new ext_queuelog('${queuenum}','${UNIQUEID}','NONE','${QUEUESTATUS}','${CALLERID(num)}|${CALLERID(num)}'));
                $goto_full = strtok($queueexit['full_destination'],',');
                $goto_full_exten = strtok(',');
                $goto_full_pri = strtok(',');
                $ext->add($contextname, 's-FULL', '', new ext_goto($goto_full_pri,$goto_full_exten,$goto_full));

                $ext->add($contextname, 's-JOINEMPTY', '', new ext_noop('Queue JOINEMPTY'));
                $ext->add($contextname, 's-JOINEMPTY', '', new ext_queuelog('${queuenum}','${UNIQUEID}','NONE','${QUEUESTATUS}','${CALLERID(num)}|${CALLERID(num)}'));
                $goto_joinempty = strtok($queueexit['joinempty_destination'],',');
                $goto_joinempty_exten = strtok(',');
                $goto_joinempty_pri = strtok(',');
                $ext->add($contextname, 's-JOINEMPTY', '', new ext_goto($goto_joinempty_pri,$goto_joinempty_exten,$goto_joinempty));

                $ext->add($contextname, 's-LEAVEEMPTY', '', new ext_noop('Queue LEAVEEMPTY'));
                $goto_leaveempty = strtok($queueexit['leaveempty_destination'],',');
                $goto_leaveempty_exten = strtok(',');
                $goto_leaveempty_pri = strtok(',');
                $ext->add($contextname, 's-LEAVEEMPTY', '', new ext_goto($goto_leaveempty_pri,$goto_leaveempty_exten,$goto_leaveempty));

                $ext->add($contextname, 's-JOINUNAVAIL', '', new ext_noop('Queue JOINUNAVAIL'));
                $ext->add($contextname, 's-JOINUNAVAIL', '', new ext_queuelog('${queuenum}','${UNIQUEID}','NONE','${QUEUESTATUS}','${CALLERID(num)}|${CALLERID(num)}'));
                $goto_joinunavail = strtok($queueexit['joinunavail_destination'],',');
                $goto_joinunavail_exten = strtok(',');
                $goto_joinunavail_pri = strtok(',');
                $ext->add($contextname, 's-JOINUNAVAIL', '', new ext_goto($goto_joinunavail_pri,$goto_joinunavail_exten,$goto_joinunavail));

                $ext->add($contextname, 's-LEAVEUNAVAIL', '', new ext_noop('Queue LEAVEUNAVAIL'));
                $goto_leaveunavail = strtok($queueexit['leaveunavail_destination'],',');
                $goto_leaveunavail_exten = strtok(',');
                $goto_leaveunavail_pri = strtok(',');
                $ext->add($contextname, 's-LEAVEUNAVAIL', '', new ext_goto($goto_leaveunavail_pri,$goto_leaveunavail_exten,$goto_leaveunavail));

                $ext->add($contextname, 's-CONTINUE', '', new ext_noop('Queue CONTINUE'));
                $goto_continue = strtok($queueexit['continue_destination'],',');
                $goto_continue_exten = strtok(',');
                $goto_continue_pri = strtok(',');
                $ext->add($contextname, 's-CONTINUE', '', new ext_goto($goto_continue_pri,$goto_continue_exten,$goto_continue));

                $ext->add($contextname, 's-', '', new ext_macro('hangupcall'));

                $ext->add($contextname, '_s-.', '', new ext_macro('hangupcall'));

                $ext->add($contextname, 'h', '', new ext_macro('hangupcall'));
            }
        break;
    }
}

function queueexit_get_details($id) {
    $dbh = FreePBX::Database();
    $sql = 'SELECT * FROM queueexit WHERE id = ?';
    $sth = $dbh->prepare($sql);
    $sth->execute(array($id));
    $res = $sth->fetchAll()[0];
    return $res;
}

